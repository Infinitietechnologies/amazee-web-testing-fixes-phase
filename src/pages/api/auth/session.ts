import type { NextApiRequest, NextApiResponse } from "next";
import { serialize } from "cookie";

import { ACCESS_TOKEN_COOKIE, AUTH_STATE_COOKIE } from "@/lib/authCookies";

/**
 * [CHANGE] Server-side auth session cookie.
 *
 * THE PROBLEM
 * -----------
 * The access token was written from the browser with
 * `setCookie("access_token", ...)` in `helpers/auth.ts`. A cookie written by
 * `document.cookie` is by definition readable by `document.cookie`, so any XSS
 * on any page — including a compromised third-party script — could exfiltrate a
 * live session token. `HttpOnly` cannot be set from JavaScript; only a server
 * response can set it. That is what this route is for.
 *
 * WHAT IT DOES
 * ------------
 * POST   — takes the token the login API returned and re-issues it as an
 *          HttpOnly cookie. The browser can no longer read it; it is still sent
 *          automatically on same-origin requests, and SSR still reads it from
 *          the request header exactly as before (see
 *          `getAccessTokenFromContext`, which is unchanged).
 * DELETE — clears it on logout.
 *
 * WHY A SEPARATE, NON-SENSITIVE FLAG
 * ----------------------------------
 * Client code needs to know *whether* someone is logged in to render the UI.
 * That question is not sensitive; the token is. So this route also sets a
 * readable `auth_state=1` cookie carrying no credential. UI code checks that
 * flag; nothing can steal a session from it.
 *
 * SECURITY NOTES
 * --------------
 * - `Secure` is set whenever the request arrived over HTTPS, so local HTTP
 *   development still works without weakening production.
 * - `SameSite=Lax` keeps the cookie off cross-site requests while preserving
 *   normal top-level navigation into the app.
 * - The token is never echoed back in any response body.
 * - There is deliberately NO endpoint that returns the token to the browser.
 *   Adding one would undo the entire point of this change.
 */

/** A token this large is not a token; refuse it rather than set a huge cookie. */
const MAX_TOKEN_BYTES = 4096;

function isSecureRequest(req: NextApiRequest): boolean {
  // Behind a proxy/load balancer the original scheme arrives in this header.
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;

  return (proto ?? "").split(",")[0].trim() === "https";
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const secure = isSecureRequest(req);

  if (req.method === "POST") {
    const token = (req.body?.access_token ?? "") as unknown;

    if (typeof token !== "string" || token.trim() === "") {
      return res.status(400).json({ success: false, message: "Missing access token." });
    }

    if (Buffer.byteLength(token, "utf8") > MAX_TOKEN_BYTES) {
      return res.status(400).json({ success: false, message: "Access token is too large." });
    }

    res.setHeader("Set-Cookie", [
      serialize(ACCESS_TOKEN_COOKIE, token, {
        httpOnly: true,
        secure,
        sameSite: "lax",
        path: "/",
        // Session lifetime is governed by the API token itself; this bound
        // exists so an abandoned browser does not keep a cookie indefinitely.
        maxAge: 60 * 60 * 24 * 30,
      }),
      // Readable on purpose, and carries no credential.
      serialize(AUTH_STATE_COOKIE, "1", {
        httpOnly: false,
        secure,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      }),
    ]);

    return res.status(204).end();
  }

  if (req.method === "DELETE") {
    const expire = { httpOnly: true, secure, sameSite: "lax" as const, path: "/", maxAge: 0 };

    res.setHeader("Set-Cookie", [
      serialize(ACCESS_TOKEN_COOKIE, "", expire),
      serialize(AUTH_STATE_COOKIE, "", { ...expire, httpOnly: false }),
    ]);

    return res.status(204).end();
  }

  res.setHeader("Allow", "POST, DELETE");

  return res.status(405).json({ success: false, message: "Method not allowed." });
}
