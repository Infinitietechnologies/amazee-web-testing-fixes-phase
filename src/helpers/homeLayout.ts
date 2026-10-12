import {
  ApiResponse,
  BogoOffer,
  Brand,
  Category,
  HomeLayoutBannerItem,
  HomeLayoutHeroItem,
  HomeLayoutData,
  HomeLayoutPlayImageItemConfig,
  HomeLayoutPlayImageRow,
  HomeLayoutPlayImageRowConfig,
  HomeLayoutSection,
  OfferGroup,
  Product,
  ProductVariant,
} from "@/types/ApiResponse";
import { getActiveCategory } from "@/helpers/getters";
import { getCookie } from "@/lib/cookies";
import { UserLocation } from "@/components/Location/types/LocationAutoComplete.types";

/**
 * Adapters for the /home-layout API.
 *
 * The home-layout product payload is structurally close to `Product` but not
 * identical: `metadata` arrives as an object (the type expects `string | null`),
 * a few fields are absent, and variant `attributes` can come back as `[]`.
 * These adapters normalise the raw payload into a `Product` that `ProductCard`,
 * `addToCart` and the offline-cart slice can consume unchanged.
 */

// Raw payload is an API boundary — intentionally loose.
type RawRecord = Record<string, any>;

/**
 * `attributes` must be a Record for ProductCard's Object.entries() tooltip.
 * The API sends `[]` when there are none, which isn't assignable to the type.
 */
const toAttributeRecord = (value: unknown): Record<string, string> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, string>)
    : {};

const adaptVariant = (raw: RawRecord): ProductVariant => {
  const stock = Number(raw?.stock) || 0;

  return {
    id: raw?.id,
    title: raw?.title ?? "",
    slug: raw?.slug ?? "",
    image: raw?.image || raw?.main_image || "",
    weight: Number(raw?.weight) || 0,
    height: Number(raw?.height) || 0,
    breadth: Number(raw?.breadth) || 0,
    length: Number(raw?.length) || 0,
    // Must not fall through to `undefined`: ProductCard renders OUT OF STOCK on
    // `!availability`, so an absent flag would wrongly hide every product.
    availability:
      typeof raw?.availability === "boolean" ? raw.availability : stock > 0,
    cart_item: raw?.cart_item,
    barcode: raw?.barcode ?? "",
    is_default: Boolean(raw?.is_default),
    price: Number(raw?.price) || 0,
    special_price: Number(raw?.special_price) || 0,
    store_id: raw?.store_id,
    store_slug: raw?.store_slug ?? "",
    store_name: raw?.store_name ?? "",
    stock,
    sku: raw?.sku ?? "",
    attributes: toAttributeRecord(raw?.attributes),
    addon_groups: raw?.addon_groups,
    is_addons: raw?.is_addons,
  };
};

/**
 * Normalise one raw home-layout product into a `Product`.
 * Returns `null` when the product has no variant — ProductCard renders nothing
 * without one, so such items are dropped rather than rendered blank.
 */
