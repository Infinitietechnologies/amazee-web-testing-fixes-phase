import { FC, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import useSWR from "swr";
import { useSelector } from "react-redux";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper/modules";
import { RotateCcw } from "lucide-react";

import SectionHeading from "@/components/SectionHeading";
import ProductCard from "@/components/Cards/ProductCard";
import SwiperNavigation from "@/components/SwiperNavigation";
import { getBuyAgain } from "@/routes/api";
import { Product } from "@/types/ApiResponse";
import { getCookie } from "@/lib/cookies";
import { UserLocation } from "@/components/Location/types/LocationAutoComplete.types";
import { isRTL } from "@/helpers/functionalHelpers";
import { RootState } from "@/lib/redux/store";

/**
 * [2026-09-28] "Buy again" rail on the homepage.
 *
 * Signed-in customers only. Shows products they have had delivered before
 * that stores at their current location can deliver now (GET /user/buy-again
 * applies the same zone, store and stock rules as every listing), newest
 * first. Renders nothing for guests, new customers or an empty result, so
 * the page is unchanged for them.
 */
const fetchBuyAgain = async (): Promise<Product[]> => {
  const location = getCookie("userLocation") as UserLocation | undefined;
  const { lat = "", lng = "" } = location || {};
  if (!lat || !lng) {
    return [];
  }
  const response = await getBuyAgain({ latitude: lat, longitude: lng, limit: 12 });

  return response.success && Array.isArray(response.data) ? response.data : [];
};

const HomeBuyAgain: FC = () => {
  const { t, i18n } = useTranslation();
  const isLoggedIn = useSelector((state: RootState) => state.auth.isLoggedIn);
  const location = getCookie("userLocation") as UserLocation | undefined;
  const key = isLoggedIn ? ["/user/buy-again", location?.lat ?? "", location?.lng ?? ""] : null;
  const { data: products = [], mutate } = useSWR(key, fetchBuyAgain, { revalidateOnFocus: false });

  const prevRef = useRef(null);
  const nextRef = useRef(null);
  const rtl = isRTL(i18n.resolvedLanguage || i18n.language);

  const slides = useMemo(
    () =>
      products.map((product) => (
        <SwiperSlide key={product.id}>
          <div className="py-0.5">
            <ProductCard product={product} />
          </div>
        </SwiperSlide>
      )),
    [products],
  );

  // Clicked by helpers/updators.ts on login and on a location change, like
  // the other home rails; rendered even while the rail itself is hidden.
  const refetch = <button onClick={() => mutate()} className="hidden" id="home-buy-again-refetch" type="button" />;

  if (!isLoggedIn || products.length === 0) {
    return refetch;
  }

  return (
    <section id="home-buy-again" data-testid="home-buy-again">
      {refetch}
      <div className="w-full mb-4">
        <div className="flex justify-between w-full items-center mb-6">
          <SectionHeading
            title={t("home.buy_again.title", { defaultValue: "Buy again" })}
            description={t("home.buy_again.description", {
              defaultValue: "Your past orders, available near you now",
            })}
            icon={<RotateCcw size={16} className="text-white" />}
          />
        </div>
        <div className="relative group">
          <SwiperNavigation prevRef={prevRef} nextRef={nextRef} rtl={rtl} />
          <Swiper
            key={rtl ? "rtl-buy-again" : "ltr-buy-again"}
            dir={rtl ? "rtl" : "ltr"}
            slidesPerView={2}
            spaceBetween={4}
            breakpoints={{
              640: { slidesPerView: 3, spaceBetween: 12 },
              1024: { slidesPerView: 4, spaceBetween: 12 },
              1280: { slidesPerView: 5, spaceBetween: 12 },
            }}
            onBeforeInit={(swiper) => {
              const nav = swiper.params.navigation;
              if (nav && typeof nav !== "boolean") {
                nav.prevEl = prevRef.current;
                nav.nextEl = nextRef.current;
              }
            }}
            navigation={true}
            modules={[Navigation]}
            lazyPreloadPrevNext={0}
          >
            {slides}
          </Swiper>
        </div>
      </div>
    </section>
  );
};

export default HomeBuyAgain;
