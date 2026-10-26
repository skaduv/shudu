// 人类技巧求解器：用于“逻辑提示”和题目难度评级
import { UNITS, PEERS, BOX, ROW, COL, bit, popcount, digitsOf, Grid, candidates, cellName, unitName } from "./core";
import type { Level } from "./types";

export type Technique =
  | "naked-single" | "hidden-single" | "pointing" | "claiming"
  | "naked-pair" | "hidden-pair" | "naked-triple" | "x-wing";

export const TECH_NAME: Record<Technique, string> = {
  "naked-single": "唯一候选",
  "hidden-single": "隐性唯一",
  pointing: "区块摒除",
  claiming: "行列区块",
  "naked-pair": "显性数对",
  "hidden-pair": "隐性数对",
  "naked-triple": "显性三数组",
  "x-wing": "X-Wing",
};

const TECH_LEVEL: Record<Technique, number> = {
  "naked-single": 1, "hidden-single": 1, pointing: 2, claiming: 2,
  "naked-pair": 3, "hidden-pair": 3, "naked-triple": 3, "x-wing": 4,
};

export interface Step {
  technique: Technique;
  place?: { i: number; d: number };
  elims: { i: number; d: number }[];
  cells: number[]; // 需要高亮的格子
  message: string;
}

function elimsFrom(cand: number[], targets: number[], mask: number) {
  const out: { i: number; d: number }[] = [];
  for (const i of targets) {
    const hit = cand[i] & mask;
    if (hit) for (const d of digitsOf(hit)) out.push({ i, d });
  }
  return out;
}

export function findStep(values: Grid, cand: number[]): Step | null {
  // 1. 唯一候选
  for (let i = 0; i < 81; i++) {
    if (!values[i] && popcount(cand[i]) === 1) {
      const d = digitsOf(cand[i])[0];
      return { technique: "naked-single", place: { i, d }, elims: [], cells: [i],
        message: `${cellName(i)}只剩一个候选数 ${d}（唯一候选）。` };
    }
  }
  // 2. 隐性唯一
  for (let u = 0; u < 27; u++) {
    for (let d = 1; d <= 9; d++) {
      const spots = UNITS[u].filter((i) => !values[i] && cand[i] & bit(d));
      if (spots.length === 1 && !UNITS[u].some((i) => values[i] === d)) {
        return { technique: "hidden-single", place: { i: spots[0], d }, elims: [], cells: UNITS[u],
          message: `在${unitName(u)}里，数字 ${d} 只能放在${cellName(spots[0])}（隐性唯一）。` };
      }
    }
  }
  // 3. 区块摒除（宫 → 行/列）与行列区块（行/列 → 宫）
  for (let b = 18; b < 27; b++) {
    for (let d = 1; d <= 9; d++) {
      const spots = UNITS[b].filter((i) => !values[i] && cand[i] & bit(d));
      if (spots.length < 2) continue;
      for (const [key, unitBase] of [[ROW, 0], [COL, 9]] as const) {
        const k = key(spots[0]);
        if (spots.every((i) => key(i) === k)) {
          const others = UNITS[unitBase + k].filter((i) => BOX(i) !== b - 18 && !values[i]);
          const elims = elimsFrom(cand, others, bit(d));
          if (elims.length) return { technique: "pointing", elims, cells: spots,
            message: `${unitName(b)}中的 ${d} 只能在${unitName(unitBase + k)}，所以该${unitBase ? "列" : "行"}其它格不能是 ${d}（区块摒除）。` };
        }
      }
    }
  }
  for (let u = 0; u < 18; u++) {
    for (let d = 1; d <= 9; d++) {
      const spots = UNITS[u].filter((i) => !values[i] && cand[i] & bit(d));
      if (spots.length < 2) continue;
      const b = BOX(spots[0]);
      if (spots.every((i) => BOX(i) === b)) {
        const others = UNITS[18 + b].filter((i) => !UNITS[u].includes(i) && !values[i]);
        const elims = elimsFrom(cand, others, bit(d));
        if (elims.length) return { technique: "claiming", elims, cells: spots,
          message: `${unitName(u)}中的 ${d} 都在${unitName(18 + b)}，所以该宫其它格不能是 ${d}（行列区块）。` };
      }
    }
  }
  // 4. 显性数对 / 三数组
  for (const size of [2, 3]) {
    for (let u = 0; u < 27; u++) {
      const empty = UNITS[u].filter((i) => !values[i] && popcount(cand[i]) >= 2 && popcount(cand[i]) <= size);
      const combos = combinations(empty, size);
      for (const combo of combos) {
        const mask = combo.reduce((m, i) => m | cand[i], 0);
        if (popcount(mask) !== size) continue;
        const others = UNITS[u].filter((i) => !values[i] && !combo.includes(i));
        const elims = elimsFrom(cand, others, mask);
        if (elims.length) return { technique: size === 2 ? "naked-pair" : "naked-triple", elims, cells: combo,
          message: `${unitName(u)}里 ${combo.map(cellName).join("、")} 只能是 ${digitsOf(mask).join("、")}，其它格可排除这些数（${size === 2 ? "显性数对" : "显性三数组"}）。` };
      }
    }
    if (size === 2) {
      // 隐性数对
      for (let u = 0; u < 27; u++) {
        const pos: number[][] = [];
        for (let d = 1; d <= 9; d++) pos[d] = UNITS[u].filter((i) => !values[i] && cand[i] & bit(d));
        for (let a = 1; a <= 9; a++) for (let c = a + 1; c <= 9; c++) {
          if (pos[a].length === 2 && pos[c].length === 2 && pos[a][0] === pos[c][0] && pos[a][1] === pos[c][1]) {
            const keep = bit(a) | bit(c);
            const elims = elimsFrom(cand, pos[a], ~keep & 0x1ff);
            if (elims.length) return { technique: "hidden-pair", elims, cells: pos[a],
              message: `${unitName(u)}里 ${a} 和 ${c} 只能出现在 ${pos[a].map(cellName).join("、")}，这两格的其它候选可删除（隐性数对）。` };
          }
        }
      }
    }
  }
  // 5. X-Wing（行与列两个方向）
  for (let d = 1; d <= 9; d++) {
    for (const dir of [0, 1]) {
      const lines: number[][] = [];
      for (let k = 0; k < 9; k++) {
        const unit = UNITS[dir * 9 + k];
        lines.push(unit.filter((i) => !values[i] && cand[i] & bit(d)).map((i) => (dir ? ROW(i) : COL(i))));
      }
      for (let a = 0; a < 9; a++) for (let b2 = a + 1; b2 < 9; b2++) {
        const A = lines[a], B = lines[b2];
        if (A.length === 2 && B.length === 2 && A[0] === B[0] && A[1] === B[1]) {
          const targets: number[] = [];
          for (const x of A) {
            const unit = UNITS[(1 - dir) * 9 + x];
            for (const i of unit) {
              const line = dir ? COL(i) : ROW(i);
              if (line !== a && line !== b2 && !values[i]) targets.push(i);
            }
          }
          const elims = elimsFrom(cand, targets, bit(d));
          if (elims.length) {
            const cells = [a, b2].flatMap((l) => A.map((x) => (dir ? x * 9 + l : l * 9 + x)));
            return { technique: "x-wing", elims, cells,
              message: `数字 ${d} 在两${dir ? "列" : "行"}中都只出现在相同的两${dir ? "行" : "列"}，构成 X-Wing，可排除交叉线上的其它 ${d}。` };
          }
        }
      }
    }
  }
  return null;
}

