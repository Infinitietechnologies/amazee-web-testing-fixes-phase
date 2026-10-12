import { FC, useState } from "react";
import { addToast } from "@heroui/react";
import { Gift, Lock, CheckCircle2, Circle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { chooseRewardGift } from "@/routes/api";
import { updateCartData } from "@/helpers/updators";
import { RewardGiftsBlock } from "@/types/ApiResponse";

/**
 * [2026-10-07] Checkout "Free Gift" section — Milestone Reward Points.
 *
 * Every configured gift is listed with the points it needs; one the customer
 * can afford (and that is in stock) can be selected — one per order; the
 * others show how many points are missing. The chosen gift becomes a ₹0 line
 * of the order and the points are deducted when it is placed (the server
 * re-checks everything then).
 */
const RewardGiftCard: FC<{
  block: RewardGiftsBlock;
  addressId?: number | null;
}> = ({ block, addressId }) => {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);

  if (!block.gifts?.length) return null;

  const onChoose = async (giftId: number | null) => {
    if (saving) return;
    setSaving(true);
    const res = await chooseRewardGift({
      reward_gift_product_id: giftId,
      address_id: addressId ?? undefined,
    });
    if (!res?.success) {
      addToast({
        title: t("reward_gift.choose_failed", "That gift is not available"),
        description: res?.message,
        color: "danger",
      });
    }
    updateCartData(true, false);
    setSaving(false);
  };

  return (
    <div
      className="w-full rounded-lg border border-amber-300 bg-amber-50/70 dark:bg-amber-900/20 p-3 space-y-2"
      data-testid="reward-gift-card"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-200">
          <Gift className="w-4 h-4" />
          <span>{t("reward_gift.title", "Free Gift")}</span>
        </div>
        <span className="text-xs font-semibold text-amber-800 dark:text-amber-200">
          {t("reward_gift.points", { count: block.available_points, defaultValue: "{{count}} pts" })}
        </span>
      </div>
      <p className="text-xs text-foreground/80">
        {t("reward_gift.hint", "Use your Milestone Reward Points for one free gift with this order.")}
      </p>
      <ul className="space-y-1">
        {block.gifts.map((gift) => {
          const selected = gift.reward_gift_product_id === block.selected_reward_gift_product_id;
          const trailing = gift.eligible
            ? selected
              ? t("reward_gift.added", "ADDED · FREE")
              : t("reward_gift.free", "FREE")
            : gift.reason === "points"
              ? t("reward_gift.need_more", { count: gift.points_short, defaultValue: "Need {{count}} more pts" })
              : gift.reason === "limit"
                ? t("reward_gift.limit", "Fully redeemed")
                : t("reward_gift.out_of_stock", "Out of stock");
          return (
            <li key={gift.reward_gift_product_id}>
              <button
                type="button"
                disabled={saving || !gift.eligible}
                onClick={() => onChoose(selected ? null : gift.reward_gift_product_id)}
                className={`w-full flex items-center gap-2 rounded-md px-1 py-1.5 text-left ${
                  gift.eligible ? "hover:bg-amber-100/60 dark:hover:bg-amber-900/30" : "opacity-60 cursor-not-allowed"
                }`}
                data-testid={`reward-gift-${gift.reward_gift_product_id}`}
              >
                {!gift.eligible ? (
                  <Lock className="w-4 h-4 text-foreground/50 shrink-0" />
                ) : selected ? (
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-primary shrink-0" />
                )}
                {gift.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={gift.image} alt="" className="w-9 h-9 rounded object-cover shrink-0" />
                ) : null}
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium truncate">{gift.title}</span>
                  <span className="block text-xxs sm:text-xs text-foreground/60">
                    {t("reward_gift.required", { count: gift.required_points, defaultValue: "{{count}} points" })}
                    {gift.store_name ? ` · ${gift.store_name}` : ""}
                  </span>
                </span>
                <span className={`text-xs font-semibold shrink-0 ${gift.eligible ? "text-success-600" : "text-foreground/60"}`}>
                  {trailing}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default RewardGiftCard;
