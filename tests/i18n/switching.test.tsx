import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { useTranslation } from "react-i18next";
import i18n, { changeLanguage } from "../../i18n";

/**
 * [CHANGE 2026-09-22] Language switching, rendered.
 *
 * The data tests next door prove the locale files are well formed. This proves
 * the thing a customer actually experiences: pick Tamil, and Tamil appears —
 * and pick a language whose file does not cover a key, and English appears
 * rather than a blank or a raw key name. The fallback is the half that is easy
 * to get wrong and impossible to see in a JSON diff.
 */

function Sample() {
  const { t } = useTranslation();
  return (
    <div>
      <span data-testid="cart">{t("pageTitle.cart")}</span>
      <span data-testid="orders">{t("pageTitle.orders")}</span>
      {/* Deliberately a key the new locales do NOT translate. */}
      <span data-testid="untranslated">{t("about_us")}</span>
    </div>
  );
}

describe("language switching", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("renders English by default", () => {
    render(<Sample />);
    expect(screen.getByTestId("cart")).toHaveTextContent("Cart");
  });

  it.each([
    ["ta", "கார்ட்", "ஆர்டர்கள்"],
    ["te", "కార్ట్", "ఆర్డర్లు"],
    ["kn", "ಕಾರ್ಟ್", "ಆರ್ಡರ್‌ಗಳು"],
    ["ml", "കാർട്ട്", "ഓർഡറുകൾ"],
  ])("renders %s when selected", async (code, cart, orders) => {
    await i18n.changeLanguage(code);
    render(<Sample />);

    expect(screen.getByTestId("cart")).toHaveTextContent(cart);
    expect(screen.getByTestId("orders")).toHaveTextContent(orders);
  });

  it.each(["ta", "te", "kn", "ml"])(
    "falls back to English for a key %s does not translate",
    async (code) => {
      await i18n.changeLanguage(code);
      render(<Sample />);

      const value = screen.getByTestId("untranslated").textContent ?? "";

      // The failure this guards against is not a wrong translation — it is the
      // key name itself leaking onto the page, which is what an i18n library
      // renders when a key is missing and no fallback is configured.
      expect(value).not.toBe("about_us");
      expect(value.length).toBeGreaterThan(0);
      expect(value).toBe(i18n.getFixedT("en")("about_us"));
    },
  );

  it("sets the document direction and lang when switching", () => {
    changeLanguage("ta");
    expect(document.documentElement.getAttribute("dir")).toBe("ltr");
    expect(document.documentElement.getAttribute("lang")).toBe("ta");

    changeLanguage("ar");
    expect(document.documentElement.getAttribute("dir")).toBe("rtl");

    changeLanguage("ml");
    expect(document.documentElement.getAttribute("dir")).toBe("ltr");
  });
});
