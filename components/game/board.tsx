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
}

export const Board = memo(function Board(p: BoardProps) {
  const hint = new Set(p.hintCells);
  return (
    <div className={cn("board num", p.won && "won")} role="grid" aria-label="数独盘面">
      {p.values.map((v, i) => {
        const given = p.givens[i] !== "0";
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
          v && p.errors.has(i) && "err"
        );
        return (
          <button
            key={i}
            type="button"
            role="gridcell"
            className={cls}
            style={p.won ? { animationDelay: `${(ROW(i) + COL(i)) * 35}ms` } : undefined}
            aria-label={`第${ROW(i) + 1}行第${COL(i) + 1}列，${v ? v : "空"}`}
            aria-selected={isSel}
            onClick={() => p.onTap(i)}
          >
            {v ? (
              <span key={v} className={given ? undefined : "pop"}>{v}</span>
            ) : p.notes[i] ? (
              <span className="notes">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                  <span key={d} className={cn(p.highlightSame && d === p.focusDigit && "on-same")}>{p.notes[i] & bit(d) ? d : ""}</span>
                ))}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
});
