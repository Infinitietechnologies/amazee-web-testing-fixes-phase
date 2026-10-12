import localFont from "next/font/local";

/**
 * [CHANGE 2026-09-23] Lexend Deca, self-hosted.
 *
 * Was `next/font/google`, which downloads the font from fonts.googleapis.com
 * AT BUILD TIME — so `next build` failed anywhere that host is unreachable
 * (it is, in this project's build environment), and every visitor's browser
 * was pointed at Google for the typeface.
 *
 * Same family, same two weights (300, 400), same variables, same fallbacks —
 * the files are the Lexend Deca latin subset from @fontsource/lexend-deca
 * 5.3.0 (SIL Open Font License 1.1; see src/assets/fonts/lexend-deca/OFL.txt),
 * served from this site. Nothing a visitor sees changes; the build no longer
 * depends on a third-party host.
 */
// next/font/local is resolved at compile time, so `src` must be written out
// literally in each call — a shared constant is not statically analysable.
export const fontSans = localFont({
  src: [
    { path: "../assets/fonts/lexend-deca/lexend-deca-latin-300-normal.woff2", weight: "300", style: "normal" },
    { path: "../assets/fonts/lexend-deca/lexend-deca-latin-400-normal.woff2", weight: "400", style: "normal" },
  ],
  variable: "--font-sans",
  display: "swap",
  preload: true,
  fallback: ["system-ui", "arial"],
  adjustFontFallback: "Arial",
});

export const fontMono = localFont({
  src: [
    { path: "../assets/fonts/lexend-deca/lexend-deca-latin-300-normal.woff2", weight: "300", style: "normal" },
    { path: "../assets/fonts/lexend-deca/lexend-deca-latin-400-normal.woff2", weight: "400", style: "normal" },
  ],
  variable: "--font-mono",
  display: "swap",
  preload: true,
  fallback: ["Courier New", "monospace"],
  adjustFontFallback: "Arial",
});
