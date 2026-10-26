"use client";
// 内置题库：按难度懒加载 /puzzles/{level}.json
import type { Level, Puzzle } from "@/lib/sudoku/types";
import { PREFIX_LEVEL } from "@/lib/sudoku/types";

type Row = [string, string, string, number];
const cache = new Map<Level, Promise<Puzzle[]>>();

export function loadLevel(level: Level): Promise<Puzzle[]> {
  if (!cache.has(level)) {
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    cache.set(
      level,
      fetch(`${base}/puzzles/${level}.json`)
        .then((r) => { if (!r.ok) throw new Error("题库加载失败"); return r.json() as Promise<Row[]>; })
        .then((rows) => rows.map(([id, givens, solution, rating], idx) => ({ id, givens, solution, rating, level, source: "bank" as const, name: `#${idx + 1}` })))
        .catch((e) => { cache.delete(level); throw e; })
    );
  }
  return cache.get(level)!;
}

export async function getBankPuzzle(id: string): Promise<Puzzle | null> {
  const level = PREFIX_LEVEL[id.split("-")[0]];
  if (!level) return null;
  const list = await loadLevel(level);
  return list.find((p) => p.id === id) ?? null;
}

/** 随机挑一道没玩过的题 */
export async function pickRandom(level: Level, exclude: Set<string>): Promise<Puzzle> {
  const list = await loadLevel(level);
  const fresh = list.filter((p) => !exclude.has(p.id));
  const pool = fresh.length ? fresh : list;
  return pool[Math.floor(Math.random() * pool.length)];
}
