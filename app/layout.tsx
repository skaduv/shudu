import type { Metadata, Viewport } from "next";
import "./globals.css";
import { FxProvider } from "@/components/app/fx";
import { Wallpaper } from "@/components/app/wallpaper";
import { Nav } from "@/components/app/nav";

// metadata 里的绝对路径 Next 不会自动加 basePath，子路径部署需手动拼接
const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "液态数独 · Liquid Sudoku",
  description: "打开即玩的液态玻璃数独：单人练习、题库与联机协作，支持笔记、计时、逻辑提示和自动保存进度。",
  manifest: `${base}/manifest.webmanifest`,
  appleWebApp: { capable: true, title: "液态数独", statusBarStyle: "black-translucent" },
  icons: { icon: `${base}/icon.svg`, apple: `${base}/icon-192.png` },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#eef1fb",
};

// 在首帧前应用深色模式，避免闪烁
const themeScript = `try{var s=JSON.parse(localStorage.getItem('liquid-sudoku:v1')||'{}');var t=(s.state&&s.state.settings&&s.state.settings.theme)||'system';if(t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen min-h-dvh">
        <Wallpaper />
        <FxProvider>
          <Nav />
          {children}
        </FxProvider>
      </body>
    </html>
  );
}
