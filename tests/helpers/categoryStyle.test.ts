import { describe, it, expect } from "vitest";
import {
  CATEGORY_SECTION_STYLES,
  categoryRailBreakpoints,
  normalizeCategoryStyle,
} from "@/helpers/categoryStyle";

/**
 * [2026-09-23 final approval, item 4] The admin chooses how a category section
 * looks; the storefront must honour exactly the backend's CategoryStyleEnum.
 */
describe("category section style", () => {
  it("offers exactly the backend's four styles", () => {
    expect([...CATEGORY_SECTION_STYLES]).toEqual(["default", "card", "full", "overlay"]);
  });

  it("passes every known style through unchanged", () => {
    for (const style of CATEGORY_SECTION_STYLES) {
      expect(normalizeCategoryStyle(style)).toBe(style);
    }
  });

  it("renders anything unknown as the existing default look", () => {
    for (const bad of [null, undefined, "", "image_title", "FULL", 3, {}]) {
      expect(normalizeCategoryStyle(bad)).toBe("default");
    }
  });

  it("keeps the default rail's breakpoints exactly as they were", () => {
    expect(categoryRailBreakpoints("default")).toEqual({
      315: { slidesPerView: 3 },
      424: { slidesPerView: 4 },
      426: { slidesPerView: 5 },
      640: { slidesPerView: 7, spaceBetween: 12 },
      1024: { slidesPerView: 9, spaceBetween: 12 },
      1280: { slidesPerView: 10, spaceBetween: 12 },
      1440: { slidesPerView: 12, spaceBetween: 12 },
    });
  });

  it("gives image-led styles wider tiles than the default", () => {
    for (const style of ["card", "full", "overlay"] as const) {
      expect(categoryRailBreakpoints(style)[1440].slidesPerView).toBeLessThan(12);
    }
  });
});
