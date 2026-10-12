import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "@/helpers/sanitizeHtml";

/** [2026-09-24 security hardening] storefront rich-text sanitiser. */
describe("sanitizeHtml", () => {
  it("keeps ordinary formatting", () => {
    const html = '<p>Fresh <b>mango</b> <a href="https://x.test/a">link</a> <img src="/i.png" alt="m"></p>';
    expect(sanitizeHtml(html)).toBe(html);
  });

  it("removes script, iframe, svg and style blocks", () => {
    const out = sanitizeHtml('<p>a</p><script>alert(1)</script><iframe src="//e"></iframe><svg onload=x><g/></svg><style>*{}</style>b');
    expect(out).toBe("<p>a</p>b");
  });

  it("strips event handlers", () => {
    expect(sanitizeHtml('<img src="x" onerror="alert(1)">')).toBe('<img src="x">');
    expect(sanitizeHtml("<p ONCLICK='x()'>t</p>")).toBe("<p>t</p>");
  });

  it("neutralises javascript: and data: URLs but keeps data images", () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).toBe('<a href="#">x</a>');
    expect(sanitizeHtml('<a href=" JaVaScRiPt:alert(1)">x</a>')).not.toMatch(/javascript/i);
    expect(sanitizeHtml('<img src="data:image/png;base64,AAAA">')).toBe('<img src="data:image/png;base64,AAAA">');
    expect(sanitizeHtml('<a href="data:text/html,<b>x</b>">x</a>')).not.toMatch(/data:text/i);
  });

  it("handles empty input", () => {
    expect(sanitizeHtml(undefined)).toBe("");
    expect(sanitizeHtml("")).toBe("");
  });
});
