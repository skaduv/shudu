"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Crown, LogOut, Play, UserRoundCheck, UsersRound } from "lucide-react";
import { GButton, Panel } from "@/components/app/panel";
import { LEVEL_NAME } from "@/lib/sudoku/types";
import {
  ROOM_PLAYER_COLORS,
  type RoomConnectionState,
  type RoomGame,
  type RoomMessage,
  type RoomMessageKind,
  type RoomPlayer,
} from "@/lib/room/types";
import { RoomChatButton } from "./room-chat";
import { RoomConnectionBadge } from "./room-connection";

interface RoomLobbyProps {
  room: RoomGame;
  players: RoomPlayer[];
  userId: string;
  connectionState: RoomConnectionState;
  latencyMs: number | null;
  busy: boolean;
  error: string | null;
  notice: string | null;
  messages: RoomMessage[];
  messagesLoaded: boolean;
  onSendMessage: (content: string, kind: RoomMessageKind) => Promise<void>;
  onCopy: () => void;
  onReady: () => void;
  onStart: () => void;
  onLeave: () => void;
}

export function RoomLobby({
  room,
  players,
  userId,
  connectionState,
  latencyMs,
  busy,
  error,
  notice,
  messages,
  messagesLoaded,
  onSendMessage,
  onCopy,
  onReady,
  onStart,
  onLeave,
}: RoomLobbyProps) {
  const [now, setNow] = useState(() => Date.now());
  const isHost = room.host_id === userId;
  const me = players.find((player) => player.user_id === userId);
  const guests = players.filter((player) => player.user_id !== room.host_id);
  const allReady = guests.length > 0 && guests.every((player) => player.is_ready);
  const canStart = isHost && players.length >= 2 && allReady;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <main className="safe-b room-shell mx-auto flex w-full max-w-[780px] flex-col gap-4 px-3 pb-10 pt-4">
      <Panel radius={28} className="overflow-hidden p-5 sm:p-7" tint={0.35}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[13px] font-medium text-[var(--ink-soft)]">房间码</div>
            <button
              type="button"
              onClick={onCopy}
              className="num mt-1 flex items-center gap-2 text-[34px] font-bold tracking-[0.16em] transition-opacity active:opacity-60"
              aria-label="复制房间邀请链接"
            >
              {room.code}
              <Copy className="size-4 tracking-normal text-[var(--ink-soft)]" />
            </button>
            <RoomConnectionBadge className="mt-2" state={connectionState} latencyMs={latencyMs} />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <RoomChatButton
              players={players}
              messages={messages}
              messagesLoaded={messagesLoaded}
              userId={userId}
              onSend={onSendMessage}
            />
            <GButton variant="capsule" size={40} onClick={onCopy}>
              <Copy className="size-4" /> 复制邀请
            </GButton>
            <GButton size={40} aria-label="离开房间" onClick={onLeave} disabled={busy}>
              <LogOut className="size-4" />
            </GButton>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2 text-[12px] text-[var(--ink-soft)]">
          <span className="rounded-full bg-black/5 px-3 py-1.5 dark:bg-white/10">{LEVEL_NAME[room.difficulty]}</span>
          <span className="rounded-full bg-black/5 px-3 py-1.5 dark:bg-white/10">{players.length}/6 人</span>
          <span className="rounded-full bg-black/5 px-3 py-1.5 dark:bg-white/10">24 小时内有效</span>
        </div>
      </Panel>

      <Panel radius={26} className="p-5 sm:p-6">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[17px] font-semibold">
            <UsersRound className="size-5 text-[#5b6cff]" />
            等待大厅
          </div>
          <span className="text-[12px] text-[var(--ink-soft)]">{players.length < 2 ? "至少 2 人开局" : "全员准备后可开始"}</span>
        </div>
        <ul className="divide-y divide-black/5 dark:divide-white/10">
          {players.map((player) => {
            const online = now - Date.parse(player.last_seen_at) < 45_000;
            const isMe = player.user_id === userId;
            const isRoomHost = player.user_id === room.host_id;
            const color = ROOM_PLAYER_COLORS[player.color_index] ?? ROOM_PLAYER_COLORS[0];
            return (
              <li key={player.user_id} className="flex items-center gap-3 py-3">
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[13px] font-bold text-white"
                  style={{ background: color }}
                >
                  {Array.from(player.nickname)[0] ?? "?"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[15px] font-medium">
                    <span className="truncate">{player.nickname}</span>
                    {isMe ? <span className="text-[11px] text-[var(--ink-soft)]">你</span> : null}
                    {isRoomHost ? <Crown className="size-3.5 text-[#ff9f0a]" aria-label="房主" /> : null}
                  </div>
                  <div className="text-[11px] text-[var(--ink-soft)]">{online ? "在线" : "暂时离线"}</div>
                </div>
                {isRoomHost ? (
                  <span className="text-[12px] font-medium text-[#ff9f0a]">房主</span>
                ) : player.is_ready ? (
                  <span className="flex items-center gap-1 text-[12px] font-medium text-[#30b85a]"><Check className="size-3.5" />已准备</span>
                ) : (
                  <span className="text-[12px] text-[var(--ink-soft)]">未准备</span>
                )}
              </li>
            );
          })}
        </ul>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          {isHost ? (
            <GButton
              variant="capsule"
              size={48}
              active
              disabled={!canStart || busy}
              onClick={onStart}
              className="flex-1"
            >
              <Play className="size-4" />
              {busy ? "正在开局…" : players.length < 2 ? "等待朋友加入" : !allReady ? "等待全员准备" : "开始协作对局"}
            </GButton>
          ) : (
            <GButton
              variant="capsule"
              size={48}
              active={!me?.is_ready}
              disabled={busy}
              onClick={onReady}
              className="flex-1"
            >
              <UserRoundCheck className="size-4" />
              {me?.is_ready ? "取消准备" : "我准备好了"}
            </GButton>
          )}
          <GButton variant="capsule" size={48} disabled={busy} onClick={onLeave}>
            <LogOut className="size-4" /> 离开
          </GButton>
        </div>
        {notice ? <p className="mt-3 text-center text-[13px] text-[#30b85a]">{notice}</p> : null}
        {error ? <p role="alert" className="mt-3 text-center text-[13px] text-[var(--error)]">{error}</p> : null}
      </Panel>
    </main>
  );
}
