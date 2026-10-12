import { FC, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import useSWR from "swr";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper/modules";
import { BadgePercent, Gift, Tag } from "lucide-react";

import ProductCard from "@/components/Cards/ProductCard";
import ProductCardSkeleton from "@/components/Skeletons/ProductCardSkeleton";
import SectionHeading from "@/components/SectionHeading";
import { getOffersSection } from "@/routes/api";
import { getCookie } from "@/lib/cookies";
import { UserLocation } from "@/components/Location/types/LocationAutoComplete.types";
import { isRTL } from "@/helpers/functionalHelpers";
import { OffersSectionData, Product } from "@/types/ApiResponse";

/**
 * [2026-09-28] The Offers page: chips for every group (admin offer
 * categories with their BOGO offers, and discounted products by product
 * category), one product rail per group. Everything is filtered by the
 * customer's location on the server, so only purchasable products appear.
 */
const fetcher = async (): Promise<OffersSectionData | null> => {
  const location = getCookie("userLocation") as UserLocation | undefined;
  const { lat = "", lng = "" } = location || {};
  const res = await getOffersSection({ latitude: lat || undefined, longitude: lng || undefined });
  return res.success && res.data ? res.data : null;
};

const breakpoints = {
  640: { slidesPerView: 3, spaceBetween: 12 },
  1024: { slidesPerView: 4, spaceBetween: 12 },
  1280: { slidesPerView: 5, spaceBetween: 12 },
};

const Rail: FC<{ products: Product[]; rtl: boolean; id: string }> = ({ products, rtl, id }) => (
  <Swiper
    key={`${id}-${rtl ? "rtl" : "ltr"}`}
    dir={rtl ? "rtl" : "ltr"}
    slidesPerView={2}
    spaceBetween={4}
    breakpoints={breakpoints}
    lazyPreloadPrevNext={0}
    modules={[Navigation]}
    navigation={true}
  >
    {products.map((product) => (
      <SwiperSlide key={product.id}>
        <div className="py-0.5">
          <ProductCard product={product} />
        </div>
      </SwiperSlide>
    ))}
  </Swiper>
);

const OffersPageView: FC = () => {
  const { t, i18n } = useTranslation();
  const rtl = isRTL(i18n.resolvedLanguage || i18n.language);
  const location = getCookie("userLocation") as UserLocation | undefined;
  const { data, isLoading, mutate } = useSWR(["/offers/section", location?.lat ?? "", location?.lng ?? ""], fetcher, {
    revalidateOnFocus: false,
  });
  const [active, setActive] = useState<string>("all");

  const chips = data?.categories ?? [];
  const bogo = useMemo(() => (data?.bogo_groups ?? []).filter((g) => active === "all" || g.category.slug === active), [data, active]);
  const discount = useMemo(() => (data?.discount_groups ?? []).filter((g) => active === "all" || g.category.slug === active), [data, active]);
  const empty = !isLoading && data && bogo.length === 0 && discount.length === 0;

  return (
    <section id="offers-page" data-testid="offers-page">
      <button onClick={() => mutate()} className="hidden" id="offers-page-refetch" type="button" />
      <div className="flex flex-col gap-1 mb-4">
        <h1 className="text-2xl font-bold">{data?.title || t("offers.title", { defaultValue: "Offers" })}</h1>
        <p className="text-gray-500 text-sm">{data?.subtitle || t("offers.subtitle", { defaultValue: "Deals and discounts near you" })}</p>
      </div>

      {chips.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1" role="tablist" data-testid="offers-chips">
          {[{ key: "all", name: t("offers.all", { defaultValue: "All offers" }), type: "all" as const, count: chips.reduce((n, c) => n + c.count, 0), icon: null }, ...chips].map((c) => (
            <button
              key={c.key}
              type="button"
              role="tab"
              aria-selected={active === c.key}
              onClick={() => setActive(c.key)}
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                active === c.key ? "bg-green-600 border-green-600 text-white" : "bg-background border-default-200 text-foreground/80 hover:border-green-500"
              }`}
            >
              {c.type === "discount" ? <BadgePercent size={14} /> : c.type === "bogo" ? <Gift size={14} /> : <Tag size={14} />}
              <span>{c.name}</span>
              <span className={`text-xs ${active === c.key ? "opacity-90" : "text-gray-400"}`}>{c.count}</span>
            </button>
          ))}
        </div>
      )}

      {isLoading && (
        <Swiper slidesPerView={2} spaceBetween={4} breakpoints={breakpoints} modules={[Navigation]}>
          {Array.from({ length: 6 }).map((_, i) => (
            <SwiperSlide key={`sk-${i}`}>
              <div className="py-0.5">
                <ProductCardSkeleton />
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      )}

      {bogo.map((group) => (
        <div className="w-full mb-6" key={`bogo-${group.category.slug}`} data-testid="offers-bogo-group">
          <div className="flex justify-between w-full items-center mb-4">
            <SectionHeading title={group.category.name} description={group.category.description || t("offers.bogoGroup", { defaultValue: "Buy more, pay less" })} icon={<Gift size={16} className="text-white" />} />
          </div>
          {group.offers.map((entry) => (
            <div className="mb-4" key={entry.offer.id}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold rounded-full border border-green-600/35 bg-green-600/10 px-3 py-1 text-green-700 dark:text-green-400">{entry.offer.label}</span>
                <span className="text-sm text-gray-600">{entry.offer.name}</span>
              </div>
              <Rail products={entry.products} rtl={rtl} id={`bogo-${entry.offer.id}`} />
            </div>
          ))}
        </div>
      ))}

      {discount.map((group) => (
        <div className="w-full mb-6" key={`disc-${group.category.slug}`} data-testid="offers-discount-group">
          <div className="flex justify-between w-full items-center mb-4">
            <SectionHeading title={group.category.name} description={t("offers.discountGroup", { defaultValue: "Discounted products" })} icon={<BadgePercent size={16} className="text-white" />} />
          </div>
          <Rail products={group.products} rtl={rtl} id={`disc-${group.category.slug}`} />
        </div>
      ))}

      {empty && (
        <div className="text-center text-gray-500 py-16" data-testid="offers-empty">
          <Gift className="mx-auto mb-3 w-10 h-10 text-gray-300" />
          <p>{t("offers.empty", { defaultValue: "No offers near you right now. Check back soon." })}</p>
        </div>
      )}
      {!isLoading && !data && (
        <div className="text-center text-gray-500 py-16">{t("offers.locationNeeded", { defaultValue: "Choose your location to see offers near you." })}</div>
      )}
    </section>
  );
};

export default OffersPageView;
