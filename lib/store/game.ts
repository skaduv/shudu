"use client";
// 全局游戏状态：对局、设置、统计。用 zustand persist 存到 localStorage（防抖写入，页面隐藏时立即落盘）
import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";
import { PEERS, bit, candidates, toGrid } from "@/lib/sudoku/core";
import type { Level, Puzzle } from "@/lib/sudoku/types";

export interface CellChange { i: number; v0: number; v1: number; n0: number; n1: number }
export interface Move { changes: CellChange[] }

export interface Game {
  puzzle: Puzzle;
  values: number[];
  notes: number[]; // 每格 9 位掩码
  history: Move[];
  future: Move[];
  elapsedMs: number;
  mistakes: number;
  hintsUsed: number;
  status: "playing" | "won";
  startedAt: number;
  updatedAt: number;
  finishedAt?: number;
}

export interface Settings {
  mistakeMode: "instant" | "conflict" | "off";
  autoClearNotes: boolean;
  highlightPeers: boolean;
  highlightSame: boolean;
  inputMode: "cell" | "digit";
  theme: "system" | "light" | "dark";
  tint: number; // 玻璃通透度 0–1
  effects: "auto" | "full" | "lite";
  haptics: boolean;
  showTimer: boolean;
  hideCompletedDigits: boolean;
}

export interface LevelStats { started: number; won: number; bestMs: number | null; totalMs: number; streak: number; bestStreak: number }
export type Stats = Record<Level, LevelStats>;

const emptyStats = (): LevelStats => ({ started: 0, won: 0, bestMs: null, totalMs: 0, streak: 0, bestStreak: 0 });

export const DEFAULT_SETTINGS: Settings = {
  mistakeMode: "conflict",
  autoClearNotes: true,
  highlightPeers: true,
  highlightSame: true,
  inputMode: "cell",
  theme: "system",
  tint: 0.55,
  effects: "auto",
  haptics: true,
  showTimer: true,
  hideCompletedDigits: true,
};

interface State {
  version: number;
  games: Record<string, Game>;
  currentId: string | null;
  completed: string[]; // 已完成的题目 ID
  settings: Settings;
  stats: Stats;

  startGame: (p: Puzzle, opts?: { restart?: boolean }) => void;
  setCurrent: (id: string) => void;
  removeGame: (id: string) => void;
  input: (i: number, d: number, opts?: { hint?: boolean }) => void;
  toggleNote: (i: number, d: number) => void;
  erase: (i: number) => void;
  fillNotes: () => void;
  clearNotes: () => void;
  undo: () => void;
  redo: () => void;
  tick: (ms: number) => void;
  setSettings: (s: Partial<Settings>) => void;
  importData: (data: Partial<State>) => void;
  resetAll: () => void;
}

const MAX_HISTORY = 600;
const MAX_GAMES = 40;

// ---------- 防抖的 localStorage ----------
const pending = new Map<string, string>();
let timer: ReturnType<typeof setTimeout> | null = null;
const flush = () => {
  if (timer) { clearTimeout(timer); timer = null; }
  for (const [k, v] of pending) {
    try { localStorage.setItem(k, v); } catch { /* 配额已满时忽略 */ }
  }
  pending.clear();
};
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
}
const debouncedStorage: StateStorage = {
  getItem: (k) => pending.get(k) ?? localStorage.getItem(k),
  setItem: (k, v) => {
    pending.set(k, v);
    if (!timer) timer = setTimeout(flush, 300);
  },
  removeItem: (k) => { pending.delete(k); localStorage.removeItem(k); },
};
export const flushStorage = flush;

function prune(games: Record<string, Game>, keep: string | null) {
  const ids = Object.keys(games);
  if (ids.length <= MAX_GAMES) return games;
  const sorted = ids.sort((a, b) => {
    const ga = games[a], gb = games[b];
    // 先删已完成的，再删最久没动的
    if (ga.status !== gb.status) return ga.status === "won" ? -1 : 1;
    return ga.updatedAt - gb.updatedAt;
  });
  const next = { ...games };
  for (const id of sorted) {
    if (Object.keys(next).length <= MAX_GAMES) break;
    if (id !== keep) delete next[id];
  }
  return next;
}

