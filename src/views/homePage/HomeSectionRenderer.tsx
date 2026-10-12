import { CSSProperties, FC, useRef } from "react";
import {
  categoryRailBreakpoints,
  normalizeCategoryStyle,
} from "@/helpers/categoryStyle";
import { useTranslation } from "react-i18next";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper/modules";
import Link from "next/link";
import { AppWindow, Boxes, Gift, Store } from "lucide-react";
import CustomImageTile from "@/views/homePage/CustomImageTile";
import PlayImageSection from "@/views/homePage/playImage/PlayImageSection";
import {
  isLegacyBannerSection,
  resolvePlayImageRow,
} from "@/views/homePage/playImage/playImageConfig";

import ProductCard from "@/components/Cards/ProductCard";
import ProductCardSkeleton from "@/components/Skeletons/ProductCardSkeleton";
import CategoryCard from "@/components/Cards/CategoryCard";
import BrandCard from "@/components/Cards/BrandCard";
import BrandCardSkeleton from "@/components/Skeletons/BrandCardSkeleton";
import CategoryCardSkeleton from "@/components/Skeletons/CategoryCardSkeleton";
import SectionHeading from "@/components/SectionHeading";
import SwiperNavigation from "@/components/SwiperNavigation";
import { HomeLayoutSection } from "@/types/ApiResponse";
import {
  bannerHref,
  getSectionBannerItems,
  getSectionBrands,
  getSectionCategories,
  getSectionHeroItems,
  getSectionOffers,
  getSectionProducts,
  getPlayImageRows,
  heroHref,
  isPublishedSectionId,
} from "@/helpers/homeLayout";
import { isRTL } from "@/helpers/functionalHelpers";

const encodeUrl = (url: string) =>
  url.replace(/\(/g, "%28").replace(/\)/g, "%29").replace(/\s/g, "%20");

/**
 * Background now comes from `config.background_type` + `config.background_color`
 * plus the section-level image fields (the old per-breakpoint image set is gone).
 * Unknown/`none` background types fall through to no styling.
 */
export const getSectionBackgroundStyle = (
  section: HomeLayoutSection,
): CSSProperties => {
  const { background_type, background_color } = section.config ?? {};

  if (background_type === "image") {
    const image = section.background_image || section.card_background_image;
    if (image) {
      return {
        backgroundImage: `url("${encodeUrl(image)}")`,
        backgroundSize: "cover",
        backgroundPosition: "top",
        backgroundRepeat: "no-repeat",
      };
    }
  }

  // `background_color` may arrive as a {light, dark} pair from the builder's
  // theme-aware colour picker. Only the flat form is usable as a CSS value
  // here; the themed form is read by the caller that knows the active theme.
  if (background_type === "color" && typeof background_color === "string" && background_color) {
    return { backgroundColor: background_color };
  }

  // [CHANGE] Gradient, configured in the Home Builder for the offers section.
  // Same 135deg direction as the builder's own preview and the mobile app, so
  // one configuration renders identically on all three.
  if (background_type === "gradient") {
    const { gradient_from, gradient_to } = section.config ?? {};
    if (gradient_from && gradient_to) {
      return {
        backgroundImage: `linear-gradient(135deg, ${gradient_from}, ${gradient_to})`,
      };
    }
  }

  return {};
};

interface SectionProps {
  section: HomeLayoutSection;
  isLoading?: boolean;
}

