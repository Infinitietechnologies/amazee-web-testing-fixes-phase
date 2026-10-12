import { Order, OrderItem } from "@/types/ApiResponse";

export type ItemOtps = {
  /** Handed to the courier when this item is delivered. */
  deliveryOtp: string | null;
  /** Handed to the agent when this returned item is collected. */
  returnPickupOtp: string | null;
};

/**
 * Resolve the OTPs that belong to a single ORDER ITEM.
 *
 * Both codes are per-item, not per-product: an order with three items yields
 * three independent delivery OTPs, and each return request carries its own
 * pickup OTP keyed by order_item_id.
 *
 * A verified OTP is spent, so it is not returned — showing it would only
 * invite the customer to read out a code the agent can no longer use.
 */
export const getItemOtps = (
  item?: OrderItem | null,
  orderDeliveryOtp?: string | null,
): ItemOtps => {
  // [2026-10-06] Audit 2.9: an item carrying the ORDER's code is not shown
  // per item — the order shows it once (getOrderDeliveryOtp).
  const deliveryOtp =
    item?.otp && !item.otp_verified && item.otp !== orderDeliveryOtp
      ? item.otp
      : null;

  // Newest unverified return wins: an item can be returned more than once
  // (e.g. a rejected request followed by a fresh one).
  const activeReturn = (item?.returns ?? [])
    .filter((request) => request?.pickup_otp && !request.pickup_otp_verified)
    .sort((a, b) => (b?.id ?? 0) - (a?.id ?? 0))[0];

  return {
    deliveryOtp,
    returnPickupOtp: activeReturn?.pickup_otp ?? null,
  };
};

/**
 * [2026-10-06] Audit 2.9 — owner decision 5: ONE delivery OTP per order.
 * The code the customer gives the rider for the whole order, while any item
 * that carries it is still waiting for delivery; null otherwise (orders from
 * before keep their per-item codes, shown on each item).
 */
export const getOrderDeliveryOtp = (order?: Order | null): string | null => {
  const code = order?.delivery_otp ?? null;
  if (!code) return null;
  const waiting = (order?.items ?? []).some(
    (item) => item?.otp === code && !item.otp_verified,
  );
  return waiting ? code : null;
};
