import { FC } from "react";
import { useRouter } from "next/router";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { ChevronRight, ShoppingBag } from "lucide-react";

import { RootState } from "@/lib/redux/store";
import { useSettings } from "@/contexts/SettingsContext";
import { formatAmount } from "@/helpers/functionalHelpers";

/**
 * [2026-09-28] Sticky "View cart" bar on phones.
 *
 * Shown on browsing pages (home, categories, brands, stores, sections,
 * search, shopping list) when the signed-in customer's cart has items, so the
 * cart is one tap away without scrolling back up. Hidden on the cart and
 * account pages, product pages (they have their own add-to-cart controls),
 * Watch & Buy, and on tablets/desktop (the header cart is visible there).
 * Reads only the cart already in the store — no extra API call.
 */
export const CART_BAR_PATHS = [
  "/",
  "/categories",
  "/categories/[slug]",
  "/brands",
  "/brands/[slug]",
  "/stores",
  "/stores/[slug]",
  "/feature-sections",
  "/feature-sections/[slug]",
  "/section/[id]",
  "/products/search",
  "/shopping-list",
  "/offers",
];

export const shouldShowCartBar = (pathname: string, itemsCount: number | undefined, isLoggedIn: boolean): boolean =>
  isLoggedIn && (itemsCount ?? 0) > 0 && CART_BAR_PATHS.includes(pathname);

type Props = {
  /** Distance from the bottom edge, in px — sits just above the bottom navigation while it is shown. */
  bottomOffset: number;
};

const MobileCartBar: FC<Props> = ({ bottomOffset }) => {
  const router = useRouter();
  const { t } = useTranslation();
  const { currencySymbol } = useSettings();
  const isLoggedIn = useSelector((state: RootState) => state.auth.isLoggedIn);
  const cart = useSelector((state: RootState) => state.cart.cartData);
  const count = cart?.items_count;

  if (!shouldShowCartBar(router.pathname, count, isLoggedIn)) {
    return null;
  }
  const total = cart?.payment_summary?.items_total ?? 0;

  return (
    <>
    {/* Keeps the end of the page (footer) scrollable clear of the bar. */}
    <div aria-hidden="true" className="md:hidden h-16" />
    <div
      className="md:hidden fixed left-0 right-0 z-40 px-3 transition-[bottom] duration-300 ease-in-out"
      style={{ bottom: bottomOffset }}
    >
      <button
        type="button"
        data-testid="mobile-cart-bar"
        onClick={() => router.push("/cart")}
        className="max-w-md mx-auto w-full flex items-center gap-3 rounded-xl bg-green-600 text-white px-4 py-3 shadow-lg active:scale-[0.99]"
      >
        <ShoppingBag size={20} aria-hidden="true" />
        <span className="flex flex-col items-start min-w-0 leading-tight">
          <span className="text-sm font-semibold truncate">
            {t("cart_bar.items", { count, defaultValue: count === 1 ? "{{count}} item" : "{{count}} items" })}
          </span>
          <span className="text-xs opacity-90">
            {currencySymbol}
            {formatAmount(total)}
          </span>
        </span>
        <span className="ms-auto flex items-center gap-1 text-sm font-semibold">
          {t("cart_bar.view_cart", { defaultValue: "View cart" })}
          <ChevronRight size={18} aria-hidden="true" className="rtl:rotate-180" />
        </span>
      </button>
    </div>
    </>
  );
};

export default MobileCartBar;
