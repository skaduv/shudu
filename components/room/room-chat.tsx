"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, Send, SmilePlus, X } from "lucide-react";
import { GButton } from "@/components/app/panel";
import {
  GlassDialog,
  GlassDialogClose,
  GlassDialogContent,
  GlassDialogDescription,
  GlassDialogTitle,
} from "@/components/ui/glass-dialog";
import { friendlyRoomError } from "@/lib/room/api";
import {
  ROOM_PLAYER_COLORS,
  type RoomMessage,
  type RoomMessageKind,
  type RoomPlayer,
} from "@/lib/room/types";
import { cn } from "@/lib/utils";

const EMOJIS = ["👍", "👏", "🎉", "😄", "🤔", "💪", "✨", "😂", "🙌", "🔥"];

export function RoomChatButton({
  players,
  messages,
  messagesLoaded,
  userId,
  onSend,
}: {
  players: RoomPlayer[];
  messages: RoomMessage[];
  messagesLoaded: boolean;
  userId: string;
  onSend: (content: string, kind: RoomMessageKind) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const lastReadRef = useRef(0);
  const seededRef = useRef(false);

  const colors = useMemo(
    () => Object.fromEntries(players.map((player) => [
      player.user_id,
      ROOM_PLAYER_COLORS[player.color_index] ?? ROOM_PLAYER_COLORS[0],
    ])),
    [players]
  );
  const latestId = messages.at(-1)?.id ?? 0;

  useEffect(() => {
    if (!messagesLoaded) return;
    if (!seededRef.current) {
      lastReadRef.current = latestId;
      seededRef.current = true;
      return;
    }
    if (open) {
      lastReadRef.current = latestId;
      setUnread(0);
      return;
    }
    setUnread(messages.filter((message) => message.id > lastReadRef.current).length);
  }, [latestId, messages, messagesLoaded, open]);

  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [open, latestId]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      lastReadRef.current = latestId;
      setUnread(0);
    }
  };

  const send = async (content: string, kind: RoomMessageKind) => {
    const next = content.trim();
    if (!next || sending) return;
    setSending(true);
    setError(null);
    try {
      await onSend(next, kind);
      if (kind === "text") setDraft("");
    } catch (cause) {
      setError(friendlyRoomError(cause));
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => handleOpenChange(true)}
        className={cn(
          "relative inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-black/5 px-3 text-[13px] font-medium transition-[background-color,scale] hover:bg-black/10 active:scale-95 dark:bg-white/10 dark:hover:bg-white/15",
          open && "bg-[var(--color-accent)] text-white"
        )}
        aria-label={unread ? `房间聊天，${unread} 条新消息` : "房间聊天"}
      >
        <MessageCircle className="size-4" />
        <span className="hidden sm:inline">聊天</span>
        {unread ? (
          <span className="num absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-[var(--error)] px-1 text-[10px] font-semibold leading-5 text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      <GlassDialog open={open} onOpenChange={handleOpenChange}>
        <GlassDialogContent tint={0.9}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <GlassDialogTitle className="flex items-center gap-2 text-[19px]">
                <MessageCircle className="size-5 text-[var(--color-accent)]" />
                房间聊天
              </GlassDialogTitle>
              <GlassDialogDescription>消息会实时同步给房间里的所有人</GlassDialogDescription>
            </div>
            <GlassDialogClose
              className="grid size-8 place-items-center rounded-full bg-black/5 outline-none hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15"
              aria-label="关闭聊天"
            >
              <X className="size-4" />
            </GlassDialogClose>
          </div>

          <div
            ref={listRef}
            className="scroll-thin mt-4 h-[min(48vh,360px)] overflow-y-auto overscroll-contain rounded-[20px] bg-black/[0.035] px-2.5 py-3 dark:bg-white/[0.055]"
            role="log"
            aria-live="polite"
            aria-label="房间消息"
          >
            {!messagesLoaded ? (
              <p className="py-12 text-center text-[13px] text-[var(--ink-soft)]">正在载入消息…</p>
            ) : messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-[var(--ink-soft)]">
                <MessageCircle className="size-8 opacity-35" />
                <p className="mt-2 text-[13px]">还没有消息</p>
                <p className="mt-1 text-[11px] opacity-75">发句话或给队友加油吧</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {messages.map((message, index) => {
                  const mine = message.user_id === userId;
                  const previous = messages[index - 1];
                  const showName = !mine && previous?.user_id !== message.user_id;
                  const time = new Date(message.created_at).toLocaleTimeString("zh-CN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <div key={message.id} className={cn("flex items-end gap-1.5", mine ? "justify-end" : "justify-start")}>
                      {!mine ? (
                        <span
                          className={cn("grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white", previous?.user_id === message.user_id && "invisible")}
                          style={{ background: colors[message.user_id] ?? "var(--color-accent)" }}
                          aria-hidden="true"
                        >
                          {Array.from(message.nickname)[0] ?? "?"}
                        </span>
                      ) : null}
                      <div className={cn("min-w-0 max-w-[78%]", mine && "text-right")}>
                        {showName ? <div className="mb-0.5 pl-1 text-[10px] text-[var(--ink-soft)]">{message.nickname}</div> : null}
                        <div
                          className={cn(
                            "inline-block break-words rounded-[17px] px-3 py-2 text-left text-[13px] leading-relaxed shadow-sm",
                            message.kind === "emoji" ? "text-[23px] leading-none" : "whitespace-pre-wrap",
                            mine
                              ? "rounded-br-[6px] bg-[var(--color-accent)] text-white"
                              : "rounded-bl-[6px] bg-white/75 text-[var(--ink)] dark:bg-white/10"
                          )}
                        >
                          {message.content}
                        </div>
                        <div className="mt-0.5 px-1 text-[9px] text-[var(--ink-soft)] opacity-70">{time}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center gap-1 overflow-x-auto pb-0.5 scroll-thin">
            <SmilePlus className="mr-0.5 size-4 shrink-0 text-[var(--ink-soft)]" />
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                disabled={sending}
                onClick={() => void send(emoji, "emoji")}
                className="grid size-8 shrink-0 place-items-center rounded-xl text-[19px] transition-[background-color,scale] hover:bg-black/5 active:scale-90 disabled:opacity-40 dark:hover:bg-white/10"
                aria-label={`发送表情 ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>

          <form
            className="mt-2 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void send(draft, "text");
            }}
          >
            <input
              value={draft}
              maxLength={200}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="给队友发消息…"
              aria-label="消息内容"
              className="h-10 min-w-0 flex-1 rounded-2xl border border-black/10 bg-white/55 px-3 text-[14px] outline-none transition-colors placeholder:text-[var(--ink-soft)] focus:border-[var(--color-accent)] dark:border-white/15 dark:bg-white/10"
            />
            <GButton
              type="submit"
              variant="capsule"
              size={40}
              active
              disabled={!draft.trim() || sending}
              aria-label="发送消息"
            >
              <Send className="size-4" />
            </GButton>
          </form>
          {error ? <p role="alert" className="mt-2 text-[12px] text-[var(--error)]">{error}</p> : null}
        </GlassDialogContent>
      </GlassDialog>
    </>
  );
}
