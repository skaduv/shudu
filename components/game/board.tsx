"use client";
import { memo } from "react";
import { BOX, COL, ROW, bit } from "@/lib/sudoku/core";
import { cn } from "@/lib/utils";

export interface BoardProps {
  values: number[];
  notes: number[];
  givens: string;
  sel: number | null;
  focusDigit: number;
  errors: Set<number>;
  hintCells: number[];
  highlightPeers: boolean;
  highlightSame: boolean;
  won: boolean;
  onTap: (i: number) => void;
  owners?: Array<string | null>;
  playerColors?: Record<string, string>;
  cursors?: Array<{ cell: number; color: string; nickname: string }>;
}

export const Board = memo(function Board(p: BoardProps) {
  const hint = new Set(p.hintCells);
  return (
    <div className={cn("board num", p.won && "won")} role="grid" aria-label="数独盘面">
      {p.values.map((v, i) => {
        const given = p.givens[i] !== "0";
        const owner = p.owners?.[i] ?? null;
        const ownerColor = owner ? p.playerColors?.[owner] : undefined;
        const cursor = p.cursors?.find((item) => item.cell === i);
        const isError = p.errors.has(i);
        const s = p.sel;
        const isSel = s === i;
        const peer = p.highlightPeers && s != null && !isSel && (ROW(s) === ROW(i) || COL(s) === COL(i) || BOX(s) === BOX(i));
        const same = p.highlightSame && p.focusDigit > 0 && v === p.focusDigit && !isSel;
        const cls = cn(
          "cell",
          COL(i) % 3 === 2 && COL(i) !== 8 && "bx-r",
          ROW(i) % 3 === 2 && ROW(i) !== 8 && "bx-b",
          peer && "peer",
          same && "same",
          hint.has(i) && "hint",
          isSel && "sel",
          given ? "given" : v ? "user" : "",
          v && isError && "err"
        );
        return (
          <button
            key={i}
            type="button"
            role="gridcell"
            className={cls}
            style={{
              animationDelay: p.won ? `${(ROW(i) + COL(i)) * 35}ms` : undefined,
              boxShadow: cursor ? `inset 0 0 0 2px ${cursor.color}` : undefined,
            }}
            aria-label={`第${ROW(i) + 1}行第${COL(i) + 1}列，${v ? v : "空"}${isError ? "，填写有误" : ""}${cursor ? `，${cursor.nickname}正在查看` : ""}`}
            aria-selected={isSel}
            onClick={() => p.onTap(i)}
          >
            {v ? (
              <span key={v} className={given ? undefined : "pop"}>{v}</span>
            ) : p.notes[i] ? (
              <span className="notes">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                  <span
                    key={d}
                    className={cn(p.highlightSame && d === p.focusDigit && "on-same")}
                    style={{ color: !given && ownerColor && !isError ? ownerColor : undefined }}
                  >
                    {p.notes[i] & bit(d) ? d : ""}
                  </span>
                ))}
              </span>
            ) : null}
            {!given && ownerColor && (v || p.notes[i]) ? (
              <span
                aria-hidden="true"
                className="owner-mark"
                style={{ background: ownerColor }}
              />
            ) : null}
            {isError ? <span aria-hidden="true" className="error-mark">!</span> : null}
            {cursor && !isSel ? (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute right-1 top-1 h-1.5 w-1.5 rounded-full"
                style={{ background: cursor.color }}
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
});
