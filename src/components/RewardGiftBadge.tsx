import { FC } from "react";

/** [2026-10-07] "🎁 FREE GIFT" / "🎁 MILESTONE REWARD" tag on a ₹0 reward gift line. */
const RewardGiftBadge: FC<{ label?: string | null; className?: string }> = ({ label, className = "" }) => (
  <span
    className={`inline-flex items-center rounded border border-amber-400 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide text-amber-800 dark:text-amber-200 ${className}`}
    data-testid="reward-gift-badge"
  >
    {(label || "").trim() || "🎁 FREE GIFT"}
  </span>
);

export default RewardGiftBadge;
