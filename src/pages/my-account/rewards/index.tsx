import MyBreadcrumbs from "@/components/custom/MyBreadcrumbs";
import PageHeader from "@/components/custom/PageHeader";
import { getAccessTokenFromContext } from "@/helpers/auth";
import { isSSR } from "@/helpers/getters";
import UserLayout from "@/layouts/UserLayout";
import { getRewardPoints, getRewardsProgress, getSettings } from "@/routes/api";
import { RewardPointsSummary, RewardsProgressData } from "@/types/ApiResponse";
import { GetServerSideProps } from "next";
import useSWR from "swr";
import { NextPageWithLayout } from "@/types";
import { loadTranslations } from "../../../../i18n";
import PageHead from "@/SEO/PageHead";
import { useTranslation } from "react-i18next";
import { Gift, Trophy, Undo2 } from "lucide-react";

/**
 * [2026-10-07] My Rewards: the "AmazeeNow Rewards" progress (continuous order
 * counter towards the next milestone) and Gift Points — the Milestone Reward
 * Points balance (available / used / earned) with its ledger. Kept apart from
 * the cash wallet and from loyalty points.
 */
type RewardsPageProps = {
  initialPoints: RewardPointsSummary | null;
  initialProgress: RewardsProgressData | null;
};

const RewardsPage: NextPageWithLayout<RewardsPageProps> = ({ initialPoints = null, initialProgress = null }) => {
  const { t } = useTranslation();

  const { data: pointsRes } = useSWR("/user/reward-points", () => getRewardPoints(), {
    fallbackData: initialPoints ? { success: true, message: "", data: initialPoints } : undefined,
    revalidateOnFocus: false,
    revalidateOnMount: !isSSR(),
  });
  const { data: progressRes } = useSWR("/user/rewards/progress", () => getRewardsProgress(), {
    fallbackData: initialProgress ? { success: true, message: "", data: initialProgress } : undefined,
    revalidateOnFocus: false,
    revalidateOnMount: !isSSR(),
  });

  const points = pointsRes?.success ? (pointsRes.data ?? null) : null;
  const progress = progressRes?.success && progressRes.data?.campaign_id ? progressRes.data : null;

  const done = Number(progress?.eligible_order_count || 0);
  const target = Number(progress?.next_required_order_count || 0);
  const remaining = Number(progress?.remaining_orders ?? (target > done ? target - done : 0));
  const percent = Math.max(0, Math.min(100, Number(progress?.progress_percentage ?? (target > 0 ? (done * 100) / target : 0))));

  return (
    <>
      <MyBreadcrumbs breadcrumbs={[{ href: "/my-account/rewards", label: t("rewards_home.title") }]} />
      <PageHead pageTitle={t("rewards_home.title")} noindex />

      <UserLayout activeTab="rewards">
        <div className="w-full">
          <PageHeader title={t("rewards_home.title")} subtitle={t("rewards_home.subtitle")} />

          <div className="w-full flex flex-col gap-4">
            {progress && (
              <div className="rounded-2xl border border-amber-300 bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/20 p-4" data-testid="rewards-progress">
                <p className="text-[10px] font-bold tracking-widest text-amber-800 dark:text-amber-200">{t("rewards_home.your_progress")}</p>
                <div className="mt-2 h-2 w-full rounded-full bg-orange-200 overflow-hidden">
                  <div className="h-2 bg-orange-500" style={{ width: `${percent}%` }} />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-bold">{t("rewards_home.orders_completed", { done, target: target || done })}</span>
                  <span className="text-xs font-bold text-success-600">{t("rewards_home.percent_completed", { percent: Math.round(percent) })}</span>
                </div>
                {remaining > 0 && (
                  <p className="mt-1 text-xs text-foreground/60">
                    {remaining === 1 ? t("rewards_home.more_to_unlock_one") : t("rewards_home.more_to_unlock", { count: remaining })}
                    {progress.reward_name ? ` ${progress.reward_name}` : ""}
                  </p>
                )}
              </div>
            )}

            <div className="rounded-2xl bg-gradient-to-r from-orange-400 to-amber-300 p-5 text-white" data-testid="gift-points-card">
              <div className="flex items-center gap-2 font-semibold">
                <Gift className="w-5 h-5" />
                <span>{t("gift_points.title")}</span>
              </div>
              <div className="mt-2 text-4xl font-extrabold">{points?.available_points ?? 0}</div>
              <p className="text-xs opacity-95">{t("gift_points.subtitle")}</p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                [t("gift_points.earned"), points?.earned_points ?? 0],
                [t("gift_points.used"), points?.used_points ?? 0],
                [t("gift_points.remaining"), points?.available_points ?? 0],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl bg-content2 p-3 text-center">
                  <div className="text-lg font-extrabold">{value}</div>
                  <div className="text-xs text-foreground/60">{label}</div>
                </div>
              ))}
            </div>

            <div>
              <h3 className="font-semibold mb-2">{t("gift_points.history")}</h3>
              {!points?.transactions?.length ? (
                <div className="w-full rounded-medium bg-content2 text-foreground/70 text-sm p-6 text-center">{t("gift_points.empty")}</div>
              ) : (
                <ul className="divide-y divide-default-200">
                  {points.transactions.map((row) => {
                    const positive = row.points >= 0;
                    const Icon = row.type === "spent" ? Gift : row.type === "reversed" ? Undo2 : Trophy;
                    return (
                      <li key={row.id} className="flex items-center gap-3 py-2">
                        <div className={`p-2 rounded-full ${positive ? "bg-success-100 text-success-700" : "bg-warning-100 text-warning-700"}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{row.note || row.type}</div>
                          <div className="text-xs text-foreground/60">
                            {[row.order_id ? t("gift_points.order", { id: row.order_id }) : "", row.at || ""].filter(Boolean).join(" · ")}
                          </div>
                        </div>
                        <div className={`text-sm font-bold ${positive ? "text-success-600" : "text-warning-600"}`}>
                          {positive ? "+" : ""}
                          {row.points}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </UserLayout>
    </>
  );
};

export const getServerSideProps: GetServerSideProps | undefined = isSSR()
  ? async (context) => {
      try {
        const access_token = (await getAccessTokenFromContext(context)) || "";
        if (!access_token) {
          return { redirect: { destination: "/", permanent: false } };
        }
        await loadTranslations(context);
        const [pointsRes, progressRes, settings] = await Promise.all([
          getRewardPoints(access_token),
          getRewardsProgress(access_token),
          getSettings(),
        ]);

        return {
          props: {
            initialPoints: pointsRes.success ? (pointsRes.data ?? null) : null,
            initialProgress: progressRes.success ? (progressRes.data ?? null) : null,
            initialSettings: settings.data,
          },
        };
      } catch (error) {
        console.error("Error fetching rewards:", error);

        return { props: { initialPoints: null, initialProgress: null, initialSettings: null } };
      }
    }
  : undefined;

export default RewardsPage;
