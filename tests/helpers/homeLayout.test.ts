import { describe, it, expect } from "vitest";
import {
  adaptHomeLayoutCategories,
  adaptHomeLayoutCategory,
  adaptHomeLayoutProduct,
  adaptHomeLayoutProducts,
  getSectionCategories,
  getSectionProducts,
  toSectionListPage,
} from "@/helpers/homeLayout";
import homeLayoutResponse from "../fixtures/homeLayoutResponse.json";
import sectionFeed from "../fixtures/homeLayoutSectionFeed.json";
import categoriesResponse from "../fixtures/homeLayoutCategoriesResponse.json";

// Real payloads captured from the live /home-layout API.
const rawSection = (homeLayoutResponse as any).data.sections[0];
const rawProduct = rawSection.content.products[0];
const rawFeedItems = (sectionFeed as any).data.data;

const makeRaw = (over: Record<string, any> = {}) => ({
  ...JSON.parse(JSON.stringify(rawProduct)),
  ...over,
});

describe("adaptHomeLayoutProduct — real API fixture", () => {
  it("adapts a live product into a render-ready Product", () => {
    const product = adaptHomeLayoutProduct(rawProduct);

    expect(product).not.toBeNull();
    expect(product!.id).toBe(rawProduct.id);
    expect(product!.slug).toBe(rawProduct.slug);
    expect(product!.title).toBe(rawProduct.title);
    expect(product!.variants.length).toBeGreaterThan(0);
  });

  it("preserves the variant fields add-to-cart depends on", () => {
    const product = adaptHomeLayoutProduct(rawProduct)!;
    const variant = product.variants[0];
    const rawVariant = rawProduct.variants[0];

    // The load-bearing trio for addToCart({product_variant_id, store_id, quantity})
    expect(variant.id).toBe(rawVariant.id);
    expect(variant.store_id).toBe(rawVariant.store_id);
    expect(variant.stock).toBe(rawVariant.stock);
    // Store link fields read off variants[0]
    expect(variant.store_slug).toBe(rawVariant.store_slug);
    expect(variant.store_name).toBe(rawVariant.store_name);
  });

  it("coerces the metadata object to the string|null contract", () => {
    // The API sends metadata as an SEO object; Product declares string | null.
    expect(typeof rawProduct.metadata).toBe("object");
    expect(adaptHomeLayoutProduct(rawProduct)!.metadata).toBeNull();
  });

  it("fills fields the API omits so the card never reads undefined", () => {
    const product = adaptHomeLayoutProduct(rawProduct)!;
    expect(product.description).toBe("");
    expect(product.custom_fields).toEqual({});
    expect(product.custom_product_sections).toEqual([]);
    expect(product.returnable_days).toBeNull();
    expect(product.store_status).toBeDefined();
  });
});

describe("adaptHomeLayoutProduct — gating edge cases", () => {
  it("returns null when the product has no variants", () => {
    expect(adaptHomeLayoutProduct(makeRaw({ variants: [] }))).toBeNull();
    expect(adaptHomeLayoutProduct(makeRaw({ variants: undefined }))).toBeNull();
  });

  it("returns null for a nullish payload", () => {
    expect(adaptHomeLayoutProduct(null as any)).toBeNull();
  });

  it("defaults a missing `availability` from stock (never renders false OUT OF STOCK)", () => {
    const inStock = adaptHomeLayoutProduct(
      makeRaw({ variants: [{ id: 1, stock: 5, price: 10 }] }),
    )!;
    expect(inStock.variants[0].availability).toBe(true);

    const noStock = adaptHomeLayoutProduct(
      makeRaw({ variants: [{ id: 1, stock: 0, price: 10 }] }),
    )!;
    expect(noStock.variants[0].availability).toBe(false);
  });

  it("respects an explicit availability=false even with stock", () => {
    const product = adaptHomeLayoutProduct(
      makeRaw({ variants: [{ id: 1, stock: 5, availability: false }] }),
    )!;
    expect(product.variants[0].availability).toBe(false);
  });

  it("moves the default variant to index 0 so store link and cart agree", () => {
    const product = adaptHomeLayoutProduct(
      makeRaw({
        variants: [
          { id: 1, is_default: false, store_id: 10, store_name: "A", stock: 1 },
          { id: 2, is_default: true, store_id: 20, store_name: "B", stock: 1 },
        ],
      }),
    )!;

    expect(product.variants[0].id).toBe(2);
    expect(product.variants[0].store_name).toBe("B");
    // ProductCard's resolution must land on the same variant as variants[0]
    const defaultVariant =
      product.variants.find((v) => v.is_default) || product.variants[0];
    expect(defaultVariant.id).toBe(product.variants[0].id);
  });

  it("promotes the first variant to default when none is flagged", () => {
    const product = adaptHomeLayoutProduct(
      makeRaw({
        variants: [
          { id: 1, store_id: 10, stock: 1 },
          { id: 2, store_id: 20, stock: 1 },
        ],
      }),
    )!;
    expect(product.variants[0].id).toBe(1);
    expect(product.variants[0].is_default).toBe(true);
  });

  it("keeps the discount relationship intact", () => {
    const product = adaptHomeLayoutProduct(
      makeRaw({ variants: [{ id: 1, price: 100, special_price: 75, stock: 2 }] }),
    )!;
    const v = product.variants[0];
    expect(v.price).toBe(100);
    expect(v.special_price).toBe(75);
    expect(v.special_price > 0 && v.special_price < v.price).toBe(true);
  });

  it("normalises variant attributes `[]` into a Record for the tooltip", () => {
    const product = adaptHomeLayoutProduct(
      makeRaw({ variants: [{ id: 1, stock: 1, attributes: [] }] }),
    )!;
    expect(product.variants[0].attributes).toEqual({});
    expect(() => Object.entries(product.variants[0].attributes)).not.toThrow();
  });

  it("infers product type from variant count when absent", () => {
    const simple = adaptHomeLayoutProduct(
      makeRaw({ type: undefined, variants: [{ id: 1, stock: 1 }] }),
    )!;
    expect(simple.type).toBe("simple");

    const variant = adaptHomeLayoutProduct(
      makeRaw({ type: undefined, variants: [{ id: 1, stock: 1 }, { id: 2, stock: 1 }] }),
    )!;
    expect(variant.type).toBe("variant");
  });

  it("defaults store_status so the card's is_open read is safe", () => {
    const product = adaptHomeLayoutProduct(makeRaw({ store_status: undefined }))!;
    expect(product.store_status.is_open).toBe(true);
  });
});

