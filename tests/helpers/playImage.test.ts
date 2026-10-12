import { describe, it, expect } from "vitest";

import {
  adaptHomeLayoutCategory,
  adaptPlayImageItem,
  getPlayImageRows,
  getSectionBannerItems,
  resolveSectionBannerHref,
} from "@/helpers/homeLayout";
import {
  getAutoPlayImageSpan,
  getPlayImageGridSpan,
  getPlayImageRowSurfaceStyle,
  getPlayImageSlidesPerView,
  isLegacyBannerSection,
  normalizeBuilderBoolean,
  normalizePlayImageAspectRatio,
  normalizePlayImageFit,
  normalizePlayImageGap,
  normalizePlayImagePosition,
  resolvePlayImageRow,
} from "@/views/homePage/playImage/playImageConfig";
import type {
  HomeLayoutBannerItem,
  HomeLayoutSection,
} from "@/types/ApiResponse";

/** A `play_image` section in the v3.2 resolver's shape (content.rows). */
const playImageSection = (
  overrides: Partial<HomeLayoutSection> = {},
): HomeLayoutSection => ({
  id: 70,
  type: "play_image",
  title: "Summer picks",
  style: null,
  config: {
    rows: [
      { row_index: 0, style: "grid", grid_gap: 8 },
      { row_index: 1, style: "scroll", items_to_show: 2, title: "Row two" },
    ],
  },
  background_image: null,
  hero_media: null,
  card_background_image: null,
  content: {
    rows: [
      {
        row_index: 0,
        style: "grid",
        config: { style: "grid", grid_gap: 8, border_radius: 12 },
        items: [
          {
            id: 1,
            image: "https://cdn.test/a.jpg",
            image_web_mobile: "https://cdn.test/a-m.jpg",
            link_type: "custom",
            link_url: "https://shop.test/sale",
            target_id: null,
            slug: null,
            config: { row_index: 0, cols: 8, cols_mobile: 12, aspect_ratio: "16:9" },
          },
          {
            id: 2,
            image: null,
            image_web_mobile: null,
            link_type: "product",
            link_url: null,
            target_id: 9,
            slug: "mango",
            config: { row_index: 0 },
          },
        ],
      },
      {
        row_index: 1,
        style: "scroll",
        config: { style: "scroll" },
        items: [
          {
            id: 3,
            image: "https://cdn.test/b.jpg",
            link_type: "categories",
            link_url: null,
            target_id: 4,
            slug: "fruits",
            config: [],
          },
        ],
      },
      // An empty row is dropped: nothing to render.
      { row_index: 2, style: "grid", config: {}, items: [] },
      "garbage",
    ] as unknown[],
  },
  ...overrides,
});

describe("getPlayImageRows (content.rows adapter)", () => {
  it("keeps renderable rows with their source position and drops empty/malformed ones", () => {
    const rows = getPlayImageRows(playImageSection().content);

    expect(rows.map((r) => [r.row_index, r.sourceIndex, r.items.length])).toEqual([
      [0, 0, 1],
      [1, 1, 1],
    ]);
  });

  it("carries image_web_mobile and per-item config; drops items with no image", () => {
    const [first, second] = getPlayImageRows(playImageSection().content);

    expect(first.items[0]).toMatchObject({
      id: 1,
      image: "https://cdn.test/a.jpg",
      image_web_mobile: "https://cdn.test/a-m.jpg",
      config: { cols: 8, cols_mobile: 12, aspect_ratio: "16:9" },
    });
    // PHP's empty array arrives as [] — normalised to an object.
    expect(second.items[0].config).toEqual({});
  });

  it("keeps a mobile-only item, using the mobile artwork as the image", () => {
    expect(
      adaptPlayImageItem({ id: 5, image: null, image_web_mobile: "https://cdn.test/m.jpg" }),
    ).toMatchObject({ image: "https://cdn.test/m.jpg", image_web_mobile: "https://cdn.test/m.jpg" });
    expect(adaptPlayImageItem({ id: 6, image: "", image_web_mobile: "" })).toBeNull();
  });

  it("returns no rows when content.rows is absent", () => {
    expect(getPlayImageRows({})).toEqual([]);
  });
});

describe("resolveSectionBannerHref", () => {
  const item = (o: Partial<HomeLayoutBannerItem>): HomeLayoutBannerItem => ({
    id: 1,
    image: "x",
    link_type: null,
    link_url: null,
    target_id: null,
    slug: null,
    ...o,
  });

  it.each([
    [{ link_type: "product", slug: "mango" }, "/products/mango"],
    [{ link_type: "products", target_id: 9 }, "/products/9"],
    [{ link_type: "categories", slug: "fruits" }, "/categories/fruits"],
    [{ link_type: "brand", slug: "amul" }, "/brands/amul"],
    [{ link_type: "store", slug: "fresh-mart" }, "/stores/fresh-mart"],
    [{ link_type: "custom", link_url: "https://shop.test" }, "https://shop.test"],
    [{ link_type: "none", link_url: "https://ignored.test" }, null],
    [{ link_type: "product" }, null],
  ])("%j -> %s", (overrides, expected) => {
    expect(resolveSectionBannerHref(item(overrides as Partial<HomeLayoutBannerItem>))).toBe(expected);
  });
});

