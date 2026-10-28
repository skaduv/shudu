"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Library, Play, Upload, UsersRound, X } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/glass-tabs";
import { Panel, GButton } from "@/components/app/panel";
import { Hero } from "./hero";
import { MiniBoard } from "@/components/game/mini-board";
import { useGame, useHydratedStore } from "@/lib/store/game";
import { pickRandom } from "@/lib/bank";
import { LEVELS, LEVEL_NAME, type Level } from "@/lib/sudoku/types";
import { formatTime } from "@/lib/format";

const LEVEL_DESC: Record<Level, string> = {
  easy: "只用唯一候选、隐性唯一，适合放松",
  medium: "需要区块摒除、数对等基础技巧",
  hard: "数对、三数组、X-Wing 轮番上阵",
  diabolical: "需要链、鱼等高级技巧或大胆试数",
};

export function HomeView() {
  const hydrated = useHydratedStore();
  const router = useRouter();
  const games = useGame((s) => s.games);
  const currentId = useGame((s) => s.currentId);
  const removeGame = useGame((s) => s.removeGame);
  const [level, setLevel] = useState<Level>("easy");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const inProgress = hydrated
    ? Object.values(games).filter((g) => g.status === "playing").sort((a, b) => b.updatedAt - a.updatedAt)
    : [];
  const current = inProgress.find((g) => g.puzzle.id === currentId) ?? inProgress[0];

  const start = async () => {
    setLoading(true);
    setErr(null);
    try {
      const st = useGame.getState();
      const p = await pickRandom(level, new Set([...st.completed, ...Object.keys(st.games)]));
      st.startGame(p);
      router.push(`/play/?id=${p.id}`);
    } catch {
      setErr("题库加载失败，请检查网络后重试");
      setLoading(false);
    }
  };

  const progressOf = (g: (typeof inProgress)[number]) => {
    const empty = g.puzzle.givens.split("").filter((x) => x === "0").length;
    const filled = g.values.filter((v, i) => v && g.puzzle.givens[i] === "0").length;
    return Math.round((filled / Math.max(1, empty)) * 100);
  };

  return (
    <main className="safe-b mx-auto flex w-full max-w-[720px] flex-col gap-4 px-3 pb-10 pt-4">
      <Panel radius={28} className="overflow-hidden" tint={0.3}>
        <Hero />
      </Panel>

      {current ? (
        <Panel radius={26} className="p-4">
          <div className="flex items-center gap-4">
            <MiniBoard givens={current.puzzle.givens} values={current.values} className="w-[92px] shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] text-[var(--ink-soft)]">继续上次的对局</div>
              <div className="mt-0.5 text-[19px] font-semibold">{LEVEL_NAME[current.puzzle.level]} · {current.puzzle.name ?? "我的题目"}</div>
              <div className="num mt-1 text-[13px] text-[var(--ink-soft)]">已完成 {progressOf(current)}% · 用时 {formatTime(current.elapsedMs)}</div>
            </div>
            <GButton variant="capsule" size={48} active onClick={() => router.push(`/play/?id=${current.puzzle.id}`)}>
              <Play className="size-4" /> 继续
            </GButton>
          </div>
        </Panel>
      ) : null}

      <Panel radius={26} className="p-4 sm:p-5">
        <div className="mb-3 text-[17px] font-semibold">开始新游戏</div>
        <Tabs value={level} onValueChange={(v) => setLevel(v as Level)}>
          <div className="flex justify-center">
            <TabsList tint={0.25} className="max-w-full">
              {LEVELS.map((l) => (
                <TabsTrigger key={l} value={l} className="px-[clamp(10px,3.5vw,18px)] text-[15px]">{LEVEL_NAME[l]}</TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>
        <p className="mt-3 text-center text-[13px] text-[var(--ink-soft)]">{LEVEL_DESC[level]}</p>
        <div className="mt-4 flex justify-center">
          <GButton variant="capsule" size={54} active onClick={start} disabled={loading} className="min-w-[200px]">
            {loading ? "正在出题…" : <>开始{LEVEL_NAME[level]}题 <ArrowRight className="size-4" /></>}
          </GButton>
        </div>
        {err ? <p className="mt-2 text-center text-[13px] text-[var(--error)]">{err}</p> : null}
      </Panel>

      {inProgress.length > 1 ? (
        <Panel radius={26} className="p-4">
          <div className="mb-2 text-[15px] font-semibold">进行中的对局</div>
          <ul className="divide-y divide-black/5 dark:divide-white/10">
            {inProgress.slice(0, 8).map((g) => (
              <li key={g.puzzle.id} className="flex items-center gap-3 py-2.5">
                <MiniBoard givens={g.puzzle.givens} values={g.values} className="w-11 shrink-0 text-[0px]" />
                <Link href={`/play/?id=${g.puzzle.id}`} className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-medium">{LEVEL_NAME[g.puzzle.level]} · {g.puzzle.name ?? "我的题目"}</div>
                  <div className="num text-[12px] text-[var(--ink-soft)]">{progressOf(g)}% · {formatTime(g.elapsedMs)}</div>
                </Link>
                <button type="button" aria-label="放弃这局" onClick={() => removeGame(g.puzzle.id)} className="grid h-8 w-8 place-items-center rounded-full text-[var(--ink-soft)] hover:bg-black/5 dark:hover:bg-white/10">
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <Link href="/room/">
        <Panel radius={24} className="flex items-center gap-4 p-4" tint={0.32}>
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(145deg,#4facff,#5b6cff)] text-white shadow-[0_8px_20px_-8px_rgba(70,111,255,0.8)]">
            <UsersRound className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold">联机协作</div>
            <div className="text-[12px] text-[var(--ink-soft)]">创建房间，和 1–5 位朋友一起解同一道题</div>
          </div>
          <ArrowRight className="size-4 shrink-0 text-[var(--ink-soft)]" />
        </Panel>
      </Link>

      <div className="grid grid-cols-2 gap-3">
        <Link href="/library/">
          <Panel radius={22} className="flex h-full items-center gap-3 p-4">
            <Library className="size-6 text-[#5b6cff]" />
            <div>
              <div className="text-[15px] font-semibold">题库</div>
              <div className="text-[12px] text-[var(--ink-soft)]">2200 道精选题，四档难度</div>
            </div>
          </Panel>
        </Link>
        <Link href="/upload/">
          <Panel radius={22} className="flex h-full items-center gap-3 p-4">
            <Upload className="size-6 text-[#ff5c8a]" />
            <div>
              <div className="text-[15px] font-semibold">上传题目</div>
              <div className="text-[12px] text-[var(--ink-soft)]">粘贴、导入或手动录入</div>
            </div>
          </Panel>
        </Link>
      </div>
    </main>
  );
}
