import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Spinner, Textarea, addToast } from "@heroui/react";
import { Bot, Headset, RefreshCw, Send, WifiOff } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  handoffSupportChat,
  pollSupportChat,
  readSupportChat,
  sendSupportChatMessage,
  startSupportChat,
} from "@/routes/api";

/**
 * [CHANGE] F66: live support chat on the web storefront.
 *
 * TRANSPORT. There is no socket — the backend has no broadcast driver, so this
 * polls a cursor endpoint ("everything after message id N"). The interval
 * backs off while the conversation is quiet, and snaps back the moment
 * anything is said, so a tab left open on this page does not hold a
 * request-every-few-seconds open all day.
 */

interface ChatMessage {
  id: number;
  sender: string;
  body: string;
  at: string | null;
}

interface ChatDetail {
  id: string;
  status: string;
  ai_active: boolean;
  assigned: boolean;
  unread: number;
  messages: ChatMessage[];
}

const FAST_INTERVAL = 4000;
const SLOW_INTERVAL = 15000;
const QUIET_POLLS_BEFORE_BACKOFF = 5;

/** A v4-shaped uuid. Its only job is to be unique per message so a retry is
 *  recognised by the server as the same one rather than a second message. */
const uuid = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;

    return v.toString(16);
  });
};

const normalise = (raw: any): ChatDetail | null => {
  if (!raw || typeof raw !== "object") return null;

  return {
    id: String(raw.id ?? ""),
    status: String(raw.status ?? ""),
    ai_active: raw.ai_active === true,
    assigned: raw.assigned === true,
    unread: Number(raw.unread ?? 0) || 0,
    messages: Array.isArray(raw.messages)
      ? raw.messages.map((m: any) => ({
          id: Number(m.id) || 0,
          sender: String(m.sender ?? ""),
          body: String(m.body ?? ""),
          at: m.at ?? null,
        }))
      : [],
  };
};

/** Merge by id. The same message arriving twice — once from the send response
 *  and again from the next poll — must collapse to one row. */
const merge = (current: ChatDetail | null, incoming: ChatDetail): ChatDetail => {
  const byId = new Map<number, ChatMessage>();
  (current?.messages ?? []).filter((m) => m.id > 0).forEach((m) => byId.set(m.id, m));
  incoming.messages.forEach((m) => byId.set(m.id, m));

  return {
    ...incoming,
    messages: Array.from(byId.values()).sort((a, b) => a.id - b.id),
  };
};

const cursorOf = (chat: ChatDetail | null): number =>
  (chat?.messages ?? []).reduce((max, m) => (m.id > max ? m.id : max), 0);

