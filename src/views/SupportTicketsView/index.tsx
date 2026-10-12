import React, { FC, useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Input,
  Select,
  SelectItem,
  Spinner,
  Textarea,
  addToast,
} from "@heroui/react";
import { MessageSquarePlus, Send, Star, Ticket } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  createSupportTicket,
  getSupportTicket,
  getSupportTicketTypes,
  getSupportTickets,
  rateSupportTicket,
  replySupportTicket,
} from "@/routes/api";

/**
 * [CHANGE] F64: support tickets on the web storefront.
 *
 * The six ticket API functions have existed in routes/api.ts since F64 and no
 * page called any of them. The endpoint manifest counted them as linked
 * because a declared call site is a string literal like any other — which is
 * why the linkage report now reports declared-but-uncalled routes separately.
 *
 * A ticket is the asynchronous channel: live chat answers now, a ticket
 * survives being closed, carries an order with it, and can be rated.
 *
 * No validation rule is duplicated here. The server bounds the subject and
 * description, checks the order id against the real key, the type against the
 * types table and the priority against its allowed set.
 */

interface TicketMessage {
  id: number;
  send_by: string;
  message: string;
  created_at: string | null;
}

interface Ticket {
  id: number;
  subject: string;
  description: string;
  status: string;
  priority: string;
  // orders.id is a VARCHAR on the server. Never parsed as a number.
  order_id: string | null;
  ticket_type?: { title?: string } | null;
  satisfaction_rating: number | null;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string | null;
  messages: TicketMessage[];
}

interface TicketType {
  id: number;
  title: string;
}

// The server's own set. A friendlier list invented here would be rejected.
const PRIORITIES = [
  { key: "low", label: "Low" },
  { key: "normal", label: "Normal" },
  { key: "high", label: "High" },
  { key: "urgent", label: "Urgent" },
];

const normaliseTicket = (raw: any): Ticket | null => {
  if (!raw || typeof raw !== "object") return null;

  const messages = raw.customer_visible_messages ?? raw.messages;

  return {
    id: Number(raw.id) || 0,
    subject: String(raw.subject ?? ""),
    description: String(raw.description ?? ""),
    status: String(raw.status ?? ""),
    priority: String(raw.priority ?? ""),
    order_id: raw.order_id == null ? null : String(raw.order_id),
    ticket_type: raw.ticket_type ?? null,
    satisfaction_rating:
      raw.satisfaction_rating == null ? null : Number(raw.satisfaction_rating),
    resolved_at: raw.resolved_at ?? null,
    closed_at: raw.closed_at ?? null,
    created_at: raw.created_at ?? null,
    messages: Array.isArray(messages)
      ? messages.map((m: any) => ({
          id: Number(m.id) || 0,
          send_by: String(m.send_by ?? ""),
          message: String(m.message ?? ""),
          created_at: m.created_at ?? null,
        }))
      : [],
  };
};

const isMine = (sendBy: string): boolean =>
  ["customer", "user", "requester"].includes(sendBy.toLowerCase());

const isClosed = (ticket: Ticket): boolean =>
  Boolean(ticket.closed_at) || ticket.status.toLowerCase() === "closed";

// Rating is offered once the ticket is finished and only if not already
// rated — asking twice reads as the first answer having been lost.
const canRate = (ticket: Ticket): boolean =>
  Boolean(ticket.resolved_at || isClosed(ticket)) &&
  !(ticket.satisfaction_rating && ticket.satisfaction_rating > 0);

