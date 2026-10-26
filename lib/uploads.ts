"use client";
// 用户上传的题目存在 IndexedDB（idb-keyval）
import { get, set } from "idb-keyval";
import type { Puzzle } from "@/lib/sudoku/types";

const KEY = "liquid-sudoku:uploads";

export async function listUploads(): Promise<Puzzle[]> {
  return ((await get(KEY)) as Puzzle[] | undefined) ?? [];
}
export async function saveUploads(items: Puzzle[]) {
  const cur = await listUploads();
  const map = new Map(cur.map((p) => [p.id, p]));
  for (const p of items) map.set(p.id, { ...map.get(p.id), ...p });
  const next = [...map.values()].sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0));
  await set(KEY, next);
  return next;
}
export async function removeUpload(id: string) {
  const next = (await listUploads()).filter((p) => p.id !== id);
  await set(KEY, next);
  return next;
}
export async function replaceUploads(items: Puzzle[]) {
  await set(KEY, items);
}
