"use client";
import { useRef, useState } from "react";
import { Download, FileUp, Trash2 } from "lucide-react";
import { Panel, GButton } from "@/components/app/panel";
import { GlassDialog, GlassDialogContent, GlassDialogTitle, GlassDialogDescription, GlassDialogClose } from "@/components/ui/glass-dialog";
import { flushStorage, useGame, useHydratedStore } from "@/lib/store/game";
import { listUploads, replaceUploads } from "@/lib/uploads";
import { LEVELS, LEVEL_NAME } from "@/lib/sudoku/types";
import { formatTime } from "@/lib/format";

export function StatsView() {
  const hydrated = useHydratedStore();
  const stats = useGame((s) => s.stats);
  const games = useGame((s) => s.games);
  const [confirm, setConfirm] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const totalWon = LEVELS.reduce((n, l) => n + (stats[l]?.won ?? 0), 0);
  const totalMs = LEVELS.reduce((n, l) => n + (stats[l]?.totalMs ?? 0), 0);
  const playing = Object.values(games).filter((g) => g.status === "playing").length;

  const exportData = async () => {
    flushStorage();
    const s = useGame.getState();
    const data = { app: "liquid-sudoku", version: 1, exportedAt: new Date().toISOString(), state: { games: s.games, currentId: s.currentId, completed: s.completed, settings: s.settings, stats: s.stats }, uploads: await listUploads() };
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `液态数独存档-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importData = async (f?: File) => {
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (data.app !== "liquid-sudoku" || !data.state) throw new Error();
      useGame.getState().importData(data.state);
      if (Array.isArray(data.uploads)) await replaceUploads(data.uploads);
      setMsg("存档已导入");
    } catch {
      setMsg("这不是有效的液态数独存档文件");
    }
  };

  if (!hydrated) return <div className="pt-24 text-center opacity-60">正在载入…</div>;

  return (
    <main className="safe-b mx-auto flex w-full max-w-[860px] flex-col gap-4 px-3 pb-10 pt-4">
      <Panel radius={26} className="p-5">
        <h1 className="text-[22px] font-bold tracking-tight">统计</h1>
        <div className="num mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            { k: "完成局数", v: String(totalWon) },
            { k: "总用时", v: formatTime(totalMs) },
            { k: "进行中", v: String(playing) },
          ].map((x) => (
            <div key={x.k} className="rounded-2xl bg-black/5 py-4 dark:bg-white/10">
              <div className="text-[24px] font-semibold">{x.v}</div>
              <div className="text-[12px] text-[var(--ink-soft)]">{x.k}</div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {LEVELS.map((l) => {
          const s = stats[l];
          const avg = s.won ? s.totalMs / s.won : 0;
          const rate = s.started ? Math.round((s.won / s.started) * 100) : 0;
          return (
            <Panel key={l} radius={24} className="p-4">
              <div className="text-[17px] font-semibold">{LEVEL_NAME[l]}</div>
              <dl className="num mt-3 grid grid-cols-3 gap-y-3 text-[13px]">
                {[
                  ["开局", s.started], ["完成", s.won], ["完成率", s.started ? `${rate}%` : "—"],
                  ["最佳", s.bestMs != null ? formatTime(s.bestMs) : "—"], ["平均", s.won ? formatTime(avg) : "—"], ["最长连胜", s.bestStreak],
                ].map(([k, v]) => (
                  <div key={String(k)}>
                    <dt className="text-[11px] text-[var(--ink-soft)]">{k}</dt>
                    <dd className="text-[17px] font-semibold">{v}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
          );
        })}
      </div>

      <Panel radius={24} className="p-4">
        <div className="text-[16px] font-semibold">存档</div>
        <p className="mt-1 text-[13px] text-[var(--ink-soft)]">进度保存在本机浏览器里。换设备或清理浏览器前，可以先导出存档。</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <GButton variant="capsule" size={42} onClick={exportData}><Download className="size-4" />导出存档</GButton>
          <GButton variant="capsule" size={42} onClick={() => fileRef.current?.click()}><FileUp className="size-4" />导入存档</GButton>
          <GButton variant="capsule" size={42} onClick={() => setConfirm(true)} className="!text-[var(--error)]"><Trash2 className="size-4" />清除全部数据</GButton>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => importData(e.target.files?.[0])} />
        </div>
        {msg ? <p className="mt-2 text-[13px] text-[var(--ink-soft)]">{msg}</p> : null}
      </Panel>

      <GlassDialog open={confirm} onOpenChange={setConfirm}>
        <GlassDialogContent>
          <GlassDialogTitle>清除全部数据？</GlassDialogTitle>
          <GlassDialogDescription>所有对局进度、统计和设置都会被删除（上传的题目保留），无法撤销。</GlassDialogDescription>
          <div className="mt-5 flex justify-end gap-2">
            <GlassDialogClose className="h-10 rounded-full bg-black/5 px-4 text-[15px] font-medium dark:bg-white/10">取消</GlassDialogClose>
            <button type="button" className="h-10 rounded-full bg-[var(--error)] px-4 text-[15px] font-medium text-white" onClick={() => { useGame.getState().resetAll(); setConfirm(false); setMsg("已清除"); }}>清除</button>
          </div>
        </GlassDialogContent>
      </GlassDialog>
    </main>
  );
}
