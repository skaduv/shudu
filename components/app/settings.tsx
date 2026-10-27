"use client";
import { GlassDialog, GlassDialogContent, GlassDialogTitle, GlassDialogClose } from "@/components/ui/glass-dialog";
import { GlassSwitch } from "@/components/ui/glass-switch";
import { GlassSlider } from "@/components/ui/glass-slider";
import { useGame, type Settings } from "@/lib/store/game";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-full bg-black/5 p-0.5 dark:bg-white/10">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={cn(
            "h-8 flex-1 whitespace-nowrap rounded-full px-2.5 text-[13px] font-medium transition-colors",
            value === o.v ? "bg-white text-black shadow-sm dark:bg-white/25 dark:text-white" : "text-[var(--ink-soft)]"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Row({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <div className="text-[15px] font-medium">{label}</div>
        {desc ? <div className="text-[12px] text-[var(--ink-soft)]">{desc}</div> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const s = useGame((st) => st.settings);
  const set = useGame((st) => st.setSettings);
  const sw = (k: keyof Settings) => (
    <GlassSwitch ariaLabel={k} checked={Boolean(s[k])} onCheckedChange={(v) => set({ [k]: v } as Partial<Settings>)} />
  );
  return (
    <GlassDialog open={open} onOpenChange={onOpenChange}>
      <GlassDialogContent tint={0.85}>
        <div className="mb-2 flex items-center justify-between">
          <GlassDialogTitle className="text-[20px]">设置</GlassDialogTitle>
          <GlassDialogClose className="grid h-8 w-8 place-items-center rounded-full bg-black/5 dark:bg-white/10" aria-label="关闭">
            <X className="size-4" />
          </GlassDialogClose>
        </div>
        <div className="scroll-thin max-h-[70vh] supports-[height:1dvh]:max-h-[70dvh] overflow-x-hidden divide-y divide-black/5 overflow-y-auto pr-1 dark:divide-white/10">
          <div className="py-2.5">
            <div className="mb-2 text-[15px] font-medium">错误提示</div>
            <Segmented
              value={s.mistakeMode}
              onChange={(v) => set({ mistakeMode: v })}
              options={[{ v: "instant", label: "立即标错" }, { v: "conflict", label: "只标冲突" }, { v: "off", label: "关闭" }]}
            />
            <div className="mt-1.5 text-[12px] text-[var(--ink-soft)]">「立即标错」会对照答案并计入错误次数</div>
          </div>
          <div className="py-2.5">
            <div className="mb-2 text-[15px] font-medium">输入方式</div>
            <Segmented
              value={s.inputMode}
              onChange={(v) => set({ inputMode: v })}
              options={[{ v: "cell", label: "先选格子" }, { v: "digit", label: "先选数字" }]}
            />
          </div>
          <Row label="填数后自动清除笔记" desc="同行、同列、同宫的相同候选数">{sw("autoClearNotes")}</Row>
          <Row label="高亮行列宫">{sw("highlightPeers")}</Row>
          <Row label="高亮相同数字">{sw("highlightSame")}</Row>
          <Row label="隐藏已填满的数字">{sw("hideCompletedDigits")}</Row>
          <Row label="显示计时器">{sw("showTimer")}</Row>
          <Row label="震动反馈" desc="仅支持的手机">{sw("haptics")}</Row>
          <div className="py-2.5">
            <div className="mb-2 text-[15px] font-medium">外观</div>
            <Segmented
              value={s.theme}
              onChange={(v) => set({ theme: v })}
              options={[{ v: "system", label: "跟随系统" }, { v: "light", label: "浅色" }, { v: "dark", label: "深色" }]}
            />
          </div>
          <div className="py-2.5">
            <div className="mb-1 flex items-center justify-between text-[15px] font-medium">
              <span>玻璃通透度</span>
              <span className="num text-[13px] text-[var(--ink-soft)]">{s.tint < 0.34 ? "清透" : s.tint < 0.67 ? "适中" : "磨砂"}</span>
            </div>
            <GlassSlider ariaLabel="玻璃通透度" min={0} max={100} value={Math.round(s.tint * 100)} onValueChange={(v) => set({ tint: v / 100 })} />
          </div>
          <div className="py-2.5">
            <div className="mb-2 text-[15px] font-medium">玻璃特效</div>
            <Segmented
              value={s.effects}
              onChange={(v) => set({ effects: v })}
              options={[{ v: "auto", label: "自动" }, { v: "full", label: "完整折射" }, { v: "lite", label: "省电" }]}
            />
            <div className="mt-1.5 text-[12px] text-[var(--ink-soft)]">折射效果在 Chrome / Edge 上最完整，Safari 与 Firefox 显示为磨砂玻璃</div>
          </div>
        </div>
      </GlassDialogContent>
    </GlassDialog>
  );
}
