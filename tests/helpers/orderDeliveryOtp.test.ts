import { describe, it, expect } from "vitest";
import { getItemOtps, getOrderDeliveryOtp } from "@/helpers/orderOtp";
import { Order, OrderItem } from "@/types/ApiResponse";

/**
 * [2026-10-06] Audit 2.9 — owner decision 5: one delivery OTP per order.
 * Every item that needs an OTP carries the order's code; the order shows it
 * once and the items do not repeat it.
 */
const item = (over: Partial<OrderItem> = {}): OrderItem =>
  ({ id: 1, otp: null, otp_verified: 0, returns: [], ...over }) as OrderItem;

const order = (over: Partial<Order> = {}): Order =>
  ({ id: "AMWC0000000001", items: [], ...over }) as unknown as Order;

describe("getOrderDeliveryOtp", () => {
  it("returns the order's code while an item carrying it waits for delivery", () => {
    const o = order({
      delivery_otp: "424242",
      items: [item({ id: 1, otp: "424242" }), item({ id: 2, otp: "424242" })],
    });
    expect(getOrderDeliveryOtp(o)).toBe("424242");
  });

  it("is gone once every item with it is verified (the code is spent)", () => {
    const o = order({
      delivery_otp: "424242",
      items: [
        item({ id: 1, otp: "424242", otp_verified: 1 }),
        item({ id: 2, otp: "424242", otp_verified: 1 }),
      ],
    });
    expect(getOrderDeliveryOtp(o)).toBeNull();
  });

  it("is null for an order without a code (older orders, no OTP products)", () => {
    expect(getOrderDeliveryOtp(order({ items: [item({ otp: "111111" })] }))).toBeNull();
    expect(getOrderDeliveryOtp(undefined)).toBeNull();
  });
});

describe("getItemOtps with an order code", () => {
  it("does not repeat the order's code on each item", () => {
    expect(getItemOtps(item({ otp: "424242" }), "424242").deliveryOtp).toBeNull();
  });

  it("still shows an item's own (older, per-item) code", () => {
    expect(getItemOtps(item({ otp: "111111" }), "424242").deliveryOtp).toBe("111111");
    expect(getItemOtps(item({ otp: "111111" })).deliveryOtp).toBe("111111");
  });
});
