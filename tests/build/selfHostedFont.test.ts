import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * [2026-09-23] The site font is self-hosted.
 *
 * `next/font/google` downloads Lexend Deca from fonts.googleapis.com during
 * `next build`, so the production build failed wherever that host is
 * unreachable, and every visitor was pointed at Google. The same family and
 * weights are now bundled from src/assets/fonts. These checks keep it that way.
 */
const root = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(root, p), "utf8");

describe("self-hosted Lexend Deca", () => {
  const fonts = read("src/config/fonts.ts");

  it("does not load the font from Google at build time", () => {
    // Import statements only — the file's own comment explains the change and
    // names the old import, and prose must not be able to pass or fail this.
    expect(fonts).not.toMatch(/from\s+["']next\/font\/google["']/);
    expect(fonts).toMatch(/from\s+["']next\/font\/local["']/);
  });

  it("keeps the same two weights the site already used", () => {
    expect(fonts).toMatch(/latin-300-normal\.woff2/);
    expect(fonts).toMatch(/latin-400-normal\.woff2/);
  });

  it("ships the font files and their licence", () => {
    for (const f of [
      "lexend-deca-latin-300-normal.woff2",
      "lexend-deca-latin-400-normal.woff2",
      "OFL.txt",
    ]) {
      expect(existsSync(resolve(root, "src/assets/fonts/lexend-deca", f))).toBe(true);
    }
  });

  it("no longer preconnects to Google Fonts", () => {
    expect(read("src/pages/_document.tsx")).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
  });
});
