import type { Level, Puzzle } from "@/lib/sudoku/types";

export type RoomStatus = "waiting" | "playing" | "won" | "closed";

export interface RoomGame {
  id: string;
  code: string;
  host_id: string;
  status: RoomStatus;
  difficulty: Level;
  puzzle_data: Puzzle | null;
  values: number[];
  notes: number[];
  owners: Array<string | null>;
  version: number;
  elapsed_ms: number;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
  expires_at: string;
}

export interface RoomPlayer {
  room_id: string;
  user_id: string;
  nickname: string;
  color_index: number;
  is_ready: boolean;
  score: number;
  correct_moves: number;
  mistakes: number;
  joined_at: string;
  last_seen_at: string;
}

export interface RoomMemberPresence {
  user_id: string;
  nickname: string;
  color_index: number;
  active_cell: number | null;
}

export interface RoomChange {
  i: number;
  v: number;
  n: number;
}

export type RoomMessageKind = "text" | "emoji";

export interface RoomMessage {
  id: number;
  room_id: string;
  user_id: string;
  nickname: string;
  kind: RoomMessageKind;
  content: string;
  created_at: string;
}

export type RoomConnectionState = "connecting" | "live" | "syncing" | "reconnecting";

export const ROOM_PLAYER_COLORS = [
  "#0a84ff",
  "#ff375f",
  "#30b85a",
  "#b05cff",
  "#ff9f0a",
  "#00a6b8",
] as const;
