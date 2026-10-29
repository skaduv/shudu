"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Copy, Eraser, LogOut, PencilLine, RefreshCw, Trophy, UsersRound } from "lucide-react";
import { Board } from "@/components/game/board";
import { GButton, Panel } from "@/components/app/panel";
import { applyOnlineChanges, friendlyRoomError, reloadRoom } from "@/lib/room/api";
import {
  ROOM_PLAYER_COLORS,
  type RoomChange,
  type RoomConnectionState,
  type RoomGame,
  type RoomMemberPresence,
  type RoomMessage,
  type RoomMessageKind,
  type RoomPlayer,
} from "@/lib/room/types";
import { BOX, COL, ROW, bit, conflicts } from "@/lib/sudoku/core";
import { LEVEL_NAME } from "@/lib/sudoku/types";
import { useGame } from "@/lib/store/game";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RoomChatButton } from "./room-chat";
import { RoomConnectionBadge } from "./room-connection";
import { RoomScoreboard } from "./room-scoreboard";

interface RoomGameProps {
  room: RoomGame;
  players: RoomPlayer[];
  userId: string;
  presence: RoomMemberPresence[];
  connectionState: RoomConnectionState;
  latencyMs: number | null;
  busy: boolean;
  error: string | null;
  notice: string | null;
  messages: RoomMessage[];
  messagesLoaded: boolean;
  onSendMessage: (content: string, kind: RoomMessageKind) => Promise<void>;
  onRoomUpdate: (room: RoomGame) => void;
  onCursor: (cell: number | null) => void;
  onCopy: () => void;
  onLeave: () => void;
  onRematch: () => void;
}

