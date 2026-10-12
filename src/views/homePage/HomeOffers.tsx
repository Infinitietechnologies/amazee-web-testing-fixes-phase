import { FC, useMemo } from "react";
import { useTranslation } from "react-i18next";
import useSWR from "swr";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Navigation } from "swiper/modules";
import { Gift } from "lucide-react";

import SectionHeading from "@/components/SectionHeading";
import ProductCard from "@/components/Cards/ProductCard";
import ProductCardSkeleton from "@/components/Skeletons/ProductCardSkeleton";
import { getOffers } from "@/routes/api";
import { OfferGroup } from "@/types/ApiResponse";
import { getCookie } from "@/lib/cookies";
import { UserLocation } from "@/components/Location/types/LocationAutoComplete.types";
import { isRTL } from "@/helpers/functionalHelpers";
import { useRailReport } from "@/hooks/useRailReport";

/**
 * The home Offers rail — one product carousel per live BOGO offer.
 *
 * Replaces the Stores rail on the homepage (Decision 1). HomeStores.tsx and
 * the /stores page are left in place: the store directory is still reachable
 * from the navigation, it is only the homepage rail that changed.
 *
 * The offer label shown on each rail is the admin's own, served by
 * `GET /offers`, which publishes only offers that are live right now.
 */
const fetcher = async (): Promise<OfferGroup[]> => {
  const location = getCookie("userLocation") as UserLocation | undefined;
  const { lat = "", lng = "" } = location || {};

  if (!lat || !lng) {
    return [];
  }

  const response = await getOffers({ latitude: lat, longitude: lng });

  if (!response.success || !Array.isArray(response.data)) {
    return [];
  }

  return response.data;
};

const HomeOffers: FC = () => {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.resolvedLanguage || i18n.language;
  const rtl = isRTL(currentLang);

  const {
    data: groups = [],
    isLoading,
    mutate,
  } = useSWR("/offers", fetcher, {
    revalidateOnFocus: false,
  });

  useRailReport("offers", groups.length === 0, isLoading);

  const skeletonSlides = useMemo(
    () =>
      Array.from({ length: 6 }).map((_, index) => (
        <SwiperSlide key={`offer-skeleton-${index}`}>
          <div className="py-0.5">
            <ProductCardSkeleton />
          </div>
        </SwiperSlide>
      )),
    [],
  );

  const breakpoints = {
    640: { slidesPerView: 3, spaceBetween: 12 },
    1024: { slidesPerView: 4, spaceBetween: 12 },
    1280: { slidesPerView: 5, spaceBetween: 12 },
  };

  return (
    <section id="home-offers">
      <button
        onClick={() => mutate()}
        className="hidden"
        id="home-offers-refetch"
      />

      {isLoading && (
        <div className="w-full mb-4">
          <div className="flex justify-between w-full items-center mb-6">
            <SectionHeading
              title={t("home.offers.title")}
              description={t("home.offers.description")}
              icon={<Gift size={16} className="text-white" />}
            />
          </div>
          <Swiper
            key={rtl ? "rtl-ho-skeleton" : "ltr-ho-skeleton"}
            dir={rtl ? "rtl" : "ltr"}
            slidesPerView={2}
            spaceBetween={4}
            breakpoints={breakpoints}
            modules={[Navigation]}
          >
            {skeletonSlides}
          </Swiper>
        </div>
      )}

      {!isLoading &&
        groups.map((group) => (
          <div className="w-full mb-4" key={group.offer.id}>
            <div className="flex justify-between w-full items-center mb-6">
              <SectionHeading
                title={group.offer.name || group.offer.label}
                description={group.offer.description || group.offer.label}
                icon={<Gift size={16} className="text-white" />}
              />
              <span className="text-xs sm:text-sm font-semibold rounded-full border border-green-600/35 bg-green-600/10 px-3 py-1 text-green-700 dark:text-green-400">
                {group.offer.label}
              </span>
            </div>
            <Swiper
              key={`${group.offer.id}-${rtl ? "rtl" : "ltr"}`}
              dir={rtl ? "rtl" : "ltr"}
              slidesPerView={2}
              spaceBetween={4}
              breakpoints={breakpoints}
              lazyPreloadPrevNext={0}
              modules={[Navigation, Autoplay]}
              loop={false}
              autoplay={{
                delay: 3500,
                disableOnInteraction: false,
                pauseOnMouseEnter: true,
              }}
            >
              {group.products.map((product) => (
                <SwiperSlide key={product.id}>
                  <div className="py-0.5">
                    <ProductCard product={product} />
                  </div>
                </SwiperSlide>
              ))}
            </Swiper>
          </div>
        ))}
    </section>
  );
};

export default HomeOffers;
