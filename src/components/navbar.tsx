import React, { FC, useEffect, useMemo, useState } from "react";
import {
  Navbar as HeroUINavbar,
  NavbarContent,
  NavbarMenu,
  NavbarMenuToggle,
  NavbarBrand,
  NavbarItem,
  NavbarMenuItem,
  Link,
  Image,
  useDisclosure,
  Button,
} from "@heroui/react";
import NextLink from "next/link";
import LocationSelector from "./Location/LocationSelector";
import { ThemeSwitch } from "./theme-switch";
import GlobalSearchbar from "./Functional/GlobalSearchbar";
import {
  ShoppingCart,
  Home,
  Tags,
  HelpCircle,
  Info,
  X,
  Clapperboard,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useSelector } from "react-redux";
import { RootState } from "@/lib/redux/store";
import { useRouter } from "next/router";
import { useSettings } from "@/contexts/SettingsContext";
import CategoryTabs from "./Functional/CategoryTabs";
import LanguageSwitcher from "./Functional/LanguageSwitcher";
import { useTranslation } from "react-i18next";
import {
  getHomeHeaderSurfaceStyle,
  hasHomeHeaderAppearance,
  resolveHomeHeaderAppearance,
} from "@/helpers/homeHeaderAppearance";
import { WATCH_AND_BUY_PATH } from "@/helpers/watchAndBuy";
const FallbackCartIcon = () => (
  <Link as={NextLink} href="/cart">
    <ShoppingCart className="text-default-500 cursor-pointer" />
  </Link>
);

const Badge = dynamic(() => import("@heroui/react").then((mod) => mod.Badge), {
  ssr: false,
  loading: () => <FallbackCartIcon />,
});

const ProfileBtn = dynamic(() => import("./ProfileBtn"), { ssr: false });
const LoginModal = dynamic(() => import("./Modals/LoginModal"), { ssr: false });
const OfflineCartDrawer = dynamic(() => import("./Cart/OfflineCartDrawer"), {
  ssr: false,
});

