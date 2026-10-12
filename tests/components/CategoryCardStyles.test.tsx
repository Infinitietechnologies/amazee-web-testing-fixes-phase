import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("@/hooks/useScreenType", () => ({ useScreenType: () => "desktop" }));
vi.mock("@/lib/analytics", () => ({ trackCategoryView: vi.fn() }));

import CategoryCard from "@/components/Cards/CategoryCard";

const category = {
  id: 7,
  title: "Fresh Fruits",
  slug: "fresh-fruits",
  image: "https://example.test/fruits.png",
} as never;

/** [2026-09-23 final approval, item 4] each admin style draws differently. */
describe("CategoryCard variants", () => {
  it("default: the existing card — no style marker, contained image, title below", () => {
    const { container, getByText } = render(<CategoryCard category={category} />);
    expect(container.querySelector("[data-category-style]")).toBeNull();
    expect(getByText("Fresh Fruits")).toBeTruthy();
    expect(container.querySelector("img")?.className).toContain("object-contain");
  });

  it("card: a bordered card linking to the category", () => {
    const { container } = render(<CategoryCard category={category} variant="card" />);
    const link = container.querySelector('[data-category-style="card"]') as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(link.getAttribute("href")).toBe("/categories/fresh-fruits");
    expect(link.className).toContain("border");
  });

  it("full: the image fills the tile and the title sits below it", () => {
    const { container } = render(<CategoryCard category={category} variant="full" />);
    const tile = container.querySelector('[data-category-style="full"]') as HTMLElement;
    expect(tile.querySelector("img")?.className).toContain("object-cover");
    expect(tile.querySelector(".bg-gradient-to-t")).toBeNull();
    expect(tile.textContent).toContain("Fresh Fruits");
  });

  it("overlay: the image fills the tile and the title is drawn over it", () => {
    const { container } = render(<CategoryCard category={category} variant="overlay" />);
    const tile = container.querySelector('[data-category-style="overlay"]') as HTMLElement;
    const overlay = tile.querySelector(".bg-gradient-to-t") as HTMLElement;
    expect(tile.querySelector("img")?.className).toContain("object-cover");
    expect(overlay).not.toBeNull();
    expect(overlay.textContent).toBe("Fresh Fruits");
  });
});
