import React, { FC, useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import useSWR from "swr";
import {
  Card,
  Button,
  Skeleton,
  addToast,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  useDisclosure,
  Image,
} from "@heroui/react";

import {
  Crown,
  ArrowRight,
  ShieldCheck,
  Lock,
  ShoppingBag,
  ShoppingCart,
  ReceiptText,
  LayoutGrid,
  Infinity,
  Clock,
} from "lucide-react";
import {
  getMembershipPlans,
  buyMembership,
  deleteCustomerMembership,
} from "@/routes/api";
import { MembershipPlan } from "@/types/ApiResponse";
import {
  formatAmount,
  updateMembershipDataInRedux,
} from "@/helpers/functionalHelpers";
import { useSelector } from "react-redux";
import { RootState } from "@/lib/redux/store";
import RazorPay from "@/components/PaymentGateway/RazorPay";
import Stripe from "@/components/PaymentGateway/Stripe";
import PaymentMethods from "@/components/PaymentMethods";
import { useSettings } from "@/contexts/SettingsContext";
import { useTranslation } from "react-i18next";
import { useSiteAccess } from "@/hooks/useSiteAccess";
import { Swiper, SwiperSlide } from "swiper/react";
import { FreeMode, Pagination } from "swiper/modules";

const MembershipView: FC = () => {
  const router = useRouter();

  const [isLargeDesktop, setIsLargeDesktop] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => {
      setIsLargeDesktop(window.innerWidth >= 1024);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const [isProcessing, setIsProcessing] = useState(false);
  const [buyingPlanId, setBuyingPlanId] = useState<number | null>(null);
  const [membershipOrderData, setMembershipOrderData] = useState<any>(null);

  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [selectedMethod, setSelectedMethod] = useState<string>("");
  const [isRazorpayCheckoutOpen, setIsRazorpayCheckoutOpen] = useState(false);
  const { currencySymbol } = useSettings();
  const { t } = useTranslation();

  const isPaymentSuccess = useRef(false);
  const pendingMembershipExists = useRef(false);
  const lastSelectedMethod = useRef<string>("");

  useEffect(() => {
    return () => {
      if (pendingMembershipExists.current && !isPaymentSuccess.current) {
        void deleteCustomerMembership();
      }
    };
  }, []);

  const activeMemberships = useSelector(
    (state: RootState) => state.auth.activeMemberships,
  );
  const isLoggedIn = useSelector((state: RootState) => state.auth.isLoggedIn);
  const { isCheckingMembership } = useSiteAccess();

  const { data: plansData, isLoading: isInitialLoading } = useSWR(
    "/membership-plans",
    async () => {
      const res = await getMembershipPlans();
      if (res.success && res.data) {
        return res.data.data;
      }
      return [];
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    },
  );

  const plans = React.useMemo(() => {
    const rawPlans = plansData || [];
    return [...rawPlans].sort((a, b) => {
      const aActive = activeMemberships?.some(
        (m: any) => m.plan_id === a.id && m.status === "active",
      )
        ? 1
        : 0;
      const bActive = activeMemberships?.some(
        (m: any) => m.plan_id === b.id && m.status === "active",
      )
        ? 1
        : 0;
      // Sort active plans (1) before inactive ones (0)
      return bActive - aActive;
    });
  }, [plansData, activeMemberships]);

  const handleBuyPlan = async (plan: MembershipPlan) => {
    if (!isLoggedIn) {
      const loginBtn = document.getElementById("login-btn");
      if (loginBtn) {
        loginBtn.click();
        addToast({
          title: "Login Required",
          description: "Please login to purchase a membership plan.",
          color: "warning",
        });
      }
      return;
    }

    isPaymentSuccess.current = false;
    pendingMembershipExists.current = false;
    lastSelectedMethod.current = "";
    setBuyingPlanId(plan.id);
    onOpen();
  };

  const handleModalOpenChange = async (open: boolean) => {
    if (!open) {
      // Clear UI state immediately before closing modal to prevent Stripe component from rendering during close animation
      setMembershipOrderData(null);
      setSelectedMethod("");
      setIsProcessing(false);
      setIsRazorpayCheckoutOpen(false);

      if (pendingMembershipExists.current && !isPaymentSuccess.current) {
        pendingMembershipExists.current = false;
        try {
          await deleteCustomerMembership();
          await updateMembershipDataInRedux();
          addToast({
            title: "Membership Cancelled",
            description: "Your pending membership purchase has been cancelled.",
            color: "warning",
          });
        } catch (err) {
          console.error("Failed to delete customer membership:", err);
        }
      }
      setBuyingPlanId(null);
      lastSelectedMethod.current = "";
    }
    onOpenChange();
  };

  const initiatePurchase = async (planId: number, method: string) => {
    if (!planId || !method) return;

    setIsProcessing(true);
    const res = await buyMembership({
      plan_id: planId,
      payment_type: method,
    });

    if (res.success) {
      setMembershipOrderData(res);
      pendingMembershipExists.current = true;
    } else {
      const isAlreadyActive = res.message
        ?.toLowerCase()
        .includes("already have an active membership");
      addToast({
        title: isAlreadyActive ? "Membership Active" : "Purchase Failed",
        description: res.message || "Failed to initiate purchase",
        color: isAlreadyActive ? "warning" : "danger",
      });
    }
    setIsProcessing(false);
  };

  const handlePaymentSelection = (method: string) => {
    setSelectedMethod(method);
    if (isOpen && buyingPlanId && method) {
      // If switching to a different payment method and pending membership exists, delete it first
      if (
        lastSelectedMethod.current &&
        lastSelectedMethod.current !== method &&
        pendingMembershipExists.current
      ) {
        // Clear old order data to prevent stale data from showing
        setMembershipOrderData(null);
        // Delete previous pending membership before initiating new purchase
        deleteCustomerMembership()
          .then(() => {
            lastSelectedMethod.current = method;
            pendingMembershipExists.current = false;
            void initiatePurchase(buyingPlanId, method);
          })
          .catch((err) => {
            console.error("Failed to delete previous membership:", err);
            // Still proceed with new purchase attempt
            lastSelectedMethod.current = method;
            void initiatePurchase(buyingPlanId, method);
          });
      } else {
        // First time selecting or same method
        lastSelectedMethod.current = method;
        void initiatePurchase(buyingPlanId, method);
      }
    }
  };

  const isPlanActive = (planId: number) => {
    return activeMemberships?.some(
      (m) => m.plan_id === planId && m.status === "active",
    );
  };

  const plansLayoutClass =
    "flex flex-col min-[1024px]:flex-row flex-wrap gap-6 justify-center items-center min-[1024px]:items-stretch w-full max-w-[1500px] mx-auto";

  const planCardClass =
    "w-full max-w-[800px] min-[1024px]:max-w-[360px] shrink-0";

  // While the site access check is in progress (e.g., after Google login before redirect)
  // show only skeleton cards to avoid flashing the heading and description text
  if (isInitialLoading || isCheckingMembership) {
    return (
      <div className="w-full py-8 md:py-10">
        <div className="bg-slate-50 dark:bg-slate-900/50 py-10 md:py-16 border-y border-slate-100 dark:border-slate-800/50 w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw]">
          <div className="max-w-[1500px] mx-auto px-4">
            <div className={plansLayoutClass}>
              {[1, 2, 3].map((i) => (
                <Card
                  key={i}
                  className={`h-[420px] border-2 border-slate-200 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-900 ${planCardClass}`}
                >
                  <Skeleton className="rounded-lg h-full w-full" />
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const renderPlanCard = (plan: MembershipPlan, isActive: boolean) => {
    const isPrime = plan.plan_type === "prime";
    const hasAnyActivePlan = activeMemberships?.some(
      (m: any) => m.status === "active",
    );
    const isPrimeLocked = isPrime && !hasAnyActivePlan;
    const activePlanDetails = activeMemberships?.find(
      (m: any) => m.plan_id === plan.id && m.status === "active",
    );

    const displayPlanName =
      isActive && activePlanDetails
        ? activePlanDetails.plan_name
        : plan.plan_name;
    const displayPrice =
      isActive && activePlanDetails ? activePlanDetails.price_paid : plan.price;

    let displayDuration = plan.duration;
    if (isActive && activePlanDetails) {
      if (activePlanDetails.end_date) {
        displayDuration = Math.round(
          (new Date(activePlanDetails.end_date).getTime() -
            new Date(activePlanDetails.start_date).getTime()) /
            (1000 * 60 * 60 * 24),
        );
      } else {
        displayDuration = null;
      }
    }

    const displayFreeDelivery =
      isActive && activePlanDetails?.benefits
        ? activePlanDetails.benefits.is_free_delivery_allowed
        : plan.is_free_delivery_allowed;
    const displayDiscount =
      isActive && activePlanDetails?.benefits
        ? activePlanDetails.benefits.discount
        : plan.discount;

    return (
      <Card
        key={plan.id}
        className={`${planCardClass} membership-plan-card h-full relative overflow-visible border transition-all duration-500 hover:scale-[1.02] shadow-2xl bg-gradient-to-br from-[#1b0d5c] to-[#08021c] border-violet-500/20 text-white p-4 sm:p-6 gap-4 sm:gap-6 rounded-2xl sm:rounded-3xl flex flex-col justify-between`}
      >
        {/* Top Badge */}
        {isActive && (
          <div className="absolute top-0 left-4 sm:left-6 -translate-y-1/2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-[10px] sm:text-xs font-black px-3 sm:px-4 py-1 sm:py-1.5 rounded-full flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 border border-emerald-400/20 z-10">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
            Active
          </div>
        )}

        <div className="space-y-4 sm:space-y-6 w-full">
          {/* Header Row */}
          <div className="flex items-center justify-between gap-4 w-full">
            {/* Left block (Crown + Plan names) */}
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Premium square crown icon wrapper */}
              <div className="membership-crown-wrapper w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shrink-0 shadow-lg shadow-violet-500/35 border border-violet-400/20">
                <Crown className="membership-crown-icon w-6 h-6 sm:w-9 sm:h-9 text-amber-300 fill-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
              </div>
              <div className="text-left">
                <h3
                  className="membership-plan-title text-lg sm:text-2xl font-black tracking-wide text-white leading-tight line-clamp-2"
                  title={displayPlanName}
                >
                  {displayPlanName}
                </h3>
                <p className="text-fuchsia-400 font-extrabold text-[10px] sm:text-xs tracking-wider mt-0.5">
                  {displayDuration
                    ? `${displayDuration} Days Access`
                    : "Lifetime Access"}
                </p>
                <p className="text-slate-400 text-[8px] sm:text-[10px] mt-1 font-medium">
                  One-time payment • No hidden charges
                </p>
              </div>
            </div>

            {/* Right block (Price) */}
            <div className="text-right flex flex-col items-end justify-center">
              <div className="membership-plan-price text-2xl sm:text-3xl font-black text-white tracking-tight flex items-baseline">
                {currencySymbol}
                {formatAmount(displayPrice)}
              </div>
              <span className="text-[8px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                {displayDuration ? "limited" : "Lifetime"}
              </span>
            </div>
          </div>

          {/* Feature Grid (3x2) */}
          <div className="membership-benefit-grid grid grid-cols-3 gap-2 sm:gap-3 w-full mt-1 sm:mt-2">
            {/* Feature 1 */}
            <div className="membership-benefit-box bg-slate-950/40 border border-slate-900/60 rounded-xl sm:rounded-2xl p-2 sm:p-3 flex flex-col items-center justify-center text-center gap-1 sm:gap-2 hover:bg-slate-950/60 transition-all duration-300 hover:border-violet-500/20 hover:scale-[1.03] group cursor-pointer shadow-inner">
              <div className="membership-benefit-icon-wrapper w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border border-violet-500/40 bg-violet-500/10 shadow-[0_0_12px_rgba(139,92,246,0.15)] text-violet-400 group-hover:scale-110 transition-transform">
                <ShoppingBag className="membership-benefit-icon w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <span className="membership-benefit-text text-[8px] sm:text-[10px] font-bold text-slate-200 tracking-wide leading-tight">
                Browse all products
              </span>
            </div>

            {/* Feature 2 */}
            <div className="membership-benefit-box bg-slate-950/40 border border-slate-900/60 rounded-xl sm:rounded-2xl p-2 sm:p-3 flex flex-col items-center justify-center text-center gap-1 sm:gap-2 hover:bg-slate-950/60 transition-all duration-300 hover:border-violet-500/20 hover:scale-[1.03] group cursor-pointer shadow-inner">
              <div className="membership-benefit-icon-wrapper w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border border-indigo-500/40 bg-indigo-500/10 shadow-[0_0_12px_rgba(99,102,241,0.15)] text-indigo-400 group-hover:scale-110 transition-transform">
                <ShoppingCart className="membership-benefit-icon w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <span className="membership-benefit-text text-[8px] sm:text-[10px] font-bold text-slate-200 tracking-wide leading-tight">
                Add items to cart
              </span>
            </div>

            {/* Feature 3 */}
            <div className="membership-benefit-box bg-slate-950/40 border border-slate-900/60 rounded-xl sm:rounded-2xl p-2 sm:p-3 flex flex-col items-center justify-center text-center gap-1 sm:gap-2 hover:bg-slate-950/60 transition-all duration-300 hover:border-violet-500/20 hover:scale-[1.03] group cursor-pointer shadow-inner">
              <div className="membership-benefit-icon-wrapper w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border border-pink-500/40 bg-pink-500/10 shadow-[0_0_12px_rgba(236,72,153,0.15)] text-pink-400 group-hover:scale-110 transition-transform">
                <ReceiptText className="membership-benefit-icon w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <span className="membership-benefit-text text-[8px] sm:text-[10px] font-bold text-slate-200 tracking-wide leading-tight">
                Place orders
              </span>
            </div>

            {/* Feature 4 */}
            <div className="membership-benefit-box bg-slate-950/40 border border-slate-900/60 rounded-xl sm:rounded-2xl p-2 sm:p-3 flex flex-col items-center justify-center text-center gap-1 sm:gap-2 hover:bg-slate-950/60 transition-all duration-300 hover:border-violet-500/20 hover:scale-[1.03] group cursor-pointer shadow-inner">
              <div className="membership-benefit-icon-wrapper w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border border-blue-500/40 bg-blue-500/10 shadow-[0_0_12px_rgba(59,130,246,0.15)] text-blue-400 group-hover:scale-110 transition-transform">
                <LayoutGrid className="membership-benefit-icon w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <span className="membership-benefit-text text-[8px] sm:text-[10px] font-bold text-slate-200 tracking-wide leading-tight">
                Access all categories
              </span>
            </div>

            {/* Feature 5 */}
            <div className="membership-benefit-box bg-slate-950/40 border border-slate-900/60 rounded-xl sm:rounded-2xl p-2 sm:p-3 flex flex-col items-center justify-center text-center gap-1 sm:gap-2 hover:bg-slate-950/60 transition-all duration-300 hover:border-violet-500/20 hover:scale-[1.03] group cursor-pointer shadow-inner">
              <div className="membership-benefit-icon-wrapper w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border border-emerald-500/40 bg-emerald-500/10 shadow-[0_0_12px_rgba(16,185,129,0.15)] text-emerald-400 group-hover:scale-110 transition-transform">
                {displayDuration ? (
                  <Clock className="membership-benefit-icon w-4 h-4 sm:w-5 sm:h-5" />
                ) : (
                  <Infinity className="membership-benefit-icon w-4 h-4 sm:w-5 sm:h-5" />
                )}
              </div>
              <span className="membership-benefit-text text-[8px] sm:text-[10px] font-bold text-slate-200 tracking-wide leading-tight">
                {displayDuration
                  ? `${displayDuration} days validity`
                  : "Lifetime validity"}
              </span>
            </div>

            {/* Feature 6 (Dynamic Benefits) — [2026-10-02] shows the plan's
                own benefit: these values were computed above and never shown. */}
            <div className="membership-benefit-box bg-slate-950/40 border border-slate-900/60 rounded-xl sm:rounded-2xl p-2 sm:p-3 flex flex-col items-center justify-center text-center gap-1 sm:gap-2 hover:bg-slate-950/60 transition-all duration-300 hover:border-violet-500/20 hover:scale-[1.03] group cursor-pointer shadow-inner">
              <div className="membership-benefit-icon-wrapper w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border border-amber-500/40 bg-amber-500/10 shadow-[0_0_12px_rgba(245,158,11,0.15)] text-amber-400 group-hover:scale-110 transition-transform">
                <ShieldCheck className="membership-benefit-icon w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <span className="membership-benefit-text text-[8px] sm:text-[10px] font-bold text-slate-200 tracking-wide leading-tight">
                {displayFreeDelivery
                  ? "Free delivery"
                  : Number(displayDiscount) > 0
                    ? `${Number(displayDiscount)}% off orders`
                    : "Secure & reliable"}
              </span>
            </div>
          </div>

          {/* 100% Safe Payment Banner */}
          <div className="membership-safe-payment p-2.5 sm:p-3.5 bg-slate-950/50 border border-slate-900/80 rounded-xl sm:rounded-2xl flex items-center justify-between gap-2 sm:gap-3 w-full shadow-inner">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="membership-safe-payment-icon-wrapper bg-violet-500/10 p-1.5 sm:p-2 rounded-lg sm:rounded-xl border border-violet-500/30 text-violet-400">
                <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="text-left">
                <p className="text-[10px] sm:text-xs font-bold text-white tracking-wide">
                  100% Safe Payment
                </p>
                <p className="text-[8px] sm:text-[9px] text-slate-400 font-medium">
                  Instant access after purchase
                </p>
              </div>
            </div>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-slate-800 flex items-center justify-center text-slate-500 bg-slate-950/30">
              <Lock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
          </div>
        </div>

        {/* Buy/Action Button */}
        {!isActive && (
          <div className="w-full mt-2">
            {isPrimeLocked ? (
              <Button
                fullWidth
                variant="flat"
                isDisabled
                className="membership-buy-button h-10 sm:h-12 text-xs sm:text-sm font-extrabold bg-slate-800 text-slate-500 rounded-xl sm:rounded-2xl cursor-not-allowed border border-slate-700/50"
              >
                Requires Basic Plan
              </Button>
            ) : (
              <Button
                fullWidth
                className={`membership-buy-button h-10 sm:h-12 text-xs sm:text-sm font-extrabold transition-all duration-300 group text-white rounded-xl sm:rounded-2xl ${
                  isPrime
                    ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 shadow-lg shadow-violet-500/30 hover:scale-[1.01]"
                    : "bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/30 hover:scale-[1.01]"
                }`}
                onPress={() => handleBuyPlan(plan)}
                isLoading={buyingPlanId === plan.id && !isOpen}
                endContent={
                  <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:translate-x-1 transition-transform" />
                }
              >
                {isPrime ? "Upgrade to Prime" : "Activate now"}
              </Button>
            )}
          </div>
        )}
      </Card>
    );
  };

  const useSwiperOnDesktop = isLargeDesktop && plans.length > 3;

  return (
    <div className="w-full pb-8 md:pb-10">
      <div className="bg-gradient-to-br from-[#01013D] via-[#04074D] to-[#0A0A5C] py-3 sm:py-4 md:py-5 border-b border-violet-900/20 w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] text-white overflow-hidden mt-1 md:mt-1 mb-0">
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#6B1DFF]/10 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-[#A03CFF]/10 rounded-full blur-[60px] pointer-events-none" />

        <div className="max-w-[1500px] mx-auto px-4 md:px-8 flex flex-row items-center justify-between gap-4 relative z-10 w-full">
          {/* Left side text */}
          <div className="flex-grow text-left space-y-2 max-w-xl">
            <div className="space-y-1.5">
              <h1 className="membership-hero-title text-xl sm:text-2xl md:text-4xl lg:text-5xl font-black leading-tight tracking-tight">
                Unlock{" "}
                <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-500 bg-clip-text text-transparent">
                  Amazee Now
                </span>
              </h1>
              <div className="membership-hero-divider h-[3px] w-12 md:w-16 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full mx-0" />
            </div>
            <p className="membership-hero-desc text-[11px] sm:text-xs md:text-base lg:text-lg text-slate-300 font-medium leading-relaxed">
              Choose a plan and unlock your premium experience today
            </p>
          </div>

          {/* Right side 3D Illustration Image */}
          <div className="membership-hero-img-wrapper w-[38%] sm:w-[32%] md:max-w-[300px] lg:max-w-[360px] shrink-0 flex justify-end">
            <Image
              src="/images/membership_hero_banner.png"
              alt="Unlock Amazee"
              className="w-full h-auto object-contain"
              classNames={{ wrapper: "w-full" }}
            />
          </div>
        </div>
      </div>

      <div className="bg-slate-50 dark:bg-slate-900/50 pt-4 sm:pt-6 pb-10 sm:pb-16 border-y border-slate-100 dark:border-slate-800/50 w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw]">
        <div className="max-w-[1500px] mx-auto px-4">
          {useSwiperOnDesktop ? (
            <div className="w-full relative px-0">
              <Swiper
                modules={[Pagination, FreeMode]}
                pagination={{ clickable: true }}
                freeMode={true}
                spaceBetween={12}
                slidesPerView={4}
                breakpoints={{
                  1024: {
                    slidesPerView: 4,
                    spaceBetween: 12,
                  },
                  1397: {
                    slidesPerView: 4,
                    spaceBetween: 24,
                  },
                }}
                className="w-full !overflow-visible pb-16"
              >
                {plans.map((plan) => {
                  const isActive = isPlanActive(plan.id);
                  return (
                    <SwiperSlide
                      key={plan.id}
                      className="!h-auto flex justify-center py-4"
                    >
                      {renderPlanCard(plan, isActive)}
                    </SwiperSlide>
                  );
                })}
              </Swiper>
            </div>
          ) : (
            <div className={`${plansLayoutClass} membership-plans-container`}>
              {plans.map((plan) => {
                const isActive = isPlanActive(plan.id);
                return renderPlanCard(plan, isActive);
              })}
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={isOpen && !isRazorpayCheckoutOpen}
        onOpenChange={handleModalOpenChange}
        backdrop="blur"
        size="xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <h2 className="text-xl font-bold">{t("select_payment_method")}</h2>
          </ModalHeader>
          <ModalBody>
            <PaymentMethods
              selectedPayment={selectedMethod}
              setSelectedPayment={handlePaymentSelection}
              hideCOD={true}
              isLoading={isProcessing}
            />

            {isProcessing && !membershipOrderData && (
              <div className="w-full flex flex-col items-center gap-3 py-4">
                <Skeleton className="w-12 h-12 rounded-full" />
                <p className="text-sm font-medium text-slate-500 animate-pulse">
                  Initializing gateway...
                </p>
              </div>
            )}

            {membershipOrderData && selectedMethod && (
              <div className="w-full pb-6">
                {selectedMethod === "razorpayPayment" && (
                  <RazorPay
                    usageType="membership"
                    membershipOrderData={membershipOrderData}
                    planId={buyingPlanId || 0}
                    onSuccess={async () => {
                      isPaymentSuccess.current = true;
                      pendingMembershipExists.current = false;
                      await updateMembershipDataInRedux();
                      handleModalOpenChange(false);
                      router.replace("/");
                    }}
                    onError={() => {
                      void handleModalOpenChange(false);
                    }}
                    isLoading={isProcessing}
                    setIsLoading={setIsProcessing}
                    onGatewayOpen={() => setIsRazorpayCheckoutOpen(true)}
                    onGatewayClose={() => setIsRazorpayCheckoutOpen(false)}
                  />
                )}

                {selectedMethod === "stripePayment" && membershipOrderData && (
                  <Stripe
                    usageType="membership"
                    membershipOrderData={membershipOrderData}
                    planId={buyingPlanId || 0}
                    onSuccess={async () => {
                      isPaymentSuccess.current = true;
                      pendingMembershipExists.current = false;
                      await updateMembershipDataInRedux();
                      handleModalOpenChange(false);
                      router.replace("/");
                    }}
                    onError={() => {
                      void handleModalOpenChange(false);
                    }}
                    isLoading={isProcessing}
                    setIsLoading={setIsProcessing}
                  />
                )}
              </div>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

      <style>{`
        .swiper-pagination-bullet {
          width: 8px !important;
          height: 8px !important;
          background: #5F23B6 !important;
          opacity: 0.35 !important;
        }
        .swiper-pagination-bullet.swiper-pagination-bullet-active {
          background: #5F23B6 !important;
          opacity: 1 !important;
        }
        .swiper-pagination {
          position: absolute !important;
          bottom: -8px !important;
        }

        @media (min-width: 1024px) and (max-width: 1396px) {
          /* Hero Banner compact styling */
          .membership-hero-title {
            font-size: 1.625rem !important; /* ~26px instead of 4xl/5xl */
            line-height: 1.25 !important;
          }
          .membership-hero-desc {
            font-size: 0.8125rem !important; /* ~13px instead of base/lg */
          }
          .membership-hero-divider {
            width: 2.5rem !important; /* 40px instead of 64px */
          }
          .membership-hero-img-wrapper {
            max-width: 200px !important; /* Compact illustration size */
          }

          /* Plan Card compact styling */
          .membership-plan-card {
            padding: 1rem !important;
            gap: 1rem !important;
            border-radius: 1rem !important; /* rounded-2xl */
          }
          .membership-plan-card .absolute.top-0 {
            left: 1rem !important;
          }
          .membership-crown-wrapper {
            width: 3rem !important; /* 48px */
            height: 3rem !important; /* 48px */
            border-radius: 0.75rem !important; /* rounded-xl */
          }
          .membership-crown-icon {
            width: 1.5rem !important; /* w-6 */
            height: 1.5rem !important; /* h-6 */
          }
          .membership-plan-title {
            font-size: 1.125rem !important; /* text-lg */
          }
          .membership-plan-price {
            font-size: 1.5rem !important; /* text-2xl */
          }
          .membership-benefit-grid {
            gap: 0.5rem !important;
          }
          .membership-benefit-box {
            padding: 0.5rem !important;
            border-radius: 0.75rem !important; /* rounded-xl */
            gap: 0.25rem !important;
          }
          .membership-benefit-icon-wrapper {
            width: 2rem !important; /* 32px */
            height: 2rem !important; /* 32px */
          }
          .membership-benefit-icon {
            width: 1rem !important; /* 16px */
            height: 1rem !important; /* 16px */
          }
          .membership-benefit-text {
            font-size: 0.5rem !important; /* text-[8px] */
          }
          .membership-safe-payment {
            padding: 0.625rem !important; /* p-2.5 */
            border-radius: 0.75rem !important; /* rounded-xl */
            gap: 0.5rem !important;
          }
          .membership-safe-payment-icon-wrapper {
            padding: 0.375rem !important; /* p-1.5 */
            border-radius: 0.5rem !important; /* rounded-lg */
          }
          .membership-safe-payment p.text-white {
            font-size: 0.625rem !important; /* text-[10px] */
          }
          .membership-safe-payment p.text-slate-400 {
            font-size: 0.5rem !important; /* text-[8px] */
          }
          .membership-safe-payment .w-7 {
            width: 1.75rem !important;
            height: 1.75rem !important;
          }
          .membership-buy-button {
            height: 2.5rem !important; /* h-10 */
            font-size: 0.75rem !important; /* text-xs */
            border-radius: 0.75rem !important; /* rounded-xl */
          }
        }

        @media (min-width: 1024px) and (max-width: 1396px) {
          /* When side-by-side in a row on medium desktops, reduce card max-width and container gap */
          .membership-plan-card {
            max-width: 290px !important;
          }
          .membership-plans-container {
            gap: 0.75rem !important; /* Reduces gap between cards to 12px instead of 24px */
          }
        }
      `}</style>
    </div>
  );
};

export default MembershipView;
