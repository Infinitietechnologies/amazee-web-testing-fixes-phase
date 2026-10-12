import { describe, it, expect, afterEach } from "vitest";
import {
  buildHomeLayoutParams,
  isPublishedSectionId,
  readHomePreviewToken,
} from "@/helpers/homeLayout";

/**
 * [CHANGE 2026-09-23] Home Builder draft preview (`?home_preview=`).
 * The backend verifies the signature; the client only forwards a well-formed
 * token and must keep forwarding it on every page of sections.
 */
const TOKEN = `12.1790000000.${"a".repeat(64)}`;

afterEach(() => window.history.pushState({}, "", "/"));

describe("readHomePreviewToken", () => {
  it("accepts a raw well-formed token", () => {
    expect(readHomePreviewToken(TOKEN)).toBe(TOKEN);
  });

  it("reads it out of a query string", () => {
    expect(readHomePreviewToken(`?home_preview=${TOKEN}&x=1`)).toBe(TOKEN);
  });

  it("ignores malformed values instead of forwarding them", () => {
    expect(readHomePreviewToken("12.99.nothex")).toBeUndefined();
    expect(readHomePreviewToken("?home_preview=<script>")).toBeUndefined();
    expect(readHomePreviewToken(undefined)).toBeUndefined();
    expect(readHomePreviewToken("")).toBeUndefined();
  });

  it("takes the first value of a repeated query param", () => {
    expect(readHomePreviewToken([TOKEN, "junk"])).toBe(TOKEN);
  });
});

describe("buildHomeLayoutParams — preview", () => {
  it("forwards the preview token on every call", () => {
    window.history.pushState({}, "", `/?home_preview=${TOKEN}`);
    expect(buildHomeLayoutParams({ page: 2 }).preview_token).toBe(TOKEN);
  });

  it("sends no token on the normal homepage", () => {
    expect(buildHomeLayoutParams().preview_token).toBeUndefined();
  });
});

describe("isPublishedSectionId", () => {
  it("is true only for a real row id", () => {
    expect(isPublishedSectionId(5)).toBe(true);
    expect(isPublishedSectionId(-1)).toBe(false);
    expect(isPublishedSectionId(0)).toBe(false);
    expect(isPublishedSectionId(null)).toBe(false);
  });
});
