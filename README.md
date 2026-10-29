# 液态数独 Liquid Sudoku

Next.js 16（App Router，静态导出）+ React 19 + Tailwind v4 + lore-glass 液态玻璃组件。

## 本地开发
    npm install
    npm run dev          # http://localhost:3000
    npm run build        # 生成 out/ 静态站点
    npx tsx scripts/build-puzzles.ts /path/to/bank   # 重新生成内置题库

## 目录
- app/                  路由：/ /play /library /upload /stats
- components/ui/        lore-glass 组件源码（shadcn 安装）
- components/app|game|home|library|upload|stats  业务组件
- lib/sudoku/           引擎：core 基础、solver 求解/唯一性、logic 技巧求解（提示+评级）、analyze 上传校验
- lib/store/game.ts     zustand 状态 + localStorage 持久化
- lib/uploads.ts        上传题目存 IndexedDB
- public/puzzles/       内置题库（简单、中等各 300 道，困难、地狱各 800 道，Sudoku Exchange Puzzle Bank，公有领域）
- scripts/serve.py      线上静态服务；scripts/deploy.sh 线上部署

## 联机房间（Supabase）

V1 联机模式使用 Supabase 的匿名登录、Postgres 和 Realtime。前端仍是静态导出，可继续部署到 GitHub Pages。

1. 在 Supabase 创建项目，区域优先选择离目标用户最近的 Tokyo 或 Singapore。
2. 在 Authentication 设置中启用匿名登录（Anonymous sign-ins）。
3. 在 SQL Editor 按顺序执行：
   - `supabase/migrations/202610280001_online_rooms.sql`
   - `supabase/migrations/202610290001_room_scores_chat.sql`
4. 复制 `.env.example` 为 `.env.local`，填入项目 URL 和 publishable key。
5. GitHub Pages 部署时，在仓库 Actions secrets 中配置 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`。

房间支持 2–6 人协作、房间码邀请、实时盘面、笔记、实时延迟、计分板、房间聊天与快捷表情、在线状态、断线重开、60 秒房主转移、24 小时有效期和完成后重新开局。房间进度保存在 Supabase，不会占用本机单机存档。

计分规则：正确落子 +10，错误落子 −4；擦除和笔记不计分。每次重新开局会清空本局得分。

