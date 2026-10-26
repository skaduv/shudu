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
- public/puzzles/       内置题库（每档 300 道，Sudoku Exchange Puzzle Bank，公有领域）
- scripts/serve.py      线上静态服务；scripts/deploy.sh 线上部署