export const adaptHomeLayoutProduct = (raw: RawRecord): Product | null => {
  if (!raw || !Array.isArray(raw.variants) || raw.variants.length === 0) {
    return null;
  }

  // ProductCard reads variants[0] for the store link but resolves the cart
  // variant via find(is_default) — if those disagree the displayed store won't
  // match the store added to cart. Emitting the default first keeps them aligned.
  const variants = raw.variants
    .map(adaptVariant)
    .sort((a, b) => Number(b.is_default) - Number(a.is_default));

  if (!variants.some((v) => v.is_default)) {
    variants[0] = { ...variants[0], is_default: true };
  }

  return {
    id: raw.id,
    uuid: raw.uuid ?? "",
    category_id: raw.category_id,
    brand_id: raw.brand_id ?? null,
    brand_name: raw.brand_name ?? null,
    seller_id: raw.seller_id,
    title: raw.title ?? "",
    slug: raw.slug ?? "",
    type: raw.type ?? (variants.length === 1 ? "simple" : "variant"),
    short_description: raw.short_description ?? "",
    description: raw.description ?? "",
    category: raw.category ?? "",
    category_name: raw.category_name ?? "",
    brand: raw.brand ?? "",
    seller: raw.seller ?? null,
    indicator: raw.indicator ?? null,
    favorite: raw.favorite ?? null,
    estimated_delivery_time: raw.estimated_delivery_time ?? null,
    ratings: Number(raw.ratings) || 0,
    rating_count: Number(raw.rating_count) || 0,
    main_image: raw.main_image ?? "",
    image_fit: raw.image_fit ?? "cover",
    additional_images: raw.additional_images ?? [],
    minimum_order_quantity: Number(raw.minimum_order_quantity) || 1,
    quantity_step_size: Number(raw.quantity_step_size) || 1,
    total_allowed_quantity:
      Number(raw.total_allowed_quantity) || variants[0].stock || 1,
    is_returnable: raw.is_returnable ?? 0,
    returnable_days: raw.returnable_days ?? null,
    is_cancelable: raw.is_cancelable ?? 0,
    cancelable_till: raw.cancelable_till ?? null,
    tags: raw.tags ?? [],
    warranty_period: raw.warranty_period ?? null,
    guarantee_period: raw.guarantee_period ?? null,
    made_in: raw.made_in ?? null,
    is_inclusive_tax: raw.is_inclusive_tax ?? "0",
    video_type: raw.video_type ?? null,
    video_link: raw.video_link ?? null,
    status: raw.status ?? "active",
    featured: raw.featured ?? null,
    // The API sends an SEO object here; the Product contract is `string | null`.
    metadata: typeof raw.metadata === "string" ? raw.metadata : null,
    item_count_in_cart: raw.item_count_in_cart,
    custom_fields: raw.custom_fields ?? {},
    created_at: raw.created_at ?? "",
    updated_at: raw.updated_at ?? "",
    // Absent store_status would crash ProductCard's `store_status.is_open` read.
    store_status: raw.store_status ?? { is_open: true, status: "open" },
    variants,
    attributes: raw.attributes ?? [],
    custom_product_sections: raw.custom_product_sections ?? [],
  };
};

/** Adapt a raw home-layout product list, dropping items that can't render. */
export const adaptHomeLayoutProducts = (raw: unknown[] = []): Product[] =>
  (raw ?? [])
    .map((item) => adaptHomeLayoutProduct(item as RawRecord))
    .filter((item): item is Product => item !== null);

/** Pull the products out of a section's `content`, adapted and render-ready. */
export const getSectionProducts = (content: Record<string, unknown[]>): Product[] =>
  adaptHomeLayoutProducts(content?.products ?? []);

/**
 * Normalise an `offers` section's content: one entry per live BOGO campaign,
 * each with the products carrying it.
 *
 * Groups whose offer failed to arrive, or that carry no products, are dropped —
 * an offer rail with nothing in it is worse than no rail.
 */
export const getSectionOffers = (
  content: Record<string, unknown[]>,
): OfferGroup[] =>
  ((content?.offers ?? []) as unknown[])
    .map((raw) => {
      const group = raw as { offer?: BogoOffer; products?: unknown[] };
      if (!group?.offer) return null;
      return {
        offer: group.offer,
        products: adaptHomeLayoutProducts(group.products ?? []),
      } as OfferGroup;
    })
    .filter((g): g is OfferGroup => g !== null && g.products.length > 0);

/**
 * Normalise a raw home-layout category into a `Category`.
 * Same drift as products: `metadata` arrives as an SEO object and `banner`
 * isn't sent at all, but CategoryCard needs a valid Category.
 * Returns `null` when there's no slug — CategoryCard's link would be broken.
 */
