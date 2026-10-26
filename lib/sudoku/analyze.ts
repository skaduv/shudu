// 上传题目的校验与分析
import { normalize, toGrid, toStr, conflicts, hash } from "./core";
import { solve } from "./solver";
import { rate } from "./logic";
import type { Level } from "./types";

export type Analysis =
  | { ok: true; givens: string; solution: string; level: Level; clues: number; id: string; hardest: string | null }
  | { ok: false; error: string; givens?: string };

export function analyze(raw: string): Analysis {
  const givens = normalize(raw);
  if (!givens) return { ok: false, error: "需要正好 81 个格子（数字 1–9，空格用 0 或 . 表示）" };
  const g = toGrid(givens);
  const clues = g.filter(Boolean).length;
  const bad = conflicts(g);
  if (bad.size) {
    const i = [...bad][0];
    return { ok: false, givens, error: `已给数字有冲突：第${Math.floor(i / 9) + 1}行第${(i % 9) + 1}列的 ${g[i]} 与同行、同列或同宫重复` };
  }
  if (clues < 17) return { ok: false, givens, error: `只有 ${clues} 个已知数，少于 17 个的数独不可能有唯一解` };
  const res = solve(g, 2);
  if (res.count === 0 || !res.solution) return { ok: false, givens, error: "这道题无解" };
  if (res.count > 1) return { ok: false, givens, error: "这道题有多个解，无法保证唯一答案" };
  const r = rate(g);
  return { ok: true, givens, solution: toStr(res.solution), level: r.level, clues, id: `u-${hash(givens)}`, hardest: r.hardest };
}

/** 把一段文本拆成多道题（一行一题；若整段只有一道 9 行格式的题，也能识别） */
export function splitPuzzles(text: string): string[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const single = lines.filter((l) => normalize(l));
  if (single.length) return single;
  const whole = normalize(text);
  if (whole) return [text];
  // 9 行一组的格式
  const out: string[] = [];
  for (let k = 0; k + 9 <= lines.length; k += 9) out.push(lines.slice(k, k + 9).join(""));
  return out.length ? out : [text];
}
