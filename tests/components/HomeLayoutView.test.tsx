import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

/**
 * Covers the homepage's refresh contract:
 *  - switching the category tab MUST hit /home-layout with the NEW category
 *  - the hidden #home-sections-refetch button (clicked on location change)
 *    MUST also hit the API
 *
 * CategoryTabs navigates with `shallow: true`, so getServerSideProps never
 * re-runs — the client is solely responsible for refreshing the sections.
 */

const { getHomeLayout } = vi.hoisted(() => ({ getHomeLayout: vi.fn() }));

vi.mock("@/routes/api", () => ({ getHomeLayout }));

// Mutable router stand-in so we can simulate a shallow query change.
// `isReady`/`replace`/`push` back the empty state's reset actions.
const routerMock: {
  query: Record<string, string>;
  isReady: boolean;
  pathname: string;
  replace: ReturnType<typeof vi.fn>;
  push: ReturnType<typeof vi.fn>;
} = {
  query: {},
  isReady: true,
  pathname: "/",
  replace: vi.fn(),
  push: vi.fn(),
};
vi.mock("next/router", () => ({ useRouter: () => routerMock }));

vi.mock("@/components/Functional/InfiniteScroll", () => ({
  default: ({ children }: any) => <div>{children}</div>,
}));

// Partially mock: keep the module intact (the real i18n.ts needs
// initReactI18next) and stub only the hook, so `t()` yields the key.
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

vi.mock("@/components/Skeletons/ProductCardSkeleton", () => ({
  default: () => <div data-testid="skeleton" />,
}));

vi.mock("@/views/homePage/HomeSectionRenderer", () => ({
  default: ({ section }: any) => (
    <div data-testid="section">{String(section.id)}</div>
  ),
}));

import { SWRConfig } from "swr";
import HomeLayoutView from "@/views/homePage/HomeLayoutView";

/**
 * SWR's cache is module-global, so without an isolated provider one test's
 * cached response leaks into the next and silently overwrites initialData.
 */
const renderView = (initialLayout: any) => {
  const value = { provider: () => new Map() };
  const wrapper = ({ children }: any) => (
    <SWRConfig value={value}>{children}</SWRConfig>
  );
  const view = render(<HomeLayoutView initialLayout={initialLayout} />, {
    wrapper,
  });
  return {
    ...view,
    // re-render through the same wrapper so the cache persists within a test
    switchTo: (layout: any) =>
      view.rerender(<HomeLayoutView initialLayout={layout} />),
  };
};

const layoutResponse = (ids: number[] = []) => ({
  success: true,
  message: "ok",
  data: {
    scope_type: "global",
    scope_id: null,
    current_page: 1,
    last_page: 1,
    per_page: 5,
    total: ids.length,
    sections: ids.map((id) => ({ id, type: "products", content: {} })),
  },
});

const setUrl = (search: string) =>
  window.history.pushState({}, "", `/${search}`);

/** The last category_slug the API was called with. */
const lastCategory = () => {
  const calls = getHomeLayout.mock.calls;
  return calls[calls.length - 1]?.[0]?.category_slug;
};

beforeEach(() => {
  getHomeLayout.mockReset();
  getHomeLayout.mockResolvedValue(layoutResponse([]));
  routerMock.query = {};
  routerMock.isReady = true;
  routerMock.replace.mockReset();
  routerMock.push.mockReset();
  setUrl("");
  // Mirror production: SSR mode means no fetch on mount (SSR seeds the data).
  process.env.NEXT_PUBLIC_SSR = "true";
  document.cookie =
    "homeCategory=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
});

const initial = () => layoutResponse([41]).data;

