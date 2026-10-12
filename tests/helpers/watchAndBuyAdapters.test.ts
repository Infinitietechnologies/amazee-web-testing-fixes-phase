import { describe, it, expect } from "vitest";

import {
  asSafeHref,
  toReel,
  toReels,
  toStoreReels,
  toStoreStoryGroup,
  toStoryGroup,
  toStoryTrayGroup,
} from "@/components/WatchAndBuy/adapters";
import {
  getWatchAndBuySettings,
  getWatchAndBuyTitle,
  isWatchAndBuyEnabled,
} from "@/helpers/watchAndBuy";
import type {
  WatchAndBuyProfile,
  WatchAndBuyReelItem,
} from "@/types/WatchAndBuy";

const sellerProfile: WatchAndBuyProfile = {
  id: 4,
  type: "seller",
  username: "fresh_mart",
  name: "Fresh Mart",
  status: "active",
  has_unseen_status: true,
  store: { id: 11, name: "Fresh Mart Indiranagar", slug: "fresh-mart", image: "https://cdn.test/logo.png" },
};

const reelItem = (overrides: Partial<WatchAndBuyReelItem> = {}): WatchAndBuyReelItem => ({
  id: 42,
  uuid: "reel-uuid-42",
  title: "Mango season",
  caption: "Alphonso just landed",
  profile: sellerProfile,
  poster_url: "https://cdn.test/poster.jpg",
  video_url: "https://cdn.test/video.mp4",
  duration_seconds: 75,
  views_count: 120,
  like_count: 10,
  is_liked: true,
  products: [
    {
      product: { id: 5, slug: "alphonso-mango", title: "Alphonso Mango", image_url: "https://cdn.test/mango.jpg" },
      variant: { id: 51, price: 500, special_price: 450 },
      store: { id: 11, slug: "fresh-mart", name: "Fresh Mart", distance_km: 1.25 },
      is_effective_primary: true,
    },
  ],
  ...overrides,
});

describe("toReel — feed item to viewer model", () => {
  it("maps identity, media, counts and the like state", () => {
    const reel = toReel(reelItem(), "₹");

    expect(reel).toMatchObject({
      id: "reel-uuid-42",
      apiId: 42,
      title: "Mango season",
      caption: "Alphonso just landed",
      publisher: "Fresh Mart",
      publisherType: "seller",
      posterSrc: "https://cdn.test/poster.jpg",
      videoSrc: "https://cdn.test/video.mp4",
      durationLabel: "1:15",
      views: 120,
      isLiked: true,
      // The viewer adds the customer's own like back on top.
      likes: 9,
    });
  });

  it("links each product to the normal product page (cart/checkout unchanged)", () => {
    const [product] = toReel(reelItem(), "₹")!.products ?? [];

    expect(product).toMatchObject({
      id: "5",
      name: "Alphonso Mango",
      href: "/products/alphonso-mango/",
      price: "₹450",
      compareAtPrice: "₹500",
      badge: "Featured",
      store: { slug: "fresh-mart", href: "/stores/fresh-mart/", distanceLabel: "1.3 km" },
    });
  });

  it("drops a reel without playable media or a poster", () => {
    expect(toReel(reelItem({ video_url: null, media_url: null }))).toBeNull();
    expect(
      toReel(
        reelItem({ poster_url: null, profile: { ...sellerProfile, photo_url: null } }),
      ),
    ).toBeNull();
    expect(toReels([reelItem(), reelItem({ video_url: "" })])).toHaveLength(1);
  });

  it("never turns a seller-supplied javascript: URL into a link", () => {
    const reel = toReel(
      reelItem({
        cta: { label: "Tap", url: "javascript:alert(1)" },
        products: [
          {
            product: { id: 5, slug: "safe-slug", title: "P", image_url: "https://cdn.test/p.jpg" },
            url: "javascript:alert(1)",
          },
        ],
      }),
    )!;

    expect(reel.cta).toBeUndefined();
    // Falls back to the product slug route instead.
    expect(reel.products?.[0]?.href).toBe("/products/safe-slug/");
  });
});

