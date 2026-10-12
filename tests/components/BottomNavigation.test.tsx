import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";

const { push, settings } = vi.hoisted(() => ({
  push: vi.fn(),
  settings: { isSingleVendor: false, isWatchAndBuyEnabled: false },
}));

vi.mock("next/router", () => ({
  useRouter: () => ({ push, pathname: "/" }),
}));
vi.mock("@/contexts/SettingsContext", () => ({
  useSettings: () => settings,
}));
vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, options?: { defaultValue?: string }) =>
        options?.defaultValue ?? key,
      i18n: { language: "en", resolvedLanguage: "en" },
    }),
  };
});
// The offline cart drawer is irrelevant to tab gating.
vi.mock("next/dynamic", () => ({ default: () => () => null }));

import BottomNavigation, {
  getBottomNavTabIds,
} from "@/components/Functional/BottomNavigation";

const renderNav = () => {
  const store = configureStore({
    reducer: {
      auth: (state = { isLoggedIn: false }) => state,
      cart: (state = { cartData: null }) => state,
      offlineCart: (state = { items: [] }) => state,
    },
  });
  return render(
    <Provider store={store}>
      <BottomNavigation />
    </Provider>,
  );
};

beforeEach(() => {
  push.mockReset();
  settings.isSingleVendor = false;
  settings.isWatchAndBuyEnabled = false;
});

describe("getBottomNavTabIds — Watch & Buy gating", () => {
  it("omits the Watch tab while watch_and_buy is disabled", () => {
    expect(
      getBottomNavTabIds({ isSingleVendor: false, isWatchAndBuyEnabled: false }),
    ).toEqual(["home", "categories", "cart", "offers", "profile"]);
  });

  it("adds the Watch tab (and keeps the cart tab) when enabled", () => {
    expect(
      getBottomNavTabIds({ isSingleVendor: false, isWatchAndBuyEnabled: true }),
    ).toEqual(["home", "categories", "watch", "cart", "offers", "profile"]);
  });

  it("[2026-09-28] shows Offers instead of Stores, on single-vendor sites too", () => {
    expect(
      getBottomNavTabIds({ isSingleVendor: true, isWatchAndBuyEnabled: true }),
    ).toEqual(["home", "categories", "watch", "cart", "offers", "profile"]);
  });
});

describe("BottomNavigation", () => {
  it("does not render the Watch tab when the feature is off", () => {
    renderNav();
    expect(screen.queryByTestId("bottom-nav-watch")).not.toBeInTheDocument();
    expect(screen.getByTestId("bottom-nav-cart")).toBeInTheDocument();
  });

  it("renders the Watch tab and routes it to /play/ when the feature is on", () => {
    settings.isWatchAndBuyEnabled = true;
    renderNav();

    const tab = screen.getByTestId("bottom-nav-watch");
    expect(tab).toHaveTextContent("Watch");
    fireEvent.click(tab);
    expect(push).toHaveBeenCalledWith("/play/");
  });

  it("[2026-09-28] the Offers tab opens /offers and no Stores tab is rendered", () => {
    renderNav();
    expect(screen.queryByTestId("bottom-nav-stores")).not.toBeInTheDocument();
    const tab = screen.getByTestId("bottom-nav-offers");
    expect(tab).toHaveTextContent("Offers");
    fireEvent.click(tab);
    expect(push).toHaveBeenCalledWith("/offers");
  });
});
