import axios from "axios";

/**
 * [AmazeeNow v3.2 port 2026-09-28] Minimal API failure reporting.
 *
 * The v3.2 Watch & Buy client calls `reportApiFailure`, which our fork did not
 * have. This is the small equivalent: it logs a sanitised summary of a failed
 * request (method, path with identifiers redacted, status, Axios code) and
 * never hands the raw Axios error — which carries headers, including the
 * bearer token — to the console. Existing API helpers keep their own
 * `console.error("API error:", …)` convention; nothing else is changed.
 */

export type ApiFailureDetails = Readonly<{
  code?: string;
  method?: string;
  path?: string;
  status?: number;
}>;

type RetryableApiFailure = {
  retryable: boolean;
};

const reportedAxiosErrors = new WeakSet<object>();

/** Numeric, UUID-ish, e-mail-ish or long opaque segments are replaced by `:id`. */
const redactPathIdentifiers = (path: string): string =>
  path
    .split("/")
    .map((segment) => {
      if (!segment) return segment;

      let decoded = segment;
      try {
        decoded = decodeURIComponent(segment);
      } catch {
        // Keep the encoded segment for the conservative checks below.
      }

      const looksLikeIdentifier =
        /^\d+$/.test(decoded) ||
        /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(decoded) ||
        decoded.includes("@") ||
        (decoded.length >= 24 && /^[a-zA-Z0-9_-]+$/.test(decoded));

      return looksLikeIdentifier ? ":id" : segment;
    })
    .join("/");

const getSafePath = (url: string | undefined): string | undefined => {
  if (!url) return undefined;

  try {
    // A fixed dummy origin parses relative and absolute URLs alike. Only the
    // path is kept: query strings can carry coordinates or tokens.
    return redactPathIdentifiers(new URL(url, "https://local.invalid").pathname);
  } catch {
    const path = url.split(/[?#]/, 1)[0]?.trim();
    return path ? redactPathIdentifiers(path) : undefined;
  }
};

export const getApiFailureDetails = (
  error: unknown,
): ApiFailureDetails | null => {
  if (!axios.isAxiosError(error)) return null;

  const method = error.config?.method?.toUpperCase();
  const path = getSafePath(error.config?.url);

  return {
    ...(error.code ? { code: error.code } : {}),
    ...(method ? { method } : {}),
    ...(path ? { path } : {}),
    ...(error.response?.status ? { status: error.response.status } : {}),
  };
};

/**
 * Report an expected transport failure as a warning with a safe summary.
 * Non-Axios failures are programming defects and still go to console.error.
 */
export const reportApiFailure = (
  error: unknown,
  operation = "request",
): void => {
  const details = getApiFailureDetails(error);

  if (!details) {
    console.error(`[API] Unexpected ${operation} failure:`, error);
    return;
  }

  if (typeof error === "object" && error !== null) {
    if (reportedAxiosErrors.has(error)) return;
    reportedAxiosErrors.add(error);
  }

  console.warn(`[API] ${operation} failed`, details);
};

/**
 * Report the failure and attach a retry hint to a typed fallback response.
 * Network errors, timeouts, 408/425/429 and 5xx are retryable; other 4xx are not.
 */
export const withApiFailureMetadata = <T extends object>(
  error: unknown,
  fallback: T,
  operation?: string,
): T & RetryableApiFailure => {
  const details = getApiFailureDetails(error);
  reportApiFailure(error, operation);

  const status = details?.status;
  const retryable =
    details !== null &&
    (status === undefined ||
      status >= 500 ||
      status === 408 ||
      status === 425 ||
      status === 429);

  return { ...fallback, retryable };
};