/** A `type: "products"` section — title + horizontal ProductCard rail. */
const HomeProductsSection: FC<SectionProps> = ({ section, isLoading = false }) => {
  const { t, i18n } = useTranslation();
  const prevRef = useRef(null);
  const nextRef = useRef(null);

  const products = getSectionProducts(section.content);
  const rtl = isRTL(i18n.resolvedLanguage || i18n.language);
  const backgroundStyle = getSectionBackgroundStyle(section);
  const hasBackground = Object.keys(backgroundStyle).length > 0;

  // Nothing to show — render nothing rather than an empty heading.
  if (!isLoading && products.length === 0) return null;

  return (
    <div className="mb-8" data-testid={`home-section-${section.id}`}>
      <div
        className={hasBackground ? "rounded-xl px-1 sm:px-6 py-4" : undefined}
        style={backgroundStyle}
      >
        <div className="flex justify-between w-full items-center mb-6">
          {/* title is nullable — fall back rather than render an empty heading */}
          <SectionHeading
            title={section.title || t("pageTitle.products")}
            description=""
            icon={<Boxes size={16} className="text-white" />}
          />

          {/* The section feed endpoint returns no title, so carry it across
              for the page header; the page falls back if it's absent. */}
          {/* A draft section in an admin preview has no published feed yet. */}
          {isPublishedSectionId(section.id) && (
            <Link
              href={{
                pathname: `/section/${section.id}`,
                query: section.title ? { title: section.title } : undefined,
              }}
              className="text-xs sm:text-sm"
              title={t("see_all")}
            >
              {t("see_all")}
            </Link>
          )}
        </div>

        <div className="relative group">
          <SwiperNavigation prevRef={prevRef} nextRef={nextRef} rtl={rtl} />

          <Swiper
            key={rtl ? `rtl-hls-${section.id}` : `ltr-hls-${section.id}`}
            dir={rtl ? "rtl" : "ltr"}
            slidesPerView={2}
            spaceBetween={4}
            breakpoints={{
              640: { slidesPerView: 3, spaceBetween: 12 },
              1024: { slidesPerView: 4, spaceBetween: 12 },
              1280: { slidesPerView: 5, spaceBetween: 12 },
              1440: { slidesPerView: 7, spaceBetween: 12 },
            }}
            lazyPreloadPrevNext={0}
            modules={[Navigation]}
            onBeforeInit={(swiper) => {
              const nav = swiper.params.navigation;
              if (nav && typeof nav !== "boolean") {
                nav.prevEl = prevRef.current;
                nav.nextEl = nextRef.current;
              }
            }}
            navigation={true}
          >
            {isLoading
              ? Array.from({ length: 7 }).map((_, index) => (
                  <SwiperSlide key={`skeleton-${index}`}>
                    <div className="py-0.5">
                      <ProductCardSkeleton />
                    </div>
                  </SwiperSlide>
                ))
              : products.map((product) => (
                  <SwiperSlide key={product.id}>
                    <div className="py-0.5">
                      <ProductCard product={product} />
                    </div>
                  </SwiperSlide>
                ))}
          </Swiper>
        </div>
      </div>
    </div>
  );
};

/**
 * [v3.2 port 2026-09-28] Home Builder `custom_image` rail style.
 *
 * Distinct from the four CategoryStyleEnum looks: the tiles are the admin's
 * own uploaded artwork at natural size, so the rail is `slidesPerView: auto`
 * and the grid variant (`config.rows_layout: grid`) takes 1–6 columns from
 * `config.grid_columns`.
 */
export const CUSTOM_IMAGE_STYLE = "custom_image";

const CUSTOM_IMAGE_GRID_CLASSES: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 md:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  5: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
  6: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6",
};

export const getCustomImageGridClasses = (value: unknown): string => {
  if (value === null || value === undefined || value === "") {
    return CUSTOM_IMAGE_GRID_CLASSES[2];
  }
  const requested = Number(value);
  const columns = Number.isFinite(requested)
    ? Math.min(6, Math.max(1, Math.round(requested)))
    : 2;
  return CUSTOM_IMAGE_GRID_CLASSES[columns];
};

interface CustomImageEntry {
  key: string | number;
  href: string;
  image: string;
  title: string;
}

