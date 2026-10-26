// 位运算 + 最少候选优先（MRV）回溯求解器，可统计解的个数
import { PEERS, bit, Grid, ALL } from "./core";

export interface SolveResult { count: number; solution: Grid | null }

/** 求解并统计解数，数到 limit 个即停止（默认 2：用于判断唯一解） */
export function solve(input: Grid, limit = 2): SolveResult {
  const g = input.slice();
  // 先检查已给数字是否互相冲突
  for (let i = 0; i < 81; i++) {
    if (!g[i]) continue;
    for (const p of PEERS[i]) if (g[p] === g[i]) return { count: 0, solution: null };
  }
  let count = 0;
  let first: Grid | null = null;
  const cand = (i: number) => {
    let m = ALL;
    for (const p of PEERS[i]) if (g[p]) m &= ~bit(g[p]);
    return m;
  };
  const rec = (): boolean => {
    let best = -1, bestMask = 0, bestCount = 10;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const m = cand(i);
      let c = 0, t = m;
      while (t) { t &= t - 1; c++; }
      if (c === 0) return false;
      if (c < bestCount) { best = i; bestMask = m; bestCount = c; if (c === 1) break; }
    }
    if (best === -1) {
      count++;
      if (!first) first = g.slice();
      return count >= limit;
    }
    for (let d = 1; d <= 9; d++) {
      if (!(bestMask & bit(d))) continue;
      g[best] = d;
      if (rec()) { g[best] = 0; return true; }
    }
    g[best] = 0;
    return false;
  };
  rec();
  return { count, solution: first };
}
