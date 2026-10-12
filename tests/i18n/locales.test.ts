import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { SUPPORTED_LANGUAGES } from "../../i18n";

/**
 * [CHANGE 2026-09-22] Guards for the five-language storefront.
 *
 * Adding a locale is mostly data, and data defects are the quiet kind: a key
 * that exists in `ta.json` but not in `en.json` is a translation nobody will
 * ever read, and a translated string that drops `{{count}}` renders literal
 * braces to a customer. Neither shows up in a type check or in a screenshot of
 * the happy path, so they are asserted here.
 *
 * Translations are deliberately PARTIAL: i18next falls back to English per key,
 * so a locale file holds only what has genuinely been translated. These tests
 * therefore check that what IS there is correct and consistent — never that
 * every key is present, which would be a test that can only be satisfied by
 * padding the files with English and calling it Tamil.
 */

// Resolved from the package root rather than import.meta.url: under the jsdom
// environment that URL is not a file: URL and fileURLToPath rejects it.
const root = process.cwd();
const localesDir = resolve(root, "public/locales");

type Tree = { [key: string]: string | Tree };

const load = (code: string): Tree =>
  JSON.parse(readFileSync(`${localesDir}/${code}.json`, "utf8")) as Tree;

/** Flatten to dotted paths, the form i18next looks a key up by. */
const leaves = (tree: Tree, prefix = ""): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      out[path] = value;
    } else {
      Object.assign(out, leaves(value, path));
    }
  }
  return out;
};

const placeholders = (value: string): string[] =>
  (value.match(/\{\{\s*\w+\s*\}\}/g) ?? []).sort();

const en = leaves(load("en"));
const NEW_LANGUAGES = ["ta", "te", "kn", "ml"] as const;

describe("storefront locales", () => {
  it("ships a file for every language the app offers", () => {
    const onDisk = readdirSync(localesDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""))
      .sort();

    expect(onDisk).toEqual([...SUPPORTED_LANGUAGES].sort());
  });

  it.each(NEW_LANGUAGES)("%s has no key that English does not have", (code) => {
    // An orphan key is dead weight: i18next looks up the English path, so a
    // translation filed under a path that does not exist is never rendered and
    // never noticed.
    const orphans = Object.keys(leaves(load(code))).filter((k) => !(k in en));
    expect(orphans).toEqual([]);
  });

  it.each(NEW_LANGUAGES)("%s preserves every interpolation placeholder", (code) => {
    const mismatched: string[] = [];

    for (const [key, value] of Object.entries(leaves(load(code)))) {
      if (placeholders(value).join(",") !== placeholders(en[key]).join(",")) {
        mismatched.push(key);
      }
    }

    expect(mismatched).toEqual([]);
  });

  it.each(NEW_LANGUAGES)("%s leaves no string in English by accident", (code) => {
    // A value identical to the English one means the key was copied rather than
    // translated — which is indistinguishable from a real translation in the
    // file, and makes the coverage figure a lie. Genuine exceptions (proper
    // nouns, "OK") would be listed here explicitly.
    const untouched = Object.entries(leaves(load(code)))
      .filter(([key, value]) => value === en[key])
      .map(([key]) => key);

    expect(untouched).toEqual([]);
  });

  it.each(NEW_LANGUAGES)("%s actually uses its own script", (code) => {
    // Catches a file that was created but left holding Latin text.
    const ranges: Record<string, RegExp> = {
      ta: /[஀-௿]/,
      te: /[ఀ-౿]/,
      kn: /[ಀ-೿]/,
      ml: /[ഀ-ൿ]/,
    };

    const values = Object.values(leaves(load(code)));
    expect(values.length).toBeGreaterThan(0);
    expect(values.filter((v) => ranges[code].test(v)).length).toBeGreaterThan(
      values.length * 0.8,
    );
  });

  it("keeps English as the fallback so a partial locale never renders blank", () => {
    const source = readFileSync(resolve(root, "i18n.ts"), "utf8");
    expect(source).toContain("fallbackLng");
    expect(source).toContain('DEFAULT_LANG = "en"');
  });

  it("treats only Arabic as right-to-left", () => {
    const source = readFileSync(resolve(root, "i18n.ts"), "utf8");
    // The four new languages are LTR. A blanket "not English means RTL" would
    // flip the whole storefront for a Tamil customer.
    expect(source).toContain('RTL_LANGUAGES = ["ar"]');
  });
});
