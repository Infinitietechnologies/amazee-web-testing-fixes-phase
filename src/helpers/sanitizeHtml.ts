/**
 * [2026-09-24 security hardening] Defence-in-depth sanitiser for seller-written
 * rich text rendered with `dangerouslySetInnerHTML` (product and store
 * descriptions).
 *
 * The backend now sanitises descriptions on save (HtmlSanitizer, an allowlist),
 * so this is the second layer — it also covers rows saved before that change.
 * It is deliberately string-based (no DOM) so the server render and the client
 * hydration produce identical markup.
 */
const DANGEROUS_BLOCKS =
  /<(script|style|iframe|object|embed|applet|form|svg|math|template|noscript|textarea|select|button|frameset|frame)\b[\s\S]*?<\/\1\s*>/gi;
const DANGEROUS_TAGS =
  /<\/?(script|style|iframe|object|embed|applet|form|svg|math|template|noscript|link|meta|base|input|textarea|select|button|frameset|frame)\b[^>]*>/gi;
const EVENT_HANDLERS = /\s(on[a-z]+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const BAD_SCHEME = "(?:javascript|vbscript|data(?!:image\\/(?:png|jpe?g|gif|webp);base64,))\\s*:";
const BAD_URLS_QUOTED = new RegExp(
  `(\\s(?:href|src|xlink:href|action|formaction)\\s*=\\s*)(["'])\\s*${BAD_SCHEME}[^"']*\\2`,
  "gi",
);
const BAD_URLS_BARE = new RegExp(
  `(\\s(?:href|src|xlink:href|action|formaction)\\s*=\\s*)\\s*${BAD_SCHEME}[^\\s>]*`,
  "gi",
);
const BAD_STYLE =
  /\sstyle\s*=\s*("[^"]*(?:expression\s*\(|url\s*\(|javascript:|@import|behavior\s*:)[^"]*"|'[^']*(?:expression\s*\(|url\s*\(|javascript:|@import|behavior\s*:)[^']*')/gi;
const COMMENTS = /<!--[\s\S]*?-->/g;

export const sanitizeHtml = (html: string | null | undefined): string => {
  if (!html) return "";
  let out = String(html);
  // Repeat until stable so nested/obfuscated constructs cannot survive one pass.
  for (let i = 0; i < 5; i++) {
    const before = out;
    out = out
      .replace(COMMENTS, "")
      .replace(DANGEROUS_BLOCKS, "")
      .replace(DANGEROUS_TAGS, "")
      .replace(EVENT_HANDLERS, "")
      .replace(BAD_URLS_QUOTED, "$1$2#$2")
      .replace(BAD_URLS_BARE, '$1"#"')
      .replace(BAD_STYLE, "");
    if (out === before) break;
  }
  return out;
};
