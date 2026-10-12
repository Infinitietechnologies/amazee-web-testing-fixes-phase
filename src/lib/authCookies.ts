/**
 * [CHANGE] Names of the auth cookies, in one place.
 *
 * Kept out of the API route modules on purpose: importing a constant from
 * `pages/api/auth/session.ts` would drag that route's default-export handler
 * into whatever imported it. Route modules should not import each other.
 */

/** HttpOnly. Never readable from browser JavaScript. */
export const ACCESS_TOKEN_COOKIE = "access_token";

/**
 * Readable by design, and carries no credential — it answers "is someone
 * signed in?" for UI purposes only. Never treat it as proof of authentication;
 * only the HttpOnly token is that, and only the server can read it.
 */
export const AUTH_STATE_COOKIE = "auth_state";