describe("adaptHomeLayoutProducts / getSectionProducts", () => {
  it("adapts every product in the live section", () => {
    const products = adaptHomeLayoutProducts(rawSection.content.products);
    expect(products).toHaveLength(rawSection.content.products.length);
  });

  it("drops unrenderable (variant-less) products instead of failing", () => {
    const products = adaptHomeLayoutProducts([
      rawProduct,
      makeRaw({ variants: [] }),
    ]);
    expect(products).toHaveLength(1);
    expect(products[0].id).toBe(rawProduct.id);
  });

  it("handles an empty/absent list", () => {
    expect(adaptHomeLayoutProducts([])).toEqual([]);
    expect(adaptHomeLayoutProducts(undefined)).toEqual([]);
  });

  it("getSectionProducts reads content.products from a live section", () => {
    const products = getSectionProducts(rawSection.content);
    expect(products.length).toBe(rawSection.content.products.length);
    expect(products[0].variants[0].id).toBeDefined();
  });

  it("getSectionProducts returns [] for a section with no products key", () => {
    expect(getSectionProducts({} as any)).toEqual([]);
  });

  it("adapts the paginated 'view all' feed identically (same shape)", () => {
    const products = adaptHomeLayoutProducts(rawFeedItems);
    expect(products).toHaveLength(rawFeedItems.length);
    expect(products[0].variants[0].store_id).toBe(rawFeedItems[0].variants[0].store_id);
  });
});

describe("adaptHomeLayoutCategory — real 'categories' section fixture", () => {
  const catSection = (categoriesResponse as any).data.sections[0];
  const rawCategories = catSection.content.categories as any[];
  const rawCategory = rawCategories[0];

  it("adapts a live category into a render-ready Category", () => {
    const category = adaptHomeLayoutCategory(rawCategory)!;
    expect(category).not.toBeNull();
    expect(category.id).toBe(rawCategory.id);
    expect(category.title).toBe(rawCategory.title);
    expect(category.slug).toBe(rawCategory.slug);
    expect(category.image).toBe(rawCategory.image);
    // CategoryCard builds its link from parent_slug + slug
    expect(category.parent_slug).toBe(rawCategory.parent_slug);
  });

  it("supplies the `banner` field the API never sends", () => {
    expect("banner" in rawCategory).toBe(false);
    expect(adaptHomeLayoutCategory(rawCategory)!.banner).toBe("");
  });

  it("coerces the metadata object to the string|null contract", () => {
    expect(typeof rawCategory.metadata).toBe("object");
    expect(adaptHomeLayoutCategory(rawCategory)!.metadata).toBeNull();
  });

  it("drops a category with no slug (its link would be broken)", () => {
    expect(adaptHomeLayoutCategory({ id: 1, title: "x" })).toBeNull();
    expect(adaptHomeLayoutCategory(null as any)).toBeNull();
  });

  it("adapts the whole live category list", () => {
    const categories = adaptHomeLayoutCategories(rawCategories);
    expect(categories).toHaveLength(rawCategories.length);
    expect(categories).toHaveLength(18);
  });

  it("getSectionCategories reads content.categories from a live section", () => {
    expect(getSectionCategories(catSection.content)).toHaveLength(
      rawCategories.length,
    );
  });

  it("returns [] for a section with no categories key", () => {
    expect(getSectionCategories({} as any)).toEqual([]);
    expect(adaptHomeLayoutCategories(undefined)).toEqual([]);
  });
});

describe("toSectionListPage — bridges the non-standard envelope", () => {
  it("moves data.sections onto data.data for useInfiniteData", () => {
    const page = toSectionListPage(homeLayoutResponse as any);
    const raw = (homeLayoutResponse as any).data;

    expect(page.success).toBe(true);
    // The hook reads its array from data.data; the API puts it at data.sections.
    expect(page.data.data).toHaveLength(raw.sections.length);
    expect(page.data.data[0].id).toBe(raw.sections[0].id);
    expect(page.data.total).toBe(raw.total);
  });

  it("falls back to an empty page when data is null (api fallback)", () => {
    const page = toSectionListPage({
      success: false,
      message: "An error occurred.",
      data: null,
    } as any);
    expect(page.success).toBe(false);
    expect(page.data.data).toEqual([]);
    expect(page.data.total).toBe(0);
  });

  it("survives a malformed/absent response without throwing", () => {
    expect(toSectionListPage(undefined as any)).toEqual({
      success: false,
      data: { data: [], total: 0 },
    });
  });
});
