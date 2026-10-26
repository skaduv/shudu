// 数独基础：索引、同组关系、解析、冲突检测
export type Grid = number[]; // 81 格，0 为空

export const ROW = (i: number) => Math.floor(i / 9);
export const COL = (i: number) => i % 9;
export const BOX = (i: number) => Math.floor(ROW(i) / 3) * 3 + Math.floor(COL(i) / 3);

/** 27 个单元（9 行、9 列、9 宫），每个单元是 9 个格子索引 */
export const UNITS: number[][] = (() => {
  const u: number[][] = [];
  for (let r = 0; r < 9; r++) u.push(Array.from({ length: 9 }, (_, c) => r * 9 + c));
  for (let c = 0; c < 9; c++) u.push(Array.from({ length: 9 }, (_, r) => r * 9 + c));
  for (let b = 0; b < 9; b++) {
    const br = Math.floor(b / 3) * 3, bc = (b % 3) * 3;
    const cells: number[] = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) cells.push((br + r) * 9 + bc + c);
    u.push(cells);
  }
  return u;
})();

/** 每格的 20 个同组格 */
export const PEERS: number[][] = Array.from({ length: 81 }, (_, i) => {
  const s = new Set<number>();
  for (let j = 0; j < 81; j++) {
    if (j !== i && (ROW(j) === ROW(i) || COL(j) === COL(i) || BOX(j) === BOX(i))) s.add(j);
  }
  return [...s];
});

export const ALL = 0x1ff; // 9 位全 1
export const bit = (d: number) => 1 << (d - 1);
export const popcount = (m: number) => {
  let c = 0;
  while (m) { m &= m - 1; c++; }
  return c;
};
export const digitsOf = (m: number) => {
  const out: number[] = [];
  for (let d = 1; d <= 9; d++) if (m & bit(d)) out.push(d);
  return out;
};

export const toGrid = (s: string): Grid => s.split("").map((ch) => (ch >= "1" && ch <= "9" ? +ch : 0));
export const toStr = (g: Grid) => g.map((v) => (v ? String(v) : "0")).join("");

/**
 * 把任意用户输入归一化成 81 位字符串。
 * 支持：0 / . / - / _ / * / x 表示空格；忽略空白、竖线、加号等装饰字符；
 * 支持 Sudoku Exchange 题库格式 “id 题面 评分”（取其中的 81 位片段）。
 */
export function normalize(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const token = trimmed.split(/[\s,;]+/).find((t) => /^[0-9.\-_*xX]{81}$/.test(t));
  if (token) return token.replace(/[.\-_*xX]/g, "0");
  const body = trimmed.split(/\r?\n/).filter((l) => !/^[\s\-+|=]+$/.test(l)).join("\n");
  const cleaned = body.replace(/[^0-9.\-_*xX]/g, "").replace(/[.\-_*xX]/g, "0");
  return cleaned.length === 81 ? cleaned : null;
}

/** 返回与同组格重复的格子集合（只看已填数字） */
export function conflicts(g: Grid): Set<number> {
  const bad = new Set<number>();
  for (const unit of UNITS) {
    const seen = new Map<number, number>();
    for (const i of unit) {
      const v = g[i];
      if (!v) continue;
      if (seen.has(v)) { bad.add(i); bad.add(seen.get(v)!); } else seen.set(v, i);
    }
  }
  return bad;
}

/** 根据当前盘面算出每格的合法候选数（位掩码） */
export function candidates(g: Grid): number[] {
  return g.map((v, i) => {
    if (v) return 0;
    let m = ALL;
    for (const p of PEERS[i]) if (g[p]) m &= ~bit(g[p]);
    return m;
  });
}

export const cellName = (i: number) => `第${ROW(i) + 1}行第${COL(i) + 1}列`;
export const unitName = (u: number) => (u < 9 ? `第${u + 1}行` : u < 18 ? `第${u - 8}列` : `第${u - 17}宫`);

/** 简单稳定的字符串哈希（用于上传题目的 ID） */
export function hash(s: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