/** A rail (or grid) of linked custom-image tiles. */
const CustomImageRail: FC<{
  section: SectionProps["section"];
  entries: CustomImageEntry[];
  isLoading: boolean;
  keyPrefix: string;
}> = ({ section, entries, isLoading, keyPrefix }) => {
  const { i18n } = useTranslation();
  const rtl = isRTL(i18n.resolvedLanguage || i18n.language);

  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-hidden" data-testid="home-custom-image-loading">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={`${keyPrefix}-skeleton-${index}`}
            className="h-32 w-48 shrink-0 rounded-xl animate-pulse bg-default-200"
          />
        ))}
      </div>
    );
  }

  if (section.config?.rows_layout === "grid") {
    return (
      <div
        className={`grid ${getCustomImageGridClasses(section.config?.grid_columns)} items-start justify-items-start gap-3 w-full py-1`}
        data-testid="home-custom-image-grid"
      >
        {entries.map((entry) => (
          <CustomImageTile
            key={entry.key}
            href={entry.href}
            image={entry.image}
            title={entry.title}
          />
        ))}
      </div>
    );
  }

  return (
    <Swiper
      key={`${rtl ? "rtl" : "ltr"}-${keyPrefix}-${section.id}`}
      className="home-category-image-swiper"
      dir={rtl ? "rtl" : "ltr"}
      slidesPerView="auto"
      spaceBetween={12}
      lazyPreloadPrevNext={0}
      modules={[Navigation]}
    >
      {entries.map((entry) => (
        <SwiperSlide key={entry.key}>
          <CustomImageTile
            href={entry.href}
            image={entry.image}
            title={entry.title}
          />
        </SwiperSlide>
      ))}
    </Swiper>
  );
};

