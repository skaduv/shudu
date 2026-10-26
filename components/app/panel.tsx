"use client";
import type { CSSProperties, ReactNode } from "react";
import { GlassSurface } from "@/components/ui/glass-surface";
import { GlassButton } from "@/components/ui/glass-button";
import { useGame } from "@/lib/store/game";
import { cn } from "@/lib/utils";
import { useFx } from "./fx";

/** 玻璃面板：高性能档用 lore-glass 的 GlassSurface（含折射），低性能档用纯毛玻璃 */
export function Panel({ children, className, style, radius = 24, tint, blur = 18 }: {
  children: ReactNode; className?: string; style?: CSSProperties; radius?: number; tint?: number; blur?: number;
}) {
  const fx = useFx();
  const userTint = useGame((s) => s.settings.tint);
  const t = tint ?? userTint;
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

/** 玻璃按钮：带 iOS 果冻按压反馈；低性能档退化为普通按钮 */
export function GButton({ size = 44, variant = "icon", active, tint, className, style, children, ...props }: BtnProps) {
  const fx = useFx();
  const userTint = useGame((s) => s.settings.tint);
  const t = tint ?? (active ? 0.95 : Math.max(0.15, userTint * 0.6));
  const activeCls = active ? "!text-white" : "";
  const activeStyle: CSSProperties = active ? { ...style } : { ...style };
  if (active) {
    // 主按钮：实心强调色 + 玻璃高光，保证文字对比度
    return (
      <button
        type="button"
        className={cn(
          "relative inline-flex shrink-0 cursor-pointer select-none items-center justify-center gap-2 font-medium text-[15px] text-white transition-[scale,filter] active:scale-95 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50",
          "bg-[linear-gradient(180deg,#3a9bff_0%,#0a6cff_100%)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.7),inset_0_-8px_16px_-10px_rgba(255,255,255,0.5),0_10px_24px_-10px_rgba(10,108,255,0.8)]",
          className
        )}
        style={{ height: size, width: variant === "icon" ? size : undefined, borderRadius: size / 2, paddingInline: variant === "capsule" ? Math.round(size * 0.45) : 0, ...style }}
        {...props}
      >
        {children}
      </button>
    );
  }
  if (fx === "lite") {
    return (
      <button
        type="button"
        className={cn(
          "lite-glass inline-flex shrink-0 cursor-pointer select-none items-center justify-center gap-2 font-medium text-[15px] text-[var(--ink)] active:scale-95 transition-[scale] disabled:opacity-40 disabled:cursor-not-allowed",
          active && "!bg-[var(--color-accent)] !text-white",
          className
        )}
        style={{ height: size, width: variant === "icon" ? size : undefined, borderRadius: size / 2, paddingInline: variant === "capsule" ? Math.round(size * 0.45) : 0, ...style }}
        {...props}
      >
        {children}
      </button>
    );
  }
  return (
    <GlassButton
      size={size}
      variant={variant}
      tint={t}
      tintColor={active ? "10,132,255" : undefined}
      className={cn(activeCls, className)}
      style={activeStyle}
      {...props}
    >
      {children}
    </GlassButton>
  );
}
