"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { RoomLanding } from "./room-landing";
import { RoomLobby } from "./room-lobby";
import { RoomGame } from "./room-game";
import {
  createOnlineRoom,
  friendlyRoomError,
  heartbeatOnlineRoom,
  joinOnlineRoom,
  leaveOnlineRoom,
  loadRoomMessages,
  loadRoomPlayers,
  reloadRoom,
  sendRoomMessage,
  setRoomReady,
  startOnlineRoom,
} from "@/lib/room/api";
import type {
  RoomConnectionState,
  RoomGame as RoomGameType,
  RoomMemberPresence,
  RoomMessage,
  RoomMessageKind,
  RoomPlayer,
} from "@/lib/room/types";
import { getSupabase, ensureAnonymousUser, isSupabaseConfigured } from "@/lib/supabase/client";
import { pickRandom } from "@/lib/bank";
import { Panel, GButton } from "@/components/app/panel";
import { LEVELS, type Level } from "@/lib/sudoku/types";

type BusyAction = "create" | "join" | "ready" | "start" | null;

interface PresencePayload {
  user_id: string;
  nickname: string;
  color_index: number;
  active_cell: number | null;
}

function mergeMessages(current: RoomMessage[], incoming: RoomMessage[]) {
  const byId = new Map<number, RoomMessage>();
  for (const message of current) byId.set(message.id, message);
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()]
    .sort((a, b) => a.id - b.id)
    .slice(-100);
}