/** A `type: "categories"` section — title + horizontal CategoryCard rail. */
const HomeCategoriesSection: FC<SectionProps> = ({
  section,
  isLoading = false,
}) => {
  const { t, i18n } = useTranslation();

  const categories = getSectionCategories(section.content);
  const rtl = isRTL(i18n.resolvedLanguage || i18n.language);
  const backgroundStyle = getSectionBackgroundStyle(section);
  const hasBackground = Object.keys(backgroundStyle).length > 0;
  // [2026-09-23 final approval, item 4] The admin's chosen style.
  const style = normalizeCategoryStyle(section.style);
  // [v3.2 port] custom_image is a Home Builder-only style, outside the
  // CategoryStyleEnum set that normalizeCategoryStyle knows.
  const isCustomImage = section.style === CUSTOM_IMAGE_STYLE;

  if (!isLoading && categories.length === 0) return null;

  if (isCustomImage) {
    return (
      <div
        className="mb-8"
        data-testid={`home-section-${section.id}`}
        data-category-section-style={CUSTOM_IMAGE_STYLE}
      >
        <div
          className={hasBackground ? "rounded-xl px-1 sm:px-6 py-4" : undefined}
          style={backgroundStyle}
        >
          <div className="flex justify-between w-full items-center mb-4">
            <SectionHeading
              title={section.title || t("home.categories.title")}
              description=""
              icon={<AppWindow size={16} className="text-white" />}
            />
            <Link href="/categories" className="text-xs sm:text-sm" title={t("see_all")}>
              {t("see_all")}
            </Link>
          </div>
          <CustomImageRail
            section={section}
            isLoading={isLoading}
            keyPrefix="hlc-ci"
            entries={categories
              .map((category) => ({
                key: category.id,
                href: category.parent_slug
                  ? `/categories/${category.parent_slug}?subcategory=${category.slug}`
                  : `/categories/${category.slug}`,
                image: category.custom_image || category.image,
                title: category.title,
              }))
              .filter((entry) => Boolean(entry.image))}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className="mb-8"
      data-testid={`home-section-${section.id}`}
      data-category-section-style={style}
    >
      <div
        className={hasBackground ? "rounded-xl px-1 sm:px-6 py-4" : undefined}
        style={backgroundStyle}
      >
        <div className="flex justify-between w-full items-center mb-4">
          <SectionHeading
            title={section.title || t("home.categories.title")}
            description=""
            icon={<AppWindow size={16} className="text-white" />}
          />
          <Link
            href="/categories"
            className="text-xs sm:text-sm"
            title={t("see_all")}
          >
            {t("see_all")}
          </Link>
        </div>

        <Swiper
          key={rtl ? `rtl-hlc-${section.id}-${style}` : `ltr-hlc-${section.id}-${style}`}
          dir={rtl ? "rtl" : "ltr"}
          slidesPerView={style === "default" ? 3 : 2.4}
          spaceBetween={style === "default" ? 1 : 10}
          breakpoints={categoryRailBreakpoints(style)}
          lazyPreloadPrevNext={0}
          modules={[Navigation]}
        >
          {isLoading
            ? Array.from({ length: 12 }).map((_, index) => (
                <SwiperSlide key={`cat-skeleton-${index}`}>
                  <CategoryCardSkeleton />
                </SwiperSlide>
              ))
            : categories.map((category) => (
                <SwiperSlide key={category.id}>
                  <div className="flex flex-col items-center">
                    <CategoryCard category={category} variant={style} />
                  </div>
                </SwiperSlide>
              ))}
        </Swiper>
      </div>
    </div>
  );
};

/**
 * [CHANGE] A `type: "offers"` section — one product rail per live BOGO
 * campaign, under the admin's configured title and background.
 *
 * The title comes from the section, never from a hardcoded string: the
 * requirement is that "the title shown on the customer Home page must come
 * from the Admin configuration". When an admin leaves it blank the section
 * still renders its rails, each headed by its own campaign name, rather than
 * inventing a heading.
 */
const HomeOffersSection: FC<SectionProps> = ({ section, isLoading = false }) => {
  const { i18n } = useTranslation();
  const rtl = isRTL(i18n.resolvedLanguage || i18n.language);
  const groups = getSectionOffers(section.content);
  const backgroundStyle = getSectionBackgroundStyle(section);
  const hasBackground = Object.keys(backgroundStyle).length > 0;

  // No live campaign with products in this zone — render nothing rather than
  // an empty heading over blank space.
  if (!isLoading && groups.length === 0) return null;

  return (
    <div className="mb-8" data-testid={`home-section-${section.id}`}>
      <div
        className={hasBackground ? "rounded-xl px-1 sm:px-6 py-4" : undefined}
        style={backgroundStyle}
      >
        {section.title ? (
          <div className="flex justify-between w-full items-center mb-6">
            <SectionHeading
              title={section.title}
              description=""
              icon={<Gift size={16} className="text-white" />}
            />
          </div>
        ) : null}

        {isLoading
          ? <div className="flex gap-3 overflow-hidden">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={`offer-skeleton-${i}`} className="w-[160px] shrink-0">
                  <ProductCardSkeleton />
                </div>
              ))}
            </div>
          : groups.map((group) => (
              <div key={group.offer.id} className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold rounded-full border border-green-600/35 bg-green-600/10 px-3 py-1 text-green-700 dark:text-green-400">
                    {group.offer.label}
                  </span>
                  {group.offer.name ? (
                    <span className="text-sm font-medium opacity-80">
                      {group.offer.name}
                    </span>
                  ) : null}
                </div>
                <Swiper
                  key={`${group.offer.id}-${rtl ? "rtl" : "ltr"}`}
                  dir={rtl ? "rtl" : "ltr"}
                  slidesPerView={2}
                  spaceBetween={4}
                  breakpoints={{
                    640: { slidesPerView: 3, spaceBetween: 12 },
                    1024: { slidesPerView: 4, spaceBetween: 12 },
                    1280: { slidesPerView: 5, spaceBetween: 12 },
                  }}
                  modules={[Navigation]}
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
      </div>
    </div>
  );
};

/**
 * Renders one home-layout section by `type`.
 *
 * Unknown types render nothing (with a dev-only warning) so new backend
 * section types can never break the homepage — add a case here as each
 * one comes online (banners | brands | stores | sliders remain unbuilt).
 */
/**
 * [CHANGE 2026-09-22] `brands`, `banners` and `hero` sections.
 *
 * All three have been publishable from the Home Builder and resolvable by
 * HomeLayoutResolver since the builder shipped. The web renderer handled only
 * products, categories and offers, and its `default` branch dropped everything
 * else with a console warning in development and silence in production. So an
 * admin could build a hero, save it, and find the home page unchanged — with no
 * error anywhere to explain why. These three renderers close that gap.
 */

/** A `type: "brands"` section — title + horizontal BrandCard rail. */
const HomeBrandsSection: FC<SectionProps> = ({ section, isLoading = false }) => {
  const { t, i18n } = useTranslation();

  const brands = getSectionBrands(section.content);
  const rtl = isRTL(i18n.resolvedLanguage || i18n.language);
  const backgroundStyle = getSectionBackgroundStyle(section);
  const hasBackground = Object.keys(backgroundStyle).length > 0;

  if (!isLoading && brands.length === 0) return null;

  // [v3.2 port] custom_image brand rails show the section's own artwork.
  const isCustomImage = section.style === CUSTOM_IMAGE_STYLE;

  return (
    <div
      className="mb-8"
      data-testid={`home-section-${section.id}`}
      data-brand-section-style={isCustomImage ? CUSTOM_IMAGE_STYLE : undefined}
    >
      <div
        className={hasBackground ? "rounded-xl px-1 sm:px-6 py-4" : undefined}
        style={backgroundStyle}
      >
        <div className="flex justify-between w-full items-center mb-4">
          <SectionHeading
            title={section.title || t("home.brands.title")}
            description=""
            icon={<Store size={16} className="text-white" />}
          />
          <Link href="/brands" className="text-xs sm:text-sm" title={t("see_all")}>
            {t("see_all")}
          </Link>
        </div>

        {isCustomImage ? (
          <CustomImageRail
            section={section}
            isLoading={isLoading}
            keyPrefix="hlb-ci"
            entries={brands
              .map((brand) => ({
                key: brand.id,
                href: `/brands/${brand.slug}`,
                image: brand.custom_image || brand.logo,
                title: brand.title,
              }))
              .filter((entry) => Boolean(entry.image))}
          />
        ) : (
        <Swiper
          key={rtl ? `rtl-hlb-${section.id}` : `ltr-hlb-${section.id}`}
          dir={rtl ? "rtl" : "ltr"}
          slidesPerView={3}
          spaceBetween={8}
          breakpoints={{
            315: { slidesPerView: 3 },
            424: { slidesPerView: 4 },
            640: { slidesPerView: 6, spaceBetween: 12 },
            1024: { slidesPerView: 8, spaceBetween: 12 },
            1280: { slidesPerView: 10, spaceBetween: 12 },
          }}
          lazyPreloadPrevNext={0}
          modules={[Navigation]}
        >
          {isLoading
            ? Array.from({ length: 10 }).map((_, index) => (
                <SwiperSlide key={`brand-skeleton-${index}`}>
                  <BrandCardSkeleton />
                </SwiperSlide>
              ))
            : brands.map((brand) => (
                <SwiperSlide key={brand.id}>
                  <BrandCard brand={brand} />
                </SwiperSlide>
              ))}
        </Swiper>
        )}
      </div>
    </div>
  );
};

/**
 * A `type: "banners"` section — a full-width promotional strip.
 *
 * A slide with no destination renders as a plain image rather than as a link:
 * `bannerHref` answers null for those, and a link to "#" would scroll the page
 * to the top when tapped, which reads as a broken banner.
 */
const HomeBannersSection: FC<SectionProps> = ({ section, isLoading = false }) => {
  const { i18n } = useTranslation();

  const items = getSectionBannerItems(section.content);
  const rtl = isRTL(i18n.resolvedLanguage || i18n.language);
  const backgroundStyle = getSectionBackgroundStyle(section);
  const hasBackground = Object.keys(backgroundStyle).length > 0;
  const peek = section.style === "peek";

  if (isLoading) {
    return (
      <div className="mb-8" data-testid={`home-section-${section.id}`}>
        <div className="w-full h-32 sm:h-48 rounded-xl animate-pulse bg-default-200" />
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="mb-8" data-testid={`home-section-${section.id}`}>
      <div
        className={hasBackground ? "rounded-xl px-1 sm:px-6 py-4" : undefined}
        style={backgroundStyle}
      >
        {section.title ? (
          <div className="mb-4">
            <SectionHeading
              title={section.title}
              description=""
              icon={<AppWindow size={16} className="text-white" />}
            />
          </div>
        ) : null}

        <Swiper
          key={rtl ? `rtl-hlbn-${section.id}` : `ltr-hlbn-${section.id}`}
          dir={rtl ? "rtl" : "ltr"}
          // "peek" is the builder's own name for showing the edge of the next
          // slide, so the two stay in step: one style value, one behaviour.
          slidesPerView={peek ? 1.1 : 1}
          spaceBetween={peek ? 12 : 0}
          lazyPreloadPrevNext={1}
          modules={[Navigation]}
        >
          {items.map((item) => {
            const href = bannerHref(item);

            // [v3.2 port] Mobile-web artwork below the md breakpoint.
            const image = (
              <picture className="block w-full">
                {item.image_web_mobile ? (
                  <source
                    media="(max-width: 767px)"
                    srcSet={item.image_web_mobile}
                    data-home-banner-mobile-source
                  />
                ) : null}
                <img
                  src={item.image}
                  alt=""
                  loading="lazy"
                  className="w-full h-auto rounded-xl object-cover"
                />
              </picture>
            );

            return (
              <SwiperSlide key={item.id}>
                {href ? (
                  <Link href={href} aria-label={String(item.id)}>
                    {image}
                  </Link>
                ) : (
                  image
                )}
              </SwiperSlide>
            );
          })}
        </Swiper>
      </div>
    </div>
  );
};

/**
 * A `type: "hero"` section — a banner with optional cards beneath it.
 *
 * `config.layout` is the builder's switch: "none" is banner-only, "items" adds
 * the card row. Read from the section rather than inferred from whether items
 * happen to be present, so a hero the admin configured as banner-only stays
 * banner-only even if stale items are still attached to it.
 */
const HomeHeroSection: FC<SectionProps> = ({ section, isLoading = false }) => {
  const { i18n } = useTranslation();

  const items = getSectionHeroItems(section.content);
  const rtl = isRTL(i18n.resolvedLanguage || i18n.language);
  const backgroundStyle = getSectionBackgroundStyle(section);
  // `hero_media` is either a plain URL or the richer {url, poster, ...} object
  // the builder writes for video heroes. Take the URL out of the object rather
  // than handing an object to <img src>, which renders "[object Object]".
  const heroMedia = section.hero_media;
  const media =
    (typeof heroMedia === "string" ? heroMedia : heroMedia?.url || heroMedia?.poster) ||
    section.background_image ||
    null;
  // [v3.2 port] Mobile-web hero artwork (plain URL), used below md.
  const mobileMedia =
    typeof section.hero_media_web_mobile === "string" &&
    section.hero_media_web_mobile.trim()
      ? section.hero_media_web_mobile.trim()
      : null;
  const withItems = (section.config?.layout ?? "items") !== "none";
  const cardBackground = section.config?.card_bg_color;
  const cardTitleColor = section.config?.card_title_color;

  if (isLoading) {
    return (
      <div className="mb-8" data-testid={`home-section-${section.id}`}>
        <div className="w-full h-40 sm:h-64 rounded-xl animate-pulse bg-default-200" />
      </div>
    );
  }

  // Nothing to show at all — not a banner, not a card. Rendering the wrapper
  // would leave an empty gap where a section used to be.
  if (!media && !mobileMedia && (!withItems || items.length === 0)) return null;

  return (
    <div className="mb-8" data-testid={`home-section-${section.id}`}>
      <div className="rounded-xl overflow-hidden" style={backgroundStyle}>
        {media || mobileMedia ? (
          <picture className="block w-full">
            {mobileMedia && media ? (
              <source
                media="(max-width: 767px)"
                srcSet={mobileMedia}
                data-home-hero-mobile-source
              />
            ) : null}
            <img
              src={(media || mobileMedia) as string}
              alt={section.title || ""}
              className="w-full h-auto object-cover"
            />
          </picture>
        ) : null}

        {withItems && items.length > 0 ? (
          <Swiper
            key={rtl ? `rtl-hlh-${section.id}` : `ltr-hlh-${section.id}`}
            dir={rtl ? "rtl" : "ltr"}
            slidesPerView={2.2}
            spaceBetween={8}
            breakpoints={{
              640: { slidesPerView: 3, spaceBetween: 12 },
              1024: { slidesPerView: 4, spaceBetween: 12 },
            }}
            className="px-2 py-3"
            lazyPreloadPrevNext={0}
            modules={[Navigation]}
          >
            {items.map((item) => {
              const href = heroHref(item);

              const card = (
                <div
                  className="rounded-xl p-2 flex flex-col items-center gap-2 h-full"
                  style={cardBackground ? { backgroundColor: cardBackground } : undefined}
                >
                  {item.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.image}
                      alt=""
                      loading="lazy"
                      className="w-14 h-14 object-cover rounded-lg"
                    />
                  ) : null}
                  <span
                    className="text-xs text-center line-clamp-2"
                    style={cardTitleColor ? { color: cardTitleColor } : undefined}
                  >
                    {item.title}
                  </span>
                </div>
              );

              return (
                <SwiperSlide key={item.id}>
                  {href ? <Link href={href}>{card}</Link> : card}
                </SwiperSlide>
              );
            })}
          </Swiper>
        ) : null}
      </div>
    </div>
  );
};

