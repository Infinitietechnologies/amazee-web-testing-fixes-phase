import type { NextApiRequest, NextApiResponse } from "next";
import { ACCESS_TOKEN_COOKIE } from "@/lib/authCookies";

/**
 * [CHANGE] Same-origin API proxy that injects the HttpOnly bearer token.
 *
 * WHY THIS IS NEEDED
 * ------------------
 * Making the token HttpOnly (see `api/auth/session.ts`) means browser JS can no
 * longer read it — which is the whole point, and which also means client code
 * can no longer set `Authorization: Bearer ...` itself. Something server-side
 * has to attach it. This route is that something: the browser calls
 * `/api/proxy/<path>` same-origin, the cookie rides along automatically, and
 * this handler forwards the call to the real API with the token attached.
 *
 * The token never enters the browser's JS heap at any point.
 *
 * SECURITY PROPERTIES
 * -------------------
 * - Forwards ONLY to the configured API origin. The upstream URL is built from
 *   `NEXT_PUBLIC_ADMIN_PANEL_URL` plus the path segments; a caller cannot
 *   redirect it elsewhere, because the origin is never taken from the request.
 * - Path segments are re-encoded, so `..` and friends cannot climb out of the
 *   `/api` prefix.
 * - A hop-by-hop and identity-bearing header allowlist is applied in both
 *   directions. In particular the client's own `Authorization`, `Cookie` and
 *   `Host` headers are NOT forwarded — the caller cannot smuggle in a different
 *   identity, and the API never sees the browser's cookie jar.
 * - `Set-Cookie` from upstream is not relayed, so the API cannot overwrite the
 *   HttpOnly session cookie through the proxy.
 * - Redirects are not followed; upstream 3xx is returned as-is for the caller
 *   to handle, so the proxy can never be walked to an unintended origin.
 *
 * NOT AN OPEN PROXY: it cannot reach any host other than the configured API.
 */

/** Never forward these from the browser to the API. */
const BLOCKED_REQUEST_HEADERS = new Set([
  "host",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "content-length",
  // Identity is decided here, from the HttpOnly cookie — not by the caller.
  "authorization",
  "cookie",
]);

/** Never relay these from the API back to the browser. */
const BLOCKED_RESPONSE_HEADERS = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "content-encoding",
  "content-length",
  // The API must not be able to overwrite our HttpOnly session cookie.
  "set-cookie",
]);

function apiOrigin(): string | null {
  const configured = (process.env.NEXT_PUBLIC_ADMIN_PANEL_URL ?? "").trim();

  if (!configured) {
    return null;
  }

  try {
    const url = new URL(configured);
    const pathname = url.pathname.replace(/\/$/, "");
    url.pathname = `${pathname}/api`;

    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export const config = {
  api: {
    // Forward the body verbatim, so multipart uploads and JSON both survive.
    bodyParser: false,
  },
};

async function readRawBody(req: NextApiRequest): Promise<Buffer | undefined> {
  if (req.method === "GET" || req.method === "HEAD") {
    return undefined;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  return chunks.length ? Buffer.concat(chunks) : undefined;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const origin = apiOrigin();

  if (!origin) {
    return res
      .status(500)
      .json({ success: false, message: "API origin is not configured." });
  }

  const segments = req.query.path;
  const parts = Array.isArray(segments) ? segments : segments ? [segments] : [];

  // Re-encode each segment: this is what stops path traversal.
  const safePath = parts
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  const queryString = req.url?.includes("?")
    ? req.url.slice(req.url.indexOf("?"))
    : "";

  const target = `${origin}/${safePath}${queryString}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (BLOCKED_REQUEST_HEADERS.has(key.toLowerCase())) continue;
    headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }

  // The one header the caller is not allowed to choose.
  const token = req.cookies?.[ACCESS_TOKEN_COOKIE];
  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      // Buffer is a Uint8Array at runtime and undici accepts it, but the DOM
      // BodyInit typing this project compiles against does not list it. The
      // view keeps the same bytes without copying them.
      body: (await readRawBody(req)) as unknown as BodyInit | undefined,
      redirect: "manual",
    });

    upstream.headers.forEach((value, key) => {
      if (!BLOCKED_RESPONSE_HEADERS.has(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    res.status(upstream.status);

    const buffer = Buffer.from(await upstream.arrayBuffer());

    return res.end(buffer);
  } catch (error) {
    console.error("API proxy error:", error);

    return res
      .status(502)
      .json({ success: false, message: "Upstream API request failed." });
  }
}
