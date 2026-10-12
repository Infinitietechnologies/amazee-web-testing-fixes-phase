import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";
import { describe, expect, it } from "vitest";

/**
 * The static files nobody looks at, and the links nobody clicks in development.
 *
 * Three defects live here at once, and all three are invisible to `tsc`, to
 * every component test and to a developer running `next dev`:
 *
 *  1. `public/robots.txt` is a TEMPLATE. `scripts/update-robots.mjs` substitutes
 *     `{{SITE_URL}}` into it at build time — and the committed copy had already
 *     been substituted once, on the upstream vendor's machine. With the
 *     placeholder consumed, every later build read the file, replaced nothing,
 *     wrote it back unchanged and printed "robots.txt updated successfully".
 *     The `Sitemap:` line pointed at the vendor's deployment, permanently.
 *
 *  2. A `<Link href>` to a page that does not exist is a 404 the moment a
 *     customer clicks it, and nothing in the toolchain says so — Next resolves
 *     hrefs at runtime.
 *
 *  3. An asset referenced from `_document.tsx` that is not in `public/` is a
 *     404 on every page load.
 *
 * These are asserted against the files on disk, so they hold whatever the
 * component tree is doing.
 */

const ROOT = join(__dirname, "..", "..");
const PUBLIC = join(ROOT, "public");
const SRC = join(ROOT, "src");
const PAGES = join(SRC, "pages");

function walk(dir: string, match: (f: string) => boolean): string[] {
  const out: string[] = [];

  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);

    if (statSync(full).isDirectory()) {
      out.push(...walk(full, match));
      continue;
    }

    if (match(entry)) out.push(full);
  }

  return out;
}

/** Every route this app actually serves, as a matcher. */
function pageRoutes(): RegExp[] {
  return walk(PAGES, (f) => f.endsWith(".tsx"))
    .map((f) => relative(PAGES, f).replace(/\\/g, "/").replace(/\.tsx$/, ""))
    .filter((r) => !r.startsWith("_") && !r.startsWith("api/"))
    .map((r) => (r.endsWith("/index") ? r.slice(0, -"/index".length) : r))
    .map((r) => (r === "index" ? "/" : "/" + r))
    .map((r) => new RegExp("^" + r.replace(/\[[^\]]+\]/g, "[^/]+").replace(/\/$/, "") + "/?$"));
}

describe("public/robots.txt", () => {
  const robots = readFileSync(join(PUBLIC, "robots.txt"), "utf8");

  it("declares a Sitemap line", () => {
    expect(robots).toMatch(/^Sitemap:\s*\S+/m);
  });

  it("does not hardcode a deployment that is not ours", () => {
    expect(robots).not.toMatch(/hyper-local-\d+\.vercel\.app/);
    expect(robots).not.toMatch(/infinitietech/);
  });

  it("is rewritten by the build script rather than left as-is", () => {
    // The script's own substitution, applied here. If it changes nothing, the
    // template has been consumed and every build is a silent no-op.
    const script = readFileSync(join(ROOT, "scripts", "update-robots.mjs"), "utf8");
    const rewrites =
      script.includes("{{SITE_URL}}") &&
      (robots.includes("{{SITE_URL}}") || /Sitemap:\s*\$\{|replace\(\s*\/\^Sitemap/.test(script));

    expect(rewrites).toBe(true);
  });
});

describe("public/sitemap.xml", () => {
  it("is not left pointing at the upstream vendor's dev host", () => {
    const sitemap = readFileSync(join(PUBLIC, "sitemap.xml"), "utf8");

    expect(sitemap).not.toMatch(/infinitietech/);
  });
});

describe("assets referenced from the document head exist", () => {
  const doc = readFileSync(join(PAGES, "_document.tsx"), "utf8");
  const refs = [...doc.matchAll(/href="(\/[^"{}]+\.(?:png|ico|svg|json|webmanifest))"/g)].map(
    (m) => m[1],
  );

  it("finds at least one asset reference to check", () => {
    expect(refs.length).toBeGreaterThan(0);
  });

  it.each(refs)("%s is present in public/", (ref) => {
    expect(existsSync(join(PUBLIC, ref.replace(/^\//, "")))).toBe(true);
  });
});

describe("every internal link resolves to a page that exists", () => {
  const routes = pageRoutes();
  const files = [
    ...walk(SRC, (f) => f.endsWith(".tsx")),
    ...walk(SRC, (f) => f.endsWith(".ts")),
  ];

  const links: { href: string; where: string }[] = [];

  for (const file of files) {
    const body = readFileSync(file, "utf8");

    body.split("\n").forEach((line, i) => {
      for (const m of line.matchAll(/href=["'](\/[^"'`{}$\s]*)["']/g)) {
        const href = m[1].split("?")[0].split("#")[0];

        // Asset paths are covered by the block above; API routes are not pages.
        if (/\.[a-z0-9]{2,5}$/i.test(href) || href.startsWith("/api")) continue;

        links.push({ href, where: relative(ROOT, file) + ":" + (i + 1) });
      }
    });
  }

  it("finds links to check", () => {
    expect(links.length).toBeGreaterThan(0);
  });

  it("has no link pointing at a route the app does not serve", () => {
    const dead = links.filter(
      ({ href }) => !routes.some((r) => r.test(href.replace(/\/$/, "") || "/")),
    );

    expect(dead.map((d) => `${d.href} (${d.where})`)).toEqual([]);
  });
});
