import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * "Pay Online" is ONE entry, and the server decides what is behind it.
 *
 * The checkout used to list every gateway — Stripe, Razorpay, Paystack,
 * Flutterwave, Xendit — and ask the customer to pick one. That put the choice
 * of payment provider in the client, so switching provider meant releasing four
 * clients, and it asked the customer a question that was never theirs.
 *
 * The shape below is the requirement: Pay Online, and Cash on Delivery. Which
 * provider Pay Online uses comes from `resolvedOnlineGateway`, resolved on the
 * server from the administrator's configuration, and a gateway that resolves to
 * nothing must not be offered at all — a payment option that cannot take a
 * payment is worse than one fewer option.
 */

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
      i18n: { language: "en", resolvedLanguage: "en" },
    }),
  };
});

vi.mock("react-redux", () => ({ useSelector: () => 0 }));

const settings = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock("@/contexts/SettingsContext", () => ({
  useSettings: () => ({ paymentSettings: settings.current, currencySymbol: "₹" }),
}));

import PaymentMethods from "@/components/PaymentMethods";

function renderWith(paymentSettings: Record<string, unknown>, hideCOD = false) {
  settings.current = paymentSettings;
  return render(
    <PaymentMethods
      selectedPayment=""
      setSelectedPayment={() => {}}
      hideCOD={hideCOD}
      isLoading={false}
    />,
  );
}

describe("PaymentMethods", () => {
  it("offers Pay Online and Cash on Delivery, and nothing gateway-specific", () => {
    renderWith({
      cod: true,
      razorpayPayment: true,
      stripePayment: true,
      resolvedOnlineGateway: "razorpayPayment",
    });

    expect(screen.getByText("payments.online.name")).toBeTruthy();
    expect(screen.getByText("payments.cod.name")).toBeTruthy();

    // The customer is never shown the provider as a CHOICE, even with two
    // gateways switched on.
    expect(screen.queryByText("payments.razorpay.name")).toBeNull();
    expect(screen.queryByText("payments.stripe.name")).toBeNull();
  });

  it("carries the resolved gateway as the option's value, so the right SDK is mounted", () => {
    const { container } = renderWith({
      cod: false,
      stripePayment: true,
      resolvedOnlineGateway: "stripePayment",
    });

    const values = [...container.querySelectorAll("input[type=radio]")].map(
      (el) => (el as HTMLInputElement).value,
    );

    expect(values).toContain("stripePayment");
  });

  it("does not offer Pay Online when nothing resolved", () => {
    // Two gateways enabled and no preference: the server refuses to guess
    // which one takes the money, so the client must not offer the option.
    renderWith({
      cod: true,
      razorpayPayment: true,
      stripePayment: true,
      resolvedOnlineGateway: "",
    });

    expect(screen.queryByText("payments.online.name")).toBeNull();
    expect(screen.getByText("payments.cod.name")).toBeTruthy();
  });

  it("treats Cashfree as an ordinary resolution, not a special case", () => {
    const { container } = renderWith({
      cod: false,
      cashfreePayment: true,
      resolvedOnlineGateway: "cashfreePayment",
    });

    const values = [...container.querySelectorAll("input[type=radio]")].map(
      (el) => (el as HTMLInputElement).value,
    );

    expect(values).toEqual(["cashfreePayment"]);
  });

  it("still honours hideCOD", () => {
    renderWith({ cod: true, razorpayPayment: true, resolvedOnlineGateway: "razorpayPayment" }, true);

    expect(screen.queryByText("payments.cod.name")).toBeNull();
    expect(screen.getByText("payments.online.name")).toBeTruthy();
  });
});
