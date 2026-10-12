import {
  getCookieFromContext,
  isHomeBuilderLayout,
  isSSR,
} from "@/helpers/getters";
import HomeCategories from "@/views/homePage/HomeCategories";
import HomeTopSlider from "@/views/homePage/HomeTopSlider";
import { GetServerSideProps } from "next";
import { getHomePageData } from "@/services/homePageService";
import { getHomeLayout, getSettings } from "@/routes/api";

import DeliveryBanner from "@/views/homePage/DeliveryBanner";
import {
  BannerData,
  Brand,
  Category,
  FeaturedSection,
  HomeLayoutData,
  Product,
  Settings,
  Store,
} from "@/types/ApiResponse";
import HomeLayoutView, {
  SECTIONS_PER_PAGE,
} from "@/views/homePage/HomeLayoutView";
import { readHomePreviewToken } from "@/helpers/homeLayout";
import { useRouter } from "next/router";
import HomeBrands from "@/views/homePage/HomeBrands";
import HomeOffers from "@/views/homePage/HomeOffers";
import { NextPageWithLayout } from "@/types";
import { getUserLocationFromContext } from "@/helpers/functionalHelpers";
import HomeFeaturedSections from "@/views/homePage/HomeFeaturedSections";
import { getAccessTokenFromContext } from "@/helpers/auth";
import HomeCarouselSlider from "@/views/homePage/HomeCarouselSlider";
import { loadTranslations } from "../../i18n";
import { useTranslation } from "react-i18next";
import DynamicSEO from "@/SEO/DynamicSEO";
import {
  generateOrganizationSchema,
  generateWebsiteSchema,
} from "@/helpers/seo";
import { useSettings } from "@/contexts/SettingsContext";
import { siteConfig } from "@/config/site";
import AppDownloadSection from "@/views/homePage/AppDownloadSection";
import HomeServiceHighlights from "@/views/homePage/HomeServiceHighlights";
import HomeBuyAgain from "@/views/homePage/HomeBuyAgain";
import HomeRewardsProgress from "@/views/homePage/HomeRewardsProgress";
import {
  HomeRailsProvider,
  useHomeRailsEmpty,
} from "@/contexts/HomeRailsContext";
import HomeCategoryEmpty from "@/components/Empty/HomeCategoryEmpty";
import { FC } from "react";

// const HomeRecentlyViewed = dynamic(
//   () => import("@/views/homePage/HomeRecentlyViewed"),
//   { ssr: false }
// );

type HomePageProps = {
  initialSettings?: Settings | null;
  initialCategories?: Category[];
  initialBanners?: BannerData;
  initialProducts?: Product[];
  initialBrands?: Brand[];
  initialStores?: Store[];
  initialSections?: FeaturedSection[];
  /** Populated only when the /home-layout homepage is enabled. */
  initialLayout?: HomeLayoutData | null;
  error?: string;
};

type LegacyHomeRailsProps = Pick<
  HomePageProps,
  | "initialBanners"
  | "initialBrands"
  | "initialCategories"
  | "initialStores"
  | "initialSections"
>;

/**
 * The legacy multi-rail homepage. Split out from HomePage so it can sit inside
 * HomeRailsProvider and read back whether every rail came up empty — a category
 * with no content at the user's location otherwise renders nothing at all.
 *
 * The rails stay mounted while empty: they own the refetch buttons that
 * helpers/events.ts clicks on a category or location change, so unmounting them
 * would sever the only path back to populated content.
 */
// initialStores stays in the props (see the note in the JSX below) but this
// component no longer renders the Stores rail, so it is not destructured.
const LegacyHomeRails: FC<LegacyHomeRailsProps> = ({
  initialBanners,
  initialBrands,
  initialCategories,
  initialSections,
}) => {
  const allEmpty = useHomeRailsEmpty();

  return (
    <>
      <div className={allEmpty ? "hidden" : undefined}>
        <HomeTopSlider initialBanners={initialBanners} />

        <HomeBrands initialBrands={initialBrands} />

        <HomeCategories initialCategories={initialCategories} />

        {/*
          Decision 1: the homepage Stores rail is replaced by the Offers rail.
          HomeStores and the /stores directory are intentionally left in the
          codebase and still reachable from the navigation — only this rail
          changed. `initialStores` stays on the page props for the same reason:
          the SSR fetch still feeds /stores, and removing it would be a wider
          change than this decision asked for.
        */}
        <HomeOffers />

        <HomeCarouselSlider initialBanners={initialBanners} />

        <HomeFeaturedSections initialSections={initialSections} />

        {/* <HomeRecentlyViewed /> */}
      </div>

      {/* [2026-09-28] Signed-in customers: past orders available here now.
          Outside the empty gate on purpose: a returning customer with no
          rail content at this location can still reorder. */}
      {/* [2026-10-07] "AmazeeNow Rewards" progress card (signed-in customers). */}
      <HomeRewardsProgress />

      <HomeBuyAgain />

      {allEmpty && <HomeCategoryEmpty />}
    </>
  );
};

