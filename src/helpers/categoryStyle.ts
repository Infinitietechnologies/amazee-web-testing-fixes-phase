/**
 * [2026-09-23 final approval, item 4] Admin-configurable category section style.
 *
 * The four values are the backend's CategoryStyleEnum. A Home Builder
 * categories section carries its own `style`; the classic homepage reads
 * `systemSettings.homeCategoryStyle`. Anything unknown — including a null or
 * a value a newer admin panel might send — renders as "default", which is the
 * storefront's existing look, so an unexpected value never breaks the rail.
 */
export const CATEGORY_SECTION_STYLES = ["default", "card", "full", "overlay"] as const;

export type CategorySectionStyle = (typeof CATEGORY_SECTION_STYLES)[number];

export function normalizeCategoryStyle(value: unknown): CategorySectionStyle {
  return typeof value === "string" &&
    (CATEGORY_SECTION_STYLES as readonly string[]).includes(value)
    ? (value as CategorySectionStyle)
    : "default";
}

type Breakpoints = Record<number, { slidesPerView: number; spaceBetween?: number }>;

/**
 * Tiles per view. "default" keeps the existing breakpoints exactly; the
 * image-led styles use wider tiles so the picture — the point of choosing
 * them — is large enough to read.
 */
export function categoryRailBreakpoints(style: CategorySectionStyle): Breakpoints {
  if (style === "default") {
    return {
      315: { slidesPerView: 3 },
      424: { slidesPerView: 4 },
      426: { slidesPerView: 5 },
      640: { slidesPerView: 7, spaceBetween: 12 },
      1024: { slidesPerView: 9, spaceBetween: 12 },
      1280: { slidesPerView: 10, spaceBetween: 12 },
      1440: { slidesPerView: 12, spaceBetween: 12 },
    };
  }

  return {
    315: { slidesPerView: 2.4, spaceBetween: 10 },
    424: { slidesPerView: 3.2, spaceBetween: 10 },
    640: { slidesPerView: 4.5, spaceBetween: 12 },
    1024: { slidesPerView: 6, spaceBetween: 14 },
    1280: { slidesPerView: 7, spaceBetween: 16 },
    1440: { slidesPerView: 8, spaceBetween: 16 },
  };
}
