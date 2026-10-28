import { Suspense } from "react";
import { RoomView } from "@/components/room/room-view";

export const metadata = { title: "联机房间 · 液态数独" };

export default function RoomPage() {
  return (
    <Suspense fallback={<div className="flex justify-center pt-24 opacity-60">正在载入联机房间…</div>}>
      <RoomView />
    </Suspense>
  );
}
