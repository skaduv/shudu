"use client";

import { CircleCheck, CircleX, Crown, Trophy } from "lucide-react";
import { Panel } from "@/components/app/panel";
import {
  ROOM_PLAYER_COLORS,
  type RoomGame,
  type RoomPlayer,
} from "@/lib/room/types";
import { cn } from "@/lib/utils";

export function RoomScoreboard({
  room,
  players,
  userId,
  compact = false,
}: {
  room: RoomGame;
  players: RoomPlayer[];
  userId: string;
  compact?: boolean;
}) {
  const ranked = [...players].sort((a, b) => (
    b.score - a.score
    || b.correct_moves - a.correct_moves
    || a.mistakes - b.mistakes
    || Date.parse(a.joined_at) - Date.parse(b.joined_at)
  ));
  const leaderScore = ranked[0]?.score ?? 0;

  return (
    <Panel radius={compact ? 20 : 24} className={cn("overflow-hidden", compact ? "p-3" : "p-4")}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[15px] font-semibold">
          <span className="grid size-7 place-items-center rounded-xl bg-[#ffb020]/15 text-[#e58e00]">
            <Trophy className="size-4" />
          </span>
          本局计分
        </div>
        <span className="text-[10px] text-[var(--ink-soft)]">正确 +10 · 错误 −4</span>
      </div>

      <ol className={cn("mt-2.5 space-y-1", compact && "mt-2")}>
        {ranked.map((player, index) => {
          const color = ROOM_PLAYER_COLORS[player.color_index] ?? ROOM_PLAYER_COLORS[0];
          const isLeader = leaderScore > 0 && player.score === leaderScore;
          const isMe = player.user_id === userId;
          return (
            <li
              key={player.user_id}
              className={cn(
                "grid grid-cols-[20px_28px_minmax(0,1fr)_auto] items-center gap-2 rounded-xl px-1.5 py-1.5",
                isMe && "bg-[var(--hl-peer)]"
              )}
            >
              <span className={cn("num text-center text-[11px] font-semibold", index === 0 ? "text-[#e58e00]" : "text-[var(--ink-soft)]")}>
                {index + 1}
              </span>
              <span
                className="grid size-7 place-items-center rounded-full text-[11px] font-bold text-white shadow-sm"
                style={{ background: color }}
                aria-hidden="true"
              >
                {Array.from(player.nickname)[0] ?? "?"}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1 text-[12px] font-medium">
                  <span className="truncate">{player.nickname}</span>
                  {player.user_id === room.host_id ? <Crown className="size-3 shrink-0 text-[#ff9f0a]" /> : null}
                  {isLeader ? <Trophy className="size-3 shrink-0 text-[#ffb020]" /> : null}
                  {isMe ? <span className="shrink-0 text-[10px] text-[var(--ink-soft)]">你</span> : null}
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-[var(--ink-soft)]">
                  <span className="inline-flex items-center gap-0.5"><CircleCheck className="size-2.5 text-[#30b85a]" />{player.correct_moves}</span>
                  <span className="inline-flex items-center gap-0.5"><CircleX className="size-2.5 text-[var(--error)]" />{player.mistakes}</span>
                </span>
              </span>
              <span className={cn("num text-[17px] font-semibold tabular-nums", player.score < 0 && "text-[var(--error)]")}>
                {player.score}
              </span>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
