import { FC } from "react";
import Link from "next/link";
import useSWR from "swr";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { ChevronRight, Gift } from "lucide-react";

import { getRewardsProgress } from "@/routes/api";
import { RewardsProgressData } from "@/types/ApiResponse";
import { RootState } from "@/lib/redux/store";

/**
 * [2026-10-07] "AmazeeNow Rewards" card on the homepage.
 *
 * "Complete your orders and get a Surprise Gift", the progress ladder,
 * "X / N Orders Completed", "P% Completed" and "Complete R more orders to
 * unlock" — from GET /user/rewards/progress, so the numbers move with every
 * delivered order. Nothing for guests or when no customer campaign is active.
 */
const fetchProgress = async (): Promise<RewardsProgressData | null> => {
  const res = await getRewardsProgress();
  return res.success && res.data && res.data.campaign_id ? res.data : null;
};

const HomeRewardsProgress: FC = () => {
  const { t } = useTranslation();
  const isLoggedIn = useSelector((state: RootState) => state.auth.isLoggedIn);
  const { data } = useSWR(isLoggedIn ? "/user/rewards/progress" : null, fetchProgress, {
    revalidateOnFocus: false,
  });
  if (!data) return null;

  const done = Number(data.eligible_order_count || 0);
  const target = Number(data.next_required_order_count || 0);
  const remaining = Number(data.remaining_orders ?? (target > done ? target - done : 0));
  const percent = Math.max(0, Math.min(100, Number(data.progress_percentage ?? (target > 0 ? (done * 100) / target : 0))));
  const steps = target <= 0 ? 10 : Math.min(10, target);
  const filled = target <= 0 ? 0 : Math.min(steps, Math.floor((done * steps) / target));

  return (
    <section className="w-full px-4 sm:px-0 my-4" data-testid="rewards-progress-card">
      <Link
        href="/my-account/rewards"
        className="block rounded-2xl border border-amber-300 bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/20 p-4 hover:shadow-md transition-shadow"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-white/70 dark:bg-black/20">
            <Gift className="w-5 h-5 text-amber-700 dark:text-amber-200" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-extrabold text-amber-900 dark:text-amber-100 text-base">{t("rewards_home.title")}</h3>
            <p className="text-xs text-amber-800 dark:text-amber-200">{t("rewards_home.subtitle")}</p>
          </div>
          <ChevronRight className="w-5 h-5 text-amber-800 dark:text-amber-200" />
        </div>
        <p className="mt-3 text-[10px] font-bold tracking-widest text-amber-800 dark:text-amber-200">{t("rewards_home.your_progress")}</p>
        <div className="mt-2 flex items-center">
          {Array.from({ length: steps * 2 - 1 }).map((_, i) => {
            if (i % 2 === 1) {
              const reached = Math.floor(i / 2) < filled;
              return <div key={i} className={`flex-1 h-[3px] ${reached ? "bg-orange-500" : "bg-orange-200"}`} />;
            }
            const idx = i / 2;
            const reached = idx < filled;
            const last = idx === steps - 1;
            return (
              <div
                key={i}
                className={`rounded-full border-2 border-orange-500 flex items-center justify-center ${last ? "w-5 h-5 text-[10px]" : "w-3 h-3"} ${
                  reached ? "bg-orange-500" : "bg-white"
                }`}
              >
                {last ? "🎁" : null}
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-sm font-bold text-foreground">
            {t("rewards_home.orders_completed", { done, target: target || done })}
          </span>
          <span className="text-xs font-bold text-success-600">{t("rewards_home.percent_completed", { percent: Math.round(percent) })}</span>
        </div>
        {remaining > 0 && (
          <p className="mt-1 text-xs text-foreground/60">
            {remaining === 1 ? t("rewards_home.more_to_unlock_one") : t("rewards_home.more_to_unlock", { count: remaining })}
            {data.reward_name ? ` ${data.reward_name}` : ""}
          </p>
        )}
      </Link>
    </section>
  );
};

export default HomeRewardsProgress;
