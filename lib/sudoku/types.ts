export type Level = "easy" | "medium" | "hard" | "diabolical";
export const LEVELS: Level[] = ["easy", "medium", "hard", "diabolical"];
export const LEVEL_NAME: Record<Level, string> = { easy: "简单", medium: "中等", hard: "困难", diabolical: "地狱" };
export const LEVEL_PREFIX: Record<Level, string> = { easy: "e", medium: "m", hard: "h", diabolical: "d" };
export const PREFIX_LEVEL: Record<string, Level> = { e: "easy", m: "medium", h: "hard", d: "diabolical" };

export interface Puzzle {
  id: string;
  givens: string;   // 81 位，0 为空
  solution: string; // 81 位
  level: Level;
  source: "bank" | "upload" | "share";
  rating?: number;
  name?: string;
  addedAt?: number;
}