describe("asSafeHref", () => {
  it.each([
    ["/products/x/", "/products/x/"],
    ["https://shop.test/a", "https://shop.test/a"],
    ["//evil.test/x", undefined],
    ["javascript:alert(1)", undefined],
    ["data:text/html,x", undefined],
    ["  ", undefined],
    [null, undefined],
  ])("%s -> %s", (input, expected) => {
    expect(asSafeHref(input)).toBe(expected);
  });
});

describe("store and story adapters", () => {
  it("toStoreReels: compact store-detail reels become shoppable reels for that store", () => {
    const reels = toStoreReels(
      {
        id: 11,
        name: "Fresh Mart",
        slug: "fresh-mart",
        logo: "https://cdn.test/logo.png",
        reels: [
          reelItem({
            profile: null,
            products: [{ product_id: 5, name: "Alphonso Mango", image_url: "https://cdn.test/m.jpg", slug: "alphonso-mango" }],
          }),
        ],
      },
      "₹",
    );

    expect(reels).toHaveLength(1);
    expect(reels[0].publisher).toBe("Fresh Mart");
    expect(reels[0].products?.[0]).toMatchObject({
      name: "Alphonso Mango",
      href: "/products/alphonso-mango/",
      store: { slug: "fresh-mart" },
    });
  });

  it("toStoreStoryGroup: no launcher when the store has no active Stories", () => {
    expect(toStoreStoryGroup({ id: 1, name: "S", slug: "s", stories: [] })).toBeNull();
  });

  it("toStoryTrayGroup: a seller tray entry points at its store page", () => {
    const group = toStoryTrayGroup({ profile: sellerProfile, status_count: 3 });

    expect(group).toMatchObject({
      id: "fresh_mart",
      title: "Fresh Mart Indiranagar",
      publisherType: "seller",
      publisherHref: "/stores/fresh-mart/",
      itemCount: 3,
      unseenItemCount: 3,
      items: [],
    });
  });

  it("toStoryGroup: maps image/video media and the seen state", () => {
    const group = toStoryGroup({
      profile: sellerProfile,
      items: [
        { id: 1, uuid: "u1", source: "seller", content_type: "image", media_url: "https://cdn.test/1.jpg", created_at: "", expires_at: "", seen_by_me: true },
        { id: 2, uuid: "u2", source: "seller", content_type: "video", media_url: "https://cdn.test/2.mp4", created_at: "", expires_at: "", duration_ms: 9000 },
      ],
      pagination: { has_more_pages: false, next_cursor: null, previous_cursor: null, per_page: 10, total: 2 },
    });

    expect(group.items[0]).toMatchObject({ id: "u1", apiId: 1, imageSrc: "https://cdn.test/1.jpg", seen: true, durationMs: 5000 });
    expect(group.items[1]).toMatchObject({ id: "u2", videoSrc: "https://cdn.test/2.mp4", durationMs: 9000 });
    expect(group.unseenItemCount).toBe(1);
  });
});

describe("watch_and_buy settings gating", () => {
  const settingsWith = (value: unknown) => [
    { variable: "system", value: {} },
    { variable: "watch_and_buy", value },
  ];

  it("is enabled only when the backend explicitly sends enabled: true", () => {
    expect(isWatchAndBuyEnabled(settingsWith({ enabled: true, title: "Watch & Buy" }))).toBe(true);
    expect(isWatchAndBuyEnabled(settingsWith({ enabled: false }))).toBe(false);
    expect(isWatchAndBuyEnabled(settingsWith({ enabled: "1" }))).toBe(false);
    expect(isWatchAndBuyEnabled(settingsWith(null))).toBe(false);
  });

  it("is disabled when the settings payload has no watch_and_buy entry (older backend)", () => {
    expect(isWatchAndBuyEnabled([{ variable: "system", value: {} }])).toBe(false);
    expect(isWatchAndBuyEnabled(null)).toBe(false);
    expect(getWatchAndBuySettings(undefined)).toBeNull();
  });

  it("uses the configured title, falling back when blank", () => {
    expect(getWatchAndBuyTitle(settingsWith({ enabled: true, title: "  Shop Reels " }))).toBe("Shop Reels");
    expect(getWatchAndBuyTitle(settingsWith({ enabled: true, title: " " }), "Fallback")).toBe("Fallback");
  });
});
