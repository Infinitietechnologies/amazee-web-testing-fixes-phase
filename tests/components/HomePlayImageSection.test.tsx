import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Same leaf mocks as HomeSectionRenderer.test.tsx: this covers the renderer's
// play_image / custom_image decisions, not Swiper or the cards.
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

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={typeof href === "string" ? href : href.pathname} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("swiper/react", () => ({
  Swiper: ({ children }: any) => <div data-testid="swiper">{children}</div>,
  SwiperSlide: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("swiper/modules", () => ({ Navigation: {}, Autoplay: {}, Pagination: {} }));
vi.mock("@/components/SwiperNavigation", () => ({ default: () => null }));
vi.mock("@/components/SectionHeading", () => ({
  default: ({ title }: any) => <h2>{title}</h2>,
}));
vi.mock("@/components/Cards/ProductCard", () => ({ default: () => null }));
vi.mock("@/components/Skeletons/ProductCardSkeleton", () => ({ default: () => null }));
vi.mock("@/components/Cards/CategoryCard", () => ({
  default: ({ category }: any) => <div data-testid="category-card">{category.title}</div>,
}));
vi.mock("@/components/Skeletons/CategoryCardSkeleton", () => ({ default: () => null }));
vi.mock("@/components/Cards/BrandCard", () => ({
  default: ({ brand }: any) => <div data-testid="brand-card">{brand.title}</div>,
}));
vi.mock("@/components/Skeletons/BrandCardSkeleton", () => ({ default: () => null }));

import HomeSectionRenderer from "@/views/homePage/HomeSectionRenderer";
import type { HomeLayoutSection } from "@/types/ApiResponse";

const section = (overrides: Partial<HomeLayoutSection>): HomeLayoutSection => ({
  id: 80,
  type: "play_image",
  title: null,
  style: null,
  config: {},
  background_image: null,
  hero_media: null,
  card_background_image: null,
  content: {},
  ...overrides,
});

const playImage = section({
  title: "Summer picks",
  content: {
    rows: [
      {
        row_index: 0,
        style: "grid",
        config: { style: "grid" },
        items: [
          {
            id: 1,
            image: "https://cdn.test/a.jpg",
            image_web_mobile: "https://cdn.test/a-m.jpg",
            link_type: "product",
            slug: "mango",
            target_id: 9,
            link_url: null,
            config: { cols: 8, alt: "Mangoes" },
          },
          {
            id: 2,
            image: "https://cdn.test/b.jpg",
            link_type: "none",
            slug: null,
            target_id: null,
            link_url: null,
            config: { cols: 4 },
          },
        ],
      },
      {
        row_index: 1,
        style: "scroll",
        config: { style: "scroll" },
        items: [
          { id: 3, image: "https://cdn.test/c.jpg", link_type: "custom", link_url: "https://shop.test/x", config: {} },
        ],
      },
    ] as unknown[],
  },
});

describe("HomeSectionRenderer — play_image", () => {
  it("renders every row with its style, next to the other section types", () => {
    render(<HomeSectionRenderer section={playImage} />);

    expect(screen.getByTestId("home-section-80")).toBeInTheDocument();
    expect(screen.getByText("Summer picks")).toBeInTheDocument();
    expect(screen.getByTestId("home-play-image-row-80-0")).toHaveAttribute("data-row-style", "grid");
    expect(screen.getByTestId("home-play-image-row-80-1")).toHaveAttribute("data-row-style", "scroll");
  });

  it("links an item with a destination and leaves link_type=none unlinked", () => {
    render(<HomeSectionRenderer section={playImage} />);

    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["/products/mango", "https://shop.test/x"]);
  });

  it("serves image_web_mobile below the md breakpoint via <picture>", () => {
    render(<HomeSectionRenderer section={playImage} />);

    const source = document.querySelector("[data-play-image-mobile-source]");
    expect(source).toHaveAttribute("srcset", "https://cdn.test/a-m.jpg");
    expect(source).toHaveAttribute("media", "(max-width: 767px)");
    expect(screen.getByAltText("Mangoes")).toHaveAttribute("src", "https://cdn.test/a.jpg");
  });

  it("passes the per-item column span to the grid", () => {
    render(<HomeSectionRenderer section={playImage} />);

    const cells = document.querySelectorAll<HTMLElement>(".home-play-image-grid-item");
    expect(cells[0].style.getPropertyValue("--play-image-span-desktop")).toBe("8");
    expect(cells[1].style.getPropertyValue("--play-image-span-desktop")).toBe("4");
  });

  it("renders nothing when no row has an image", () => {
    const { container } = render(
      <HomeSectionRenderer section={section({ content: { rows: [{ row_index: 0, items: [] }] as unknown[] } })} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("HomeSectionRenderer — custom_image rails", () => {
  it("categories: renders the admin artwork as linked tiles instead of CategoryCards", () => {
    render(
      <HomeSectionRenderer
        section={section({
          id: 81,
          type: "categories",
          style: "custom_image",
          content: {
            categories: [
              { id: 1, slug: "fruits", title: "Fruits", image: "https://cdn.test/fruits.jpg", custom_image_url: "https://cdn.test/fruits-art.jpg" },
              { id: 2, slug: "herbs", title: "Herbs", image: "https://cdn.test/herbs.jpg", parent_slug: "veg" },
            ],
          },
        })}
      />,
    );

    expect(screen.queryByTestId("category-card")).not.toBeInTheDocument();
    expect(screen.getByTestId("home-section-81")).toHaveAttribute("data-category-section-style", "custom_image");
    expect(screen.getByAltText("Fruits")).toHaveAttribute("src", "https://cdn.test/fruits-art.jpg");
    const hrefs = screen.getAllByTestId("home-custom-image-tile").map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["/categories/fruits", "/categories/veg?subcategory=herbs"]);
  });

  it("categories: rows_layout=grid lays the tiles out in the configured columns", () => {
    render(
      <HomeSectionRenderer
        section={section({
          id: 82,
          type: "categories",
          style: "custom_image",
          config: { rows_layout: "grid", grid_columns: 3 },
          content: { categories: [{ id: 1, slug: "fruits", title: "Fruits", image: "https://cdn.test/f.jpg" }] },
        })}
      />,
    );

    expect(screen.getByTestId("home-custom-image-grid").className).toContain("lg:grid-cols-3");
  });

  it("brands: renders the artwork tiles linked to the brand page", () => {
    render(
      <HomeSectionRenderer
        section={section({
          id: 83,
          type: "brands",
          style: "custom_image",
          content: { brands: [{ id: 5, slug: "amul", title: "Amul", logo: "https://cdn.test/amul-art.jpg" }] },
        })}
      />,
    );

    expect(screen.queryByTestId("brand-card")).not.toBeInTheDocument();
    expect(screen.getByTestId("home-custom-image-tile")).toHaveAttribute("href", "/brands/amul");
    expect(screen.getByAltText("Amul")).toHaveAttribute("src", "https://cdn.test/amul-art.jpg");
  });

  it("other category styles still render CategoryCards", () => {
    render(
      <HomeSectionRenderer
        section={section({
          id: 84,
          type: "categories",
          style: "card",
          content: { categories: [{ id: 1, slug: "fruits", title: "Fruits", image: "x" }] },
        })}
      />,
    );
    expect(screen.getByTestId("category-card")).toBeInTheDocument();
  });
});

describe("HomeSectionRenderer — web-mobile media on hero and banners", () => {
  it("hero: hero_media_web_mobile is the mobile <source>", () => {
    render(
      <HomeSectionRenderer
        section={section({
          id: 85,
          type: "hero",
          hero_media: "https://cdn.test/hero.jpg",
          hero_media_web_mobile: "https://cdn.test/hero-m.jpg",
          config: { layout: "none" },
        })}
      />,
    );

    expect(document.querySelector("[data-home-hero-mobile-source]")).toHaveAttribute(
      "srcset",
      "https://cdn.test/hero-m.jpg",
    );
    expect(document.querySelector("img")).toHaveAttribute("src", "https://cdn.test/hero.jpg");
  });

  it("hero: a mobile-only hero still renders", () => {
    render(
      <HomeSectionRenderer
        section={section({ id: 86, type: "hero", hero_media_web_mobile: "https://cdn.test/m.jpg", config: { layout: "none" } })}
      />,
    );
    expect(document.querySelector("img")).toHaveAttribute("src", "https://cdn.test/m.jpg");
  });

  it("banners: image_web_mobile is the mobile <source>", () => {
    render(
      <HomeSectionRenderer
        section={section({
          id: 87,
          type: "banners",
          content: { items: [{ id: 1, image: "https://cdn.test/d.jpg", image_web_mobile: "https://cdn.test/m.jpg" }] },
        })}
      />,
    );
    expect(document.querySelector("[data-home-banner-mobile-source]")).toHaveAttribute(
      "srcset",
      "https://cdn.test/m.jpg",
    );
  });
});