describe("resolvePlayImageRow (section defaults -> config.rows -> content row)", () => {
  it("merges configs by row_index and keeps the content row's style authoritative", () => {
    const section = playImageSection();
    const [, second] = getPlayImageRows(section.content);
    const resolved = resolvePlayImageRow(section, second);

    expect(resolved.style).toBe("scroll");
    expect(resolved.config.items_to_show).toBe(2);
    // Row title comes from the configured row when the content row has none.
    expect(resolved.title).toBe("Row two");
  });

  it("treats slider/carousel as scroll and anything unknown as grid", () => {
    const section = playImageSection();
    const [first] = getPlayImageRows(section.content);

    expect(resolvePlayImageRow(section, { ...first, style: "carousel", config: {} }).style).toBe("scroll");
    expect(resolvePlayImageRow(section, { ...first, style: "mosaic", config: {} }).style).toBe("grid");
  });

  it("ignores blank values rather than letting them override a default", () => {
    const section = playImageSection({ config: { grid_gap: 16, rows: [] } });
    const [first] = getPlayImageRows(section.content);

    const resolved = resolvePlayImageRow(section, { ...first, config: { grid_gap: " " } });
    expect(resolved.config.grid_gap).toBe(16);
  });
});

describe("play_image config parsing", () => {
  it("auto grid spans follow the app's 12-column allocation", () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(getAutoPlayImageSpan)).toEqual([12, 6, 4, 3, 2, 2, 1]);
  });

  it("explicit spans are clamped to 1..12; a lone item is always full width", () => {
    expect(getPlayImageGridSpan(8, 2)).toBe(8);
    expect(getPlayImageGridSpan("20", 3)).toBe(12);
    expect(getPlayImageGridSpan("auto", 3)).toBe(4);
    expect(getPlayImageGridSpan(4, 1)).toBe(12);
  });

  it("slides per view: numeric within 0.5..12, otherwise the fallback", () => {
    expect(getPlayImageSlidesPerView("2.5", 1)).toBe(2.5);
    expect(getPlayImageSlidesPerView(40, 1)).toBe(12);
    expect(getPlayImageSlidesPerView("auto", 3)).toBe(3);
  });

  it("aspect ratio accepts 16:9, 16x9, 4/3 and plain numbers only", () => {
    expect(normalizePlayImageAspectRatio("16:9")).toBe("16 / 9");
    expect(normalizePlayImageAspectRatio("16x9")).toBe("16 / 9");
    expect(normalizePlayImageAspectRatio(1.5)).toBe("1.5");
    expect(normalizePlayImageAspectRatio("wide")).toBeNull();
  });

  it("object-fit/position and gaps are whitelisted", () => {
    expect(normalizePlayImageFit("CONTAIN")).toBe("contain");
    expect(normalizePlayImageFit("url(x)")).toBe("cover");
    expect(normalizePlayImagePosition("left top")).toBe("left top");
    expect(normalizePlayImagePosition("x;y")).toBe("center");
    expect(normalizePlayImageGap("12")).toBe(12);
    expect(normalizePlayImageGap(-4)).toBe(0);
  });

  it("builder booleans accept true/1/'yes'", () => {
    expect([true, 1, "1", "true", "YES", false, 0, "no", null].map(normalizeBuilderBoolean)).toEqual([
      true, true, true, true, true, false, false, false, false,
    ]);
  });

  it("row surface: colour/image backgrounds, padding and radius; unsafe colour ignored", () => {
    const section = playImageSection();
    const [first] = getPlayImageRows(section.content);

    const colour = getPlayImageRowSurfaceStyle(
      resolvePlayImageRow(section, {
        ...first,
        config: { background_type: "color", background_color: "#ffeecc", outer_padding: 8, border_radius: "1rem" },
      }),
    );
    expect(colour).toMatchObject({ backgroundColor: "#ffeecc", paddingInline: "8px", borderRadius: "1rem" });

    const unsafe = getPlayImageRowSurfaceStyle(
      resolvePlayImageRow(section, {
        ...first,
        config: { background_type: "color", background_color: "red;}body{x" },
      }),
    );
    expect(unsafe.backgroundColor).toBeUndefined();

    const image = getPlayImageRowSurfaceStyle(
      resolvePlayImageRow(section, {
        ...first,
        config: { background_type: "image", background_image: "https://cdn.test/bg (1).jpg" },
      }),
    );
    expect(image.backgroundImage).toBe('url("https://cdn.test/bg%20%281%29.jpg")');
  });

  it("detects upgraded legacy banners from the section config", () => {
    expect(
      isLegacyBannerSection(
        playImageSection({ config: { legacy_type: " Banners " } as HomeLayoutSection["config"] }),
      ),
    ).toBe(true);
    expect(isLegacyBannerSection(playImageSection())).toBe(false);
  });
});

describe("other v3.2 home-builder media adapters", () => {
  it("banner items carry image_web_mobile when sent", () => {
    const [item] = getSectionBannerItems({
      items: [{ id: 1, image: "https://cdn.test/d.jpg", image_web_mobile: "https://cdn.test/m.jpg" }],
    });
    expect(item.image_web_mobile).toBe("https://cdn.test/m.jpg");
  });

  it("categories pick up custom_image_url for custom_image rails", () => {
    expect(
      adaptHomeLayoutCategory({ id: 1, slug: "fruits", custom_image_url: "https://cdn.test/c.jpg" })
        ?.custom_image,
    ).toBe("https://cdn.test/c.jpg");
    expect(adaptHomeLayoutCategory({ id: 1, slug: "fruits" })?.custom_image).toBeNull();
  });
});
