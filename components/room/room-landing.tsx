"use client";

import { useState } from "react";
import { Link2, LogIn, Plus, UsersRound, WifiOff } from "lucide-react";
import { GButton, Panel } from "@/components/app/panel";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/glass-tabs";
import { LEVELS, LEVEL_NAME, type Level } from "@/lib/sudoku/types";

interface RoomLandingProps {
  configured: boolean;
  nickname: string;
  code: string;
  difficulty: Level;
  busy: "create" | "join" | null;
  error: string | null;
  onNicknameChange: (value: string) => void;
  onCodeChange: (value: string) => void;
  onDifficultyChange: (value: Level) => void;
  onCreate: () => void;
  onJoin: () => void;
}

export function RoomLanding({
  configured,
  nickname,
  code,
  difficulty,
  busy,
  error,
  onNicknameChange,
  onCodeChange,
  onDifficultyChange,
  onCreate,
  onJoin,
}: RoomLandingProps) {
  const [tab, setTab] = useState<"join" | "create">("join");

  return (
    <main className="safe-b mx-auto flex w-full max-w-[760px] flex-col gap-4 px-3 pb-10 pt-4">
      <Panel radius={28} className="overflow-hidden p-5 sm:p-7" tint={0.32}>
        <div className="flex items-start gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[20px] bg-[linear-gradient(145deg,#4facff,#5b6cff)] text-white shadow-[0_12px_28px_-10px_rgba(70,111,255,0.85)]">
            <UsersRound className="size-7" />
          </div>
          <div>
            <h1 className="text-[26px] font-bold tracking-tight">一起玩数独</h1>
            <p className="mt-1 text-[14px] leading-relaxed text-[var(--ink-soft)]">
              2–6 人共享同一棋盘，实时看到彼此的落子和光标。无需注册，输入昵称即可开始。
            </p>
          </div>
        </div>
      </Panel>

      {!configured ? (
        <Panel radius={20} className="flex gap-3 p-4 text-[14px]">
          <WifiOff className="mt-0.5 size-5 shrink-0 text-[#ff9f0a]" />
          <div>
            <div className="font-medium">联机服务尚未配置</div>
            <p className="mt-1 text-[12px] leading-relaxed text-[var(--ink-soft)]">
              设置 <code>NEXT_PUBLIC_SUPABASE_URL</code> 和 <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> 后即可创建房间。
            </p>
          </div>
        </Panel>
      ) : null}

      <Panel radius={26} className="p-5">
        <label className="block text-[14px] font-semibold" htmlFor="room-nickname">你的昵称</label>
        <input
          id="room-nickname"
          value={nickname}
          maxLength={20}
          autoComplete="nickname"
          onChange={(event) => onNicknameChange(event.target.value)}
          placeholder="例如：小南"
          className="mt-2 h-11 w-full rounded-2xl border border-black/10 bg-white/55 px-3 text-[15px] outline-none transition-colors placeholder:text-[var(--ink-soft)] focus:border-[var(--color-accent)] dark:border-white/15 dark:bg-white/10"
        />

        <div className="mt-5 grid grid-cols-2 rounded-full bg-black/5 p-1 dark:bg-white/10">
          <button
            type="button"
            onClick={() => setTab("join")}
            className={`h-9 rounded-full text-[14px] font-medium transition-colors ${tab === "join" ? "bg-white text-black shadow-sm dark:bg-white/25 dark:text-white" : "text-[var(--ink-soft)]"}`}
          >
            加入房间
          </button>
          <button
            type="button"
            onClick={() => setTab("create")}
            className={`h-9 rounded-full text-[14px] font-medium transition-colors ${tab === "create" ? "bg-white text-black shadow-sm dark:bg-white/25 dark:text-white" : "text-[var(--ink-soft)]"}`}
          >
            创建房间
          </button>
        </div>

        {tab === "join" ? (
          <div className="mt-5">
            <label className="block text-[14px] font-semibold" htmlFor="room-code">6 位房间码</label>
            <div className="mt-2 flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Link2 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--ink-soft)]" />
                <input
                  id="room-code"
                  value={code}
                  maxLength={6}
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(event) => onCodeChange(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                  placeholder="ABC234"
                  className="num h-11 w-full rounded-2xl border border-black/10 bg-white/55 pl-9 pr-3 text-[18px] font-semibold tracking-[0.18em] outline-none transition-colors placeholder:text-[15px] placeholder:tracking-normal placeholder:text-[var(--ink-soft)] focus:border-[var(--color-accent)] dark:border-white/15 dark:bg-white/10"
                />
              </div>
              <GButton
                variant="capsule"
                size={44}
                active
                disabled={!configured || busy !== null || code.length !== 6 || !nickname.trim()}
                onClick={onJoin}
              >
                <LogIn className="size-4" />
                {busy === "join" ? "加入中…" : "加入"}
              </GButton>
            </div>
          </div>
        ) : (
          <div className="mt-5">
            <div className="text-[14px] font-semibold">选择难度</div>
            <Tabs value={difficulty} onValueChange={(value) => onDifficultyChange(value as Level)} className="mt-2">
              <TabsList tint={0.24} className="w-full">
                {LEVELS.map((level) => (
                  <TabsTrigger key={level} value={level} className="flex-1 px-2 text-[14px]">
                    {LEVEL_NAME[level]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <GButton
              variant="capsule"
              size={48}
              active
              disabled={!configured || busy !== null || !nickname.trim()}
              onClick={onCreate}
              className="mt-4 w-full"
            >
              <Plus className="size-4" />
              {busy === "create" ? "创建中…" : `创建${LEVEL_NAME[difficulty]}房间`}
            </GButton>
          </div>
        )}

        {error ? <p role="alert" className="mt-3 text-[13px] text-[var(--error)]">{error}</p> : null}
      </Panel>

      <p className="px-3 text-center text-[12px] leading-relaxed text-[var(--ink-soft)]">
        联机对局需要网络连接。关闭页面后进度仍保存在房间中，24 小时内可通过房间码重新加入。
      </p>
    </main>
  );
}
