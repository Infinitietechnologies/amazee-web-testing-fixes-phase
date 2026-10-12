import { FC, useMemo } from "react";
import { useTranslation } from "react-i18next";
import useSWR from "swr";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Navigation } from "swiper/modules";
import { AppWindow } from "lucide-react";
import { getCategories, getSubCategories } from "@/routes/api";
import { getActiveCategory, isSSR } from "@/helpers/getters";
import { Category } from "@/types/ApiResponse";
import CategoryCard from "@/components/Cards/CategoryCard";
import CategoryCardSkeleton from "@/components/Skeletons/CategoryCardSkeleton";
import SectionHeading from "@/components/SectionHeading";
import Link from "next/link";
import { UserLocation } from "@/components/Location/types/LocationAutoComplete.types";
import { getCookie } from "@/lib/cookies";
import { isRTL } from "@/helpers/functionalHelpers";
import { useRailReport } from "@/hooks/useRailReport";
import { useSettings } from "@/contexts/SettingsContext";
import {
  categoryRailBreakpoints,
  normalizeCategoryStyle,
} from "@/helpers/categoryStyle";

interface HomeCategoriesProps {
  initialCategories?: Category[];
}

// SWR fetcher
const fetcher = async () => {
  const validSlug = getActiveCategory();

  const location = getCookie("userLocation") as UserLocation | undefined;
  const { lat = "", lng = "" } = location || {};

  if (!lat || !lng) {
    return [];
  }

  const response = validSlug
    ? await getCategories({
        slug: validSlug,
        latitude: lat,
        longitude: lng,
      })
    : await getSubCategories({
        slug: validSlug,
        latitude: lat,
        longitude: lng,
        filter: "top_category",
      });

  if (!response.success || !response.data) {
    console.error(response.message || "Failed to fetch categories");
  }

  return response.data?.data ?? [];
};

const HomeCategories: FC<HomeCategoriesProps> = ({
  initialCategories = [],
}) => {
  const { t, i18n } = useTranslation();

  const currentLang = i18n.resolvedLanguage || i18n.language;
  const rtl = isRTL(currentLang);
  // [2026-09-23 final approval, item 4] Admin-chosen style for the classic
  // homepage (Settings → System → Category section style).
  const { systemSettings } = useSettings();
  const style = normalizeCategoryStyle(systemSettings?.homeCategoryStyle);

  const {
    data: categories = [],
    isLoading,
    isValidating,
    mutate,
  } = useSWR("/categories", fetcher, {
    fallbackData: isSSR() ? initialCategories : undefined,
    revalidateOnFocus: false,
    revalidateOnMount: !isSSR(),
  });

  const slides = useMemo(
    () =>
      categories.map((category) => (
        <SwiperSlide key={category.id}>
          <div className="flex flex-col items-center">
            <CategoryCard category={category} variant={style} />
          </div>
        </SwiperSlide>
      )),
    [categories, style],
  );

  const skeletonSlides = useMemo(() => {
    return Array.from({ length: 12 }).map((_, index) => (
      <SwiperSlide key={`skeleton-${index}`}>
        <CategoryCardSkeleton />
      </SwiperSlide>
    ));
  }, []);
  const shouldHide = categories?.length === 0 && !isLoading && !isValidating;
  const validSlug = getActiveCategory();

  useRailReport("categories", categories?.length === 0, isLoading || isValidating);

  return (
    <section id="home-categories" data-category-section-style={style}>
      <button
        onClick={() => mutate()}
        className="hidden"
        id="home-categories-refetch"
      />
      {!shouldHide && (
        <div className="w-full mb-4">
          <div className="flex justify-between w-full items-center mb-4">
            <SectionHeading
              title={t("home.categories.title")}
              description={t("home.categories.description")}
              icon={<AppWindow size={16} className="text-white" />}
            />
            <Link
              href={validSlug ? `/categories?slug=${validSlug}` : "/categories"}
              className="text-xs sm:text-sm"
              title={t("see_all")}
            >
              {t("see_all")}
            </Link>
          </div>
          <Swiper
            key={rtl ? `rtl-hc-${style}` : `ltr-hc-${style}`}
            dir={rtl ? "rtl" : "ltr"}
            slidesPerView={style === "default" ? 3 : 2.4}
            spaceBetween={style === "default" ? 1 : 10}
            breakpoints={categoryRailBreakpoints(style)}
            lazyPreloadPrevNext={0}
            modules={[Navigation, Autoplay]}
            loop={false}
            autoplay={{
              delay: 3200,
              disableOnInteraction: false,
              pauseOnMouseEnter: true,
            }}
          >
            {isLoading ? skeletonSlides : slides}
          </Swiper>
        </div>
      )}
    </section>
  );
};

export default HomeCategories;
