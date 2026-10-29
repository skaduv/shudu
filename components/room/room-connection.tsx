"use client";

import { LoaderCircle, RefreshCw, Wifi, WifiOff } from "lucide-react";
import type { RoomConnectionState } from "@/lib/room/types";
import { cn } from "@/lib/utils";

const LABELS: Record<RoomConnectionState, string> = {
  connecting: "正在连接",
  live: "实时同步",
  syncing: "同步中",
  reconnecting: "正在重连",
};

export function RoomConnectionBadge({
  state,
  latencyMs,
  className,
}: {
  state: RoomConnectionState;
  latencyMs: number | null;
  className?: string;
}) {
  const Icon = state === "reconnecting"
    ? WifiOff
    : state === "connecting"
      ? LoaderCircle
      : state === "syncing"
        ? RefreshCw
        : Wifi;
  const quality = latencyMs == null
    ? null
    : latencyMs < 90
      ? "excellent"
      : latencyMs < 180
        ? "good"
        : latencyMs < 350
          ? "fair"
          : "slow";
  const latency = latencyMs == null ? "延迟 --" : latencyMs < 1000 ? `延迟 ${latencyMs} ms` : `延迟 ${(latencyMs / 1000).toFixed(1)} s`;

  return (
    <span
      className={cn(
        "room-connection inline-flex min-w-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
        `is-${state}`,
        className
      )}
      title={`${LABELS[state]} · ${latency}`}
      aria-live="polite"
    >
      <Icon
        className={cn(
          "size-3.5 shrink-0",
          (state === "connecting" || state === "syncing") && "animate-spin"
        )}
      />
      <span className="truncate">{LABELS[state]}</span>
      <span className="room-latency num shrink-0 tabular-nums" data-quality={quality ?? undefined}>
        {latencyMs == null ? "-- ms" : latencyMs < 1000 ? `${latencyMs} ms` : `${(latencyMs / 1000).toFixed(1)} s`}
      </span>
    </span>
  );
}