const SupportTicketsView: FC = () => {
  const { t } = useTranslation();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [types, setTypes] = useState<TicketType[]>([]);
  const [open, setOpen] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [composing, setComposing] = useState(false);
  const [error, setError] = useState("");

  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [orderId, setOrderId] = useState("");
  const [typeId, setTypeId] = useState<string>("");
  const [priority, setPriority] = useState("normal");
  const [reply, setReply] = useState("");
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const response = await getSupportTickets({ per_page: 20 });

    if (!response?.success) {
      setError(response?.message ?? "");
      setLoading(false);

      return;
    }

    const rows = (response as any)?.data?.data;
    setTickets(Array.isArray(rows) ? rows.map(normaliseTicket).filter(Boolean) as Ticket[] : []);
    setError("");
    setLoading(false);
  }, []);

  useEffect(() => {
    // Schedule the initial fetch after commit. Calling `load` synchronously in
    // the effect immediately sets loading state and triggers a cascading
    // render under React's strict-effects checks.
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load]);

  const loadTypes = useCallback(async () => {
    if (types.length > 0) return;

    const response = await getSupportTicketTypes();

    // A failure is not surfaced: a ticket can be raised without a type — the
    // field is nullable on the server — so an unavailable dropdown must not
    // stop someone reporting a problem.
    if (response?.success && Array.isArray((response as any).data)) {
      setTypes((response as any).data);
    }
  }, [types.length]);

  const openTicket = useCallback(async (id: number) => {
    const response = await getSupportTicket(String(id));
    const ticket = normaliseTicket((response as any)?.data);

    if (!response?.success || !ticket) {
      addToast({ title: response?.message ?? "", color: "danger" });

      return;
    }

    setOpen(ticket);
    setRating(0);
    setRatingComment("");
  }, []);

  const submitNew = useCallback(async () => {
    if (!subject.trim() || !description.trim()) return;

    setSending(true);
    const response = await createSupportTicket({
      subject: subject.trim(),
      description: description.trim(),
      ...(typeId ? { ticket_type_id: Number(typeId) } : {}),
      // A VARCHAR order id, sent as the string it is.
      ...(orderId.trim() ? { order_id: orderId.trim() } : {}),
      priority,
    });
    setSending(false);

    if (!response?.success) {
      addToast({ title: response?.message ?? "", color: "danger" });

      return;
    }

    setComposing(false);
    setSubject("");
    setDescription("");
    setOrderId("");
    setTypeId("");
    setPriority("normal");
    await load();

    const created = normaliseTicket((response as any)?.data);
    if (created) void openTicket(created.id);
  }, [description, load, openTicket, orderId, priority, subject, typeId]);

  const submitReply = useCallback(async () => {
    if (!open || !reply.trim()) return;

    setSending(true);
    const response = await replySupportTicket(String(open.id), reply.trim());
    setSending(false);

    if (!response?.success) {
      addToast({ title: response?.message ?? "", color: "danger" });

      return;
    }

    // Cleared only on success, so a failed reply is not silently lost.
    setReply("");
    // Re-read: replying can move the ticket's status, and the thread on the
    // server is the one that counts.
    await openTicket(open.id);
  }, [open, openTicket, reply]);

  const submitRating = useCallback(async () => {
    if (!open || rating === 0) return;

    setSending(true);
    const response = await rateSupportTicket(
      String(open.id),
      rating,
      ratingComment.trim() || undefined,
    );
    setSending(false);

    if (!response?.success) {
      addToast({ title: response?.message ?? "", color: "danger" });

      return;
    }

    await openTicket(open.id);
    await load();
  }, [load, open, openTicket, rating, ratingComment]);

  const canSubmitNew = useMemo(
    () => Boolean(subject.trim() && description.trim()) && !sending,
    [description, sending, subject],
  );

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-center gap-2">
        <Ticket className="h-5 w-5 text-primary" />
        <h1 className="flex-1 text-lg font-semibold">
          {t("supportTickets", "Support tickets")}
        </h1>
        {!open && (
          <Button
            color="primary"
            size="sm"
            startContent={<MessageSquarePlus className="h-4 w-4" />}
            onPress={() => {
              setComposing((v) => !v);
              void loadTypes();
            }}
          >
            {t("newTicket", "New ticket")}
          </Button>
        )}
        {open && (
          <Button size="sm" variant="light" onPress={() => setOpen(null)}>
            {t("back", "Back")}
          </Button>
        )}
      </div>

      {error && !open && <p className="mb-3 text-sm text-danger">{error}</p>}

      {!open && composing && (
        <Card className="mb-4 flex flex-col gap-3 p-4" shadow="none">
          <Input
            label={t("ticketSubject", "Subject")}
            maxLength={191}
            value={subject}
            onValueChange={setSubject}
          />
          <Textarea
            label={t("ticketDescription", "Describe the problem")}
            // Matches the server's cap, so a long description is stopped at
            // the field rather than by a 422 after it is written.
            maxLength={5000}
            minRows={4}
            value={description}
            onValueChange={setDescription}
          />
          {types.length > 0 && (
            <Select
              label={t("ticketCategory", "Category")}
              selectedKeys={typeId ? [typeId] : []}
              onSelectionChange={(keys) => setTypeId(String(Array.from(keys)[0] ?? ""))}
            >
              {types.map((type) => (
                <SelectItem key={String(type.id)}>{type.title}</SelectItem>
              ))}
            </Select>
          )}
          <Input
            label={t("ticketOrder", "Related order (optional)")}
            maxLength={14}
            value={orderId}
            onValueChange={setOrderId}
          />
          <Select
            label={t("ticketPriority", "Priority")}
            selectedKeys={[priority]}
            onSelectionChange={(keys) => setPriority(String(Array.from(keys)[0] ?? "normal"))}
          >
            {PRIORITIES.map((p) => (
              <SelectItem key={p.key}>{p.label}</SelectItem>
            ))}
          </Select>
          <Button color="primary" isDisabled={!canSubmitNew} isLoading={sending} onPress={submitNew}>
            {t("raiseTicket", "Raise a ticket")}
          </Button>
        </Card>
      )}

      {!open && (
        <div className="flex flex-col gap-2">
          {tickets.length === 0 && !composing && (
            <p className="py-10 text-center text-sm text-default-500">
              {t("noTicketsYet", "You have not raised any tickets yet.")}
            </p>
          )}
          {tickets.map((ticket) => (
            <Card
              key={ticket.id}
              isPressable
              className="p-4 text-left"
              shadow="none"
              onPress={() => void openTicket(ticket.id)}
            >
              <div className="flex w-full items-start gap-2">
                <span className="flex-1 text-sm font-semibold">{ticket.subject}</span>
                <span className="rounded-full bg-default-100 px-2 py-0.5 text-[10px] font-bold uppercase">
                  {ticket.status.replace(/_/g, " ") || "—"}
                </span>
              </div>
              <span className="mt-1 text-xs text-default-500">
                {[`#${ticket.id}`, ticket.ticket_type?.title, ticket.order_id]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </Card>
          ))}
        </div>
      )}

      {open && (
        <div className="flex flex-col gap-3">
          <Card className="p-4" shadow="none">
            <p className="text-sm font-semibold">{open.subject}</p>
            <p className="mt-1 text-xs text-default-500">
              {[open.status.replace(/_/g, " "), open.ticket_type?.title, open.order_id]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </Card>

          {/* The customer-visible thread only. Internal staff notes are
              excluded at the relation on the server, so they cannot reach
              this page and nothing here needs to filter them. */}
          <div className="flex flex-col gap-2 rounded-medium bg-default-50 p-3">
            {open.description && (
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-medium bg-primary px-3 py-2 text-sm text-white">
                  {open.description}
                </div>
              </div>
            )}
            {open.messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${isMine(message.send_by) ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-medium px-3 py-2 text-sm ${
                    isMine(message.send_by) ? "bg-primary text-white" : "bg-content1"
                  }`}
                >
                  <span className="whitespace-pre-wrap break-words">{message.message}</span>
                  {message.created_at && (
                    <span
                      className={`mt-1 block text-[10px] ${
                        isMine(message.send_by) ? "text-white/70" : "text-default-500"
                      }`}
                    >
                      {new Date(message.created_at).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {isClosed(open) ? (
            <p className="text-center text-xs text-default-500">
              {t(
                "ticketClosedNotice",
                "This ticket is closed. Raise a new one if you still need help.",
              )}
            </p>
          ) : (
            <div className="flex items-end gap-2">
              <Textarea
                minRows={1}
                maxRows={4}
                maxLength={5000}
                value={reply}
                onValueChange={setReply}
                placeholder={t("typeYourMessage", "Type your message")}
              />
              <Button
                isIconOnly
                color="primary"
                isDisabled={!reply.trim() || sending}
                isLoading={sending}
                onPress={submitReply}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          )}

          {canRate(open) && (
            <Card className="flex flex-col gap-3 p-4" shadow="none">
              <p className="text-sm font-semibold">{t("rateThisTicket", "How did we do?")}</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    aria-label={`${value}`}
                    type="button"
                    onClick={() => setRating(value)}
                  >
                    <Star
                      className={`h-6 w-6 ${
                        value <= rating ? "fill-warning text-warning" : "text-default-300"
                      }`}
                    />
                  </button>
                ))}
              </div>
              <Textarea
                minRows={2}
                maxLength={1000}
                value={ratingComment}
                onValueChange={setRatingComment}
                placeholder={t("ratingComment", "Anything to add? (optional)")}
              />
              {/* Zero is not a rating the server accepts, so the button stays
                  disabled until a star is chosen. */}
              <Button
                color="primary"
                isDisabled={rating === 0 || sending}
                isLoading={sending}
                onPress={submitRating}
              >
                {t("submitRating", "Submit rating")}
              </Button>
            </Card>
          )}

          {open.satisfaction_rating != null && open.satisfaction_rating > 0 && (
            <p className="text-center text-xs text-default-500">
              {t("ratingThanks", "Thanks for the feedback.")}{" "}
              {"★".repeat(open.satisfaction_rating)}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default SupportTicketsView;