export function RoomGame({
  room,
  players,
  userId,
  presence,
  connectionState,
  latencyMs,
  busy,
  error,
  notice,
  messages,
  messagesLoaded,
  onSendMessage,
  onRoomUpdate,
  onCursor,
  onCopy,
  onLeave,
  onRematch,
}: RoomGameProps) {
  const settings = useGame((state) => state.settings);
  const [sel, setSel] = useState<number | null>(null);
  const [noteMode, setNoteMode] = useState(false);
  const [activeDigit, setActiveDigit] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const puzzle = room.puzzle_data;
  const won = room.status === "won";
  const isHost = room.host_id === userId;
  const playerColors = useMemo(
    () => Object.fromEntries(players.map((player) => [player.user_id, ROOM_PLAYER_COLORS[player.color_index] ?? ROOM_PLAYER_COLORS[0]])),
    [players]
  );
  const cursors = useMemo(
    () =>
      presence
        .filter((item) => item.user_id !== userId && item.active_cell != null)
        .map((item) => ({
          cell: item.active_cell as number,
          color: ROOM_PLAYER_COLORS[item.color_index] ?? ROOM_PLAYER_COLORS[0],
          nickname: item.nickname,
        })),
    [presence, userId]
  );

  useEffect(() => {
    setSel(null);
    setActiveDigit(0);
    onCursor(null);
  }, [puzzle?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (won) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [won]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const applyChanges = useCallback(
    async (changes: RoomChange[]) => {
      if (!changes.length || submitting || won) return;
      setSubmitting(true);
      try {
        const next = await applyOnlineChanges(room.id, changes, room.version);
        onRoomUpdate(next);
      } catch (cause) {
        const message = friendlyRoomError(cause);
        setToast(message);
        try {
          onRoomUpdate(await reloadRoom(room.id));
        } catch {
          // The next realtime event or heartbeat will retry the snapshot.
        }
      } finally {
        setSubmitting(false);
      }
    },
    [room.id, room.version, submitting, won, onRoomUpdate]
  );

  const placeDigit = useCallback(
    (digit: number, asNote = noteMode) => {
      if (!puzzle || sel == null || won || submitting) return;
      if (puzzle.givens[sel] !== "0") return;

      const changes: RoomChange[] = [];
      if (asNote) {
        changes.push({ i: sel, v: 0, n: room.notes[sel] ^ bit(digit) });
      } else {
        const value = room.values[sel] === digit ? 0 : digit;
        changes.push({ i: sel, v: value, n: 0 });
        if (value && settings.autoClearNotes) {
          for (const peer of candidatesPeers(sel)) {
            if (puzzle.givens[peer] === "0" && (room.notes[peer] & bit(digit))) {
              changes.push({ i: peer, v: room.values[peer], n: room.notes[peer] & ~bit(digit) });
            }
          }
        }
      }
      void applyChanges(changes);
      if (settings.haptics) navigator.vibrate?.(8);
    },
    [puzzle, sel, won, submitting, noteMode, room.notes, room.values, settings.autoClearNotes, settings.haptics, applyChanges]
  );

  const onDigit = useCallback(
    (digit: number) => {
      if (settings.inputMode === "digit" && sel == null) {
        setActiveDigit((current) => current === digit ? 0 : digit);
        return;
      }
      if (sel == null) {
        setActiveDigit((current) => current === digit ? 0 : digit);
        return;
      }
      placeDigit(digit);
    },
    [settings.inputMode, sel, placeDigit]
  );

  const onTap = useCallback(
    (cell: number) => {
      setSel(cell);
      onCursor(cell);
      if (settings.inputMode === "digit" && activeDigit && puzzle?.givens[cell] === "0") {
        placeDigit(activeDigit);
      }
    },
    [activeDigit, onCursor, placeDigit, puzzle?.givens, settings.inputMode]
  );

  const erase = useCallback(() => {
    if (sel == null || won || submitting || puzzle?.givens[sel] !== "0") return;
    void applyChanges([{ i: sel, v: 0, n: 0 }]);
  }, [sel, won, submitting, puzzle?.givens, applyChanges]);

  const leaveSelection = useCallback(() => {
    setSel(null);
    setActiveDigit(0);
    onCursor(null);
  }, [onCursor]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;
      if (/^[1-9]$/.test(event.key)) {
        event.preventDefault();
        if (sel == null) setActiveDigit(Number(event.key));
        else placeDigit(Number(event.key), event.shiftKey || event.altKey ? !noteMode : noteMode);
        return;
      }
      const move = (dr: number, dc: number) => {
        event.preventDefault();
        const current = sel ?? 40;
        const row = (ROW(current) + dr + 9) % 9;
        const col = (COL(current) + dc + 9) % 9;
        const next = row * 9 + col;
        setSel(next);
        onCursor(next);
      };

      switch (event.key) {
        case "ArrowUp": case "w": case "W": return move(-1, 0);
        case "ArrowDown": case "s": case "S": return move(1, 0);
        case "ArrowLeft": case "a": case "A": return move(0, -1);
        case "ArrowRight": case "d": case "D": return move(0, 1);
        case "Backspace": case "Delete": case "0": event.preventDefault(); return erase();
        case "n": case "N": return setNoteMode((current) => !current);
        case "Escape": return leaveSelection();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sel, placeDigit, noteMode, erase, leaveSelection, onCursor]);

  const errors = useMemo(() => {
    const next = new Set<number>();
    if (!puzzle || settings.mistakeMode === "off") return next;
    for (const cell of conflicts(room.values)) next.add(cell);
    if (settings.mistakeMode === "instant") {
      room.values.forEach((value, cell) => {
        if (value && puzzle.givens[cell] === "0" && String(value) !== puzzle.solution[cell]) next.add(cell);
      });
    }
    return next;
  }, [puzzle, room.values, settings.mistakeMode]);

  const counts = useMemo(() => {
    const next = new Array(10).fill(0);
    room.values.forEach((value) => { if (value) next[value] += 1; });
    return next;
  }, [room.values]);

  const progress = useMemo(() => {
    if (!puzzle) return 0;
    const empty = puzzle.givens.split("").filter((cell) => cell === "0").length;
    const filled = room.values.filter((value, cell) => value && puzzle.givens[cell] === "0").length;
    return empty ? Math.round((filled / empty) * 100) : 100;
  }, [puzzle, room.values]);

  const elapsed = won
    ? room.elapsed_ms
    : room.started_at
      ? Math.max(0, now - Date.parse(room.started_at))
      : 0;

  if (!puzzle) {
    return <div className="flex justify-center pt-24 text-[var(--ink-soft)]">正在载入协作棋盘…</div>;
  }

  const focusDigit = (sel != null && room.values[sel]) || activeDigit;
  const toolbar = [
    { label: "擦除", icon: Eraser, onClick: erase, disabled: sel == null || won || puzzle.givens[sel ?? 0] !== "0" },
    { label: noteMode ? "笔记 开" : "笔记", icon: PencilLine, onClick: () => setNoteMode((current) => !current), active: noteMode, disabled: won },
    { label: "邀请", icon: Copy, onClick: onCopy },
    { label: "离开", icon: LogOut, onClick: onLeave },
  ];

  return (
    <main className="play-wrap safe-b">
      <div className="board-box">
        <Panel radius={22} className="p-1.5 sm:p-2" tint={Math.max(0.6, settings.tint)}>
          <Board
            values={room.values}
            notes={room.notes}
            givens={puzzle.givens}
            sel={sel}
            focusDigit={focusDigit}
            errors={errors}
            hintCells={[]}
            highlightPeers={settings.highlightPeers}
            highlightSame={settings.highlightSame}
            won={won}
            onTap={onTap}
            owners={room.owners}
            playerColors={playerColors}
            cursors={cursors}
          />
        </Panel>
      </div>

      <div className="side">
        <Panel radius={22} className="room-status-card px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[15px] font-semibold">
                <UsersRound className="size-4 text-[#5b6cff]" />
                房间 {room.code}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[var(--ink-soft)]">
                <span>{LEVEL_NAME[room.difficulty]} · {progress}%</span>
                <span className="opacity-45">·</span>
                <span>{players.length} 人协作</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="num min-w-[54px] text-right text-[21px] font-semibold tabular-nums">{formatTime(elapsed)}</div>
              <RoomChatButton
                players={players}
                messages={messages}
                messagesLoaded={messagesLoaded}
                userId={userId}
                onSend={onSendMessage}
              />
              <GButton size={38} aria-label="复制邀请" onClick={onCopy}><Copy className="size-[17px]" /></GButton>
            </div>
          </div>
          <RoomConnectionBadge className="mt-2.5" state={connectionState} latencyMs={latencyMs} />
        </Panel>

        <RoomScoreboard room={room} players={players} userId={userId} compact />

        {won ? (
          <Panel radius={20} className="p-4" tint={0.8}>
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[linear-gradient(180deg,#ffd24d,#ff9f0a)] text-white shadow-lg">
                <Trophy className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[16px] font-semibold">一起完成了！</div>
                <div className="num text-[12px] text-[var(--ink-soft)]">用时 {formatTime(room.elapsed_ms)}</div>
              </div>
              {isHost ? (
                <GButton variant="capsule" size={40} active disabled={busy} onClick={onRematch}>
                  <RefreshCw className="size-4" /> 再来一局
                </GButton>
              ) : (
                <span className="flex items-center gap-1 text-[12px] text-[var(--ink-soft)]"><CheckCircle2 className="size-4 text-[#30b85a]" />等待房主</span>
              )}
            </div>
          </Panel>
        ) : null}

        <Panel radius={22} className="px-2 py-1.5">
          <div className="grid grid-cols-4 gap-1">
            {toolbar.map((button) => (
              <button
                key={button.label}
                type="button"
                onClick={button.onClick}
                disabled={button.disabled}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-2xl py-2 text-[12px] font-medium transition-[background-color,scale] active:scale-95 disabled:opacity-35",
                  button.active ? "bg-[var(--color-accent)] text-white" : "text-[var(--ink)] hover:bg-black/5 dark:hover:bg-white/10"
                )}
              >
                <button.icon className="size-[21px]" strokeWidth={1.8} />
                {button.label}
              </button>
            ))}
          </div>
        </Panel>

        <div className="pad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
            <Panel key={digit} flat radius={18} className={cn("key transition-opacity", settings.hideCompletedDigits && counts[digit] >= 9 && "pointer-events-none opacity-0")}>
              <button
                type="button"
                disabled={won || submitting}
                aria-label={`数字 ${digit}，还剩 ${9 - counts[digit]} 个`}
                onClick={() => onDigit(digit)}
                className={cn(
                  "num flex h-full w-full flex-col items-center justify-center rounded-[inherit] text-[clamp(22px,6.5vw,34px)] font-medium leading-none transition-[scale] active:scale-90 disabled:opacity-40",
                  activeDigit === digit ? "bg-[var(--color-accent)] text-white" : noteMode ? "text-[var(--ink-soft)]" : "text-[var(--user-ink)]"
                )}
              >
                {digit}
                <span className="mt-0.5 text-[10px] opacity-60">{counts[digit] < 9 ? 9 - counts[digit] : ""}</span>
              </button>
            </Panel>
          ))}
        </div>
        <p className="text-center text-[12px] text-[var(--ink-soft)]">
          {submitting ? "正在同步…" : "落子底部颜色表示归属 · 红色数字表示错误"}
        </p>
        {notice ? <p className="text-center text-[12px] text-[#30b85a]">{notice}</p> : null}
        {error ? <p role="alert" className="text-center text-[12px] text-[var(--error)]">{error}</p> : null}
      </div>

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <Panel radius={20} className="px-4 py-2.5 text-[14px]" tint={0.85}>{toast}</Panel>
        </div>
      ) : null}
    </main>
  );
}

function candidatesPeers(cell: number) {
  const peers = new Set<number>();
  for (let i = 0; i < 81; i += 1) {
    if (i !== cell && (ROW(i) === ROW(cell) || COL(i) === COL(cell) || BOX(i) === BOX(cell))) {
      peers.add(i);
    }
  }
  return peers;
}
