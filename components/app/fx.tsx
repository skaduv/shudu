"use client";
// 玻璃效果性能分级：full（真折射）/ lite（纯毛玻璃）
import { createContext, useContext, useEffect, useState } from "react";
import { useGame } from "@/lib/store/game";

type Fx = "full" | "lite";
const FxContext = createContext<Fx>("full");
export const useFx = () => useContext(FxContext);

function detect(): Fx {
  if (typeof window === "undefined") return "full";
  const mq = (q: string) => window.matchMedia?.(q).matches;
  if (mq("(prefers-reduced-transparency: reduce)") || mq("(prefers-reduced-motion: reduce)")) return "lite";
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean; effectiveType?: string };
  };
  if (
    nav.connection?.saveData
    || nav.connection?.effectiveType === "2g"
    || (nav.deviceMemory && nav.deviceMemory <= 4)
    || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4)
    || (mq("(pointer: coarse)") && window.innerWidth < 1024)
  ) return "lite";
  return "full";
}

export function FxProvider({ children }: { children: React.ReactNode }) {
  const pref = useGame((s) => s.settings.effects);
  const theme = useGame((s) => s.settings.theme);
  const [auto, setAuto] = useState<Fx>("lite");
  useEffect(() => setAuto(detect()), []);
  const fx: Fx = pref === "auto" ? auto : pref;

  // 主题：跟随系统 / 浅色 / 深色
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && mq.matches);
      root.classList.toggle("dark", dark);
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0b1024" : "#eef1fb");
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  useEffect(() => {
    document.documentElement.classList.toggle("fx-lite", fx === "lite");
  }, [fx]);

  // 离线缓存（PWA）
  useEffect(() => {
    if ("serviceWorker" in navigator && location.protocol === "https:") {
      navigator.serviceWorker.register(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/sw.js`).catch(() => {});
    }
  }, []);

  return <FxContext.Provider value={fx}>{children}</FxContext.Provider>;
}
