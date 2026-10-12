import { FC } from "react";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { Card, CardBody } from "@heroui/react";
import { Truck } from "lucide-react";

import { RootState } from "@/lib/redux/store";

/**
 * [2026-09-28] Shown on the cart page when the customer's location is outside
 * every Live zone and the order will be delivered through the hub network.
 * Says the promise in days and, when COD is off for such orders, that only
 * online payment is available. Renders nothing for an in-zone cart.
 */
const OutOfZoneNotice: FC = () => {
  const { t } = useTranslation();
  const cart = useSelector((state: RootState) => state.cart.cartData);
  const zone = cart?.delivery_zone;
  if (!zone?.out_of_zone) return null;
  const days = zone.promise_days ?? 0;
  // [2026-10-06] Audit 17.1: the date the server promises (zone / distance based).
  const date = zone.estimated_delivery_date
    ? new Date(`${zone.estimated_delivery_date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })
    : null;

  return (
    <Card className="w-full border border-warning-300 bg-warning-50" radius="md" shadow="none" data-testid="out-of-zone-notice">
      <CardBody className="flex flex-row gap-3 items-start py-3">
        <Truck className="w-5 h-5 text-warning-600 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="text-sm">
          <p className="font-semibold text-warning-700">
            {t("cart.outOfZoneTitle", { defaultValue: "Delivered through our logistics network" })}
          </p>
          {date && (
            <p className="font-medium text-gray-800" data-testid="out-of-zone-date">
              {t("cart.outOfZoneEstimatedDate", { date, defaultValue: "Estimated delivery: {{date}}" })}
            </p>
          )}
          <p className="text-gray-700">
            {t("cart.outOfZoneDescription", {
              days,
              defaultValue: "Your location is outside our delivery zones. Orders are delivered in about {{days}} day(s); express and scheduled slots are not available.",
            })}
            {!zone.cod_enabled && (
              <> {t("cart.outOfZoneNoCod", { defaultValue: "Cash on delivery is not available for these orders." })}</>
            )}
          </p>
        </div>
      </CardBody>
    </Card>
  );
};

export default OutOfZoneNotice;
