import { useState, useEffect, useMemo, useRef } from "react";
import {
  Home,
  ShoppingCart,
  User,
  Package,
  BadgePercent,
  Clapperboard,
} from "lucide-react";
import { useRouter } from "next/router";
import { useSelector } from "react-redux";
import { RootState } from "@/lib/redux/store";
import { addToast, useDisclosure } from "@heroui/react";
import { useTranslation } from "react-i18next";
import dynamic from "next/dynamic";
import { useSettings } from "@/contexts/SettingsContext";
import { WATCH_AND_BUY_PATH } from "@/helpers/watchAndBuy";

const OfflineCartDrawer = dynamic(() => import("../Cart/OfflineCartDrawer"), {
  ssr: false,
});
// [2026-09-28] Sticky "View cart" bar that rides just above this navigation.
const MobileCartBar = dynamic(() => import("./MobileCartBar"), { ssr: false });

export type BottomNavTabId =
  | "home"
  | "categories"
  | "watch"
  | "cart"
  | "offers"
  | "profile";

/**
 * Which tabs the mobile bottom bar shows, in order.
 *
 * [v3.2 port 2026-09-28] "watch" (Watch & Buy, `/play/`) appears only when the
 * backend enables the feature — v3.2 showed it unconditionally and replaced
 * the cart tab; here the cart tab stays and "watch" is gated.
 *
 * [2026-09-28] "offers" (/offers) replaces the Stores tab (approved). The
 * store directory stays reachable at /stores from the header and the home
 * page; the tab now goes to the Offers section on every site, single-vendor
 * included.
 */
export const getBottomNavTabIds = ({
  isWatchAndBuyEnabled,
}: {
  /** Kept for callers; the tab set no longer depends on the vendor mode. */
  isSingleVendor: boolean;
  isWatchAndBuyEnabled: boolean;
}): BottomNavTabId[] =>
  (
    ["home", "categories", "watch", "cart", "offers", "profile"] as const
  ).filter((id) => !(!isWatchAndBuyEnabled && id === "watch"));

const BottomNavigation = () => {
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const navRef = useRef<HTMLDivElement>(null);
  const [navHeight, setNavHeight] = useState(64);

  useEffect(() => {
    const el = navRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setNavHeight(el.offsetHeight || 64));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const router = useRouter();
  const { t } = useTranslation();
  const { isSingleVendor, isWatchAndBuyEnabled } = useSettings();
  const isLoggedIn = useSelector((state: RootState) => state.auth.isLoggedIn);
  const cartCount =
    useSelector((state: RootState) => state.cart.cartData?.items_count) ||
    undefined;

  const offLineCartCount =
    useSelector((state: RootState) => state.offlineCart.items)?.length || 0;

  const {
    isOpen: isOfflineCartOpen,
    onOpen: openOfflineCart,
    onClose: closeOfflineCart,
  } = useDisclosure();

  const activeTab = useMemo(() => {
    const pathToTabMap: Record<string, string> = {
      "/": "home",
      "/cart": "cart",
      "/categories": "categories",
      "/my-account": "profile",
      "/offers": "offers",
      "/play": "watch",
    };
    return pathToTabMap[router.pathname] || "";
  }, [router.pathname]);

  useEffect(() => {
    const controlNavbar = () => {
      if (typeof window !== "undefined") {
        const currentScrollY = window.scrollY;

        if (currentScrollY < lastScrollY || currentScrollY < 10) {
          setIsVisible(true);
        } else {
          setIsVisible(false);
        }

        setLastScrollY(currentScrollY);
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("scroll", controlNavbar);
      return () => window.removeEventListener("scroll", controlNavbar);
    }
  }, [lastScrollY]);

  useEffect(() => {
    if (isLoggedIn && isOfflineCartOpen) {
      closeOfflineCart();
    }
  }, [isLoggedIn, isOfflineCartOpen, closeOfflineCart]);

  const visibleTabIds = getBottomNavTabIds({
    isSingleVendor,
    isWatchAndBuyEnabled,
  });
  const navItems = [
    { id: "home", label: t("home_title"), icon: Home, path: "/" },
    {
      id: "categories",
      label: t("categories"),
      icon: Package,
      path: "/categories",
    },
    {
      id: "watch",
      label: t("nav.watch", { defaultValue: "Watch" }),
      icon: Clapperboard,
      path: WATCH_AND_BUY_PATH,
      protected: false,
    },
    {
      id: "cart",
      label: t("cart_title"),
      icon: ShoppingCart,
      path: "/cart",
      protected: true,
    },
    {
      id: "offers",
      label: t("offers.title", { defaultValue: "Offers" }),
      icon: BadgePercent,
      path: "/offers",
      protected: false,
    },
    {
      id: "profile",
      label: t("profile"),
      icon: User,
      path: "/my-account",
      protected: true,
    },
  ].filter((item) => visibleTabIds.includes(item.id as BottomNavTabId));
  // Six tabs need tighter padding to fit a 360px viewport.
  const tabPadding = navItems.length > 5 ? "px-1" : "px-3";

  const handleTabClick = (
    itemId: string,
    path?: string,
    protectedTab?: boolean,
  ) => {
    if (itemId === "cart" && !isLoggedIn) {
      openOfflineCart();
      return;
    }
    if (protectedTab && !isLoggedIn) {
      document.getElementById("login-btn")?.click();
      addToast({ title: "Please Login to Continue !", color: "warning" });
      return;
    }
    if (path) router.push(path);
  };

  return (
    <>
    <MobileCartBar bottomOffset={isVisible ? navHeight + 8 : 12} />
    <div
      className={`md:hidden fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ease-in-out ${
        isVisible ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="shadow-lg bg-background" ref={navRef}>
        <div className="max-w-md mx-auto">
          <nav className="flex justify-around items-center py-2 px-1 gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`bottom-nav-${item.id}`}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() =>
                    handleTabClick(item.id, item.path, item.protected)
                  }
                  className={`relative flex flex-col items-center justify-center py-2 ${tabPadding} rounded-lg transition-all duration-200 min-w-0 flex-1 ${
                    isActive
                      ? "text-green-600 bg-green-50"
                      : "text-foreground/50 hover:text-foreground/70"
                  }`}
                >
                  <Icon
                    size={20}
                    className={`mb-1 transition-all duration-200 ${
                      isActive ? "scale-110" : "scale-100"
                    }`}
                  />
                  {item.id === "cart" &&
                  (isLoggedIn ? cartCount : offLineCartCount) ? (
                    <span className="absolute top-0 right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-red-500 rounded-full">
                      {isLoggedIn ? cartCount : offLineCartCount}
                    </span>
                  ) : null}
                  <span
                    className={`text-xs font-medium transition-all duration-200 ${
                      isActive ? "scale-105" : "scale-100"
                    }`}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>
      <OfflineCartDrawer
        isOpen={isOfflineCartOpen}
        onClose={closeOfflineCart}
      />
    </div>
    </>
  );
};

export default BottomNavigation;
