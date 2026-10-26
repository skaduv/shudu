import { Suspense } from "react";
import { PlayView } from "@/components/game/play-view";

export const metadata = { title: "对局 · 液态数独" };

export default function PlayPage() {
  return (
    <Suspense fallback={<div className="flex justify-center pt-24 opacity-60">正在载入…</div>}>
      <PlayView />
    </Suspense>
  );
}