const SupportChatView: FC = () => {
  const { t } = useTranslation();

  const [chat, setChat] = useState<ChatDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState<Record<number, { body: string; uuid: string }>>({});
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const quietRef = useRef(0);
  // Bumped on unmount so a poll answered afterwards cannot set state.
  const sessionRef = useRef(0);
  const chatRef = useRef<ChatDetail | null>(null);
  const pendingIdRef = useRef(-1);

  chatRef.current = chat;

  const closed = useMemo(
    () => chat?.status === "closed" || chat?.status === "resolved",
    [chat?.status],
  );

  const scrollToEnd = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);

  /** Fire-and-forget. A failed read receipt must never surface as a chat
   *  error, and the next successful one corrects the count anyway. */
  const markRead = useCallback((detail: ChatDetail) => {
    const cursor = cursorOf(detail);
    if (cursor <= 0 || detail.unread === 0) return;

    void readSupportChat(detail.id, cursor);
  }, []);

  const stopPolling = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const schedulePoll = useCallback(
    (fast: boolean) => {
      stopPolling();

      const current = chatRef.current;
      // A closed conversation receives nothing further. Polling it forever
      // would be a request every few seconds for no possible result.
      if (!current || current.status === "closed" || current.status === "resolved") return;

      if (fast) quietRef.current = 0;

      const session = sessionRef.current;
      const delay =
        quietRef.current >= QUIET_POLLS_BEFORE_BACKOFF ? SLOW_INTERVAL : FAST_INTERVAL;

      timerRef.current = setTimeout(async () => {
        const target = chatRef.current;
        if (!target) return;

        const response = await pollSupportChat(target.id, cursorOf(target));
        if (session !== sessionRef.current) return;

        const incoming = normalise((response as any)?.data?.chat);

        if (!response?.success || !incoming) {
          // A failed poll is not worth an error banner over a working
          // conversation: the next tick usually succeeds. Back off so a
          // server that is down is not hammered.
          quietRef.current += 1;
          schedulePoll(false);

          return;
        }

        const merged = merge(chatRef.current, incoming);
        const somethingNew =
          merged.messages.length !== (chatRef.current?.messages.length ?? 0) ||
          merged.status !== target.status ||
          merged.assigned !== target.assigned ||
          merged.ai_active !== target.ai_active;

        if (somethingNew) {
          quietRef.current = 0;
          setChat(merged);
          markRead(merged);
        } else {
          quietRef.current += 1;
        }

        schedulePoll(somethingNew);
      }, delay);
    },
    [markRead, stopPolling],
  );

  const open = useCallback(async () => {
    setLoading(true);
    setError("");

    const session = sessionRef.current;
    const response = await startSupportChat();
    if (session !== sessionRef.current) return;

    const detail = normalise((response as any)?.data);

    if (!response?.success || !detail) {
      setLoading(false);
      setError(response?.message ?? "");

      return;
    }

    setChat(detail);
    chatRef.current = detail;
    setLoading(false);
    markRead(detail);
    schedulePoll(true);
  }, [markRead, schedulePoll]);

  useEffect(() => {
    void open();

    return () => {
      sessionRef.current += 1;
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollToEnd();
  }, [chat?.messages.length, scrollToEnd]);

  const deliver = useCallback(
    async (pendingId: number, body: string, clientUuid: string) => {
      const target = chatRef.current;
      if (!target) return;

      setSending(true);
      const session = sessionRef.current;

      const response = await sendSupportChatMessage(target.id, body, clientUuid);
      if (session !== sessionRef.current) return;

      const detail = normalise((response as any)?.data);

      if (!response?.success || !detail) {
        // The message stays on screen, marked failed. A support message the
        // customer believes was sent and was not is the worst outcome here.
        setSending(false);
        setFailed((prev) => ({ ...prev, [pendingId]: { body, uuid: clientUuid } }));
        if (response?.message) addToast({ title: response.message, color: "danger" });
        schedulePoll(false);

        return;
      }

      setFailed((prev) => {
        const next = { ...prev };
        delete next[pendingId];

        return next;
      });

      const withoutPending: ChatDetail | null = chatRef.current
        ? {
            ...chatRef.current,
            messages: chatRef.current.messages.filter((m) => m.id !== pendingId),
          }
        : null;

      const settled = merge(withoutPending, detail);
      setChat(settled);
      chatRef.current = settled;
      setSending(false);
      markRead(settled);
      schedulePoll(true);
    },
    [markRead, schedulePoll],
  );

  const send = useCallback(() => {
    const body = draft.trim();
    const target = chatRef.current;

    if (!body || !target || sending || closed) return;

    const pendingId = pendingIdRef.current;
    pendingIdRef.current -= 1;
    const clientUuid = uuid();

    // Shown immediately, with a negative id so it can never collide with a
    // real cursor value.
    const optimistic: ChatDetail = {
      ...target,
      messages: [
        ...target.messages,
        { id: pendingId, sender: "user", body, at: new Date().toISOString() },
      ],
    };

    setChat(optimistic);
    chatRef.current = optimistic;
    setDraft("");

    void deliver(pendingId, body, clientUuid);
  }, [closed, deliver, draft, sending]);

  const requestAgent = useCallback(async () => {
    const target = chatRef.current;
    if (!target) return;

    const session = sessionRef.current;
    const response = await handoffSupportChat(target.id);
    if (session !== sessionRef.current) return;

    const detail = normalise((response as any)?.data);

    if (!response?.success || !detail) {
      if (response?.message) addToast({ title: response.message, color: "danger" });

      return;
    }

    const merged = merge(chatRef.current, detail);
    setChat(merged);
    chatRef.current = merged;
    schedulePoll(true);
  }, [schedulePoll]);

  const talkingToAi = Boolean(chat?.ai_active && !chat?.assigned);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!chat) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-16 text-center">
        <WifiOff className="h-10 w-10 text-default-400" />
        <p>{error || t("supportChatUnavailable", "Support chat is unavailable right now.")}</p>
        <Button variant="bordered" startContent={<RefreshCw className="h-4 w-4" />} onPress={() => void open()}>
          {t("tryAgain", "Try again")}
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-160px)] max-w-3xl flex-col px-3 py-4">
      {/* Who the customer is talking to, and the way to change it. Left to be
          inferred, a customer phrases their problem for the wrong reader. */}
      <Card className="mb-3 flex flex-row items-center gap-2 px-4 py-3" shadow="none">
        {talkingToAi ? (
          <Bot className="h-4 w-4 text-primary" />
        ) : (
          <Headset className="h-4 w-4 text-primary" />
        )}
        <span className="flex-1 text-xs">
          {talkingToAi
            ? t("chatWithAssistant", "Assistant — ask for a person any time")
            : chat.assigned
              ? t("connectedToAgent", "Connected to a support agent")
              : t("waitingForAgent", "Waiting for a support agent")}
        </span>
        {talkingToAi && !closed && (
          <Button size="sm" variant="light" onPress={() => void requestAgent()}>
            {t("talkToAPerson", "Talk to a person")}
          </Button>
        )}
      </Card>

      <div className="flex-1 overflow-y-auto rounded-medium bg-default-50 p-3">
        {chat.messages.map((message) => {
          const mine = message.sender === "user";
          const isFailed = Boolean(failed[message.id]);

          if (message.sender === "system") {
            return (
              <p key={message.id} className="my-2 text-center text-xs text-default-500">
                {message.body}
              </p>
            );
          }

          return (
            <div key={message.id} className={`mb-2 flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[78%] rounded-medium px-3 py-2 text-sm ${
                  mine
                    ? `bg-primary text-white ${isFailed ? "opacity-50" : ""}`
                    : "bg-content1"
                }`}
              >
                {!mine && (
                  <span className="mb-1 block text-[10px] font-bold uppercase text-primary">
                    {message.sender === "ai"
                      ? t("assistant", "Assistant")
                      : t("supportChatTitle", "Support")}
                  </span>
                )}
                <span className="whitespace-pre-wrap break-words">{message.body}</span>
                <span className={`mt-1 block text-[10px] ${mine ? "text-white/70" : "text-default-500"}`}>
                  {isFailed
                    ? t("notSent", "Not sent")
                    : message.id < 0
                      ? t("sendingMessage", "Sending…")
                      : message.at
                        ? new Date(message.at).toLocaleString()
                        : ""}
                  {isFailed && (
                    <button
                      type="button"
                      className="ml-2 underline"
                      onClick={() => {
                        const retry = failed[message.id];
                        if (!retry) return;

                        setFailed((prev) => {
                          const next = { ...prev };
                          delete next[message.id];

                          return next;
                        });
                        // Same uuid as the first attempt, so the server treats
                        // a duplicate as the same message.
                        void deliver(message.id, retry.body, retry.uuid);
                      }}
                    >
                      {t("tryAgain", "Try again")}
                    </button>
                  )}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {closed ? (
        <div className="mt-3 flex flex-col items-center gap-2">
          <p className="text-xs text-default-500">
            {t("conversationClosed", "This conversation is closed.")}
          </p>
          <Button variant="bordered" onPress={() => void open()}>
            {t("startNewConversation", "Start a new conversation")}
          </Button>
        </div>
      ) : (
        <div className="mt-3 flex items-end gap-2">
          <Textarea
            minRows={1}
            maxRows={4}
            // Matches the server's validation. Being stopped at the field is
            // better than a 422 after typing a long message.
            maxLength={5000}
            value={draft}
            onValueChange={setDraft}
            placeholder={t("typeYourMessage", "Type your message")}
          />
          <Button
            isIconOnly
            color="primary"
            isDisabled={!draft.trim() || sending}
            isLoading={sending}
            onPress={send}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default SupportChatView;
