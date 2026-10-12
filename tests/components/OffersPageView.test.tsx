import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const { getOffersSection } = vi.hoisted(() => ({ getOffersSection: vi.fn() }));

vi.mock("@/routes/api", () => ({ getOffersSection }));
// functionalHelpers boots the real i18n instance; only isRTL is needed here.
vi.mock("@/helpers/functionalHelpers", () => ({ isRTL: () => false }));
vi.mock("@/lib/cookies", () => ({ getCookie: () => ({ lat: 12.9, lng: 77.6 }) }));
vi.mock("@/components/Cards/ProductCard", () => ({ default: ({ product }: { product: { title: string } }) => <div data-testid="pc">{product.title}</div> }));
vi.mock("@/components/Skeletons/ProductCardSkeleton", () => ({ default: () => <div /> }));
vi.mock("swiper/react", () => ({ Swiper: ({ children }: { children: React.ReactNode }) => <div>{children}</div>, SwiperSlide: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("swiper/modules", () => ({ Navigation: {} }));
vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return { ...actual, useTranslation: () => ({ t: (k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? k, i18n: { language: "en", resolvedLanguage: "en" } }) };
});

import { SWRConfig } from "swr";
import OffersPageView from "@/views/OffersPageView";

// A fresh SWR cache per render so the two tests do not share the section key.
const renderView = () => render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}><OffersPageView /></SWRConfig>);

const data = {
  title: "Today's deals",
  subtitle: "Fresh savings",
  categories: [
    { key: "dairy", name: "Dairy", icon: null, type: "bogo", count: 1 },
    { key: "discount-veg", name: "Vegetables", icon: null, type: "discount", count: 2 },
  ],
  bogo_groups: [{ category: { id: 1, name: "Dairy", slug: "dairy", icon: null, image: null, description: null }, offers: [{ offer: { id: 5, name: "Milk B1G1", label: "Buy 1 Get 1" }, products: [{ id: 1, title: "Milk" }] }] }],
  discount_groups: [{ category: { id: 2, name: "Vegetables", slug: "discount-veg", icon: null, image: null, description: null }, products: [{ id: 2, title: "Tomato" }, { id: 3, title: "Onion" }] }],
};

beforeEach(() => getOffersSection.mockReset());

describe("OffersPageView", () => {
  it("renders the configured title, chips, BOGO and discount groups, and filters by chip", async () => {
    getOffersSection.mockResolvedValue({ success: true, data });
    renderView();
    await waitFor(() => expect(screen.getByText("Today's deals")).toBeInTheDocument());
    expect(screen.getAllByTestId("offers-bogo-group")).toHaveLength(1);
    expect(screen.getAllByTestId("offers-discount-group")).toHaveLength(1);
    expect(screen.getByText("Buy 1 Get 1")).toBeInTheDocument();
    expect(screen.getAllByTestId("pc").map((e) => e.textContent)).toEqual(["Milk", "Tomato", "Onion"]);

    fireEvent.click(screen.getByRole("tab", { name: /Vegetables/ }));
    expect(screen.queryAllByTestId("offers-bogo-group")).toHaveLength(0);
    expect(screen.getAllByTestId("offers-discount-group")).toHaveLength(1);
  });

  it("shows the empty state when nothing is on offer", async () => {
    getOffersSection.mockResolvedValue({ success: true, data: { ...data, categories: [], bogo_groups: [], discount_groups: [] } });
    renderView();
    await waitFor(() => expect(screen.getByTestId("offers-empty")).toBeInTheDocument());
  });
});
