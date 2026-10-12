import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock the heavy leaves so this stays a focused unit test of the renderer's
// decision logic (type switch / fallback / product fan-out). The ProductCard
// field contract is covered by the adapter tests.
// Partially mock: the real i18n.ts (pulled in via helpers) needs initReactI18next,
// so keep the module intact and only stub the hook.
vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
      i18n: { language: "en", resolvedLanguage: "en" },
    }),
  };
});

// Mirrors next/link's object-href support so we can assert the resolved URL.
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => {
    const url =
      typeof href === "string"
        ? href
        : `${href.pathname}${
            href.query ? `?${new URLSearchParams(href.query).toString()}` : ""
          }`;
    return (
      <a href={url} {...rest}>
        {children}
      </a>
    );
  },
}));

vi.mock("swiper/react", () => ({
  Swiper: ({ children }: any) => <div data-testid="swiper">{children}</div>,
  SwiperSlide: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("swiper/modules", () => ({ Navigation: {} }));

vi.mock("@/components/SwiperNavigation", () => ({ default: () => null }));

vi.mock("@/components/SectionHeading", () => ({
  default: ({ title }: any) => <h2>{title}</h2>,
}));

vi.mock("@/components/Cards/ProductCard", () => ({
  default: ({ product }: any) => (
    <div data-testid="product-card">{product.title}</div>
  ),
}));

vi.mock("@/components/Skeletons/ProductCardSkeleton", () => ({
  default: () => <div data-testid="product-skeleton" />,
}));

vi.mock("@/components/Cards/CategoryCard", () => ({
  default: ({ category }: any) => (
    <div data-testid="category-card">{category.title}</div>
  ),
}));

vi.mock("@/components/Skeletons/CategoryCardSkeleton", () => ({
  default: () => <div data-testid="category-skeleton" />,
}));

vi.mock("@/components/Cards/BrandCard", () => ({
  default: ({ brand }: any) => <div data-testid="brand-card">{brand.title}</div>,
}));

vi.mock("@/components/Skeletons/BrandCardSkeleton", () => ({
  default: () => <div data-testid="brand-skeleton" />,
}));

import HomeSectionRenderer, {
  getSectionBackgroundStyle,
} from "@/views/homePage/HomeSectionRenderer";
import { HomeLayoutSection } from "@/types/ApiResponse";
import homeLayoutResponse from "../fixtures/homeLayoutResponse.json";
import categoriesResponse from "../fixtures/homeLayoutCategoriesResponse.json";

const liveCategoriesSection = (categoriesResponse as any).data
  .sections[0] as HomeLayoutSection;
const liveCategories = (liveCategoriesSection.content.categories as any[]) ?? [];

const liveSection = (homeLayoutResponse as any).data.sections[0] as HomeLayoutSection;
// The products fixture has a real title; `title` is nullable on the type.
const liveTitle = liveSection.title as string;
const liveProducts = (liveSection.content.products as any[]) ?? [];

const makeSection = (over: Partial<HomeLayoutSection> = {}): HomeLayoutSection =>
  ({ ...JSON.parse(JSON.stringify(liveSection)), ...over }) as HomeLayoutSection;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("HomeSectionRenderer — products section (live fixture)", () => {
  it("renders the section title and one card per product", () => {
    render(<HomeSectionRenderer section={liveSection} />);

    expect(screen.getByText(liveTitle)).toBeInTheDocument();
    expect(screen.getAllByTestId("product-card")).toHaveLength(liveProducts.length);
  });

  it("links 'see all' to the id-based section route, carrying the title", () => {
    render(<HomeSectionRenderer section={liveSection} />);
    const expected = `/section/${liveSection.id}?${new URLSearchParams({
      title: liveTitle,
    }).toString()}`;
    expect(screen.getByRole("link", { name: "see_all" })).toHaveAttribute(
      "href",
      expected,
    );
  });

  // [CHANGE 2026-09-23] A section that exists only in an admin draft preview
  // has no published feed; the API numbers it below zero.
  it("hides 'see all' for a draft-only preview section (negative id)", () => {
    render(<HomeSectionRenderer section={makeSection({ id: -1 })} />);
    expect(screen.getAllByTestId("product-card")).toHaveLength(liveProducts.length);
    expect(screen.queryByRole("link", { name: "see_all" })).toBeNull();
  });

  it("omits the title query when the section has no title", () => {
    render(<HomeSectionRenderer section={makeSection({ title: "" })} />);
    expect(screen.getByRole("link", { name: "see_all" })).toHaveAttribute(
      "href",
      `/section/${liveSection.id}`,
    );
  });

  it("renders skeletons instead of cards while loading", () => {
    render(<HomeSectionRenderer section={liveSection} isLoading />);
    expect(screen.getAllByTestId("product-skeleton").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("product-card")).not.toBeInTheDocument();
  });
});

describe("HomeSectionRenderer — categories section (live fixture)", () => {
  it("renders one card per category from the live categories section", () => {
    render(<HomeSectionRenderer section={liveCategoriesSection} />);
    expect(screen.getAllByTestId("category-card")).toHaveLength(
      liveCategories.length,
    );
    expect(screen.getAllByTestId("category-card")).toHaveLength(18);
  });

  it("falls back to a default heading when the API sends title: null", () => {
    // The live categories section really does have title === null.
    expect(liveCategoriesSection.title).toBeNull();
    render(<HomeSectionRenderer section={liveCategoriesSection} />);
    expect(screen.getByText("home.categories.title")).toBeInTheDocument();
  });

  it("links categories 'see all' to /categories", () => {
    render(<HomeSectionRenderer section={liveCategoriesSection} />);
    expect(screen.getByRole("link", { name: "see_all" })).toHaveAttribute(
      "href",
      "/categories",
    );
  });

  it("renders category skeletons while loading", () => {
    render(<HomeSectionRenderer section={liveCategoriesSection} isLoading />);
    expect(screen.getAllByTestId("category-skeleton").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("category-card")).not.toBeInTheDocument();
  });

  it("renders nothing when a categories section is empty", () => {
    const { container } = render(
      <HomeSectionRenderer
        section={
          { ...liveCategoriesSection, content: { categories: [] } } as any
        }
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("HomeSectionRenderer — graceful fallbacks", () => {
  // [CHANGE 2026-09-22] This used to probe with "banners", which the renderer
  // now implements — the test was asserting the absence of a feature rather
  // than the fallback itself. Re-pointed at "sliders", a type the backend
  // enum does not publish and the storefront does not render, so the guarantee
  // under test (unknown type is skipped, and says so in development) is
  // unchanged while the stale expectation is gone.
  it("renders nothing for an unknown section type and warns in dev", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = render(
      <HomeSectionRenderer section={makeSection({ type: "sliders" })} />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Unsupported section type "sliders"'),
    );
  });

  it("renders nothing when a products section has no products", () => {
    const { container } = render(
      <HomeSectionRenderer section={makeSection({ content: { products: [] } })} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when content is missing entirely", () => {
    const { container } = render(
      <HomeSectionRenderer section={makeSection({ content: {} })} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for a nullish section", () => {
    const { container } = render(
      <HomeSectionRenderer section={undefined as any} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("drops variant-less products but still renders the rest", () => {
    const section = makeSection({
      content: {
        products: [liveProducts[0], { ...liveProducts[1], variants: [] }],
      },
    });
    render(<HomeSectionRenderer section={section} />);
    expect(screen.getAllByTestId("product-card")).toHaveLength(1);
  });
});

describe("getSectionBackgroundStyle", () => {
  it("returns a background colour for background_type=color", () => {
    const section = makeSection({
      config: { source: null, orientation: null, background_type: "color", background_color: "#e71313" },
    });
    expect(getSectionBackgroundStyle(section)).toEqual({
      backgroundColor: "#e71313",
    });
  });

  it("returns a background image for background_type=image", () => {
    const section = makeSection({
      config: { source: null, orientation: null, background_type: "image", background_color: null },
      background_image: "https://cdn.test/a b(1).png",
    });
    const style = getSectionBackgroundStyle(section);
    // spaces/parens are URL-encoded so the CSS url() stays valid
    expect(style.backgroundImage).toBe('url("https://cdn.test/a%20b%281%29.png")');
    expect(style.backgroundSize).toBe("cover");
  });

  it("returns no styling for the live 'none' background type", () => {
    // The live fixture uses background_type "none" with a stray colour set.
    expect(getSectionBackgroundStyle(liveSection)).toEqual({});
  });

  it("returns no styling when an image type has no image", () => {
    const section = makeSection({
      config: { source: null, orientation: null, background_type: "image", background_color: null },
      background_image: null,
      card_background_image: null,
    });
    expect(getSectionBackgroundStyle(section)).toEqual({});
  });
});

/* ====================================================================
   [CHANGE 2026-09-22] brands | banners | hero

   These three types were publishable from the Home Builder and resolvable by
   the backend, and the renderer's `default` branch dropped all three — a hero
   the admin built simply never appeared, with no error in production to say so.
   The regression these guard against is that silence coming back.
   ==================================================================== */

const brandsSection = (over: Partial<HomeLayoutSection> = {}): HomeLayoutSection =>
  ({
    id: 901,
    type: "brands",
    title: "Featured brands",
    style: "image_title",
    config: { source: "all", background_type: "none" },
    content: {
      brands: [
        { id: 1, title: "Alpha", slug: "alpha", logo: "https://cdn.test/a.png" },
        { id: 2, title: "Beta", slug: "beta", image: "https://cdn.test/b.png" },
        // No slug — cannot be linked to, so it must be dropped rather than
        // rendered as a card that goes nowhere.
        { id: 3, title: "Ghost" },
      ],
    },
    ...over,
  }) as unknown as HomeLayoutSection;

const bannersSection = (items: unknown[], over: Partial<HomeLayoutSection> = {}) =>
  ({
    id: 902,
    type: "banners",
    title: "",
    style: "peek",
    config: {},
    content: { items },
    ...over,
  }) as unknown as HomeLayoutSection;

const heroSection = (over: Partial<HomeLayoutSection> = {}) =>
  ({
    id: 903,
    type: "hero",
    title: "Flash deals",
    style: "image_title",
    config: { layout: "items", card_bg_color: "#FFF3E0", card_title_color: "#E65100" },
    hero_media: "https://cdn.test/hero.png",
    content: {
      items: [
        { id: 11, title: "Up to 50% off", image: "https://cdn.test/i1.png", type: "category", slug: "deals" },
        { id: 12, title: "Daily picks", default_image: "https://cdn.test/i2.png", type: null, slug: null },
      ],
    },
    ...over,
  }) as unknown as HomeLayoutSection;

describe("HomeSectionRenderer — brands section", () => {
  it("renders the admin's title and one card per linkable brand", () => {
    render(<HomeSectionRenderer section={brandsSection()} />);

    expect(screen.getByText("Featured brands")).toBeInTheDocument();
    // Three in the payload, one with no slug.
    expect(screen.getAllByTestId("brand-card")).toHaveLength(2);
    expect(screen.queryByText("Ghost")).not.toBeInTheDocument();
  });

  it("renders nothing when the section has no brands", () => {
    const { container } = render(
      <HomeSectionRenderer section={brandsSection({ content: { brands: [] } } as any)} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows skeletons, not an empty rail, while loading", () => {
    render(
      <HomeSectionRenderer
        section={brandsSection({ content: { brands: [] } } as any)}
        isLoading
      />,
    );
    expect(screen.getAllByTestId("brand-skeleton").length).toBeGreaterThan(0);
  });
});

describe("HomeSectionRenderer — banners section", () => {
  it("links a slide with a custom URL", () => {
    render(
      <HomeSectionRenderer
        section={bannersSection([
          { id: 1, image: "https://cdn.test/b1.png", link_type: "custom", link_url: "https://example.test/sale" },
        ])}
      />,
    );
    expect(screen.getByRole("link")).toHaveAttribute("href", "https://example.test/sale");
  });

  it("builds the route for a slide that points at a category", () => {
    render(
      <HomeSectionRenderer
        section={bannersSection([
          { id: 2, image: "https://cdn.test/b2.png", link_type: "category", link_url: null, slug: "fruits" },
        ])}
      />,
    );
    expect(screen.getByRole("link")).toHaveAttribute("href", "/categories/fruits");
  });

  it("renders a destination-less slide as a plain image, not a link to nowhere", () => {
    render(
      <HomeSectionRenderer
        section={bannersSection([
          { id: 3, image: "https://cdn.test/b3.png", link_type: null, link_url: null, slug: null },
        ])}
      />,
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(document.querySelector("img")).toHaveAttribute("src", "https://cdn.test/b3.png");
  });

  it("drops a slide with no image rather than leaving a broken image box", () => {
    const { container } = render(
      <HomeSectionRenderer section={bannersSection([{ id: 4, link_type: "custom", link_url: "/x" }])} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("HomeSectionRenderer — hero section", () => {
  it("renders the banner and one card per item", () => {
    render(<HomeSectionRenderer section={heroSection()} />);

    const images = Array.from(document.querySelectorAll("img")).map((i) => i.getAttribute("src"));
    expect(images).toContain("https://cdn.test/hero.png");
    expect(screen.getByText("Up to 50% off")).toBeInTheDocument();
    // Falls back to default_image when the admin set no override.
    expect(images).toContain("https://cdn.test/i2.png");
  });

  it("links a card that has a target, and leaves one without a target unlinked", () => {
    render(<HomeSectionRenderer section={heroSection()} />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/categories/deals");
  });

  it("honours layout=none: banner only, no card row", () => {
    render(
      <HomeSectionRenderer
        section={heroSection({ config: { layout: "none" } } as any)}
      />,
    );
    expect(screen.queryByText("Up to 50% off")).not.toBeInTheDocument();
    expect(document.querySelector("img")).toHaveAttribute("src", "https://cdn.test/hero.png");
  });

  it("renders nothing when there is neither a banner nor an item", () => {
    const { container } = render(
      <HomeSectionRenderer
        section={heroSection({ hero_media: null, background_image: null, content: { items: [] } } as any)}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("HomeSectionRenderer — the unsupported-type fallback still holds", () => {
  it("skips a type the storefront does not implement", () => {
    const { container } = render(
      <HomeSectionRenderer
        section={{ id: 999, type: "sliders", title: "x", content: {} } as unknown as HomeLayoutSection}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
