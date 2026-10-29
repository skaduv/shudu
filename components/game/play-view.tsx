"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Eraser, Lightbulb, MoreHorizontal, Pause, PencilLine, Play, Redo2, RotateCcw, Sparkles, Trash2, Undo2, Share2, Plus, Home, Trophy,
} from "lucide-react";
import { Board } from "./board";
import { Panel, GButton } from "@/components/app/panel";
import { GlassPopover, GlassPopoverContent, GlassPopoverItem, GlassPopoverSeparator, GlassPopoverTrigger } from "@/components/ui/glass-popover";
import { GlassDialog, GlassDialogContent, GlassDialogTitle, GlassDialogDescription } from "@/components/ui/glass-dialog";
import { currentGame, flushStorage, useGame, useHydratedStore } from "@/lib/store/game";
import { getBankPuzzle, pickRandom } from "@/lib/bank";
import { analyze } from "@/lib/sudoku/analyze";
import { candidates, conflicts, popcount, COL, ROW } from "@/lib/sudoku/core";
import { nextHint, TECH_NAME } from "@/lib/sudoku/logic";
import { LEVEL_NAME, type Puzzle } from "@/lib/sudoku/types";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

interface HintState { cells: number[]; target: number; digit: number; message: string; kind: "place" | "fix" }