function combinations<T>(arr: T[], k: number): T[][] {
  const out: T[][] = [];
  const rec = (start: number, acc: T[]) => {
    if (acc.length === k) { out.push(acc.slice()); return; }
    for (let i = start; i < arr.length; i++) { acc.push(arr[i]); rec(i + 1, acc); acc.pop(); }
  };
  rec(0, []);
  return out;
}

export function applyStep(values: Grid, cand: number[], step: Step) {
  if (step.place) {
    const { i, d } = step.place;
    values[i] = d;
    cand[i] = 0;
    for (const p of PEERS[i]) cand[p] &= ~bit(d);
  }
  for (const { i, d } of step.elims) cand[i] &= ~bit(d);
}

export interface Rating { level: Level; score: number; hardest: Technique | null; solvedByLogic: boolean }

/** 用技巧求解器给题目评级 */
export function rate(givens: Grid): Rating {
  const values = givens.slice();
  const cand = candidates(values);
  let maxLevel = 0, score = 0;
  let hardest: Technique | null = null;
  for (let guard = 0; guard < 2000; guard++) {
    if (values.every((v) => v)) break;
    const step = findStep(values, cand);
    if (!step) {
      return { level: "diabolical", score: score + 50, hardest, solvedByLogic: false };
    }
    const lv = TECH_LEVEL[step.technique];
    score += lv;
    if (lv > maxLevel) { maxLevel = lv; hardest = step.technique; }
    applyStep(values, cand, step);
  }
  const level: Level = maxLevel <= 1 ? "easy" : maxLevel === 2 ? "medium" : "hard";
  return { level, score, hardest, solvedByLogic: true };
}

/** 针对当前盘面找下一步可落子的逻辑提示 */
export function nextHint(values: Grid): { step: Step; via: Technique[] } | null {
  const v = values.slice();
  const cand = candidates(v);
  const via: Technique[] = [];
  for (let guard = 0; guard < 200; guard++) {
    const step = findStep(v, cand);
    if (!step) return null;
    if (step.place) return { step, via };
    if (!via.includes(step.technique)) via.push(step.technique);
    applyStep(v, cand, step);
  }
  return null;
}