export const adaptHomeLayoutCategory = (raw: RawRecord): Category | null => {
  if (!raw || !raw.slug) return null;

  return {
    id: raw.id,
    title: raw.title ?? "",
    slug: raw.slug,
    image: raw.image ?? "",
    banner: raw.banner ?? "", // not returned by /home-layout
    icon: raw.icon ?? "",
    active_icon: raw.active_icon ?? "",
    background_type: raw.background_type ?? null,
    background_color: raw.background_color ?? "",
    background_image: raw.background_image ?? "",
    font_color: raw.font_color ?? "",
    parent_id: raw.parent_id ?? null,
    parent_slug: raw.parent_slug ?? null,
    description: raw.description ?? null,
    status: raw.status ?? "active",
    requires_approval: Boolean(raw.requires_approval),
    // The API sends an SEO object here; the Category contract is `string | null`.
    metadata: typeof raw.metadata === "string" ? raw.metadata : null,
    subcategory_count: Number(raw.subcategory_count) || 0,
    product_count: Number(raw.product_count) || 0,
    enabled: raw.enabled,
    // [v3.2 port] `custom_image` rails: the resolver swaps the section artwork
    // into `image` and may also expose it as `custom_image_url`.
    custom_image: raw.custom_image_url ?? raw.custom_image ?? null,
  };
};

/** Adapt a raw home-layout category list, dropping items that can't render. */
export const adaptHomeLayoutCategories = (raw: unknown[] = []): Category[] =>
  (raw ?? [])
    .map((item) => adaptHomeLayoutCategory(item as RawRecord))
    .filter((item): item is Category => item !== null);

/** Pull the categories out of a section's `content`, adapted and render-ready. */
export const getSectionCategories = (
  content: Record<string, unknown[]>,
): Category[] => adaptHomeLayoutCategories(content?.categories ?? []);

/**
 * [CHANGE 2026-09-22] Brands, banners and hero items.
 *
 * The backend has always published these three section types — `brands`,
 * `banners` and `hero` are in HomeSectionTypeEnum and HomeLayoutResolver
 * resolves content for each. The web storefront had no adapter and no renderer
 * for any of them, so an admin could build a hero or a banner strip, save it,
 * see it in the builder's preview, and find nothing on the site. These three
 * adapters close the customer-facing half of that gap.
 */

/** Adapt one raw home-layout brand; null when it cannot be linked to. */
export const adaptHomeLayoutBrand = (raw: RawRecord): Brand | null => {
  if (!raw || !raw.slug) return null;

  return {
    id: raw.id,
    title: raw.title ?? raw.name ?? "",
    slug: raw.slug,
    // BrandResource calls it `logo`; some payloads carry `image`.
    logo: (raw.logo as string) || (raw.image as string) || "",
    description: (raw.description as string) ?? undefined,
    enabled: raw.enabled as boolean | undefined,
    // [v3.2 port] See adaptHomeLayoutCategory.
    custom_image: (raw.custom_image_url as string) ?? (raw.custom_image as string) ?? null,
  };
};

export const adaptHomeLayoutBrands = (raw: unknown[] = []): Brand[] =>
  (raw ?? [])
    .map((item) => adaptHomeLayoutBrand(item as RawRecord))
    .filter((item): item is Brand => item !== null);

export const getSectionBrands = (
  content: Record<string, unknown[]>,
): Brand[] => adaptHomeLayoutBrands(content?.brands ?? []);

/**
 * A banner slide that is actually renderable.
 *
 * `HomeLayoutBannerItem` (the API contract) has `image: string | null`, because
 * the API can publish a slide whose image was never uploaded. The adapter drops
 * those, so everything downstream can rely on the image being there — this
 * alias is how that guarantee reaches the type system instead of living in a
 * comment.
 */
export type RenderableBannerItem = HomeLayoutBannerItem & { image: string };

/**
 * Where a banner slide points.
 *
 * Returns null rather than "#" when a slide has no destination: a banner that
 * links nowhere should render as a plain image, not as a link that scrolls the
 * page to the top when tapped.
 */
export const bannerHref = (item: HomeLayoutBannerItem): string | null => {
  if (item.link_url) return item.link_url;
  if (!item.slug) return null;

  switch (item.link_type) {
    case "product":
      return `/products/${item.slug}`;
    case "category":
      return `/categories/${item.slug}`;
    case "brand":
      return `/brands/${item.slug}`;
    default:
      return null;
  }
};

