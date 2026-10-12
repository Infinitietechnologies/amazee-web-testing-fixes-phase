import { describe, it, expect } from "vitest";
import { codUnavailableReason } from "@/helpers/codAvailability";

// 59.3 (owner decision 10): the website shows COD the way checkout will treat it.
const fallbacks = { address: "COD not available here", scheduled: "Scheduled = online only" };

describe("codUnavailableReason", () => {
  it("allows COD when the server allows it and scheduled COD is on", () => {
    const cart = { is_cod_available: true, cod_rules: { scheduled_cod_allowed: true } };
    expect(codUnavailableReason(cart, false, fallbacks)).toBeNull();
    expect(codUnavailableReason(cart, true, fallbacks)).toBeNull();
  });

  it("keeps scheduled orders online-only while the admin switch is off", () => {
    const cart = {
      is_cod_available: true,
      cod_rules: { scheduled_cod_allowed: false, scheduled_cod_message: "Pay online for scheduled orders." },
    };
    expect(codUnavailableReason(cart, false, fallbacks)).toBeNull();
    expect(codUnavailableReason(cart, true, fallbacks)).toBe("Pay online for scheduled orders.");
  });

  it("uses the server's message when COD is off for the address (out of zone, zone switch, risk)", () => {
    const cart = {
      is_cod_available: false,
      cod_block_message: "Cash on Delivery is not available in your delivery zone.",
      cod_rules: { scheduled_cod_allowed: true },
    };
    expect(codUnavailableReason(cart, false, fallbacks)).toBe("Cash on Delivery is not available in your delivery zone.");
  });

  it("treats a server without cod_rules as before: no COD for scheduled orders", () => {
    expect(codUnavailableReason({}, false, fallbacks)).toBeNull();
    expect(codUnavailableReason({}, true, fallbacks)).toBe(fallbacks.scheduled);
    expect(codUnavailableReason(null, true, fallbacks)).toBe(fallbacks.scheduled);
  });
});
