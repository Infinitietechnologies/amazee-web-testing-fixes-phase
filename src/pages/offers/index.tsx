import { GetServerSideProps } from "next";
import { useTranslation } from "react-i18next";

import DynamicSEO from "@/SEO/DynamicSEO";
import MyBreadcrumbs from "@/components/custom/MyBreadcrumbs";
import OffersPageView from "@/views/OffersPageView";
import { isSSR } from "@/helpers/getters";
import { getSettings } from "@/routes/api";
import { getAccessTokenFromContext } from "@/helpers/auth";
import { NextPageWithLayout } from "@/types";
import { Settings } from "@/types/ApiResponse";
import { loadTranslations } from "../../../i18n";

/** [2026-09-28] /offers — the Offers section (replaces Stores in the bottom navigation). */
type Props = { initialSettings?: Settings | null };

const OffersPage: NextPageWithLayout<Props> = () => {
  const { t } = useTranslation();
  const title = t("offers.title", { defaultValue: "Offers" });

  return (
    <>
      <DynamicSEO
        title={title}
        description={t("offers.subtitle", { defaultValue: "Deals and discounts near you" })}
        keywords="offers, deals, discounts, buy one get one"
        canonical="/offers"
        ogType="website"
        ogTitle={title}
        ogDescription={t("offers.subtitle", { defaultValue: "Deals and discounts near you" })}
      />
      <MyBreadcrumbs breadcrumbs={[{ href: "/offers", label: title }]} />
      <OffersPageView />
    </>
  );
};

export const getServerSideProps: GetServerSideProps<Props> | undefined = isSSR()
  ? async (context) => {
      try {
        await loadTranslations(context);
        const access_token = (await getAccessTokenFromContext(context)) || "";
        const settings = await getSettings({ access_token });
        return { props: { initialSettings: settings.data ?? null } };
      } catch {
        return { props: { initialSettings: null } };
      }
    }
  : undefined;

export default OffersPage;
