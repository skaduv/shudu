import { cn } from "@/lib/utils";

/** 小缩略盘面 */
export function MiniBoard({ givens, values, className }: { givens: string; values?: number[]; className?: string }) {
  return (
    <div className={cn("num grid aspect-square grid-cols-9 overflow-hidden rounded-[10px] bg-white/50 text-[7px] leading-none dark:bg-black/30", className)}>
      {givens.split("").map((ch, i) => {
        const v = values?.[i] || (ch !== "0" ? Number(ch) : 0);
        const user = ch === "0" && v;
        const r = Math.floor(i / 9), c = i % 9;
        return (
          <span
            key={i}
            className={cn(
              "flex items-center justify-center border-black/5 dark:border-white/5",
              c % 3 === 2 && c !== 8 ? "border-r border-r-black/25 dark:border-r-white/25" : "border-r",
              r % 3 === 2 && r !== 8 ? "border-b border-b-black/25 dark:border-b-white/25" : "border-b",
              user ? "text-[var(--user-ink)]" : "text-[var(--ink)]"
            )}
          >
            {v || ""}
          </span>
        );
      })}
    </div>
  );
}
