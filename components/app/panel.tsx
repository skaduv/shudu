"use client";
import type { CSSProperties, ReactNode } from "react";
import { GlassSurface } from "@/components/ui/glass-surface";
import { useGame } from "@/lib/store/game";
import { cn } from "@/lib/utils";
import { useFx } from "./fx";

/** 玻璃面板：高性能档用 lore-glass 的 GlassSurface（含折射），低性能档用纯毛玻璃 */
export function Panel({ children, className, style, radius = 24, tint, blur = 18, flat = false }: {
  children: ReactNode; className?: string; style?: CSSProperties; radius?: number; tint?: number; blur?: number; flat?: boolean;
}) {
  const fx = useFx();
  const userTint = useGame((s) => s.settings.tint);
  const t = tint ?? userTint;
  if (flat) {
    return <div className={cn("flat-glass", className)} style={{ borderRadius: radius, ...style }}>{children}</div>;
  }
  if (fx === "lite") {
    return <div className={cn("lite-glass", className)} style={{ borderRadius: radius, ...style }}>{children}</div>;
  }
  return (
    <GlassSurface blur={blur} radius={radius} tint={t} className={className} style={style}>
      {children}
    </GlassSurface>
  );
}

type BtnProps = React.ComponentProps<"button"> & { size?: number; variant?: "icon" | "capsule"; active?: boolean; tint?: number };

/** 轻量玻璃按钮：避免每个按钮都创建独立的实时折射层。 */
export function GButton({ size = 44, variant = "icon", active, tint, className, style, children, ...props }: BtnProps) {
  void tint;
  return (
    <button
      type="button"
      className={cn(
        "app-control relative inline-flex shrink-0 cursor-pointer select-none items-center justify-center gap-2 overflow-hidden text-[14px] font-medium transition-[scale,filter,background-color] active:scale-95 disabled:cursor-not-allowed disabled:opacity-45",
        active
          ? "app-control-active text-white hover:brightness-110"
          : "app-control-soft text-[var(--ink)] hover:bg-white/65 dark:hover:bg-white/15",
        className
      )}
      style={{
        height: size,
        width: variant === "icon" ? size : undefined,
        borderRadius: size / 2,
        paddingInline: variant === "capsule" ? Math.round(size * 0.45) : 0,
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  );
}
