"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Grid3x3, Library, Settings2, Upload, UsersRound } from "lucide-react";
import { useState } from "react";
import { Panel, GButton } from "./panel";
import { SettingsDialog } from "./settings";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "开局", icon: Grid3x3 },
  { href: "/library/", label: "题库", icon: Library },
  { href: "/upload/", label: "上传", icon: Upload },
  { href: "/stats/", label: "统计", icon: BarChart3 },
  { href: "/room/", label: "联机", icon: UsersRound },
];

export function Nav() {
  const path = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const norm = (p: string) => (p.endsWith("/") ? p : p + "/");
  return (
    <header className="safe-t sticky top-0 z-30 flex justify-center px-3">
      <Panel radius={26} className="w-full max-w-[720px]">
        <nav className="flex h-[52px] items-center gap-1 px-2">
          <Link href="/" className="mr-auto flex items-center gap-2 pl-2 pr-1 font-semibold tracking-tight">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/icon.svg`} alt="" width={32} height={32} className="h-8 w-8 rounded-[10px] shadow-[0_4px_10px_-4px_rgba(90,61,240,0.6)]" />
            <span className="hidden text-[17px] sm:inline">液态数独</span>
          </Link>
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? path === "/" : norm(path).startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex h-10 items-center gap-1.5 rounded-full px-3 text-[14px] font-medium transition-colors",
                  active ? "bg-[var(--hl-same)] text-[var(--user-ink)]" : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
                )}
              >
                <Icon className="size-[18px]" />
                <span className="hidden min-[420px]:inline">{label}</span>
              </Link>
            );
          })}
          <GButton aria-label="设置" size={40} onClick={() => setOpen(true)} className="ml-1">
            <Settings2 className="size-[18px]" />
          </GButton>
        </nav>
      </Panel>
      <SettingsDialog open={open} onOpenChange={setOpen} />
    </header>
  );
}
