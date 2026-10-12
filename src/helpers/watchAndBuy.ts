import type { WatchAndBuySettings } from "@/types/WatchAndBuy";

/**
 * [AmazeeNow v3.2 port] Watch & Buy gating.
 *
 * The public settings payload is an array of `{ variable, value }` entries.
 * The `Settings` tuple type predates Watch & Buy, so the entry is read
 * structurally here instead of widening that tuple (every existing consumer and
 * test fixture would otherwise have to change shape).
 *
 * The feature is ON only when the backend explicitly says `enabled: true`.
 * A missing entry (older backend), a malformed value or `enabled: false` all
 * mean OFF, so no entry point to `/play/` appears for a feature the backend
 * cannot serve. Both the navbar link and the bottom-navigation "Watch" tab
 * read this one predicate (v3.2 forgot to gate the bottom-nav tab).
 */
export const getWatchAndBuySettings = (
  settings: unknown,
): WatchAndBuySettings | null => {
  if (!Array.isArray(settings)) return null;

  const entry = settings.find(
    (item): item is { variable: string; value: unknown } =>
      Boolean(item) &&
      typeof item === "object" &&
      (item as { variable?: unknown }).variable === "watch_and_buy",
  );
  const value = entry?.value;

  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as WatchAndBuySettings)
    : null;
};

export const isWatchAndBuyEnabled = (settings: unknown): boolean =>
  getWatchAndBuySettings(settings)?.enabled === true;

/** Customer-facing feature title, or the supplied fallback when unset/blank. */
export const getWatchAndBuyTitle = (
  settings: unknown,
  fallback = "Watch & Buy",
): string => {
  const title = getWatchAndBuySettings(settings)?.title;
  return typeof title === "string" && title.trim() ? title.trim() : fallback;
};

/** The Watch & Buy landing page. Trailing slash matches `trailingSlash` export routing. */
export const WATCH_AND_BUY_PATH = "/play/";
