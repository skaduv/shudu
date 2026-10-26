// 从 Sudoku Exchange Puzzle Bank（公有领域）生成内置题库
// 用法：tsx scripts/build-puzzles.ts <题库txt所在目录>
import { readFileSync, writeFileSync } from "node:fs";
import { toGrid, toStr } from "../lib/sudoku/core";
import { solve } from "../lib/sudoku/solver";
import { rate } from "../lib/sudoku/logic";
import { LEVELS, LEVEL_PREFIX } from "../lib/sudoku/types";

const dir = process.argv[2] ?? "/tmp/bank";
const PER_LEVEL = 300;
const summary: Record<string, unknown> = {};
for (const level of LEVELS) {
  const lines = readFileSync(`${dir}/${level}.txt`, "utf8").split("\n")
    .map((l) => l.trim().split(/\s+/)).filter((p) => p.length >= 3 && /^[0-9]{81}$/.test(p[1]));
  const step = Math.max(1, Math.floor(lines.length / PER_LEVEL));
  const out: [string, string, string, number][] = [];
  const techs: Record<string, number> = {};
  for (let k = 0; k < lines.length && out.length < PER_LEVEL; k += step) {
    const [id, puzzle, r] = lines[k];
    const res = solve(toGrid(puzzle), 2);
    if (res.count !== 1 || !res.solution) continue;
    const rt = rate(toGrid(puzzle));
    techs[rt.hardest ?? "none"] = (techs[rt.hardest ?? "none"] ?? 0) + (rt.solvedByLogic ? 1 : 0);
    techs.stuck = (techs.stuck ?? 0) + (rt.solvedByLogic ? 0 : 1);
    out.push([`${LEVEL_PREFIX[level]}-${id}`, puzzle, toStr(res.solution), Number(r)]);
  }
  writeFileSync(`public/puzzles/${level}.json`, JSON.stringify(out));
  summary[level] = { count: out.length, techs };
}
console.log(JSON.stringify(summary, null, 1));
