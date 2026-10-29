"use client";

import { getSupabase } from "@/lib/supabase/client";
import type { Level, Puzzle } from "@/lib/sudoku/types";
import type {
  RoomChange,
  RoomGame,
  RoomMessage,
  RoomMessageKind,
  RoomPlayer,
} from "./types";

function requireClient() {
  const supabase = getSupabase();
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  return supabase;
}

function errorText(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return String(error ?? "");
}

export function friendlyRoomError(error: unknown): string {
  const text = errorText(error).toLowerCase();

  if (text.includes("supabase_not_configured")) return "联机服务尚未配置";
  if (text.includes("anonymous sign-ins are disabled")) return "Supabase 尚未开启匿名登录";
  if (text.includes("auth_required")) return "登录状态已失效，请刷新页面";
  if (text.includes("nickname_required")) return "请先输入昵称";
  if (text.includes("room_not_found")) return "没有找到这个房间，请检查房间码";
  if (text.includes("room_expired")) return "房间已过期";
  if (text.includes("room_full")) return "房间已满（最多 6 人）";
  if (text.includes("room_needs_players")) return "至少需要 2 名玩家才能开始";
  if (text.includes("players_not_ready")) return "还有玩家没有准备";
  if (text.includes("host_required")) return "只有房主可以开始游戏";
  if (text.includes("room_not_playing")) return "当前对局已结束或暂停";
  if (text.includes("room_version_conflict")) return "盘面刚刚被其他玩家更新，已自动同步";
  if (text.includes("room_membership_required")) return "你已不在这个房间";
  if (text.includes("room_rate_limited")) return "消息发送太快，请稍后再试";
  if (text.includes("invalid_message")) return "消息内容不能为空且不能超过 200 字";
  if (text.includes("invalid_puzzle")) return "题目数据无效";
  if (text.includes("room_code_unavailable")) return "房间码生成失败，请重试";
  if (text.includes("failed to fetch")) return "网络连接失败，请检查网络后重试";
  return "联机操作失败，请稍后重试";
}

export async function createOnlineRoom(nickname: string, difficulty: Level): Promise<RoomGame> {
  const { data, error } = await requireClient().rpc("create_room", {
    p_nickname: nickname,
    p_difficulty: difficulty,
  });
  if (error) throw error;
  return data as RoomGame;
}

export async function joinOnlineRoom(code: string, nickname: string): Promise<RoomGame> {
  const { data, error } = await requireClient().rpc("join_room", {
    p_code: code,
    p_nickname: nickname,
  });
  if (error) throw error;
  return data as RoomGame;
}

export async function loadRoomPlayers(roomId: string): Promise<RoomPlayer[]> {
  const { data, error } = await requireClient()
    .from("room_players")
    .select("*")
    .eq("room_id", roomId)
    .order("joined_at");
  if (error) throw error;
  return ((data ?? []) as RoomPlayer[]).map((player) => ({
    ...player,
    score: Number(player.score ?? 0),
    correct_moves: Number(player.correct_moves ?? 0),
    mistakes: Number(player.mistakes ?? 0),
  }));
}

export async function loadRoomMessages(roomId: string): Promise<RoomMessage[]> {
  const { data, error } = await requireClient()
    .from("room_messages")
    .select("*")
    .eq("room_id", roomId)
    .order("id", { ascending: false })
    .limit(100);
  if (error) throw error;
  return ((data ?? []) as RoomMessage[]).reverse();
}

export async function sendRoomMessage(
  roomId: string,
  content: string,
  kind: RoomMessageKind = "text"
): Promise<RoomMessage> {
  const { data, error } = await requireClient().rpc("send_room_message", {
    p_room_id: roomId,
    p_content: content,
    p_kind: kind,
  });
  if (error) throw error;
  return data as RoomMessage;
}

export async function reloadRoom(roomId: string): Promise<RoomGame> {
  const { data, error } = await requireClient()
    .from("rooms")
    .select("*")
    .eq("id", roomId)
    .single();
  if (error) throw error;
  return data as RoomGame;
}

export async function setRoomReady(roomId: string, ready: boolean): Promise<RoomGame> {
  const { data, error } = await requireClient().rpc("set_room_ready", {
    p_room_id: roomId,
    p_ready: ready,
  });
  if (error) throw error;
  return data as RoomGame;
}

export async function startOnlineRoom(roomId: string, puzzle: Puzzle): Promise<RoomGame> {
  const { data, error } = await requireClient().rpc("start_room", {
    p_room_id: roomId,
    p_puzzle: puzzle,
  });
  if (error) throw error;
  return data as RoomGame;
}

export async function applyOnlineChanges(roomId: string, changes: RoomChange[], expectedVersion: number): Promise<RoomGame> {
  const { data, error } = await requireClient().rpc("apply_room_changes", {
    p_room_id: roomId,
    p_changes: changes,
    p_expected_version: expectedVersion,
  });
  if (error) throw error;
  return data as RoomGame;
}

export async function heartbeatOnlineRoom(roomId: string): Promise<RoomGame> {
  const { data, error } = await requireClient().rpc("room_heartbeat", {
    p_room_id: roomId,
  });
  if (error) throw error;
  return data as RoomGame;
}

export async function leaveOnlineRoom(roomId: string): Promise<void> {
  const { error } = await requireClient().rpc("leave_room", {
    p_room_id: roomId,
  });
  if (error) throw error;
}
