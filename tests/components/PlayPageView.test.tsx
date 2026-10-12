import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const { settings } = vi.hoisted(() => ({
  settings: {
    isWatchAndBuyEnabled: false,
    watchAndBuySettings: null as null | { enabled?: boolean; title?: string },
  },
}));

vi.mock("@/contexts/SettingsContext", () => ({ useSettings: () => settings }));
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
// The feeds themselves are covered by the adapter/API tests.
vi.mock("@/components/WatchAndBuy", () => ({
  WatchAndBuyStoriesSection: () => <div data-testid="stories-feed" />,
  WatchAndBuyReelsSection: () => <div data-testid="reels-feed" />,
}));
vi.mock("@/components/custom/MyBreadcrumbs", () => ({ default: () => null }));
vi.mock("@/components/custom/PageHeader", () => ({
  default: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

import PlayPageView from "@/views/PlayPageView";

beforeEach(() => {
  settings.isWatchAndBuyEnabled = false;
  settings.watchAndBuySettings = null;
});

describe("PlayPageView gating", () => {
  it("explains that Watch & Buy is off instead of rendering empty feeds", () => {
    render(<PlayPageView />);

    expect(screen.getByTestId("play-unavailable")).toBeInTheDocument();
    expect(screen.queryByTestId("reels-feed")).not.toBeInTheDocument();
  });

  it("renders both feeds under the configured title when enabled", () => {
    settings.isWatchAndBuyEnabled = true;
    settings.watchAndBuySettings = { enabled: true, title: "Shop Reels" };
    render(<PlayPageView />);

    expect(screen.getByRole("heading", { name: "Shop Reels" })).toBeInTheDocument();
    expect(screen.getByTestId("stories-feed")).toBeInTheDocument();
    expect(screen.getByTestId("reels-feed")).toBeInTheDocument();
  });
});