export const adaptHomeLayoutBannerItems = (
  raw: unknown[] = [],
): RenderableBannerItem[] =>
  (raw ?? [])
    .map((entry) => {
      const item = entry as RawRecord;

      // No image means no slide. Rendering an empty <img> leaves a broken-image
      // box in the middle of the home page.
      if (!item || !item.image) return null;

      return {
        id: item.id,
        image: item.image as string,
        // [v3.2 port] Optional mobile-web artwork, used below the md breakpoint.
        image_web_mobile: (item.image_web_mobile as string) || null,
        link_type: (item.link_type as HomeLayoutBannerItem["link_type"]) ?? null,
        link_url: (item.link_url as string) ?? null,
        target_id: (item.target_id as number) ?? null,
        slug: (item.slug as string) ?? null,
      } as RenderableBannerItem;
    })
    .filter((item): item is RenderableBannerItem => item !== null);

export const getSectionBannerItems = (
  content: Record<string, unknown[]>,
): RenderableBannerItem[] => adaptHomeLayoutBannerItems(content?.items ?? []);

/**
 * [v3.2 port 2026-09-28] Where a home-builder image points, or `null`.
 *
 * The v3.2 resolver for `play_image` items: a superset of `bannerHref` that
 * also understands plural link types, store/seller targets and an explicit
 * `none`. `custom` (and anything unrecognised) uses `link_url` when sent.
 * `bannerHref` is left untouched for the existing banner rail.
 */
