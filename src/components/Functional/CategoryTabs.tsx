import React, { useCallback, useEffect, useState, useRef } from "react";
import { useInfiniteData } from "@/hooks/useInfiniteData";
import { getCategories } from "@/routes/api";
import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperType } from "swiper";
import TabButton from "../custom/TabButton";
import SkeletonTabButton from "../custom/SkeletonTabButton";
import { setCookie } from "@/lib/cookies";
import { onHomeCategoryChange } from "@/helpers/events";
import { useSettings } from "@/contexts/SettingsContext";
import { useRouter } from "next/router";
import { Mousewheel } from "swiper/modules";
import { useTranslation } from "react-i18next";
import { isRTL } from "@/helpers/functionalHelpers";

interface Category {
  id: number;
  title: string;
  slug: string;
  image: string;
  icon: string;
  active_icon: string;
  description: string | null;
  status: string;
}

interface CategoryTabsProps {
  defaultCategory?: string;
  className?: string;
}

const PER_PAGE = 15;

const CategoryTabs: React.FC<CategoryTabsProps> = ({
  defaultCategory = "all",
  className = "",
}) => {
  const [showLeftShadow, setShowLeftShadow] = useState(false);
  const [showRightShadow, setShowRightShadow] = useState(false);
  const swiperRef = useRef<SwiperType | null>(null);

  const { homeGeneralSettings } = useSettings();
  const router = useRouter();
  const { i18n } = useTranslation();
  const currentLang = i18n.resolvedLanguage || i18n.language;
  const rtl = isRTL(currentLang);

  // The URL is authoritative, so the selection is derived rather than stored:
  // navigating to a bare "/" (e.g. clicking the header logo from
  // "/?category=beauty") must fall back to `defaultCategory`, not to whatever
  // the cookie still remembers. The cookie is only a hint for the first SSR
  // hit, when there is no query yet.
  const queryCategory = (router.query.category as string) || "";
  const selectedCategory = queryCategory || defaultCategory;

  // Mirror the derived selection out to the external systems that can't read
  // it: the cookie SSR/scoped fetches use, and the refetch event.
  const syncedCategory = useRef<string | null>(null);

  useEffect(() => {
    if (!router.isReady) return;
    if (syncedCategory.current === selectedCategory) return;

    const isFirstSync = syncedCategory.current === null;
    syncedCategory.current = selectedCategory;

    setCookie("homeCategory", selectedCategory);

    // On the first pass the server already rendered this category, so firing
    // the event would trigger a redundant refetch of data we just received.
    if (!isFirstSync) {
      onHomeCategoryChange();
    }
  }, [router.isReady, selectedCategory]);

  const {
    data: categories,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    error,
    refetch,
  } = useInfiniteData<Category>({
    fetcher: getCategories,
    perPage: PER_PAGE,
    dataKey: "categories-tab",
    forceFetchOnMount: true,
    passLocation: true,
    extraParams: {home: true},
  });

  const updateShadows = (swiper: SwiperType) => {
    // Check if slides actually overflow container
    const hasOverflow =
      swiper.width <
      swiper.slides.reduce((sum, slide) => sum + slide.offsetWidth, 0);

    if (!hasOverflow) {
      // No overflow → no shadows at all
      setShowLeftShadow(false);
      setShowRightShadow(false);
      return;
    }

    setShowLeftShadow(!swiper.isBeginning);
    setShowRightShadow(!swiper.isEnd);
  };

  // Only drives the URL — the sync effect above picks the change up and owns
  // the cookie and the refetch event, so tab clicks and logo navigations take
  // the exact same path.
  const handleCategorySelect = useCallback(
    async (categorySlug: string) => {
      const isAll = !categorySlug || categorySlug === "all";

      await router.replace(
        {
          pathname: router.pathname,
          query: isAll ? {} : { category: categorySlug },
        },
        undefined,
        { shallow: true }
      );
    },
    [router]
  );

  // A category slug in the URL that this location doesn't serve (stale link,
  // changed catalog) falls back to "all". Clearing the query is enough — the
  // sync effect above reacts to it and handles the cookie and refetch.
  useEffect(() => {
    if (!router.isReady || isLoading || selectedCategory === "all") return;

    const exists = categories?.some((c) => c.slug === selectedCategory);
    if (!exists) {
      handleCategorySelect("all");
    }
  }, [
    categories,
    isLoading,
    router.isReady,
    selectedCategory,
    handleCategorySelect,
  ]);

  const handleSeeMore = () => {
    if (hasMore && !isLoadingMore) {
      loadMore();
    }
  };

  if (error) {
    console.error(error);
  }

  // router.query is empty until the router is ready, so wait before rendering
  // tabs — otherwise the correct tab can't be highlighted yet.
  if (!router.isReady) {
    return (
      <div className={`w-full relative ${className}`}>
        <Swiper
          key={rtl ? "rtl-ct" : "ltr-ct"}
          dir={rtl ? "rtl" : "ltr"}
          spaceBetween={8}
          grabCursor={true}
          slidesPerView="auto"
          slidesOffsetAfter={8}
          modules={[Mousewheel]}
          mousewheel
        >
          <SwiperSlide style={{ width: "auto" }}>
            <SkeletonTabButton />
          </SwiperSlide>
          {Array.from({ length: 5 }).map((_, i) => (
            <SwiperSlide key={i} style={{ width: "auto" }}>
              <SkeletonTabButton />
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    );
  }

  return (
    <div className={`w-full relative ${className}`}>
      <button
        className="hidden"
        id="home-category-tabs"
        onClick={() => refetch()}
      />
      <div className="flex gap-0.5">
        <TabButton
          slug="all"
          title={homeGeneralSettings?.title || "All"}
          isSelected={selectedCategory === "all"}
          category={{
            active_icon: homeGeneralSettings?.activeIcon || "",
            description: "",
            icon: homeGeneralSettings?.icon || "",
            id: 0,
            image: "",
            slug: "",
            status: "",
            title: homeGeneralSettings?.title || "all",
          }}
          onClick={() => {
            handleCategorySelect("all");
          }}
        />

        <div className={`w-full relative overflow-x-hidden ${className}`}>
          {/* Left Shadow */}
          <div
            className={`absolute left-0 top-0 bottom-0 w-6
            bg-linear-to-r
            from-gray-400/20 via-gray-400/10 to-transparent
            dark:from-gray-500/30 dark:via-gray-400/20
            z-10 pointer-events-none
            transition-opacity duration-300 ease-in-out
            ${showLeftShadow ? "opacity-100" : "opacity-0"}`}
          />

          {/* Right Shadow */}
          <div
            className={`absolute right-0 top-0 bottom-0 w-6
              bg-linear-to-l
            from-gray-400/20 via-gray-400/10 to-transparent
            dark:from-gray-500/30 dark:via-gray-400/20
              z-10 pointer-events-none
              transition-opacity duration-300 ease-in-out
              ${showRightShadow ? "opacity-100" : "opacity-0"}`}
          />

          <Swiper
            grabCursor
            slidesPerView="auto"
            slidesOffsetAfter={8}
            modules={[Mousewheel]}
            mousewheel
            spaceBetween={8} // default (desktop)
            breakpoints={{
              0: {
                spaceBetween: 2, // mobile
              },
              640: {
                spaceBetween: 8, // tablet & above
              },
            }}
            onSwiper={(swiper) => {
              swiperRef.current = swiper;
              updateShadows(swiper);
            }}
            onSlideChange={updateShadows}
            onResize={updateShadows}
            onProgress={updateShadows}
          >
            {/* Category tabs */}
            {isLoading
              ? Array.from({ length: PER_PAGE }).map((_, i) => (
                  <SwiperSlide key={i} style={{ width: "auto" }}>
                    <SkeletonTabButton />
                  </SwiperSlide>
                ))
              : categories.map((category) => (
                  <SwiperSlide key={category.slug} style={{ width: "auto" }}>
                    <TabButton
                      slug={category.slug}
                      title={category.title}
                      category={category}
                      isSelected={selectedCategory === category.slug}
                      onClick={() => {
                        handleCategorySelect(category.slug);
                      }}
                    />
                  </SwiperSlide>
                ))}

            {/* See More */}
            {hasMore && (
              <SwiperSlide style={{ width: "auto" }}>
                <TabButton
                  slug="see-more"
                  title={isLoadingMore ? "Loading..." : "See More"}
                  isSelected={false}
                  isLoading={isLoadingMore}
                  onClick={handleSeeMore}
                />
              </SwiperSlide>
            )}
          </Swiper>
        </div>
      </div>
    </div>
  );
};

export default CategoryTabs;