export function RoomView() {
  const params = useSearchParams();
  const [nickname, setNickname] = useState("");
  const [code, setCode] = useState("");
  const [difficulty, setDifficulty] = useState<Level>("medium");
  const [userId, setUserId] = useState("");
  const [room, setRoom] = useState<RoomGameType | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [presence, setPresence] = useState<RoomMemberPresence[]>([]);
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<"connecting" | "subscribed" | "disconnected">("connecting");
  const [restHealth, setRestHealth] = useState<"unknown" | "ok" | "bad">("unknown");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [channelRetryKey, setChannelRetryKey] = useState(0);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const channelRetryTimerRef = useRef<number | null>(null);
  const heartbeatFailuresRef = useRef(0);
  const fallbackFailuresRef = useRef(0);
  const activeCellRef = useRef<number | null>(null);

  const connectionState = useMemo<RoomConnectionState>(() => {
    if (!room) return "connecting";
    if (realtimeStatus === "subscribed") return "live";
    if (restHealth === "ok") return "syncing";
    if (restHealth === "bad") return "reconnecting";
    return "connecting";
  }, [room, realtimeStatus, restHealth]);

  const myPlayer = useMemo(
    () => players.find((player) => player.user_id === userId) ?? null,
    [players, userId]
  );
  const presencePayload = useMemo<PresencePayload | null>(
    () =>
      myPlayer
        ? {
            user_id: myPlayer.user_id,
            nickname: myPlayer.nickname,
            color_index: myPlayer.color_index,
            active_cell: activeCellRef.current,
          }
        : null,
    [myPlayer]
  );
  const activeRoomId = room?.id;

  useEffect(() => {
    const queryCode = params.get("code")?.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) ?? "";
    if (queryCode) setCode(queryCode);
    try {
      const savedName = localStorage.getItem("liquid-sudoku:room-name");
      if (savedName) setNickname(savedName);
    } catch {
      // Storage can be unavailable in private browsing modes.
    }
  }, [params]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    ensureAnonymousUser()
      .then((user) => {
        if (active) setUserId(user.id);
      })
      .catch((cause) => {
        if (active) setError(friendlyRoomError(cause));
      });
    return () => { active = false; };
  }, []);

  const updatePlayers = useCallback(async (roomId: string) => {
    const next = await loadRoomPlayers(roomId);
    setPlayers(next);
  }, []);

  const handleSendMessage = useCallback(async (content: string, kind: RoomMessageKind) => {
    if (!activeRoomId) return;
    const message = await sendRoomMessage(activeRoomId, content, kind);
    setMessages((current) => mergeMessages(current, [message]));
  }, [activeRoomId]);

  const acceptRoomUpdate = useCallback((next: RoomGameType) => {
    setRoom((current) => (
      current && current.id === next.id && next.version < current.version
        ? current
        : next
    ));
  }, []);

  const enterRoom = useCallback(async (nextRoom: RoomGameType, nextUserId: string) => {
    setRoom(nextRoom);
    setUserId(nextUserId);
    setMessages([]);
    setMessagesLoaded(false);
    setLatencyMs(null);
    setRestHealth("unknown");
    setRealtimeStatus("connecting");
    heartbeatFailuresRef.current = 0;
    fallbackFailuresRef.current = 0;
    setError(null);
    setNotice(null);
    await updatePlayers(nextRoom.id);
    const url = new URL(window.location.href);
    url.search = `?code=${nextRoom.code}`;
    window.history.replaceState(null, "", url);
  }, [updatePlayers]);

  const requireUser = useCallback(async () => {
    if (userId) return userId;
    const user = await ensureAnonymousUser();
    setUserId(user.id);
    return user.id;
  }, [userId]);

  useEffect(() => {
    if (!room?.id) return;
    let active = true;
    setMessagesLoaded(false);
    loadRoomMessages(room.id)
      .then((history) => {
        if (!active) return;
        setMessages((current) => mergeMessages(current, history));
        setMessagesLoaded(true);
      })
      .catch(() => {
        if (active) setMessagesLoaded(true);
      });
    return () => { active = false; };
  }, [room?.id]);

  const handleCreate = async () => {
    if (!nickname.trim()) {
      setError("请先输入昵称");
      return;
    }
    setBusy("create");
    setError(null);
    try {
      try { localStorage.setItem("liquid-sudoku:room-name", nickname.trim()); } catch { /* private mode */ }
      const currentUser = await requireUser();
      const created = await createOnlineRoom(nickname.trim(), difficulty);
      await enterRoom(created, currentUser);
    } catch (cause) {
      setError(friendlyRoomError(cause));
    } finally {
      setBusy(null);
    }
  };

  const handleJoin = async () => {
    if (!nickname.trim()) {
      setError("请先输入昵称");
      return;
    }
    if (code.length !== 6) {
      setError("请输入 6 位房间码");
      return;
    }
    setBusy("join");
    setError(null);
    try {
      try { localStorage.setItem("liquid-sudoku:room-name", nickname.trim()); } catch { /* private mode */ }
      const currentUser = await requireUser();
      const joined = await joinOnlineRoom(code, nickname.trim());
      await enterRoom(joined, currentUser);
    } catch (cause) {
      setError(friendlyRoomError(cause));
    } finally {
      setBusy(null);
    }
  };

  const handleReady = async () => {
    if (!room || !myPlayer) return;
    setBusy("ready");
    setError(null);
    try {
      acceptRoomUpdate(await setRoomReady(room.id, !myPlayer.is_ready));
      await updatePlayers(room.id);
    } catch (cause) {
      setError(friendlyRoomError(cause));
    } finally {
      setBusy(null);
    }
  };

  const prepareAndStart = async () => {
    if (!room) return;
    setBusy("start");
    setError(null);
    try {
      const puzzle = await pickRandom(room.difficulty, new Set());
      acceptRoomUpdate(await startOnlineRoom(room.id, puzzle));
    } catch (cause) {
      setError(friendlyRoomError(cause));
      throw cause;
    } finally {
      setBusy(null);
    }
  };

  const handleStart = () => {
    void prepareAndStart().catch(() => {});
  };

  const handleRematch = () => {
    void prepareAndStart().catch(() => {});
  };

  const copyInvite = async () => {
    if (!room) return;
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    const url = `${window.location.origin}${base}/room/?code=${room.code}`;
    try {
      await navigator.clipboard.writeText(url);
      setNotice("邀请链接已复制");
    } catch {
      setNotice(`房间码：${room.code}`);
    }
  };

  const handleLeave = async () => {
    setBusy(null);
    if (room) {
      try {
        await leaveOnlineRoom(room.id);
      } catch {
        // Leaving the UI is still safe when a transient request fails.
      }
    }
    setRoom(null);
    setPlayers([]);
    setPresence([]);
    setMessages([]);
    setMessagesLoaded(false);
    setLatencyMs(null);
    setRestHealth("unknown");
    setRealtimeStatus("connecting");
    setNotice(null);
    setError(null);
    const url = new URL(window.location.href);
    url.search = "";
    window.history.replaceState(null, "", url);
  };

  const updateCursor = useCallback((cell: number | null) => {
    activeCellRef.current = cell;
    const channel = channelRef.current;
    if (!channel || !presencePayload) return;
    void channel.track({ ...presencePayload, active_cell: cell });
  }, [presencePayload]);

  useEffect(() => {
    if (!room || !userId) return;
    const supabase = getSupabase();
    if (!supabase) return;
    let active = true;
    const clearRetry = () => {
      if (channelRetryTimerRef.current != null) {
        window.clearTimeout(channelRetryTimerRef.current);
        channelRetryTimerRef.current = null;
      }
    };
    const scheduleRetry = () => {
      if (!active || channelRetryTimerRef.current != null) return;
      channelRetryTimerRef.current = window.setTimeout(() => {
        channelRetryTimerRef.current = null;
        if (active) setChannelRetryKey((value) => value + 1);
      }, 5_000);
    };
    setRealtimeStatus("connecting");

    const channel = supabase
      .channel(`room:${room.id}`, {
        config: { presence: { key: userId } },
      })
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${room.id}` },
        (payload) => {
          if (active) acceptRoomUpdate(payload.new as RoomGameType);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_players", filter: `room_id=eq.${room.id}` },
        () => {
          if (active) void updatePlayers(room.id).catch(() => {});
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "room_messages", filter: `room_id=eq.${room.id}` },
        (payload) => {
          if (!active) return;
          setMessages((current) => mergeMessages(current, [payload.new as RoomMessage]));
          setMessagesLoaded(true);
        }
      )
      .on("presence", { event: "sync" }, () => {
        if (!active) return;
        const states = Object.values(channel.presenceState()).flat() as unknown as PresencePayload[];
        setPresence(states.map((item) => ({
          user_id: item.user_id,
          nickname: item.nickname,
          color_index: item.color_index,
          active_cell: item.active_cell ?? null,
        })));
      })
      .subscribe((status) => {
        if (!active) return;
        if (status === "SUBSCRIBED") {
          clearRetry();
          setRealtimeStatus("subscribed");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setRealtimeStatus("disconnected");
          scheduleRetry();
        } else {
          setRealtimeStatus("connecting");
          scheduleRetry();
        }
      });

    channelRef.current = channel;
    return () => {
      active = false;
      clearRetry();
      channelRef.current = null;
      setRealtimeStatus("connecting");
      void supabase.removeChannel(channel);
    };
  }, [room?.id, userId, updatePlayers, acceptRoomUpdate, channelRetryKey]);

  useEffect(() => {
    const channel = channelRef.current;
    if (!channel || realtimeStatus !== "subscribed" || !presencePayload) return;
    void channel.track(presencePayload);
  }, [realtimeStatus, presencePayload]);

  useEffect(() => {
    if (!room || room.status === "closed") return;
    let active = true;
    const beat = async () => {
      const startedAt = performance.now();
      try {
        const next = await heartbeatOnlineRoom(room.id);
        if (active) {
          heartbeatFailuresRef.current = 0;
          setRestHealth("ok");
          setLatencyMs(Math.max(1, Math.round(performance.now() - startedAt)));
          acceptRoomUpdate(next);
          await updatePlayers(room.id);
        }
      } catch {
        if (!active) return;
        heartbeatFailuresRef.current += 1;
        if (heartbeatFailuresRef.current >= 2) {
          setRestHealth("bad");
          setLatencyMs(null);
          if (heartbeatFailuresRef.current === 2) {
            setChannelRetryKey((value) => value + 1);
          }
        }
      }
    };
    void beat();
    const timer = window.setInterval(() => void beat(), 8_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [room?.id, room?.status, updatePlayers, acceptRoomUpdate]);

  // WebSocket 断开或网络阻断时仍能同步盘面，避免只能等待下一次心跳。
  useEffect(() => {
    if (!room || realtimeStatus === "subscribed" || room.status === "closed") return;
    let active = true;

    const refresh = async () => {
      const startedAt = performance.now();
      try {
        const [nextRoom, nextPlayers, nextMessages] = await Promise.all([
          reloadRoom(room.id),
          loadRoomPlayers(room.id),
          loadRoomMessages(room.id),
        ]);
        if (active) {
          fallbackFailuresRef.current = 0;
          setRestHealth("ok");
          setLatencyMs(Math.max(1, Math.round(performance.now() - startedAt)));
          acceptRoomUpdate(nextRoom);
          setPlayers(nextPlayers);
          setMessages((current) => mergeMessages(current, nextMessages));
          setMessagesLoaded(true);
        }
      } catch {
        if (!active) return;
        fallbackFailuresRef.current += 1;
        if (fallbackFailuresRef.current >= 2) {
          setRestHealth("bad");
          setLatencyMs(null);
        }
      }
    };

    void refresh();
    const timer = window.setInterval(() => void refresh(), 4_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [room?.id, room?.status, realtimeStatus, acceptRoomUpdate]);

  useEffect(() => {
    const online = () => {
      setRestHealth("unknown");
      setChannelRetryKey((value) => value + 1);
    };
    const offline = () => {
      setRestHealth("bad");
      setLatencyMs(null);
    };
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    if (typeof navigator !== "undefined" && !navigator.onLine) offline();
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, []);

  if (room?.status === "waiting") {
    return (
      <RoomLobby
        room={room}
        players={players}
        userId={userId}
        connectionState={connectionState}
        latencyMs={latencyMs}
        busy={busy !== null}
        error={error}
        notice={notice}
        messages={messages}
        messagesLoaded={messagesLoaded}
        onSendMessage={handleSendMessage}
        onCopy={() => void copyInvite()}
        onReady={() => void handleReady()}
        onStart={handleStart}
        onLeave={() => void handleLeave()}
      />
    );
  }

  if (room && (room.status === "playing" || room.status === "won")) {
    return (
      <RoomGame
        room={room}
        players={players}
        userId={userId}
        presence={presence}
        connectionState={connectionState}
        latencyMs={latencyMs}
        busy={busy !== null}
        error={error}
        notice={notice}
        messages={messages}
        messagesLoaded={messagesLoaded}
        onSendMessage={handleSendMessage}
        onRoomUpdate={acceptRoomUpdate}
        onCursor={updateCursor}
        onCopy={() => void copyInvite()}
        onLeave={() => void handleLeave()}
        onRematch={handleRematch}
      />
    );
  }

  if (room?.status === "closed") {
    return (
      <main className="mx-auto max-w-md px-4 pt-16">
        <Panel className="p-6 text-center">
          <h1 className="text-[20px] font-semibold">房间已关闭</h1>
          <p className="mt-2 text-[14px] text-[var(--ink-soft)]">房间已过期，或者所有玩家都已离开。</p>
          <GButton variant="capsule" size={46} active className="mt-5" onClick={() => { setRoom(null); setPlayers([]); }}>创建新房间</GButton>
        </Panel>
      </main>
    );
  }

  return (
    <RoomLanding
      configured={isSupabaseConfigured}
      nickname={nickname}
      code={code}
      difficulty={difficulty}
      busy={busy === "create" || busy === "join" ? busy : null}
      error={error}
      onNicknameChange={setNickname}
      onCodeChange={setCode}
      onDifficultyChange={setDifficulty}
      onCreate={() => void handleCreate()}
      onJoin={() => void handleJoin()}
    />
  );
}