export const useGame = create<State>()(
  persist(
    (set, get) => {
      /** 对当前对局做修改的通用函数 */
      const mutate = (fn: (g: Game) => Game | null) => {
        const { currentId, games } = get();
        if (!currentId || !games[currentId]) return;
        const next = fn(games[currentId]);
        if (!next) return;
        set({ games: { ...games, [currentId]: { ...next, updatedAt: Date.now() } } });
      };

      /** 把一组格子改动作为一步，记入撤销栈 */
      const commit = (g: Game, changes: CellChange[]): Game => {
        const real = changes.filter((c) => c.v0 !== c.v1 || c.n0 !== c.n1);
        if (!real.length) return g;
        const values = g.values.slice();
        const notes = g.notes.slice();
        for (const c of real) { values[c.i] = c.v1; notes[c.i] = c.n1; }
        const history = [...g.history, { changes: real }].slice(-MAX_HISTORY);
        return { ...g, values, notes, history, future: [] };
      };

      const checkWin = (g: Game): Game => {
        if (g.status === "won") return g;
        const sol = g.puzzle.solution;
        for (let i = 0; i < 81; i++) if (String(g.values[i]) !== sol[i]) return g;
        const { stats, completed } = get();
        const lv = g.puzzle.level;
        const s = { ...(stats[lv] ?? emptyStats()) };
        s.won += 1;
        s.totalMs += g.elapsedMs;
        s.bestMs = s.bestMs == null ? g.elapsedMs : Math.min(s.bestMs, g.elapsedMs);
        s.streak += 1;
        s.bestStreak = Math.max(s.bestStreak, s.streak);
        set({
          stats: { ...stats, [lv]: s },
          completed: completed.includes(g.puzzle.id) ? completed : [...completed, g.puzzle.id],
        });
        return { ...g, status: "won", finishedAt: Date.now() };
      };

      return {
        version: 1,
        games: {},
        currentId: null,
        completed: [],
        settings: DEFAULT_SETTINGS,
        stats: { easy: emptyStats(), medium: emptyStats(), hard: emptyStats(), diabolical: emptyStats() },

        startGame: (p, opts) => {
          const { games, stats } = get();
          const existing = games[p.id];
          if (existing && !opts?.restart) {
            set({ currentId: p.id });
            return;
          }
          const lv = p.level;
          const s = { ...(stats[lv] ?? emptyStats()) };
          s.started += 1;
          if (existing && existing.status === "playing") s.streak = 0; // 重开视为中断连胜
          const g: Game = {
            puzzle: p,
            values: toGrid(p.givens),
            notes: new Array(81).fill(0),
            history: [],
            future: [],
            elapsedMs: 0,
            mistakes: 0,
            hintsUsed: 0,
            status: "playing",
            startedAt: Date.now(),
            updatedAt: Date.now(),
          };
          set({ games: prune({ ...games, [p.id]: g }, p.id), currentId: p.id, stats: { ...stats, [lv]: s } });
        },

        setCurrent: (id) => set({ currentId: id }),

        removeGame: (id) => {
          const games = { ...get().games };
          const g = games[id];
          delete games[id];
          const patch: Partial<State> = { games, currentId: get().currentId === id ? null : get().currentId };
          if (g && g.status === "playing") {
            const stats = get().stats;
            patch.stats = { ...stats, [g.puzzle.level]: { ...stats[g.puzzle.level], streak: 0 } };
          }
          set(patch);
        },

        input: (i, d, opts) =>
          mutate((g) => {
            if (g.status === "won" || g.puzzle.givens[i] !== "0") return null;
            const { settings } = get();
            const v1 = g.values[i] === d && !opts?.hint ? 0 : d;
            const changes: CellChange[] = [{ i, v0: g.values[i], v1, n0: g.notes[i], n1: 0 }];
            if (v1 && settings.autoClearNotes) {
              for (const p of PEERS[i]) {
                if (g.notes[p] & bit(d)) changes.push({ i: p, v0: g.values[p], v1: g.values[p], n0: g.notes[p], n1: g.notes[p] & ~bit(d) });
              }
            }
            let next = commit(g, changes);
            if (opts?.hint) next = { ...next, hintsUsed: next.hintsUsed + 1 };
            else if (v1 && settings.mistakeMode === "instant" && String(v1) !== g.puzzle.solution[i]) {
              next = { ...next, mistakes: next.mistakes + 1 };
            }
            return checkWin(next);
          }),

        toggleNote: (i, d) =>
          mutate((g) => {
            if (g.status === "won" || g.puzzle.givens[i] !== "0" || g.values[i]) return null;
            return commit(g, [{ i, v0: 0, v1: 0, n0: g.notes[i], n1: g.notes[i] ^ bit(d) }]);
          }),

        erase: (i) =>
          mutate((g) => {
            if (g.status === "won" || g.puzzle.givens[i] !== "0") return null;
            return commit(g, [{ i, v0: g.values[i], v1: 0, n0: g.notes[i], n1: 0 }]);
          }),

        fillNotes: () =>
          mutate((g) => {
            if (g.status === "won") return null;
            const cand = candidates(g.values);
            return commit(g, g.values.map((v, i) => ({ i, v0: v, v1: v, n0: g.notes[i], n1: v ? g.notes[i] : cand[i] })));
          }),

        clearNotes: () =>
          mutate((g) => commit(g, g.values.map((v, i) => ({ i, v0: v, v1: v, n0: g.notes[i], n1: 0 })))),

        undo: () =>
          mutate((g) => {
            const last = g.history[g.history.length - 1];
            if (!last || g.status === "won") return null;
            const values = g.values.slice(), notes = g.notes.slice();
            for (const c of last.changes) { values[c.i] = c.v0; notes[c.i] = c.n0; }
            return { ...g, values, notes, history: g.history.slice(0, -1), future: [...g.future, last] };
          }),

        redo: () =>
          mutate((g) => {
            const m = g.future[g.future.length - 1];
            if (!m || g.status === "won") return null;
            const values = g.values.slice(), notes = g.notes.slice();
            for (const c of m.changes) { values[c.i] = c.v1; notes[c.i] = c.n1; }
            return checkWin({ ...g, values, notes, history: [...g.history, m], future: g.future.slice(0, -1) });
          }),

        tick: (ms) => mutate((g) => (g.status === "playing" ? { ...g, elapsedMs: g.elapsedMs + ms } : null)),

        setSettings: (s) => set({ settings: { ...get().settings, ...s } }),

        importData: (data) =>
          set({
            games: data.games ?? {},
            currentId: data.currentId ?? null,
            completed: data.completed ?? [],
            settings: { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) },
            stats: { ...get().stats, ...(data.stats ?? {}) },
          }),

        resetAll: () =>
          set({
            games: {}, currentId: null, completed: [], settings: DEFAULT_SETTINGS,
            stats: { easy: emptyStats(), medium: emptyStats(), hard: emptyStats(), diabolical: emptyStats() },
          }),
      };
    },
    {
      name: "liquid-sudoku:v1",
      version: 1,
      storage: createJSONStorage(() => debouncedStorage),
      partialize: (s) => ({ version: s.version, games: s.games, currentId: s.currentId, completed: s.completed, settings: s.settings, stats: s.stats }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        return { ...current, ...p, settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) }, stats: { ...current.stats, ...(p.stats ?? {}) } };
      },
    }
  )
);

/** 等待 localStorage 恢复完成，避免服务端渲染与客户端不一致 */
export function useHydratedStore() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (useGame.persist.hasHydrated()) setOk(true);
    const unsub = useGame.persist.onFinishHydration(() => setOk(true));
    return unsub;
  }, []);
  return ok;
}

export const currentGame = (s: State) => (s.currentId ? s.games[s.currentId] ?? null : null);
