import { Html, Head, Main, NextScript } from "next/document";
import clsx from "clsx";
import { devInspectorHookScript } from "next-dev-inspector/hook";
import { fontSans } from "@/config/fonts";

export default function Document() {
  return (
    <Html lang="en" prefix="og: https://ogp.me/ns#">
      <Head>
        {/* DevInspector early hook: enables true re-render flashes with
            component names. Must run before React loads; dev only. */}
        {process.env.NODE_ENV === "development" &&
          process.env.NEXT_PUBLIC_DEV_INSPECTOR === "true" && (
            <script
              dangerouslySetInnerHTML={{ __html: devInspectorHookScript }}
            />
          )}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />

        {/* [CHANGE 2026-09-22] Was /icons/icon-192x192.png — public/icons/ does
            not exist, so this 404d on every page load. logo-192.png is the file
            scripts/update-manifest.mjs actually writes. */}
        <link rel="apple-touch-icon" href="/logo-192.png" />
        {/* [CHANGE 2026-09-22] This token was hardcoded and belongs to the
            upstream vendor's Search Console property, not ours — it claimed
            every page of this site for someone else's account. It is now read
            from the environment and simply omitted when unset. */}
        {process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION && (
          <meta
            name="google-site-verification"
            content={process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION}
          />
        )}

        {/* [2026-09-23] The site font is self-hosted (src/config/fonts.ts), so
            the Google Fonts preconnects are no longer needed. */}
      </Head>
      <body
        className={clsx(
          "min-h-screen bg-background font-sans antialiased",
          fontSans.variable
        )}
      >
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
