import type { CSSProperties } from "react";

import type { HomeGeneralSettings } from "@/types/ApiResponse";

/**
 * [v3.2 port 2026-09-28] Per-platform home header appearance (web / web-mobile).
 *
 * Reads `home_general_settings` from the public settings payload. The web uses
 * the `…Web` fields (falling back to the shared ones) and, below the md
 * breakpoint, `backgroundImageWebMobile`. The `…App` fields belong to the
 * mobile app and are ignored here.
 *
 * Colour and image only. v3.2 also plays a Lottie animation when
 * `backgroundType` is `animation`/`lottie`; that needs `lottie-web` and is
 * pending owner approval, so an animation setting degrades to the configured
 * colour instead of rendering nothing.
 */
export interface HomeHeaderAppearance {
  type: "color" | "image";
  backgroundColor?: string;
  backgroundImage?: string;
  mobileBackgroundImage?: string;
  fontColor?: string;
}

const normalizeCssColor = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const candidate = value.trim();
  if (!candidate || /[;"{}]/.test(candidate)) return undefined;
  return /^[#(),.%\w\s-]+$/.test(candidate) ? candidate : undefined;
};

/** Root-relative paths and absolute http(s) URLs only. */
const normalizeAssetUrl = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const candidate = value.trim();
  if (!candidate || /[\\\r\n]/.test(candidate)) return undefined;

  if (candidate.startsWith("/") && !candidate.startsWith("//")) {
    return candidate;
  }

  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
};

export const resolveHomeHeaderAppearance = (
  settings?: Partial<HomeGeneralSettings> | null,
): HomeHeaderAppearance => {
  const backgroundColor =
    normalizeCssColor(settings?.backgroundColorWeb) ??
    normalizeCssColor(settings?.backgroundColor);
  const backgroundImage = normalizeAssetUrl(
    settings?.backgroundImageWeb || settings?.backgroundImage,
  );
  const mobileBackgroundImage = normalizeAssetUrl(
    settings?.backgroundImageWebMobile,
  );
  const fontColor = normalizeCssColor(settings?.fontColor);

  // `backgroundType` is authoritative: admin responses can retain stale image
  // URLs after switching to a colour, and those must not override the choice.
  // Anything other than a usable image (including animation/lottie) is colour.
  const requestedType =
    typeof settings?.backgroundType === "string"
      ? settings.backgroundType.trim().toLowerCase()
      : "color";
  const type =
    requestedType === "image" && (backgroundImage || mobileBackgroundImage)
      ? "image"
      : "color";

  return {
    type,
    backgroundColor,
    backgroundImage: type === "image" ? backgroundImage : undefined,
    mobileBackgroundImage: type === "image" ? mobileBackgroundImage : undefined,
    fontColor,
  };
};

/** True when the appearance paints anything at all. */
export const hasHomeHeaderAppearance = (
  appearance: HomeHeaderAppearance,
): boolean =>
  Boolean(
    appearance.backgroundColor ||
      appearance.backgroundImage ||
      appearance.mobileBackgroundImage,
  );

const cssUrl = (value: string) =>
  `url("${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}")`;

/**
 * Inline style for the header surface (`.home-header-surface` in globals.css).
 * The images travel as CSS custom properties so the stylesheet can swap the
 * mobile-web artwork in below the md breakpoint without a second element.
 */
export const getHomeHeaderSurfaceStyle = (
  appearance: HomeHeaderAppearance,
): CSSProperties => {
  const style: Record<string, string> = {};

  if (appearance.backgroundColor) {
    style["--home-header-color"] = appearance.backgroundColor;
  }
  if (appearance.backgroundImage) {
    style["--home-header-image"] = cssUrl(appearance.backgroundImage);
  }
  if (appearance.mobileBackgroundImage) {
    style["--home-header-image-mobile"] = cssUrl(
      appearance.mobileBackgroundImage,
    );
  }
  if (appearance.fontColor) {
    style.color = appearance.fontColor;
  }

  return style as CSSProperties;
};