export const Navbar: FC = () => {
  const { t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showDemoWarning, setShowDemoWarning] = useState(true);
  const isLoggedIn = useSelector((state: RootState) => state.auth.isLoggedIn);
  const {
    webSettings,
    demoMode,
    systemSettings,
    homeGeneralSettings,
    watchAndBuySettings,
    isWatchAndBuyEnabled,
  } = useSettings();
  const router = useRouter();
  const cartCount =
    useSelector((state: RootState) => state.cart.cartData?.items_count) || 0;

  const offLineCartCount =
    useSelector((state: RootState) => state.offlineCart.items)?.length || 0;

  const {
    isOpen: isOfflineCartOpen,
    onOpen: openOfflineCart,
    onClose: closeOfflineCart,
  } = useDisclosure();
  const {
    siteHeaderLogo = "https://placehold.co/160x40?text=Logo",
    siteHeaderDarkLogo = "https://placehold.co/160x40?text=Logo",
    siteName = "Site Logo",
  } = webSettings || {};

  useEffect(() => {
    if (webSettings?.headerScript) {
      const temp = document.createElement("div");
      temp.innerHTML = webSettings.headerScript;

      // Append each <script> dynamically
      Array.from(temp.querySelectorAll("script")).forEach((oldScript) => {
        const newScript = document.createElement("script");
        if (oldScript.src) {
          newScript.src = oldScript.src;
        }
        if (oldScript.textContent) {
          newScript.textContent = oldScript.textContent;
        }
        document.head.appendChild(newScript);
      });
    }
  }, [webSettings?.headerScript]);

  useEffect(() => {
    if (isLoggedIn && isOfflineCartOpen) {
      closeOfflineCart();
    }
  }, [isLoggedIn, isOfflineCartOpen, closeOfflineCart]);

  // [v3.2 port] Watch & Buy entry point, shown only when the backend enables it.
  const watchAndBuyTitle =
    (typeof watchAndBuySettings?.title === "string" &&
      watchAndBuySettings.title.trim()) ||
    t("nav.watch_and_buy", { defaultValue: "Watch & Buy" });

  // [v3.2 port] Per-platform home header appearance (colour/image only).
  const isHomePage = router.pathname === "/";
  const homeHeaderAppearance = useMemo(
    () => resolveHomeHeaderAppearance(homeGeneralSettings),
    [homeGeneralSettings],
  );
  const paintHomeHeader =
    isHomePage && hasHomeHeaderAppearance(homeHeaderAppearance);

  // Menu items with translation keys
  const navMenuItems = [
    { label: t("nav.home"), href: "/", icon: Home },
    { label: t("nav.brands"), href: "/brands", icon: Tags },
    ...(isWatchAndBuyEnabled
      ? [{ label: watchAndBuyTitle, href: WATCH_AND_BUY_PATH, icon: Clapperboard }]
      : []),
    { label: t("nav.faqs"), href: "/faqs", icon: HelpCircle },
    { label: t("nav.about_us"), href: "/about-us", icon: Info },
  ];
  return (
    <>
      <div
        className={`w-full flex flex-col items-start shadow-sm ${
          paintHomeHeader ? "home-header-surface" : ""
        }`}
        style={
          paintHomeHeader
            ? getHomeHeaderSurfaceStyle(homeHeaderAppearance)
            : undefined
        }
        data-home-header-appearance={
          paintHomeHeader ? homeHeaderAppearance.type : undefined
        }
      >
        {demoMode && showDemoWarning && (
          <div className="w-full bg-primary-50 dark:bg-content1 text-warning-700 text-xs sm:text-sm px-3 py-1 flex items-center justify-center gap-2 relative">
            ℹ️
            <span className="font-medium flex items-center gap-2">
              {systemSettings?.customerDemoModeMessage
                ? systemSettings.customerDemoModeMessage
                : "Currently running in Demo Mode"}
            </span>
            <Button
              onPress={() => setShowDemoWarning(false)}
              aria-label="Close demo mode warning"
              isIconOnly
              size="sm"
              radius="full"
              color="primary"
              variant="flat"
              className="min-w-1 w-6 h-6"
            >
              <X size={16} className="text-warning-700 rounded-full" />
            </Button>
          </div>
        )}

        <HeroUINavbar
          maxWidth="2xl"
          position="sticky"
          className="p-0"
          // A painted home header shows through the (otherwise opaque) navbar.
          isBlurred={!paintHomeHeader}
          classNames={{
            wrapper: "p-0 px-2 md:px-4",
            base: paintHomeHeader
              ? "shadow-none bg-transparent"
              : "shadow-none",
          }}
          isMenuOpen={isMenuOpen}
          onMenuOpenChange={setIsMenuOpen}
        >
          {/* Logo and Location */}
          <NavbarContent className="md:basis-1/4 w-full" justify="start">
            <NavbarMenuToggle
              className="md:hidden"
              aria-label={
                isMenuOpen ? t("aria.close_menu") : t("aria.open_menu")
              }
            />
            <div className="flex justify-between w-full md:min-w-32">
              <NavbarBrand className="gap-3 w-full min-w-32">
                {/* `as={NextLink}`: HeroUI's Link renders a bare <a>, which
                    triggers a full page load. It doesn't depend on
                    @react-aria/link, so it never reads the RouterProvider
                    context that _app.tsx wires up. */}
                {/* `?category=all` rather than a bare "/": it's an explicit
                    reset, so the persisted homeCategory cookie must not
                    resurrect the previously selected category. */}
                <Link
                  as={NextLink}
                  href="/?category=all"
                  title={t("nav.home")}
                >
                  {/* Light theme logo */}
                  <Image
                    loading="eager"
                    src={siteHeaderLogo}
                    alt={siteName}
                    radius="none"
                    className="object-contain dark:hidden"
                    classNames={{
                      img: "h-8 sm:h-10 md:h-12 w-full sm:min-w-5 md:min-w-32",
                      wrapper: "cursor-pointer",
                    }}
                  />
                  {/* Dark theme logo */}
                  <Image
                    loading="eager"
                    src={siteHeaderDarkLogo}
                    alt={siteName}
                    radius="none"
                    className="object-contain hidden dark:block"
                    classNames={{
                      img: "h-8 sm:h-10 md:h-12 w-full sm:min-w-5 md:min-w-32",
                      wrapper: "cursor-pointer",
                    }}
                  />
                </Link>
              </NavbarBrand>
              <div className="flex items-center gap-4 md:hidden">
                <NavbarItem>
                  {isLoggedIn ? (
                    <ProfileBtn />
                  ) : (
                    <LoginModal triggerView="icon" />
                  )}
                </NavbarItem>
              </div>
            </div>
            <div className="hidden md:flex w-full flex-start">
              <LocationSelector />
            </div>
          </NavbarContent>

          {/* Search Bar - Desktop */}
          <NavbarContent
            className="hidden md:flex md:basis-1/2"
            justify="center"
          >
            <div className="w-full max-w-xl">
              <GlobalSearchbar />
            </div>
          </NavbarContent>

          {/* Right Side Actions - Desktop */}
          <NavbarContent className="hidden md:flex" justify="end">
            {isWatchAndBuyEnabled && (
              <NavbarItem className="shrink-0">
                <Link
                  as={NextLink}
                  href={WATCH_AND_BUY_PATH}
                  aria-label={watchAndBuyTitle}
                  title={watchAndBuyTitle}
                  data-testid="navbar-watch-and-buy"
                  className="flex items-center justify-center rounded-md text-default-500"
                >
                  <Clapperboard aria-hidden="true" size={22} />
                </Link>
              </NavbarItem>
            )}
            <NavbarItem className="flex items-end gap-2">
              <LanguageSwitcher />
            </NavbarItem>
            <NavbarItem className="flex items-end gap-2">
              <ThemeSwitch />
            </NavbarItem>
            <NavbarItem>
              <div className="flex items-center">
                <Badge
                  color="primary"
                  content={
                    isLoggedIn
                      ? cartCount || undefined
                      : offLineCartCount || undefined
                  }
                  variant="solid"
                  classNames={{ badge: "text-xs" }}
                >
                  <Link
                    title={t("cart_title")}
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      if (isLoggedIn) {
                        router.push("/cart");
                      } else {
                        openOfflineCart();
                      }
                    }}
                  >
                    <ShoppingCart className="text-default-500 cursor-pointer" />
                  </Link>
                </Badge>
              </div>
            </NavbarItem>
            <NavbarItem>
              {isLoggedIn ? <ProfileBtn /> : <LoginModal />}
            </NavbarItem>
          </NavbarContent>

          {/* Mobile Menu */}
          <NavbarMenu>
            <NavbarMenuItem className="flex justify-between items-center gap-4 pb-4 border-b border-divider">
              <LanguageSwitcher />
              <ThemeSwitch variant="switch" />
            </NavbarMenuItem>
            <div className="flex flex-col gap-1 mt-2">
              {navMenuItems.map((item, index) => {
                const Icon = item.icon;
                return (
                  <NavbarMenuItem key={`${item.label}-${index}`}>
                    <Link
                      as={NextLink}
                      color="foreground"
                      href={item.href}
                      size="lg"
                      className="w-full flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-default-100 transition-colors"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <Icon size={20} className="text-default-500" />
                      <span>{item.label}</span>
                    </Link>
                  </NavbarMenuItem>
                );
              })}
            </div>
          </NavbarMenu>
        </HeroUINavbar>

        {/* Mobile Search & Location */}
        <div className="w-full md:hidden px-2 flex flex-col sm:flex-row sm:justify-start sm:gap-4 relative -top-[1vh] sm:top-0">
          <LocationSelector />
          <GlobalSearchbar />
        </div>

        {/* CategoryTabs */}
        {router.pathname === "/" && (
          <div
            className={`w-full max-w-screen-2xl mx-auto px-2 md:px-6 ${
              router.pathname !== "/" ? "hidden" : ""
            }`}
          >
            <CategoryTabs className="w-full" />
          </div>
        )}
      </div>
      <OfflineCartDrawer
        isOpen={isOfflineCartOpen}
        onClose={closeOfflineCart}
      />
    </>
  );
};