const HomePage: NextPageWithLayout<HomePageProps> = ({
  initialCategories,
  initialBanners,
  initialBrands,
  initialStores,
  initialSections,
  initialLayout,
}) => {
  const { t } = useTranslation();
  const { webSettings, isHomeBuilder } = useSettings();
  // [CHANGE 2026-09-23] An admin draft preview always renders the section
  // homepage, whichever homepage the storefront is currently set to.
  const router = useRouter();
  const isHomePreview =
    Boolean(initialLayout?.preview) ||
    Boolean(readHomePreviewToken(router.query.home_preview as string | undefined));

  // Generate SEO schemas
  const siteName = webSettings?.siteName || siteConfig.name;
  const siteDescription =
    webSettings?.metaDescription || siteConfig.metaDescription;
  const siteLogo = webSettings?.siteHeaderLogo || "/logo.png";

  const organizationSchema = generateOrganizationSchema(
    siteName,
    siteDescription,
    siteLogo
  );

  const websiteSchema = generateWebsiteSchema(siteName);

  return (
    <>
      <DynamicSEO
        title={t("pageTitle.home")}
        description={siteDescription}
        keywords={siteConfig.metaKeywords}
        canonical="/"
        ogType="website"
        ogTitle={siteName}
        ogDescription={siteDescription}
        ogImage={siteLogo}
        jsonLd={[organizationSchema, websiteSchema]}
      />

      <div className="flex flex-col gap-0">
        {/* Chosen by the backend's system.layoutType, not a build-time env var,
            so the admin panel can switch homepages without a redeploy. Under
            SSR the settings arrive as initialSettings and seed SWR's
            fallbackData, so this resolves on the first render and can't flip
            after paint. */}
        {isHomeBuilder || isHomePreview ? (
          /* Backend-driven, section-based homepage (/home-layout). */
          <>
            <HomeLayoutView initialLayout={initialLayout} />
            {/* [2026-09-28] After the admin-built sections, signed-in customers only. */}
            <HomeBuyAgain />
          </>
        ) : (
          /* Legacy multi-rail homepage. The default whenever layoutType is
             anything other than "home_builder". */
          <HomeRailsProvider>
            <LegacyHomeRails
              initialBanners={initialBanners}
              initialBrands={initialBrands}
              initialCategories={initialCategories}
              initialStores={initialStores}
              initialSections={initialSections}
            />
          </HomeRailsProvider>
        )}

        <HomeServiceHighlights />

        <DeliveryBanner />

        <AppDownloadSection />
      </div>
    </>
  );
};

export const getServerSideProps: GetServerSideProps<HomePageProps> | undefined =
  isSSR()
    ? async (context) => {
        try {
          await loadTranslations(context);

          const access_token = (await getAccessTokenFromContext(context)) || "";

          const { lat = "", lng = "" } =
            (await getUserLocationFromContext(context)) || {};

          // 1️⃣ take category from query if available, else fallback to cookie.
          // `?category=all` is an explicit "show everything" (the header logo
          // links there), so it must not fall through to the cookie — only a
          // missing query does.
          const queryCategory = context.query.category as string | undefined;
          const cookieCategory =
            (getCookieFromContext(context, "homeCategory") as string) || "";

          const homeCategory =
            queryCategory !== undefined ? queryCategory : cookieCategory;

          // Settings decide WHICH homepage to build, so they can no longer be
          // fetched alongside the layout — they have to land first. That costs
          // one sequential round-trip; the alternative is speculatively fetching
          // both homepages and throwing one away. Passed down to whichever
          // branch wins so nothing re-fetches them.
          const settingsRes = await getSettings({ access_token });
          const settings = settingsRes.data ?? null;

          // /home-layout homepage: one layout call. The layout endpoint returns
          // no settings, and DefaultLayout needs them, so they ride along.
          const previewToken = readHomePreviewToken(
            context.query.home_preview as string | undefined,
          );

          if (previewToken || isHomeBuilderLayout(settings)) {
            const layout = await getHomeLayout({
              preview_token: previewToken,
              platform: "web",
              category_slug:
                homeCategory && homeCategory !== "all" ? homeCategory : undefined,
              latitude: lat || undefined,
              longitude: lng || undefined,
              page: 1,
              per_page: SECTIONS_PER_PAGE,
              access_token,
            });

            return {
              props: {
                initialSettings: settings,
                initialLayout: layout.data ?? null,
              },
            };
          }

          const { categories, banners, products, brands, stores, sections } =
            await getHomePageData({
              lat,
              lng,
              access_token,
              homeCategory,
              settings,
            });

          return {
            props: {
              initialSettings: settings,
              initialCategories: categories,
              initialBanners: banners,
              initialProducts: products,
              initialBrands: brands,
              initialStores: stores,
              initialSections: sections,
            },
          };
        } catch (err) {
          console.error("Error in getServerSideProps:", err);
          return {
            props: {
              initialSettings: null,
              initialCategories: [],
              initialBanners: undefined,
              initialProducts: [],
              initialBrands: [],
              initialStores: [],
              initialSections: [],
              initialLayout: null,
              error:
                err instanceof Error
                  ? err.message
                  : "An error occurred during SSR",
            },
          };
        }
      }
    : undefined;

export default HomePage;
