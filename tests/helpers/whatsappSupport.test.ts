import { describe, expect, it } from "vitest";
import { getWhatsAppSupportLink } from "@/helpers/whatsappSupport";

// [2026-10-06] Audit 6.2: the footer's "Chat on WhatsApp" link.
describe("getWhatsAppSupportLink", () => {
  it("builds a wa.me link with the pre-filled message", () => {
    const settings = [{ variable: "whatsapp", value: { supportNumber: "+91 98765 43210", supportMessage: "Hi AmazeeNow" } }];
    expect(getWhatsAppSupportLink(settings)).toBe("https://wa.me/919876543210?text=Hi%20AmazeeNow");
  });

  it("is null without a number (or settings)", () => {
    expect(getWhatsAppSupportLink([{ variable: "whatsapp", value: { supportNumber: "" } }])).toBeNull();
    expect(getWhatsAppSupportLink(null)).toBeNull();
  });
});
