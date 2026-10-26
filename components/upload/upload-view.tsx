"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ClipboardPaste, FileUp, Grid3x3, Link2, Play, Save, XCircle } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/glass-tabs";
import { Panel, GButton } from "@/components/app/panel";
import { MiniBoard } from "@/components/game/mini-board";
import { analyze, splitPuzzles, type Analysis } from "@/lib/sudoku/analyze";
import { TECH_NAME, type Technique } from "@/lib/sudoku/logic";
import { saveUploads } from "@/lib/uploads";
import { useGame } from "@/lib/store/game";
import { LEVELS, LEVEL_NAME, type Level, type Puzzle } from "@/lib/sudoku/types";
import { cn } from "@/lib/utils";

type Mode = "paste" | "file" | "manual";
interface Item { raw: string; a: Analysis; level?: Level; name: string; saved?: boolean }

const SAMPLE = "530070000600195000098000060800060003400803001700020006060000280000419005000080079";
const MAX_BATCH = 500;

export function UploadView() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("paste");
  const [text, setText] = useState("");
  const [cells, setCells] = useState<string[]>(() => new Array(81).fill(""));
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const run = (sources: string[]) => {
    setBusy(true);
    setMsg(null);
    // 让出主线程，避免大批量时卡住界面
    setTimeout(() => {
      const list = sources.slice(0, MAX_BATCH).map((raw, k) => {
        const a = analyze(raw);
        return { raw, a, level: a.ok ? a.level : undefined, name: `上传 ${new Date().toLocaleDateString("zh-CN")} #${k + 1}` } as Item;
      });
      setItems(list);
      if (sources.length > MAX_BATCH) setMsg(`一次最多处理 ${MAX_BATCH} 道，已截取前 ${MAX_BATCH} 道`);
      if (!sources.length) setMsg("没有识别到题目");
      setBusy(false);
    }, 20);
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { setMsg("文件太大（上限 5MB）"); return; }
    const t = await f.text();
    let lines: string[];
    if (/\.csv$/i.test(f.name)) {
      lines = t.split(/\r?\n/).map((l) => l.split(/[,;\t]/).find((c) => /^[0-9.]{81}$/.test(c.trim())) ?? "").filter(Boolean);
    } else lines = splitPuzzles(t);
    run(lines);
  };

  const toPuzzle = (it: Item): Puzzle | null => {
    if (!it.a.ok) return null;
    return { id: it.a.id, givens: it.a.givens, solution: it.a.solution, level: it.level ?? it.a.level, source: "upload", name: it.name, addedAt: Date.now() };
  };

  const saveAll = async () => {
    const ps = items.map(toPuzzle).filter(Boolean) as Puzzle[];
    if (!ps.length) return;
    await saveUploads(ps);
    setItems((cur) => cur.map((it) => (it.a.ok ? { ...it, saved: true } : it)));
    setMsg(`已保存 ${ps.length} 道到「我的题目」`);
  };

  const play = async (it: Item) => {
    const p = toPuzzle(it);
    if (!p) return;
    await saveUploads([p]);
    useGame.getState().startGame(p);
    router.push(`/play/?id=${p.id}`);
  };

  const copyLink = async (it: Item) => {
    if (!it.a.ok) return;
    const url = `${location.origin}/play/?p=${it.a.givens}`;
    try { await navigator.clipboard.writeText(url); setMsg("分享链接已复制"); } catch { setMsg(url); }
  };

  const setCell = (i: number, v: string) => {
    const d = v.replace(/[^1-9]/g, "").slice(-1);
    setCells((c) => { const n = c.slice(); n[i] = d; return n; });
    if (d && i < 80) inputs.current[i + 1]?.focus();
  };
  const onCellKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    const go = (j: number) => { if (j >= 0 && j < 81) { e.preventDefault(); inputs.current[j]?.focus(); } };
    if (e.key === "ArrowRight") go(i + 1);
    else if (e.key === "ArrowLeft") go(i - 1);
    else if (e.key === "ArrowDown") go(i + 9);
    else if (e.key === "ArrowUp") go(i - 9);
    else if (e.key === "Backspace" && !cells[i]) go(i - 1);
  };

  const valid = items.filter((i) => i.a.ok).length;

  return (
    <main className="safe-b mx-auto flex w-full max-w-[860px] flex-col gap-4 px-3 pb-10 pt-4">
      <Panel radius={26} className="p-4 sm:p-5">
        <h1 className="text-[22px] font-bold tracking-tight">上传题目</h1>
        <p className="mt-1 text-[13px] text-[var(--ink-soft)]">自动检查冲突、是否有唯一解，并按所需技巧建议难度，你也可以手动改难度。题目只保存在本机浏览器。</p>
        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)} className="mt-4">
          <div className="flex justify-center">
            <TabsList tint={0.25}>
              <TabsTrigger value="paste"><ClipboardPaste className="size-[17px]" />粘贴</TabsTrigger>
              <TabsTrigger value="file"><FileUp className="size-[17px]" />导入文件</TabsTrigger>
              <TabsTrigger value="manual"><Grid3x3 className="size-[17px]" />手动录入</TabsTrigger>
            </TabsList>
          </div>
        </Tabs>

        <div className="mt-4">
          {mode === "paste" ? (
            <div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                spellCheck={false}
                placeholder={"每行一道题，81 个字符，空格用 0 或 . 表示\n也支持 9 行网格格式，例如：\n5 3 . | . 7 . | . . .\n6 . . | 1 9 5 | . . ."}
                className="num h-40 w-full resize-y rounded-2xl border border-black/10 bg-white/60 p-3 text-[14px] leading-relaxed outline-none focus:border-[var(--color-accent)] dark:border-white/15 dark:bg-black/30"
              />
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <GButton variant="capsule" size={42} onClick={() => setText(SAMPLE)}>填入示例</GButton>
                <GButton variant="capsule" size={42} active disabled={!text.trim() || busy} onClick={() => run(splitPuzzles(text))}>{busy ? "检查中…" : "检查题目"}</GButton>
              </div>
            </div>
          ) : mode === "file" ? (
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-black/15 bg-white/40 px-4 py-10 text-center dark:border-white/20 dark:bg-black/20">
              <FileUp className="size-8 text-[var(--color-accent)]" />
              <span className="text-[15px] font-medium">选择 .txt / .sdk / .csv 文件</span>
              <span className="text-[12px] text-[var(--ink-soft)]">一行一题可批量导入；支持 Sudoku Exchange 题库格式</span>
              <input type="file" accept=".txt,.sdk,.csv,.ss,text/plain,text/csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
          ) : (
            <div className="flex flex-col items-center">
              <div className="num grid w-full max-w-[420px] grid-cols-9 overflow-hidden rounded-2xl bg-white/60 dark:bg-black/30">
                {cells.map((v, i) => {
                  const r = Math.floor(i / 9), c = i % 9;
                  return (
                    <input
                      key={i}
                      ref={(el) => { inputs.current[i] = el; }}
                      value={v}
                      inputMode="numeric"
                      aria-label={`第${r + 1}行第${c + 1}列`}
                      onChange={(e) => setCell(i, e.target.value)}
                      onKeyDown={(e) => onCellKey(i, e)}
                      onFocus={(e) => e.target.select()}
                      className={cn(
                        "aspect-square w-full bg-transparent text-center text-[clamp(15px,4.5vw,22px)] font-semibold outline-none focus:bg-[var(--hl-sel)]",
                        "border-black/10 dark:border-white/10",
                        c % 3 === 2 && c !== 8 ? "border-r-2 border-r-black/40 dark:border-r-white/40" : c !== 8 && "border-r",
                        r % 3 === 2 && r !== 8 ? "border-b-2 border-b-black/40 dark:border-b-white/40" : r !== 8 && "border-b"
                      )}
                    />
                  );
                })}
              </div>
              <div className="mt-3 flex gap-2">
                <GButton variant="capsule" size={42} onClick={() => setCells(new Array(81).fill(""))}>清空</GButton>
                <GButton variant="capsule" size={42} active disabled={busy} onClick={() => run([cells.map((x) => x || "0").join("")])}>检查题目</GButton>
              </div>
            </div>
          )}
        </div>
        {msg ? <p className="mt-3 text-center text-[13px] text-[var(--ink-soft)]">{msg}</p> : null}
      </Panel>

      {items.length ? (
        <Panel radius={26} className="p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-[16px] font-semibold">检查结果：{valid} 道可用{items.length - valid ? `，${items.length - valid} 道有问题` : ""}</div>
            {valid > 1 ? <GButton variant="capsule" size={40} active onClick={saveAll}><Save className="size-4" />全部保存</GButton> : null}
          </div>
          <ul className="flex flex-col gap-3">
            {items.slice(0, 100).map((it, k) => (
              <li key={k} className="flex gap-3 rounded-2xl bg-white/40 p-3 dark:bg-white/5">
                {it.a.givens ? <MiniBoard givens={it.a.givens} className="w-[84px] shrink-0" /> : null}
                <div className="min-w-0 flex-1">
                  {it.a.ok ? (
                    <>
                      <div className="flex items-center gap-1.5 text-[14px] font-medium text-[#1f9d4c] dark:text-[#4cd97b]"><CheckCircle2 className="size-4" />唯一解 · {it.a.clues} 个已知数</div>
                      <div className="mt-1 text-[12px] text-[var(--ink-soft)]">
                        建议难度：{LEVEL_NAME[it.a.level]}{it.a.hardest ? `（最难用到：${TECH_NAME[it.a.hardest as Technique]}）` : ""}{it.a.level === "diabolical" ? "（基础技巧无法解开）" : ""}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <select
                          value={it.level}
                          onChange={(e) => setItems((cur) => cur.map((x, j) => (j === k ? { ...x, level: e.target.value as Level, saved: false } : x)))}
                          className="h-9 rounded-full border border-black/10 bg-white/70 px-3 text-[13px] dark:border-white/15 dark:bg-black/40"
                          aria-label="难度"
                        >
                          {LEVELS.map((l) => <option key={l} value={l}>{LEVEL_NAME[l]}</option>)}
                        </select>
                        <GButton variant="capsule" size={36} active onClick={() => play(it)}><Play className="size-3.5" />开始玩</GButton>
                        <GButton variant="capsule" size={36} disabled={it.saved} onClick={async () => { const p = toPuzzle(it); if (p) { await saveUploads([p]); setItems((cur) => cur.map((x, j) => (j === k ? { ...x, saved: true } : x))); } }}>
                          <Save className="size-3.5" />{it.saved ? "已保存" : "保存"}
                        </GButton>
                        <GButton variant="capsule" size={36} onClick={() => copyLink(it)}><Link2 className="size-3.5" />分享</GButton>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-start gap-1.5 text-[14px] text-[var(--error)]"><XCircle className="mt-0.5 size-4 shrink-0" />{it.a.error}</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {items.length > 100 ? <p className="mt-3 text-center text-[12px] text-[var(--ink-soft)]">只显示前 100 条结果，「全部保存」会保存所有可用题目</p> : null}
        </Panel>
      ) : null}
    </main>
  );
}
