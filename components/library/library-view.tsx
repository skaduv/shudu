"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, CircleDot, Trash2, Upload } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/glass-tabs";
import { Panel, GButton } from "@/components/app/panel";
import { MiniBoard } from "@/components/game/mini-board";
import { loadLevel } from "@/lib/bank";
import { listUploads, removeUpload } from "@/lib/uploads";
import { useGame, useHydratedStore } from "@/lib/store/game";
import { LEVELS, LEVEL_NAME, type Level, type Puzzle } from "@/lib/sudoku/types";

type TabKey = Level | "mine";
const PAGE = 48;

export function LibraryView() {
  const hydrated = useHydratedStore();
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("easy");
  const [items, setItems] = useState<Puzzle[] | null>(null);
  const [shown, setShown] = useState(PAGE);
  const [filter, setFilter] = useState<"all" | "new" | "done">("all");
  const games = useGame((s) => s.games);
  const completed = useGame((s) => s.completed);

  useEffect(() => {
    setItems(null);
    setShown(PAGE);
    const p = tab === "mine" ? listUploads() : loadLevel(tab);
    p.then(setItems).catch(() => setItems([]));
  }, [tab]);

  const done = useMemo(() => new Set(completed), [completed]);
  const visible = useMemo(() => {
    if (!items) return [];
    return items.filter((p) => (filter === "all" ? true : filter === "done" ? done.has(p.id) : !done.has(p.id)));
  }, [items, filter, done]);

  const open = (p: Puzzle) => {
    useGame.getState().startGame(p);
    router.push(`/play/?id=${p.id}`);
  };

  return (
    <main className="safe-b mx-auto flex w-full max-w-[960px] flex-col gap-4 px-3 pb-10 pt-4">
      <Panel radius={26} className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight">题库</h1>
            <p className="text-[13px] text-[var(--ink-soft)]">简单、中等各 300 道，困难、地狱各 800 道，均已验证唯一解</p>
          </div>
          <div className="flex rounded-full bg-black/5 p-0.5 text-[13px] dark:bg-white/10">
            {([["all", "全部"], ["new", "未完成"], ["done", "已完成"]] as const).map(([k, label]) => (
              <button key={k} type="button" onClick={() => setFilter(k)} className={`h-8 rounded-full px-3 font-medium ${filter === k ? "bg-white text-black shadow-sm dark:bg-white/25 dark:text-white" : "text-[var(--ink-soft)]"}`}>{label}</button>
            ))}
          </div>
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="mt-4">
          <div className="scroll-thin flex justify-center overflow-x-auto">
            <TabsList tint={0.25}>
              {LEVELS.map((l) => <TabsTrigger key={l} value={l}>{LEVEL_NAME[l]}</TabsTrigger>)}
              <TabsTrigger value="mine">我的题目</TabsTrigger>
            </TabsList>
          </div>
        </Tabs>
      </Panel>

      {items === null ? (
        <div className="py-16 text-center text-[var(--ink-soft)]">正在加载题库…</div>
      ) : visible.length === 0 ? (
        <Panel radius={24} className="p-8 text-center">
          <p className="text-[15px]">{tab === "mine" ? "还没有上传过题目" : "这里暂时没有题目"}</p>
          {tab === "mine" ? (
            <Link href="/upload/" className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-5 py-2.5 text-white"><Upload className="size-4" />去上传</Link>
          ) : null}
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {visible.slice(0, shown).map((p) => {
              const g = hydrated ? games[p.id] : undefined;
              const isDone = hydrated && done.has(p.id);
              const clues = p.givens.split("").filter((x) => x !== "0").length;
              return (
                <Panel key={p.id} radius={22} className="p-3">
                  <button type="button" onClick={() => open(p)} className="block w-full text-left">
                    <MiniBoard givens={p.givens} values={g?.values} />
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-semibold">{p.name ?? "我的题目"}</div>
                        <div className="num text-[11px] text-[var(--ink-soft)]">{LEVEL_NAME[p.level]} · {clues} 个已知数</div>
                      </div>
                      {isDone ? <CheckCircle2 className="size-5 shrink-0 text-[#34c759]" aria-label="已完成" /> : g ? <CircleDot className="size-5 shrink-0 text-[var(--color-accent)]" aria-label="进行中" /> : null}
                    </div>
                  </button>
                  {tab === "mine" ? (
                    <button type="button" onClick={() => removeUpload(p.id).then(setItems)} className="mt-1 flex items-center gap-1 text-[12px] text-[var(--error)]">
                      <Trash2 className="size-3.5" />删除
                    </button>
                  ) : null}
                </Panel>
              );
            })}
          </div>
          {shown < visible.length ? (
            <div className="flex justify-center">
              <GButton variant="capsule" size={46} onClick={() => setShown((n) => n + PAGE)}>加载更多（还有 {visible.length - shown} 道）</GButton>
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}
