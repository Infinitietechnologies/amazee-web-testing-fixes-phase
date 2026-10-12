/**
 * [2026-10-06] Audit 6.2 — PDF "WhatsApp Support Integration": the support
 * number from the `whatsapp` settings entry as a click-to-chat link
 * (https://wa.me/<digits>?text=...). Null when no number is set.
 */
export const getWhatsAppSupportLink = (settings: unknown): string | null => {
  if (!Array.isArray(settings)) return null;
  const entry = settings.find(
    (item): item is { variable: string; value: unknown } =>
      Boolean(item) && typeof item === "object" && (item as { variable?: unknown }).variable === "whatsapp",
  );
  const value = (entry?.value ?? {}) as { supportNumber?: unknown; supportMessage?: unknown };
  const digits = String(value.supportNumber ?? "").replace(/\D/g, "");
  if (digits.length < 8) return null;
  const message = String(value.supportMessage ?? "").trim();

  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
};
