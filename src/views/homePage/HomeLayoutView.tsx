import { FC, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";

import { useInfiniteData } from "@/hooks/useInfiniteData";
import { getHomeLayout } from "@/routes/api";
import { HomeLayoutData, HomeLayoutSection } from "@/types/ApiResponse";
import {
  readHomePreviewToken,
  buildHomeLayoutParams,
  toSectionListPage,
} from "@/helpers/homeLayout";
import { Skeleton } from "@heroui/react";
import InfiniteScroll from "@/components/Functional/InfiniteScroll";
import ProductCardSkeleton from "@/components/Skeletons/ProductCardSkeleton";
import HomeSectionRenderer from "./HomeSectionRenderer";
import HomeCategoryEmpty from "@/components/Empty/HomeCategoryEmpty";

/** Sections (not products) per page — the layout list is itself paginated. */
export const SECTIONS_PER_PAGE = 5;

interface HomeLayoutViewProps {
  initialLayout?: HomeLayoutData | null;
}

/** Cards per skeleton rail: 3 columns x SKELETON_ROWS rows. */
const SKELETON_COLUMNS = 3;
const SKELETON_ROWS = 3;

/**
 * Placeholder rail shown while sections load (initial load, category switch,
 * and paging). Capped at 3 columns for now.
 */
const SectionSkeleton: FC = () => (
  <div className="mb-8" data-testid="home-section-skeleton">
    {/* section heading placeholder */}
    <div className="flex justify-between w-full items-center mb-6">
      <Skeleton className="w-40 h-6 rounded-md" />
      <Skeleton className="w-16 h-4 rounded-md" />
    </div>

    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {Array.from({ length: SKELETON_COLUMNS * SKELETON_ROWS }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  </div>
);

/**
 * The /home-layout homepage: renders backend-driven sections and lazily loads
 * further pages of sections as the user scrolls.
 *
 * Category and location are read inside the fetcher (not the SWR key), so a
 * change to either refreshes via the hidden #home-sections-refetch button that
 * helpers/events.ts clicks on "/" — mirroring the legacy rails. Location is
 * optional: the API falls back to a global-scope layout.
 */
const HomeLayoutView: FC<HomeLayoutViewProps> = ({ initialLayout }) => {
  const {
    data: sections,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    refetch,
  } = useInfiniteData<HomeLayoutSection>({
    fetcher: async (params) => {
      // Category/location are resolved PER FETCH (see buildHomeLayoutParams) —
      // memoising them pins the homepage to its mount-time category.
      const res = await getHomeLayout(buildHomeLayoutParams(params));

      // /home-layout puts its array at data.sections, not data.data.
      return toSectionListPage(res);
    },
    perPage: SECTIONS_PER_PAGE,
    initialData: initialLayout?.sections ?? [],
    initialTotal: initialLayout?.total ?? 0,
    dataKey: "home-layout",
  });

  // Refetch on every category-tab switch.
  //
  // CategoryTabs navigates with `shallow: true`, so getServerSideProps never
  // re-runs and no fresh sections arrive as props. Its only refresh signal is
  // onHomeCategoryChange() clicking #home-sections-refetch below — too fragile
  // to depend on alone. Watching the query param guarantees the API is called
  // with the new scope every time the tab changes. (Concurrent revalidations of
  // the same SWR key are deduped, so this won't double-fetch.)
  const router = useRouter();
  const { t } = useTranslation();
  const isPreview =
    Boolean(initialLayout?.preview) ||
    Boolean(readHomePreviewToken(router.query.home_preview as string | undefined));
  const activeCategory = (router.query.category as string) || "all";
  const lastCategory = useRef(activeCategory);

  useEffect(() => {
    if (lastCategory.current === activeCategory) return;
    lastCategory.current = activeCategory;
    refetch();
  }, [activeCategory, refetch]);

  // Show skeletons whenever we're loading — NOT only when the list is empty.
  // On a category switch the previous category's sections are still in state,
  // so an `isLoading && !sections.length` check would leave stale content on
  // screen with no loading feedback at all.
  const showSkeleton = isLoading;

  // A category the backend has no sections for would otherwise render nothing
  // at all, leaving the user on a blank page with no way back to "All".
  const isEmpty = !showSkeleton && sections.length === 0;

  return (
    <section id="home-layout" className="w-full">
      {isPreview && (
        <div
          role="status"
          data-testid="home-preview-banner"
          className="sticky top-0 z-30 mb-3 rounded-md bg-amber-100 px-3 py-2 text-center text-xs font-medium text-amber-900 sm:text-sm"
        >
          {t("home.previewBanner")}
        </div>
      )}
      {/* Location/category changes trigger a refresh by clicking this. */}
      <button
        id="home-sections-refetch"
        className="hidden"
        onClick={() => refetch()}
      />

      <InfiniteScroll
        hasMore={hasMore}
        isLoading={isLoadingMore}
        onLoadMore={loadMore}
      >
        {showSkeleton ? (
          <SectionSkeleton />
        ) : isEmpty ? (
          <HomeCategoryEmpty />
        ) : (
          sections.map((section) => (
            <HomeSectionRenderer key={section.id} section={section} />
          ))
        )}

        {isLoadingMore && <SectionSkeleton />}
      </InfiniteScroll>
    </section>
  );
};

export default HomeLayoutView;