export const resolveSectionBannerHref = (
  item: HomeLayoutBannerItem,
): string | null => {
  const target = item?.slug ?? item?.target_id ?? null;
  const to = (base: string) =>
    target !== null && target !== "" ? `/${base}/${target}` : null;

  switch (item?.link_type) {
    case "product":
    case "products":
      return to("products");
    case "category":
    case "categories":
      return to("categories");
    case "brand":
    case "brands":
      return to("brands");
    case "store":
    case "stores":
    case "seller":
      return to("stores");
    case "none":
      return null;
    default:
      return item?.link_url || null;
  }
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

/**
 * [v3.2 port] One `play_image` item. Kept separate from
 * `adaptHomeLayoutBannerItems` because play images keep their per-item
 * `config` and may carry only a mobile-web image. Null when there is no image
 * at all — an empty tile would reserve blank space on the page.
 */
export const adaptPlayImageItem = (
  raw: RawRecord,
): HomeLayoutBannerItem | null => {
  if (!raw || typeof raw !== "object") return null;

  const desktop = typeof raw.image === "string" ? raw.image : "";
  const mobile =
    typeof raw.image_web_mobile === "string" ? raw.image_web_mobile : "";
  const image = desktop || mobile;
  if (!image) return null;

  return {
    id: raw.id,
    image,
    image_web_mobile: mobile || null,
    media_type: raw.media_type ?? "image",
    link_type: raw.link_type ?? null,
    link_url: raw.link_url ?? null,
    target_id: raw.target_id ?? null,
    slug: raw.slug ?? null,
    config: asRecord(raw.config) as HomeLayoutPlayImageItemConfig,
  };
};

/**
 * [v3.2 port] Normalise `content.rows` of a `play_image` section.
 * Rows without a renderable item are dropped; `sourceIndex` keeps each row's
 * original position so config matching survives dropped rows.
 */
export const getPlayImageRows = (
  content: Record<string, unknown[]>,
): HomeLayoutPlayImageRow[] => {
  const rows = Array.isArray(content?.rows) ? content.rows : [];

  return rows.flatMap((value, sourceIndex) => {
    const row = value as RawRecord;
    if (!row || typeof row !== "object" || Array.isArray(row)) return [];

    const items = (Array.isArray(row.items) ? row.items : [])
      .map((item: unknown) => adaptPlayImageItem(item as RawRecord))
      .filter(
        (item: HomeLayoutBannerItem | null): item is HomeLayoutBannerItem =>
          item !== null,
      );
    if (items.length === 0) return [];

    return [
      {
        sourceIndex,
        row_index: row.row_index ?? sourceIndex,
        title: typeof row.title === "string" ? row.title : null,
        style: typeof row.style === "string" ? row.style : null,
        config: asRecord(row.config) as HomeLayoutPlayImageRowConfig,
        items,
      },
    ];
  });
};

/** A hero card with the fields the renderer needs resolved to plain strings. */
export type RenderableHeroItem = Omit<HomeLayoutHeroItem, "title" | "image"> & {
  title: string;
  image: string;
};

export const heroHref = (item: Pick<HomeLayoutHeroItem, "type" | "slug">): string | null => {
  if (!item.slug) return null;

  switch (item.type) {
    case "product":
      return `/products/${item.slug}`;
    case "category":
      return `/categories/${item.slug}`;
    case "brand":
      return `/brands/${item.slug}`;
    default:
      return null;
  }
};

export const adaptHomeLayoutHeroItems = (
  raw: unknown[] = [],
): RenderableHeroItem[] =>
  (raw ?? [])
    .map((entry) => {
      const item = entry as RawRecord;
      if (!item) return null;

      // `default_image` is the itemable's own image; `image` is the override the
      // admin uploaded on the card. Either will do — a card with neither is a
      // blank tile, so it is dropped.
      const image = (item.image as string) || (item.default_image as string) || "";
      const title = (item.title as string) || "";

      if (!image && !title) return null;

      return {
        id: item.id,
        title,
        image,
        type: (item.type as HomeLayoutHeroItem["type"]) ?? null,
        target_id: (item.target_id as number) ?? null,
        slug: (item.slug as string) ?? null,
      } as RenderableHeroItem;
    })
    .filter((item): item is RenderableHeroItem => item !== null);

export const getSectionHeroItems = (
  content: Record<string, unknown[]>,
): RenderableHeroItem[] => adaptHomeLayoutHeroItems(content?.items ?? []);

/**
 * Build the /home-layout request params for the section list.
 *
 * MUST be called fresh on every fetch. `getActiveCategory()` reads
 * window.location.search and the location cookie changes at runtime, so
 * capturing either in a `useMemo` pins every later request to the mount-time
 * category — the homepage then stays stuck on the category it first loaded with.
 */
export const buildHomeLayoutParams = (
  params: Record<string, unknown> = {},
): Record<string, unknown> => {
  const { lat = "", lng = "" } =
    (getCookie("userLocation") as UserLocation) || {};

  return {
    platform: "web",
    category_slug: getActiveCategory(), // undefined for "all"/unset
    ...params,
    latitude: lat || undefined,
    longitude: lng || undefined,
    // Read per call like the category: later pages of a preview must keep
    // asking for the draft, not silently switch to the live layout.
    preview_token: readHomePreviewToken(
      typeof window !== "undefined" ? window.location.search : "",
    ),
  };
};

/**
 * [CHANGE 2026-09-23] Admin Home Builder preview token from `?home_preview=`.
 *
 * Shape-checked only (`{layoutId}.{expires}.{hmac}`); the backend verifies the
 * signature and expiry. Anything else is ignored so a mangled link falls back
 * to the normal homepage instead of an error page.
 */
export const readHomePreviewToken = (
  search: string | string[] | undefined,
): string | undefined => {
  const raw = Array.isArray(search) ? search[0] : search;
  if (!raw) return undefined;
  const value = raw.includes("=") || raw.startsWith("?")
    ? new URLSearchParams(raw).get("home_preview")
    : raw;
  return value && /^\d+\.\d+\.[a-f0-9]{64}$/.test(value) ? value : undefined;
};

/** Draft sections not yet published have no id of their own (the API numbers them below zero). */
export const isPublishedSectionId = (id: number | null | undefined): boolean =>
  typeof id === "number" && id > 0;

/**
 * Re-shape a /home-layout response for `useInfiniteData`.
 *
 * The hook reads its page array from `data.data` and its count from `data.total`,
 * but /home-layout is a non-standard envelope that puts the array at
 * `data.sections`. Without this bridge the hook silently renders zero sections.
 */
export const toSectionListPage = (
  res: ApiResponse<HomeLayoutData>,
): { success: boolean; data: { data: HomeLayoutSection[]; total: number } } => ({
  success: Boolean(res?.success),
  data: {
    data: res?.data?.sections ?? [],
    total: res?.data?.total ?? 0,
  },
});
