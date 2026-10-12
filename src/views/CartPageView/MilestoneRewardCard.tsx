import { FC, useState } from "react";
import { Radio, RadioGroup, addToast } from "@heroui/react";
import { Gift } from "lucide-react";
import { useTranslation } from "react-i18next";
import { chooseMilestoneReward } from "@/routes/api";
import { updateCartData } from "@/helpers/updators";
import { MilestoneRewardBlock } from "@/types/ApiResponse";

/**
 * [2026-10-06] Audits 3.3 / 3.5 — PDF §3.6, owner decisions 6 and 7: before
 * payment, "Congratulations! Your milestone reward will be delivered with
 * this order", and the customer chooses one of the gifts available for this
 * order's delivery zone. The server re-checks the choice and its stock when
 * the order is placed; the gift is added free and delivered with the order.
 */
const MilestoneRewardCard: FC<{
  block: MilestoneRewardBlock;
  addressId?: number | null;
}> = ({ block, addressId }) => {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);

  const onChoose = async (value: string) => {
    const configId = Number(value);
    if (!configId || configId === block.selected_gift_product_config_id) return;
    setSaving(true);
    const res = await chooseMilestoneReward({
      gift_product_config_id: configId,
      address_id: addressId ?? undefined,
    });
    if (!res?.success) {
      addToast({
        title: t("milestone_reward.choose_failed"),
        description: res?.message,
        color: "danger",
      });
    }
    updateCartData(true, false);
    setSaving(false);
  };

  return (
    <div
      className="w-full rounded-lg border border-primary-300 bg-primary-50/60 dark:bg-primary-900/20 p-3 space-y-2"
      data-testid="milestone-reward-card"
    >
      <div className="flex items-center gap-2 font-semibold text-primary">
        <Gift className="w-4 h-4" />
        <span>{block.title}</span>
      </div>
      <p className="text-xs text-foreground/80">{block.message}</p>
      {block.options.length > 0 && (
        <RadioGroup
          size="sm"
          aria-label={t("milestone_reward.choose_label")}
          value={String(block.selected_gift_product_config_id ?? "")}
          onValueChange={onChoose}
          isDisabled={saving}
        >
          {block.options.map((option) => (
            <Radio
              key={option.gift_product_config_id}
              value={String(option.gift_product_config_id)}
              description={option.store_name}
            >
              <span className="text-sm">
                {option.title}{" "}
                <span className="text-success-600 font-semibold">
                  {t("milestone_reward.free")}
                </span>
              </span>
            </Radio>
          ))}
        </RadioGroup>
      )}
    </div>
  );
};

export default MilestoneRewardCard;