describe("HomeLayoutView — category tab switching", () => {
  it("does NOT refetch on mount (SSR already supplied the sections)", async () => {
    const { getAllByTestId } = renderView(initial());

    expect(getAllByTestId("section")).toHaveLength(1);
    await new Promise((r) => setTimeout(r, 50));
    expect(getHomeLayout).not.toHaveBeenCalled();
  });

  it("calls the API with the new category on every tab switch", async () => {
    const { switchTo } = renderView(initial());
    expect(getHomeLayout).not.toHaveBeenCalled();

    // Tab -> Beauty (shallow nav: query + URL change, no new props)
    routerMock.query = { category: "beauty-1" };
    setUrl("?category=beauty-1");
    switchTo(initial());

    await waitFor(() => expect(getHomeLayout).toHaveBeenCalledTimes(1));
    expect(lastCategory()).toBe("beauty-1");

    // Tab -> Grocery: must call again with the NEW scope (the reported bug was
    // it staying pinned to the first category).
    routerMock.query = { category: "grocery-1" };
    setUrl("?category=grocery-1");
    switchTo(initial());

    await waitFor(() => expect(lastCategory()).toBe("grocery-1"));

    // Tab -> All: category_slug is dropped entirely
    routerMock.query = {};
    setUrl("");
    switchTo(initial());

    await waitFor(() => expect(lastCategory()).toBeUndefined());
  });

  it("does not refetch when re-rendering with the same category", async () => {
    routerMock.query = { category: "beauty-1" };
    setUrl("?category=beauty-1");

    const { switchTo } = renderView(initial());
    await new Promise((r) => setTimeout(r, 50));
    const callsAfterMount = getHomeLayout.mock.calls.length;

    switchTo(initial());
    await new Promise((r) => setTimeout(r, 50));

    expect(getHomeLayout.mock.calls.length).toBe(callsAfterMount);
  });

  it("shows skeletons while a category switch is in flight, then the sections", async () => {
    // Hold the request open so we can observe the loading state.
    let release: (v: any) => void = () => {};
    getHomeLayout.mockImplementation(
      () => new Promise((res) => (release = res)),
    );

    const { switchTo, queryAllByTestId, getAllByTestId } = renderView(initial());

    // Settled: previous category's section is on screen, no skeletons.
    expect(getAllByTestId("section")).toHaveLength(1);
    expect(queryAllByTestId("home-section-skeleton")).toHaveLength(0);

    // Switch tab -> in-flight: skeletons replace the stale section.
    routerMock.query = { category: "grocery-1" };
    setUrl("?category=grocery-1");
    switchTo(initial());

    await waitFor(() =>
      expect(queryAllByTestId("home-section-skeleton")).toHaveLength(1),
    );
    expect(queryAllByTestId("section")).toHaveLength(0);

    // Resolve -> skeletons swap out for the new sections.
    release(layoutResponse([99]));
    await waitFor(() =>
      expect(queryAllByTestId("home-section-skeleton")).toHaveLength(0),
    );
    expect(getAllByTestId("section")).toHaveLength(1);
  });

  it("renders a 3-column x 3-row grid of card skeletons", async () => {
    getHomeLayout.mockImplementation(() => new Promise(() => {}));

    const { switchTo, getAllByTestId, getByTestId } = renderView(initial());

    routerMock.query = { category: "grocery-1" };
    setUrl("?category=grocery-1");
    switchTo(initial());

    await waitFor(() => getByTestId("home-section-skeleton"));
    expect(getAllByTestId("skeleton")).toHaveLength(9);
  });

  it("shows an actionable empty state when a category has no sections", async () => {
    routerMock.query = { category: "beauty-1" };
    setUrl("?category=beauty-1");

    const { getByText, queryAllByTestId } = renderView(layoutResponse([]).data);

    // Nothing to render, so the user must get a message rather than a blank page.
    await waitFor(() => getByText("home.empty.title"));
    expect(queryAllByTestId("section")).toHaveLength(0);

    // ...and a way out: clearing the category scope back to "All".
    getByText("home.empty.view_all").click();
    expect(routerMock.replace).toHaveBeenCalledWith(
      { pathname: "/", query: {} },
      undefined,
      { shallow: true },
    );
  });

  it("does not show the empty state while sections are still loading", async () => {
    // Hold the request open: mid-flight is not the same as empty.
    getHomeLayout.mockImplementation(() => new Promise(() => {}));

    routerMock.query = { category: "grocery-1" };
    setUrl("?category=grocery-1");

    const { switchTo, queryByText, getByTestId } = renderView(initial());

    routerMock.query = { category: "kids-2" };
    setUrl("?category=kids-2");
    switchTo(initial());

    await waitFor(() => getByTestId("home-section-skeleton"));
    expect(queryByText("home.empty.title")).toBeNull();
  });

  it("does not show the empty state when the category has sections", async () => {
    const { queryByText, getAllByTestId } = renderView(initial());

    expect(getAllByTestId("section")).toHaveLength(1);
    expect(queryByText("home.empty.title")).toBeNull();
  });

  it("the hidden #home-sections-refetch button also hits the API (location change)", async () => {
    setUrl("?category=beauty-1");
    renderView(initial());

    // This is what helpers/events.ts does on a location change.
    document.getElementById("home-sections-refetch")?.click();

    await waitFor(() => expect(getHomeLayout).toHaveBeenCalled());
    expect(lastCategory()).toBe("beauty-1");
  });
});

// [CHANGE 2026-09-23] Admin Home Builder draft preview.
describe("HomeLayoutView — draft preview banner", () => {
  it("shows the preview banner when the API marks the layout as a preview", () => {
    const { getByTestId } = renderView({ ...initial(), preview: true });
    expect(getByTestId("home-preview-banner")).toHaveTextContent("home.previewBanner");
  });

  it("shows no banner on the normal homepage", () => {
    const { queryByTestId } = renderView(initial());
    expect(queryByTestId("home-preview-banner")).toBeNull();
  });
});
