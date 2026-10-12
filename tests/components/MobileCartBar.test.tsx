import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";

const { push, router } = vi.hoisted(() => ({
  push: vi.fn(),
  router: { pathname: "/" },
}));

vi.mock("next/router", () => ({
  useRouter: () => ({ push, pathname: router.pathname }),
}));
vi.mock("@/contexts/SettingsContext", () => ({
  useSettings: () => ({ currencySymbol: "₹" }),
}));
vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, options?: { defaultValue?: string; count?: number }) =>
        (options?.defaultValue ?? key).replace("{{count}}", String(options?.count ?? "")),
      i18n: { language: "en", resolvedLanguage: "en" },
    }),
  };
});

import MobileCartBar, { shouldShowCartBar } from "@/components/Functional/MobileCartBar";

const renderBar = (isLoggedIn: boolean, itemsCount: number, itemsTotal = 0) => {
  const store = configureStore({
    reducer: {
      auth: (state = { isLoggedIn }) => state,
      cart: (state = { cartData: itemsCount ? { items_count: itemsCount, payment_summary: { items_total: itemsTotal } } : null }) => state,
    },
  });
  return render(
    <Provider store={store}>
      <MobileCartBar bottomOffset={72} />
    </Provider>,
  );
};

beforeEach(() => {
  push.mockReset();
  router.pathname = "/";
});

describe("shouldShowCartBar", () => {
  it("shows on browsing pages when a signed-in cart has items", () => {
    expect(shouldShowCartBar("/", 2, true)).toBe(true);
    expect(shouldShowCartBar("/categories/[slug]", 1, true)).toBe(true);
    expect(shouldShowCartBar("/products/search", 1, true)).toBe(true);
  });
  it("hides for guests, empty carts, and on cart, account, product and Watch & Buy pages", () => {
    expect(shouldShowCartBar("/", 2, false)).toBe(false);
    expect(shouldShowCartBar("/", 0, true)).toBe(false);
    expect(shouldShowCartBar("/", undefined, true)).toBe(false);
    for (const p of ["/cart", "/my-account", "/products/[slug]", "/play"]) {
      expect(shouldShowCartBar(p, 3, true)).toBe(false);
    }
  });
});

describe("MobileCartBar", () => {
  it("shows the item count and items total and opens the cart", () => {
    renderBar(true, 3, 249.5);
    const bar = screen.getByTestId("mobile-cart-bar");
    expect(bar).toHaveTextContent("3 items");
    expect(bar).toHaveTextContent("₹249.50");
    expect(bar).toHaveTextContent("View cart");
    fireEvent.click(bar);
    expect(push).toHaveBeenCalledWith("/cart");
  });

  it("uses the singular for one item and sits at the given offset", () => {
    renderBar(true, 1, 40);
    const bar = screen.getByTestId("mobile-cart-bar");
    expect(bar).toHaveTextContent("1 item");
    expect((bar.parentElement as HTMLElement).style.bottom).toBe("72px");
  });

  it("renders nothing on the cart page or for an empty cart", () => {
    router.pathname = "/cart";
    renderBar(true, 2, 10);
    expect(screen.queryByTestId("mobile-cart-bar")).not.toBeInTheDocument();
    router.pathname = "/";
    const { container } = renderBar(true, 0);
    expect(container.querySelector("[data-testid='mobile-cart-bar']")).toBeNull();
  });
});