export function PlayView() {
  const hydrated = useHydratedStore();
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id");
  const shared = params.get("p");
  const [error, setError] = useState<string | null>(null);

  const game = useGame(currentGame);
  const settings = useGame((s) => s.settings);
  const { startGame, setCurrent, input, toggleNote, erase, undo, redo, tick, fillNotes, clearNotes } = useGame.getState();

  // ---------- 载入对局 ----------
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    (async () => {
      const st = useGame.getState();
      if (shared) {
        const a = analyze(shared);
        if (!a.ok) { setError(`分享的题目无效：${a.error}`); return; }
        const p: Puzzle = { id: a.id, givens: a.givens, solution: a.solution, level: a.level, source: "share", name: "分享的题目", addedAt: Date.now() };
        startGame(p);
        router.replace(`/play/?id=${a.id}`);
        return;
      }
      if (id) {
        if (st.games[id]) { setCurrent(id); return; }
        const p = await getBankPuzzle(id).catch(() => null);
        if (cancelled) return;
        if (!p) { setError("找不到这道题，可能已被清除"); return; }
        startGame(p);
        return;
      }
      if (st.currentId && st.games[st.currentId]) { router.replace(`/play/?id=${st.currentId}`); return; }
      router.replace("/");
    })();
    return () => { cancelled = true; };
  }, [hydrated, id, shared]); // eslint-disable-line react-hooks/exhaustive-deps

  const [sel, setSel] = useState<number | null>(null);
  const [noteMode, setNoteMode] = useState(false);
  const [activeDigit, setActiveDigit] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hint, setHint] = useState<HintState | null>(null);
  const [winOpen, setWinOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const won = game?.status === "won";
  const ready = Boolean(game && (!id || game.puzzle.id === id));

  // 换题时重置界面状态
  useEffect(() => { setSel(null); setHint(null); setPaused(false); setActiveDigit(0); }, [game?.puzzle.id]);

  // ---------- 计时器：标签页隐藏或暂停时停止 ----------
  useEffect(() => {
    if (!ready || won || paused) return;
    let last = performance.now();
    const t = setInterval(() => {
      const now = performance.now();
      const dt = Math.min(now - last, 5000);
      last = now;
      if (document.visibilityState === "visible") tick(dt);
    }, 1000);
    const onVis = () => { last = performance.now(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [ready, won, paused, tick]);

  // 完成时弹出成绩
  const prevWon = useRef(won);
  useEffect(() => {
    if (won && !prevWon.current) { setTimeout(() => setWinOpen(true), 900); flushStorage(); }
    prevWon.current = won;
  }, [won]);

  const vibrate = useCallback(() => { if (settings.haptics) navigator.vibrate?.(8); }, [settings.haptics]);

  // ---------- 输入 ----------
  const place = useCallback((i: number, d: number, asNote = noteMode) => {
    if (!game || won || paused) return;
    if (game.puzzle.givens[i] !== "0") return;
    if (asNote) toggleNote(i, d); else input(i, d);
    setHint(null);
    vibrate();
  }, [game, won, paused, noteMode, toggleNote, input, vibrate]);

  const onDigit = useCallback((d: number, asNote?: boolean) => {
    if (settings.inputMode === "digit") {
      if (asNote !== undefined && sel != null) { place(sel, d, asNote); return; }
      setActiveDigit((cur) => (cur === d ? 0 : d));
      return;
    }
    if (sel == null) { setActiveDigit((cur) => (cur === d ? 0 : d)); return; }
    place(sel, d, asNote ?? noteMode);
  }, [settings.inputMode, sel, place, noteMode]);

  const onTap = useCallback((i: number) => {
    if (paused) return;
    setSel(i);
    if (settings.inputMode === "digit" && activeDigit && game && game.puzzle.givens[i] === "0") {
      place(i, activeDigit);
    }
  }, [paused, settings.inputMode, activeDigit, game, place]);

  const onErase = useCallback(() => {
    if (sel == null || !game || paused) return;
    erase(sel);
    setHint(null);
  }, [sel, game, paused, erase]);

  // ---------- 提示 ----------
  const onHint = useCallback(() => {
    if (!game || won || paused) return;
    const sol = game.puzzle.solution;
    if (hint) {
      if (hint.kind === "fix") erase(hint.target);
      else input(hint.target, hint.digit, { hint: true });
      setSel(hint.target);
      setHint(null);
      return;
    }
    const wrong = game.values.findIndex((v, i) => v && game.puzzle.givens[i] === "0" && String(v) !== sol[i]);
    if (wrong >= 0) {
      setHint({ cells: [wrong], target: wrong, digit: 0, kind: "fix", message: `第${ROW(wrong) + 1}行第${COL(wrong) + 1}列填错了。再点一次「提示」帮你擦掉。` });
      setSel(wrong);
      return;
    }
    const res = nextHint(game.values);
    if (res?.step.place) {
      const pre = res.via.length ? `先用${res.via.map((t) => TECH_NAME[t]).join("、")}排除候选数，然后：` : "";
      setHint({ cells: res.step.cells, target: res.step.place.i, digit: res.step.place.d, kind: "place", message: pre + res.step.message + " 再点一次「提示」直接填入。" });
      setSel(res.step.place.i);
      return;
    }
    // 需要更高级技巧时，挑候选最少的格子
    const cand = candidates(game.values);
    let best = -1;
    for (let i = 0; i < 81; i++) if (!game.values[i] && (best < 0 || popcount(cand[i]) < popcount(cand[best]))) best = i;
    if (best < 0) return;
    setHint({ cells: [best], target: best, digit: Number(sol[best]), kind: "place", message: "这一步需要更高级的技巧（如链或试数）。已为你选中候选最少的格子，再点一次「提示」直接填入。" });
    setSel(best);
  }, [game, won, paused, hint, erase, input]);

  // ---------- 键盘 ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!game || winOpen) return;
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); setHint(null); return; }
      if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); return; }
      if (mod) return;
      if (/^[1-9]$/.test(e.key)) { e.preventDefault(); if (sel != null) place(sel, Number(e.key), e.shiftKey || e.altKey ? !noteMode : noteMode); else onDigit(Number(e.key)); return; }
      const move = (dr: number, dc: number) => {
        e.preventDefault();
        const cur = sel ?? 40;
        const r = (ROW(cur) + dr + 9) % 9, c = (COL(cur) + dc + 9) % 9;
        setSel(r * 9 + c);
      };
      switch (e.key) {
        case "ArrowUp": case "w": case "W": return move(-1, 0);
        case "ArrowDown": case "s": case "S": return move(1, 0);
        case "ArrowLeft": case "a": case "A": return move(0, -1);
        case "ArrowRight": case "d": case "D": return move(0, 1);
        case "Backspace": case "Delete": case "0": e.preventDefault(); return onErase();
        case "n": case "N": case "p": case "P": return setNoteMode((m) => !m);
        case "h": case "H": return onHint();
        case " ": e.preventDefault(); return setPaused((p) => !p);
        case "Escape": setSel(null); setActiveDigit(0); return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [game, sel, noteMode, winOpen, place, onDigit, onErase, onHint, undo, redo]);

  // ---------- 派生数据 ----------
  const errors = useMemo(() => {
    if (!game) return new Set<number>();
    if (settings.mistakeMode === "off") return new Set<number>();
    if (settings.mistakeMode === "conflict") return conflicts(game.values);
    const s = new Set<number>();
    game.values.forEach((v, i) => { if (v && game.puzzle.givens[i] === "0" && String(v) !== game.puzzle.solution[i]) s.add(i); });
    for (const i of conflicts(game.values)) s.add(i);
    return s;
  }, [game, settings.mistakeMode]);

  const counts = useMemo(() => {
    const c = new Array(10).fill(0);
    game?.values.forEach((v) => { if (v) c[v]++; });
    return c;
  }, [game]);

  const progress = useMemo(() => {
    if (!game) return 0;
    const empty = game.puzzle.givens.split("").filter((x) => x === "0").length;
    const filled = game.values.filter((v, i) => v && game.puzzle.givens[i] === "0").length;
    return empty ? Math.round((filled / empty) * 100) : 100;
  }, [game]);

  const newSameLevel = async () => {
    if (!game) return;
    const st = useGame.getState();
    const exclude = new Set([...st.completed, ...Object.keys(st.games)]);
    const p = await pickRandom(game.puzzle.level, exclude);
    startGame(p);
    setWinOpen(false);
    router.push(`/play/?id=${p.id}`);
  };

  const share = async () => {
    if (!game) return;
    const url = `${location.origin}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/play/?p=${game.puzzle.givens}`;
    try {
      if (navigator.share) await navigator.share({ title: "来挑战这道数独", url });
      else { await navigator.clipboard.writeText(url); setToast("分享链接已复制"); }
    } catch { /* 用户取消 */ }
  };

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2200); return () => clearTimeout(t); }, [toast]);

  if (error) {
    return (
      <div className="flex justify-center px-4 pt-16">
        <Panel className="w-full max-w-md p-6 text-center">
          <p className="text-[16px]">{error}</p>
          <Link href="/" className="mt-4 inline-block rounded-full bg-[var(--color-accent)] px-5 py-2.5 text-white">回到首页</Link>
        </Panel>
      </div>
    );
  }
  if (!hydrated || !game || !ready) {
    return <div className="flex justify-center pt-24 text-[var(--ink-soft)]">正在载入…</div>;
  }

  const focusDigit = (sel != null && game.values[sel]) || activeDigit;
  const showPause = paused && !won;

  const toolbar = (
    <div className="grid grid-cols-5 gap-1">
      {[
        { label: "撤销", icon: Undo2, onClick: () => { undo(); setHint(null); }, disabled: !game.history.length || won },
        { label: "擦除", icon: Eraser, onClick: onErase, disabled: sel == null || won || game.puzzle.givens[sel ?? 0] !== "0" },
        { label: noteMode ? "笔记 开" : "笔记", icon: PencilLine, onClick: () => setNoteMode((m) => !m), active: noteMode, disabled: won },
        { label: hint ? "填入" : "提示", icon: Lightbulb, onClick: onHint, disabled: won, active: Boolean(hint) },
      ].map((b) => (
        <button
          key={b.label}
          type="button"
          onClick={b.onClick}
          disabled={b.disabled}
          className={cn(
            "flex flex-col items-center gap-1 rounded-2xl py-2 text-[12px] font-medium transition-[background-color,scale] active:scale-95 disabled:opacity-35",
            b.active ? "bg-[var(--color-accent)] text-white" : "text-[var(--ink)] hover:bg-black/5 dark:hover:bg-white/10"
          )}
        >
          <b.icon className="size-[22px]" strokeWidth={1.8} />
          {b.label}
        </button>
      ))}
      <GlassPopover>
        <GlassPopoverTrigger className="flex flex-col items-center gap-1 rounded-2xl py-2 text-[12px] font-medium text-[var(--ink)] outline-none transition-[background-color,scale] hover:bg-black/5 active:scale-95 dark:hover:bg-white/10">
          <MoreHorizontal className="size-[22px]" strokeWidth={1.8} />
          更多
        </GlassPopoverTrigger>
        <GlassPopoverContent align="end" side="top">
          <GlassPopoverItem icon={<Redo2 />} label="重做" sublabel="Ctrl / ⌘ + Y" disabled={!game.future.length || won} onClick={() => redo()} />
          <GlassPopoverItem icon={<Sparkles />} label="填充全部候选数" sublabel="按当前盘面自动标记" disabled={won} onClick={() => fillNotes()} />
          <GlassPopoverItem icon={<Trash2 />} label="清除全部笔记" disabled={won} onClick={() => clearNotes()} />
          <GlassPopoverSeparator />
          <GlassPopoverItem icon={<Share2 />} label="分享这道题" sublabel="生成链接，朋友打开即玩" onClick={share} />
          <GlassPopoverItem icon={<Plus />} label={`新的${LEVEL_NAME[game.puzzle.level]}题`} onClick={newSameLevel} />
          <GlassPopoverItem icon={<RotateCcw />} label="重新开始" destructive onClick={() => { startGame(game.puzzle, { restart: true }); setHint(null); }} />
        </GlassPopoverContent>
      </GlassPopover>
    </div>
  );

  return (
    <main className="play-wrap safe-b">
      <div className="board-box">
        <Panel radius={22} className="p-1.5 sm:p-2" tint={Math.max(0.6, settings.tint)}>
          <div className="relative">
            <Board
              values={game.values}
              notes={game.notes}
              givens={game.puzzle.givens}
              sel={paused ? null : sel}
              focusDigit={paused ? 0 : focusDigit}
              errors={errors}
              hintCells={hint?.cells ?? []}
              highlightPeers={settings.highlightPeers}
              highlightSame={settings.highlightSame}
              won={won}
              onTap={onTap}
            />
            {showPause ? (
              <div className="paused-veil">
                <GButton variant="capsule" size={52} onClick={() => setPaused(false)} tint={0.7}>
                  <Play className="size-5" /> 继续游戏
                </GButton>
              </div>
            ) : null}
          </div>
        </Panel>
      </div>

      <div className="side">
        <Panel radius={22} className="px-4 py-2.5">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[15px] font-semibold">
                <span>{LEVEL_NAME[game.puzzle.level]}</span>
                <span className="truncate text-[13px] font-normal text-[var(--ink-soft)]">{game.puzzle.source === "bank" ? game.puzzle.name : game.puzzle.name ?? "我的题目"}</span>
              </div>
              <div className="num mt-0.5 flex gap-3 text-[12px] text-[var(--ink-soft)]">
                <span>进度 {progress}%</span>
                {settings.mistakeMode === "instant" ? <span>错误 {game.mistakes}</span> : null}
                <span>提示 {game.hintsUsed}</span>
              </div>
            </div>
            {settings.showTimer ? <div className="num text-[22px] font-semibold tabular-nums">{formatTime(game.elapsedMs)}</div> : null}
            <GButton aria-label={paused ? "继续" : "暂停"} size={40} onClick={() => setPaused((p) => !p)} disabled={won}>
              {paused ? <Play className="size-[18px]" /> : <Pause className="size-[18px]" />}
            </GButton>
          </div>
        </Panel>

        {hint ? (
          <Panel radius={18} className="px-4 py-3" tint={0.8}>
            <div className="flex gap-2 text-[14px] leading-relaxed">
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-[#f5a623]" />
              <span>{hint.message}</span>
            </div>
          </Panel>
        ) : null}

        <Panel radius={22} className="px-2 py-1.5">{toolbar}</Panel>

        <div className="pad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
            <DigitKey
              key={d}
              d={d}
              left={9 - counts[d]}
              hidden={settings.hideCompletedDigits && counts[d] >= 9 && !game.values.some((v, i) => v === d && game.puzzle.givens[i] === "0" && String(v) !== game.puzzle.solution[i])}
              active={activeDigit === d}
              note={noteMode}
              disabled={won || paused}
              onPress={(asNote) => onDigit(d, asNote)}
            />
          ))}
        </div>
        {settings.inputMode === "digit" ? (
          <p className="text-center text-[12px] text-[var(--ink-soft)]">先选数字，再点格子填入{activeDigit ? `（当前：${activeDigit}）` : ""}</p>
        ) : (
          <p className="hidden text-center text-[12px] text-[var(--ink-soft)] lg:block">键盘：1–9 填数 · 方向键移动 · N 笔记 · H 提示 · 空格暂停 · ⌘/Ctrl+Z 撤销</p>
        )}
      </div>

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <Panel radius={20} className="px-4 py-2.5 text-[14px]" tint={0.85}>{toast}</Panel>
        </div>
      ) : null}

      <GlassDialog open={winOpen} onOpenChange={setWinOpen}>
        <GlassDialogContent tint={0.85}>
          <div className="text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[linear-gradient(180deg,#ffd24d,#ff9f0a)] text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.8),0_10px_24px_-8px_rgba(255,159,10,0.7)]"><Trophy className="size-8" /></div>
            <GlassDialogTitle className="mt-3 text-[22px]">完成！</GlassDialogTitle>
            <GlassDialogDescription>你解开了这道{LEVEL_NAME[game.puzzle.level]}题</GlassDialogDescription>
            <div className="num mt-5 grid grid-cols-3 gap-2">
              {[
                { k: "用时", v: formatTime(game.elapsedMs) },
                { k: "错误", v: settings.mistakeMode === "instant" ? String(game.mistakes) : "—" },
                { k: "提示", v: String(game.hintsUsed) },
              ].map((x) => (
                <div key={x.k} className="rounded-2xl bg-black/5 py-3 dark:bg-white/10">
                  <div className="text-[20px] font-semibold">{x.v}</div>
                  <div className="text-[12px] text-[var(--ink-soft)]">{x.k}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex justify-center gap-3">
              <GButton variant="capsule" size={46} onClick={() => { setWinOpen(false); router.push("/"); }}>
                <Home className="size-4" /> 首页
              </GButton>
              <GButton variant="capsule" size={46} active onClick={newSameLevel}>
                <Plus className="size-4" /> 再来一局
              </GButton>
            </div>
          </div>
        </GlassDialogContent>
      </GlassDialog>
    </main>
  );
}

function DigitKey({ d, left, hidden, active, note, disabled, onPress }: {
  d: number; left: number; hidden: boolean; active: boolean; note: boolean; disabled: boolean; onPress: (asNote?: boolean) => void;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longFired = useRef(false);
  const start = () => {
    longFired.current = false;
    timer.current = setTimeout(() => { longFired.current = true; onPress(!note); navigator.vibrate?.(15); }, 450);
  };
  const cancel = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  return (
    <Panel flat radius={18} className={cn("key transition-opacity", hidden && "pointer-events-none opacity-0")}>
      <button
        type="button"
        disabled={disabled}
        aria-label={`数字 ${d}，还剩 ${left} 个`}
        onPointerDown={start}
        onPointerUp={cancel}
        onPointerLeave={cancel}
        onPointerCancel={cancel}
        onContextMenu={(e) => e.preventDefault()}
        onClick={() => { if (longFired.current) return; onPress(); }}
        className={cn(
          "num relative flex h-full w-full select-none flex-col items-center justify-center rounded-[inherit] transition-[scale] active:scale-90 disabled:opacity-40",
          active ? "bg-[var(--color-accent)] text-white" : note ? "text-[var(--ink-soft)]" : "text-[var(--user-ink)]"
        )}
      >
        <span className={cn("font-medium leading-none", note ? "text-[clamp(18px,5vw,26px)]" : "text-[clamp(22px,6.5vw,34px)]")}>{d}</span>
        <span className="mt-0.5 text-[10px] leading-none opacity-60">{left > 0 ? left : ""}</span>
      </button>
    </Panel>
  );
}
