import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * [2026-09-23 final approval, item 12] What a web checkout sends.
 *
 * `delivery_type` is REQUIRED by the server and was never sent, so the web
 * checkout could not place an order at all; the booked window (date / slot)
 * was never sent either, so a scheduled choice silently became an immediate
 * order. handleCheckout now sends both, decided by resolveDeliveryParams.
 */

const createOrder = vi.fn();
const checkoutState = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock("@/routes/api", () => ({
  addToCart: vi.fn(),
  checkDeliveryZone: vi.fn(),
  createOrder: (...args: unknown[]) => createOrder(...args),
  getActiveMemberships: vi.fn(),
  getProductBySlug: vi.fn(),
  getUserData: vi.fn(),
  updateCartItem: vi.fn(),
}));

vi.mock("@/lib/redux/store", () => ({
  store: { getState: () => ({ checkout: checkoutState.current }), dispatch: vi.fn() },
}));

vi.mock("@heroui/react", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  addToast: vi.fn(),
}));
vi.mock("@/lib/analytics", () => ({ trackPurchase: vi.fn() }));
vi.mock("@/helpers/updators", () => ({ updateCartData: vi.fn() }));

import { handleCheckout } from "@/helpers/functionalHelpers";

const sent = (): FormData => createOrder.mock.calls.at(-1)?.[0] as FormData;

beforeEach(() => {
  createOrder.mockReset();
  createOrder.mockResolvedValue({ success: false, message: "stop", data: null });
});

describe("handleCheckout — delivery parameters", () => {
  it("always sends delivery_type=delivery (the server requires it)", async () => {
    checkoutState.current = { selectedAddress: { id: 3 }, rushDelivery: false, scheduledDelivery: null };
    await handleCheckout("razorpayPayment", {});
    expect(sent().get("delivery_type")).toBe("delivery");
    expect(sent().get("scheduled_date")).toBeNull();
    expect(sent().get("rush_delivery")).toBe("0");
  });

  it("sends the booked date and slot id for a scheduled order, and switches rush off", async () => {
    checkoutState.current = {
      selectedAddress: { id: 3 },
      rushDelivery: true,
      scheduledDelivery: { date: "2026-09-24", slotDbId: 12, slotId: "x", label: "10–12", startHour: 10, endHour: 12 },
    };
    await handleCheckout("cashfreePayment", {});
    expect(sent().get("scheduled_date")).toBe("2026-09-24");
    expect(sent().get("delivery_time_slot_id")).toBe("12");
    expect(sent().get("rush_delivery")).toBe("0");
  });

  it("sends slot times when the window is identified by time", async () => {
    checkoutState.current = {
      selectedAddress: { id: 3 },
      scheduledDelivery: { date: "2026-09-25", slotStartTime: "14:00:00", slotEndTime: "16:00:00", slotId: "y", label: "2–4", startHour: 14, endHour: 16 },
    };
    await handleCheckout("stripePayment", {});
    expect(sent().get("scheduled_slot_start_time")).toBe("14:00:00");
    expect(sent().get("scheduled_slot_end_time")).toBe("16:00:00");
    expect(sent().get("delivery_time_slot_id")).toBeNull();
  });
});
