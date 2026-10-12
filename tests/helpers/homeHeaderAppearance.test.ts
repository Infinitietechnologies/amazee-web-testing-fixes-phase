import { describe, it, expect } from "vitest";

import {
  getHomeHeaderSurfaceStyle,
  hasHomeHeaderAppearance,
  resolveHomeHeaderAppearance,
} from "@/helpers/homeHeaderAppearance";

describe("resolveHomeHeaderAppearance (web / web-mobile, colour + image only)", () => {
  it("prefers the web-specific colour and image over the shared ones", () => {
    const appearance = resolveHomeHeaderAppearance({
      backgroundType: "image",
      backgroundColor: "#111111",
      backgroundColorWeb: "#222222",
      backgroundImage: "https://cdn.test/shared.jpg",
      backgroundImageWeb: "https://cdn.test/web.jpg",
      backgroundImageWebMobile: "https://cdn.test/web-mobile.jpg",
      fontColor: "#ffffff",
    });

    expect(appearance).toEqual({
      type: "image",
      backgroundColor: "#222222",
      backgroundImage: "https://cdn.test/web.jpg",
      mobileBackgroundImage: "https://cdn.test/web-mobile.jpg",
      fontColor: "#ffffff",
    });
  });

  it("ignores app-only fields", () => {
    const appearance = resolveHomeHeaderAppearance({
      backgroundType: "image",
      backgroundColorApp: "#abcdef",
      backgroundImageApp: "https://cdn.test/app.jpg",
    });

    expect(appearance.type).toBe("color");
    expect(hasHomeHeaderAppearance(appearance)).toBe(false);
  });

  it("colour mode never shows a stale image URL", () => {
    const appearance = resolveHomeHeaderAppearance({
      backgroundType: "color",
      backgroundColorWeb: "#ff0000",
      backgroundImageWeb: "https://cdn.test/stale.jpg",
    });

    expect(appearance).toMatchObject({ type: "color", backgroundColor: "#ff0000" });
    expect(appearance.backgroundImage).toBeUndefined();
  });

  it.each(["animation", "lottie"])(
    "degrades backgroundType=%s to the configured colour (no Lottie)",
    (backgroundType) => {
      const appearance = resolveHomeHeaderAppearance({
        backgroundType: backgroundType as "animation",
        backgroundColorWeb: "#00aa00",
        backgroundAnimationWeb: "https://cdn.test/anim.json",
      });

      expect(appearance).toEqual({
        type: "color",
        backgroundColor: "#00aa00",
        backgroundImage: undefined,
        mobileBackgroundImage: undefined,
        fontColor: undefined,
      });
    },
  );

  it("rejects unsafe colours and non-http(s) image URLs", () => {
    const appearance = resolveHomeHeaderAppearance({
      backgroundType: "image",
      backgroundColorWeb: "red;}body{display:none",
      backgroundImageWeb: "javascript:alert(1)",
    });

    expect(appearance.type).toBe("color");
    expect(appearance.backgroundColor).toBeUndefined();
  });

  it("handles missing settings", () => {
    expect(resolveHomeHeaderAppearance(null)).toMatchObject({ type: "color" });
  });
});

describe("getHomeHeaderSurfaceStyle", () => {
  it("passes colour and both images as CSS custom properties", () => {
    const style = getHomeHeaderSurfaceStyle({
      type: "image",
      backgroundColor: "#222222",
      backgroundImage: "https://cdn.test/web.jpg",
      mobileBackgroundImage: "https://cdn.test/m.jpg",
      fontColor: "#ffffff",
    }) as Record<string, string>;

    expect(style).toEqual({
      "--home-header-color": "#222222",
      "--home-header-image": 'url("https://cdn.test/web.jpg")',
      "--home-header-image-mobile": 'url("https://cdn.test/m.jpg")',
      color: "#ffffff",
    });
  });

  it("is empty when nothing is configured", () => {
    expect(getHomeHeaderSurfaceStyle({ type: "color" })).toEqual({});
  });
});
