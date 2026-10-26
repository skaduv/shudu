import type { Metadata, Viewport } from "next";
import "./globals.css";
import { FxProvider } from "@/components/app/fx";
import { Wallpaper } from "@/components/app/wallpaper";
import { Nav } from "@/components/app/nav";

export const metadata: Metadata = {
  title: "液态数独 · Liquid Sudoku",
  description: "打开即玩的液态玻璃数独：笔记、擦除、撤销、计时、逻辑提示，自动保存进度，支持上传题目。",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "液态数独", statusBarStyle: "black-translucent" },
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
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
      <body className="min-h-dvh">
        <Wallpaper />
        <FxProvider>
          <Nav />
          {children}
        </FxProvider>
      </body>
    </html>
  );
}
