import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * [2026-09-23] Pay Online must actually take the customer to pay.
 *
 * For pay-AFTER-order gateways the server creates the order PENDING and returns
 * the provider's hosted page as `payment_response.link`. Only Flutterwave used
 * to be followed, so a Xendit or Cashfree order was "confirmed" with a success
 * toast and the customer was never sent to pay — which meant switching the Pay
 * Online gateway to either of them in Payment Settings produced unpayable
 * orders.
 */

const createOrder = vi.fn();
const addToast = vi.fn();

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
  store: {
    getState: () => ({
      checkout: {
        selectedAddress: { id: 7 },
        orderNote: "",
        useWallet: false,
        rushDelivery: false,
        promoCode: "",
      },
    }),
    dispatch: vi.fn(),
  },
}));

vi.mock("@heroui/react", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  addToast: (...args: unknown[]) => addToast(...args),
}));

vi.mock("@/lib/analytics", () => ({ trackPurchase: vi.fn() }));
vi.mock("@/helpers/updators", () => ({ updateCartData: vi.fn() }));

import {
  REDIRECT_GATEWAYS,
  handleCheckout,
  isRedirectGateway,
} from "@/helpers/functionalHelpers";

const orderResponse = (link: string) => ({
  success: true,
  message: "ok",
  data: { id: "AMWC1000000001", final_total: 250, payment_response: { link } },
});

describe("Pay Online redirect gateways", () => {
  let location: { href: string; origin: string };

  beforeEach(() => {
    createOrder.mockReset();
    addToast.mockReset();
    location = { href: "http://localhost/cart", origin: "http://localhost" };
    Object.defineProperty(window, "location", { value: location, writable: true });
  });

  it("names every pay-after-order gateway", () => {
    expect([...REDIRECT_GATEWAYS].sort()).toEqual(
      ["cashfreePayment", "flutterwavePayment", "xenditPayment"],
    );
    expect(isRedirectGateway("razorpayPayment")).toBe(false);
    expect(isRedirectGateway("cod")).toBe(false);
  });

  it.each(["cashfreePayment", "xenditPayment", "flutterwavePayment"])(
    "sends the customer to the provider page for %s",
    async (gateway) => {
      createOrder.mockResolvedValue(orderResponse("https://pay.example.test/session/abc"));

      const res = await handleCheckout(gateway, {});

      expect(location.href).toBe("https://pay.example.test/session/abc");
      expect(res).toEqual({ success: true, data: null, message: "Redirected" });
    },
  );

  it("refuses to show success when a redirect gateway returns no usable link", async () => {
    createOrder.mockResolvedValue(orderResponse(""));

    await handleCheckout("cashfreePayment", {});

    expect(location.href).toBe("http://localhost/cart");
    expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ color: "danger" }));
  });

  it("does not redirect for an inline gateway", async () => {
    createOrder.mockResolvedValue(orderResponse("https://should-not-follow.test/"));

    await handleCheckout("razorpayPayment", {});

    expect(location.href).toBe("http://localhost/cart");
  });
});