/**
 * [v3.2 port 2026-09-28] A `type: "play_image"` section — one or more rows of
 * linked images, each row a responsive 12-column grid or a slider, configured
 * per row in the Home Builder (views/homePage/playImage/*).
 */
const HomePlayImageSection: FC<SectionProps> = ({ section, isLoading = false }) => {
  const rows = getPlayImageRows(section.content);
  const backgroundStyle = getSectionBackgroundStyle(section);
  const hasBackground = Object.keys(backgroundStyle).length > 0;

  if (!isLoading && rows.length === 0) return null;

  // Upgraded legacy "top" banners keep a stable desktop frame.
  const compactLegacyBannerOnDesktop =
    isLegacyBannerSection(section) &&
    typeof section.config?.position === "string" &&
    section.config.position.trim().toLowerCase() === "top";
  const hasFullBleedRow = rows.some(
    (row) => resolvePlayImageRow(section, row).config.container_width === "full",
  );

  return (
    <div
      className="mb-8"
      data-testid={`home-section-${section.id}`}
      data-full-bleed={hasFullBleedRow ? "true" : undefined}
    >
      <div
        className={hasBackground ? "rounded-xl px-1 sm:px-6 py-4" : undefined}
        style={backgroundStyle}
      >
        <PlayImageSection
          section={section}
          rows={rows}
          isLoading={isLoading}
          compactLegacyBannerOnDesktop={compactLegacyBannerOnDesktop}
        />
      </div>
    </div>
  );
};

const HomeSectionRenderer: FC<SectionProps> = ({ section, isLoading }) => {
  if (!section) return null;

  switch (section.type) {
    case "products":
      return <HomeProductsSection section={section} isLoading={isLoading} />;

    case "categories":
      return <HomeCategoriesSection section={section} isLoading={isLoading} />;

    case "offers":
      return <HomeOffersSection section={section} isLoading={isLoading} />;

    case "brands":
      return <HomeBrandsSection section={section} isLoading={isLoading} />;

    case "banners":
      return <HomeBannersSection section={section} isLoading={isLoading} />;

    case "hero":
      return <HomeHeroSection section={section} isLoading={isLoading} />;

    case "play_image":
      return <HomePlayImageSection section={section} isLoading={isLoading} />;

    default:
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `[home-layout] Unsupported section type "${section.type}" (id=${section.id}) — skipped.`,
        );
      }
      return null;
  }
};

export default HomeSectionRenderer;
