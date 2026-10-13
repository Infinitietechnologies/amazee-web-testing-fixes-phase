import axios from "axios";
import { setupInterceptors } from "./interceptor";
import {
  Address,
  ApiResponse,
  BannerData,
  Brand,
  CartResponse,
  RewardGiftsBlock,
  RewardPointsSummary,
  RewardsProgressData,
  CartSyncData,
  Category,
  CheckDeliveryZone,
  DeliveryLocationResponse,
  DeliveryZone,
  FAQ,
  FeaturedSection,
  KeywordSearch,
  MembershipBuyResponse,
  MembershipPlan,
  OfferGroup,
  Order,
  OrderCheckoutResponse,
  PaginatedResponse,
  PaystackCreateOrderResponse,
  Product,
  OffersSectionData,
  ProductFaq,
  ProductReviews,
  PromoCode,
  RazorpayOrderData,
  SellerFeedbackItem,
  SellerReview,
  Settings,
  SidebarFilters,
  Store,
  Transaction,
  userData,
  UserConsentStatus,
  UserMembership,
  VerifyUserData,
  WalletTransaction,
  Wishlist,
  WishTitle,
  VersionCheckData,
  ReferralInfo,
  RewardSystemData,
  MembershipTransaction,
  HomeLayout,
  HomeLayoutSectionFeed,
  ScheduledDeliveryDates,
  ScheduledDeliverySlots,
  XenditCreateOrderResponse,
  CartDeliveryDatesData,
  CartDeliverySlotsData,
  ReturnReason,
  LoyaltyPointsTransactionsData,
  LoyaltyTransactionQueryArgs,
} from "@/types/ApiResponse";
import {
  AddBalanceParams,
  AddressParams,
  DeductBalanceParams,
  PrepareWalletRechargeResponse,
  RegisterUserParams,
  UpdateUserParams,
  WalletTransactionParams,
} from "@/types/params";
import type {
  WatchAndBuyConfig,
  WatchAndBuyProfileReelsData,
  WatchAndBuyProfileStoriesData,
  WatchAndBuyReelFeedData,
  WatchAndBuyReelLikeParams,
  WatchAndBuyReelLikeResult,
  WatchAndBuyResponse,
  WatchAndBuyStorySeenParams,
  WatchAndBuyStorySeenResult,
  WatchAndBuyStoryTrayData,
} from "@/types/WatchAndBuy";
import { withApiFailureMetadata } from "@/helpers/apiError";
import {
  fallbackApiRes,
  fallbackBannerRes,
  fallbackPaginateRes,
  fallbackPaginateResOfProductReviews,
} from "@/config/constants";

// Helper function to construct API base URL properly
const constructApiBaseUrl = (baseUrl: string | undefined): string => {
  if (!baseUrl) {
    console.error(
      "NEXT_PUBLIC_ADMIN_PANEL_URL is not defined in environment variables.",
    );
    return "/api"; // Fallback to relative path to avoid crashing top-level module load
  }

  const trimmedUrl = baseUrl.trim();
  if (!trimmedUrl) {
    console.error("NEXT_PUBLIC_ADMIN_PANEL_URL is empty.");
    return "/api";
  }

  try {
    const url = new URL(trimmedUrl);
    // Preserve existing pathname and append /api
    const pathname = url.pathname.replace(/\/$/, ""); // Remove trailing slash if exists
    url.pathname = `${pathname}/api`;
    return url.toString();
  } catch (error) {
    console.error("Invalid NEXT_PUBLIC_ADMIN_PANEL_URL:", trimmedUrl);
    console.error("Error details:", error);
    // Return the original trimmed value or fallback to avoid crashing module load
    return trimmedUrl.endsWith("/api")
      ? trimmedUrl
      : `${trimmedUrl.replace(/\/$/, "")}/api`;
  }
};

const api = axios.create({
  baseURL: constructApiBaseUrl(process.env.NEXT_PUBLIC_ADMIN_PANEL_URL),
});

// Apply interceptors to the axios instance
setupInterceptors(api);

/* <----------------- API Function --------------------->*/

// ALL Settings
export const getSettings = async (
  params: { access_token?: string | null } = {},
): Promise<ApiResponse<Settings>> => {
  try {
    const response = await api.get<ApiResponse<Settings>>("/settings", {
      headers: params.access_token
        ? { Authorization: `Bearer ${params.access_token}` }
        : undefined,
    });

    return response.data;
  } catch (error: any) {
    console.error("API error:", error);
    // Check if it's a 503 maintenance mode response
    if (error?.response?.status === 503) {
      const responseData = error.response?.data;
      if (
        responseData &&
        typeof responseData === "object" &&
        (responseData as any).maintenance === true
      ) {
        // Return maintenance mode response
        return {
          success: false,
          message: (responseData as any).message || "Maintenance mode active",
          data: null,
        };
      }
    }
    return { success: false, message: "An error occurred.", data: null };
  }
};

export const getVersionCheck = async (
  params: {
    app: string;
    current_version: string;
    platform: string;
  } = {
    app: "web",
    current_version: process.env.NEXT_PUBLIC_APP_VERSION || "0",
    platform: "android",
  },
): Promise<ApiResponse<VersionCheckData>> => {
  try {
    const response = await api.get<ApiResponse<VersionCheckData>>(
      "/settings/check-version",
      {
        params,
      },
    );
    return response.data;
  } catch (error: any) {
    console.error("API error:", error);
    return { success: false, message: "An error occurred.", data: null };
  }
};

// Banners
export const getBannerImages = async (params: {
  position?: "top" | "carousel" | "sidebar";
  scope_category_slug?: string;
  per_page?: string | number;
  page?: string | number;
  latitude?: string | number;
  longitude?: string | number;
}): Promise<PaginatedResponse<BannerData>> => {
  try {
    const response = await api.get("/banners", {
      params: params,
    });
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackBannerRes;
  }
};

// User Interactions
export const verifyUser = async (params: {
  type: "email" | "mobile";
  value: string;
}): Promise<ApiResponse<VerifyUserData>> => {
  try {
    const response = await api.post("/verify-user", null, { params });
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

export const registerUser = async (params: RegisterUserParams) => {
  try {
    const response = await api.post("/register", null, { params });
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

export const getReferralInfo = async (
  access_token?: string | null,
): Promise<ApiResponse<ReferralInfo>> => {
  try {
    const response = await api.get<ApiResponse<ReferralInfo>>(
      "/user/referral",
      {
        headers: access_token
          ? { Authorization: `Bearer ${access_token}` }
          : undefined,
      },
    );
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return { success: false, message: "An error occurred.", data: undefined };
  }
};

export const getRewardSystem = async (
  access_token?: string | null,
): Promise<ApiResponse<RewardSystemData>> => {
  try {
    const response = await api.get<ApiResponse<RewardSystemData>>(
      "/user/reward-system",
      {
        headers: access_token
          ? { Authorization: `Bearer ${access_token}` }
          : undefined,
      },
    );
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return { success: false, message: "An error occurred.", data: undefined };
  }
};

export const getMyRewards = async (): Promise<ApiResponse<any[]>> => {
  try {
    const response = await api.get("/user/reward-system/my-rewards");
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return { success: false, message: "An error occurred.", data: undefined };
  }
};

export const deleteUser = async () => {
  try {
    const response = await api.delete("/user/delete-account");
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

export const login = async (params: {
  email?: string;
  password: string;
  mobile?: string;
  fcm_token?: string | null;
  device_type?: "web";
}): Promise<ApiResponse<userData>> => {
  try {
    const response = await api.post("/login", null, { params });
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return { success: false, message: "An error occurred.", data: undefined };
  }
};

export const googleLogin = async (params: {
  idToken: string;
  fcm_token?: string | null;
  device_type?: string | null;
  friends_code?: string | null;
  country?: string | null;
  iso_2?: string | null;
}): Promise<ApiResponse<userData>> => {
  try {
    const response = await api.post("/auth/google/callback", params);
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return { success: false, message: "An error occurred.", data: undefined };
  }
};

export const appleLogin = async (params: {
  idToken: string;
  fcm_token?: string | null;
  device_type?: string | null;
  friends_code?: string | null;
  country?: string | null;
  iso_2?: string | null;
}): Promise<ApiResponse<userData>> => {
  try {
    const response = await api.post("/auth/apple/callback", params);
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return { success: false, message: "An error occurred.", data: undefined };
  }
};

export const phoneLogin = async (params: {
  idToken: string;
  name?: string | null;
  friends_code?: string | null;
  // [2026-10-06] Audit 1.1: a verified new number becomes an account.
  auto_register?: boolean;
  fcm_token?: string | null;
  device_type?: string | null;
  access_token?: string;
}): Promise<ApiResponse<userData>> => {
  try {
    const { access_token, ...body } = params;
    const config = access_token
      ? { headers: { Authorization: `Bearer ${access_token}` } }
      : {};
    const response = await api.post("/auth/phone/callback", body, config);
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return { success: false, message: "An error occurred.", data: undefined };
  }
};

// Custom SMS OTP (auth/send-otp)
export const checkAccountStatus = async (params: {
  mobile: string;
}): Promise<
  ApiResponse<{ can_continue: boolean }> & { error_code?: string }
> => {
  try {
    const response = await api.post("/auth/check-account-status", params);
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    if (axios.isAxiosError(error) && error.response?.data) {
      return error.response.data as ApiResponse<{ can_continue: boolean }> & {
        error_code?: string;
      };
    }
    return fallbackApiRes;
  }
};

export const sendOtp = async (params: {
  mobile: string;
  expires_in?: number;
}): Promise<ApiResponse<{ mobile: string; expires_in: number }>> => {
  try {
    const response = await api.post("/auth/send-otp", params);
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    if (axios.isAxiosError(error) && error.response?.data) {
      return error.response.data as ApiResponse<{
        mobile: string;
        expires_in: number;
      }>;
    }
    return fallbackApiRes;
  }
};

// Custom SMS OTP verification (auth/verify-otp)
export const verifyOtp = async (params: {
  mobile: string;
  otp: string;
  friends_code?: string | null;
  // [2026-10-06] Audit 1.1: a verified new number becomes an account.
  auto_register?: boolean;
}): Promise<ApiResponse<userData>> => {
  try {
    const response = await api.post("/auth/verify-otp", params);
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    if (axios.isAxiosError(error) && error.response?.data) {
      return error.response.data as ApiResponse<userData>;
    }
    return fallbackApiRes;
  }
};

export const logout = async (
  access_token: string | null,
  params?: { fcm_id?: string; fcm_token?: string | null },
): Promise<ApiResponse<{}>> => {
  try {
    const response = await api.post(
      "/logout",
      params ?? {},
      access_token
        ? {
            headers: {
              Authorization: `Bearer ${access_token}`,
            },
          }
        : undefined,
    );

    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return { success: false, message: "An error occurred.", data: undefined };
  }
};

export const forgotPassword = async (params: {
  email: string;
}): Promise<ApiResponse<null>> => {
  try {
    const response = await api.post("/forget-password", null, { params });
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

export const getUserData = async (
  params: { access_token?: string } = {},
): Promise<ApiResponse<userData>> => {
  try {
    const response = await api.get("/user/profile", { params });
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return { success: false, message: "An error occurred.", data: undefined };
  }
};

export const updateUserData = async (params: UpdateUserParams | FormData) => {
  try {
    // Pass params to the request
    const response = await api.post<ApiResponse<userData>>(
      "/user/profile",
      params,
    );
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

// [2026-10-04] Records acceptance of the Terms and Privacy versions the user
// was shown. A 409 means the versions changed meanwhile (refresh and re-ask).
export const acceptConsents = async (
  termsVersion: string,
  privacyVersion: string,
): Promise<ApiResponse<UserConsentStatus>> => {
  try {
    const response = await api.post("/user/consents", {
      accept: true,
      terms_version: termsVersion,
      privacy_version: privacyVersion,
      channel: "web",
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data) {
      return error.response.data as ApiResponse<UserConsentStatus>;
    }
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

export const updateEmail = async (email: string) => {
  try {
    const response = await api.post<ApiResponse<userData>>(
      "/user/update-email",
      {
        email,
      },
    );
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

export const resendVerificationEmail = async () => {
  try {
    const response = await api.post<ApiResponse<any>>(
      "/user/email/verification-notification",
    );
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

//categories
export const getCategories = async (
  params: {
    page?: string | number;
    per_page?: string | number;
    slug?: string;
    latitude?: string | number;
    longitude?: string | number;
  } = {},
): Promise<PaginatedResponse<Category[]>> => {
  try {
    const response = await api.get("/categories", { params });
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackPaginateRes;
  }
};

export const getSubCategories = async (
  params: {
    page?: string | number;
    per_page?: string | number;
    slug?: string;
    latitude?: string | number;
    longitude?: string | number;
    filter?: "random" | "top_category";
  } = {},
): Promise<PaginatedResponse<Category[]>> => {
  try {
    const response = await api.get("/categories/sub-categories", { params });
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackPaginateRes;
  }
};

// Address Interactions
export const getAddresses = async (
  params: {
    access_token?: string;
    page?: number;
    per_page?: number;
    latitude?: string | number;
    longitude?: string | number;
    zone_id?: string | number;
  } = {},
): Promise<PaginatedResponse<Address[]>> => {
  try {
    const response = await api.get("/user/addresses", { params });
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackPaginateRes;
  }
};

export const addAddress = async (params: AddressParams) => {
  try {
    // Pass params to the request
    const response = await api.post<ApiResponse<Address>>(
      "/user/addresses",
      params,
    );
    return response.data;
  } catch (error: any) {
    console.error("API error:", error);
    // Return validation errors from API response if available
    if (error?.response?.data) {
      return error.response.data;
    }
    return fallbackApiRes;
  }
};

export const editAddress = async (params: AddressParams) => {
  try {
    // Pass params to the request
    const response = await api.put<ApiResponse<Address>>(
      `/user/addresses/${params.id}`,
      params,
    );
    return response.data;
  } catch (error: any) {
    console.error("API error:", error);
    // Return validation errors from API response if available
    if (error?.response?.data) {
      return error.response.data;
    }
    return fallbackApiRes;
  }
};

export const deleteAddress = async (params: { id: string | number }) => {
  try {
    // Pass params to the request
    const response = await api.delete<ApiResponse<Address>>(
      `/user/addresses/${params.id}`,
    );
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

//wallet

export const prepareWalletRecharge = async (params: AddBalanceParams) => {
  try {
    // Pass params to the request
    const response = await api.post<ApiResponse<PrepareWalletRechargeResponse>>(
      "/user/wallet/prepare-wallet-recharge",
      params,
    );
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

// REMOVED: addBalance() and confirmWalletRecharge().
//
// Both called routes the API does not serve — POST /user/wallet/add-balance and
// POST /user/wallet/confirm-recharge — so both 404ed. Neither had a call site;
// they were inherited stubs, and the contract check found them.
//
// They are not restored, because the API's shape here is deliberate. The only
// client-callable wallet mutation is deduct-balance. A credit is prepared with
// prepareWalletRecharge() below, paid at the gateway, and then applied
// server-side by the gateway callback through WalletService::finalizeDeposit().
// confirmWalletRecharge() in particular passed razorpay_order_id /
// payment_id / signature up from the browser as proof of payment — crediting a
// wallet on that would be trusting a client redirect, which is the one thing
// the payment rules forbid outright.
//
// To top a wallet up from the web panel, use prepareWalletRecharge() and let
// the gateway callback settle it. Do not add a client-driven credit endpoint.

export const deductBalance = async (params: DeductBalanceParams) => {
  try {
    // Pass params to the request
    const response = await api.post<ApiResponse<object>>(
      "/user/wallet/deduct-balance",
      params,
    );
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

export const getTransactions = async (
  params: {
    payment_status?: string;
    limit?: string;
    type?: string;
    page?: string | number;
    per_page?: string | number;
    access_token?: string | null;
    search?: string;
    sort?: string;
  } = {},
): Promise<PaginatedResponse<Transaction[]>> => {
  try {
    const { access_token, ...queryParams } = params;
    const response = await api.get("/user/order-transactions", {
      headers: access_token
        ? { Authorization: `Bearer ${access_token}` }
        : undefined,
      params: queryParams,
    });
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackPaginateRes;
  }
};

export const getWalletTransactions = async (
  params: WalletTransactionParams,
): Promise<PaginatedResponse<WalletTransaction[]>> => {
  try {
    const response = await api.get("/user/wallet/transactions", { params });
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackPaginateRes;
  }
};

export const getNotifications = async (
  params: {
    page?: number;
    per_page?: number;
    access_token?: string | null;
  } = {},
): Promise<ApiResponse<any>> => {
  try {
    const { access_token, ...queryParams } = params;
    const response = await api.get("/user/notifications", {
      headers: access_token
        ? { Authorization: `Bearer ${access_token}` }
        : undefined,
      params: queryParams,
    });
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

export const markNotificationRead = async (
  id: string,
): Promise<ApiResponse<any>> => {
  try {
    const response = await api.post(`/user/notifications/${id}/read`, { id });
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

export const markAllNotificationsRead = async (): Promise<ApiResponse<any>> => {
  try {
    const response = await api.post("/user/notifications/mark-all-read");
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

// Brands
export const getBrands = async (
  params: {
    page?: string | number;
    per_page?: string | number;
    scope_category_slug?: string;
    latitude?: string | number;
    longitude?: string | number;
  } = {},
): Promise<PaginatedResponse<Brand[]>> => {
  try {
    const response = await api.get("/brands", { params });
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackPaginateRes;
  }
};

// Offers — the home Offers rail that replaced the Stores rail.
export const getOffers = async (
  params: {
    latitude?: string | number;
    longitude?: string | number;
    limit?: number;
  } = {},
): Promise<ApiResponse<OfferGroup[]>> => {
  try {
    const response = await api.get("/offers", { params });
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return { ...fallbackApiRes, data: [] } as ApiResponse<OfferGroup[]>;
  }
};

// [2026-09-28] Buy again — products the signed-in customer has had delivered
// before and can order again at this location (GET /user/buy-again).
export const getBuyAgain = async (
  params: {
    latitude: string | number;
    longitude: string | number;
    limit?: number;
  },
): Promise<ApiResponse<Product[]>> => {
  try {
    const response = await api.get("/user/buy-again", { params });
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return { ...fallbackApiRes, data: [] } as ApiResponse<Product[]>;
  }
};

// [2026-09-28] Offers section — offer categories, BOGO groups and discounted
// products at the customer's location (GET /offers/section).
export const getOffersSection = async (
  params: {
    latitude?: string | number;
    longitude?: string | number;
    category?: string;
  } = {},
): Promise<ApiResponse<OffersSectionData>> => {
  try {
    const response = await api.get("/offers/section", { params });
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return { ...fallbackApiRes, data: undefined } as ApiResponse<OffersSectionData>;
  }
};

// Stores
export const getStores = async (
  params: {
    latitude?: string | number;
    longitude?: string | number;
    page?: string | number;
    per_page?: string | number;
    search?: string;
  } = {},
): Promise<PaginatedResponse<Store[]>> => {
  try {
    const response = await api.get("/delivery-zone/stores", { params });
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackPaginateRes;
  }
};

export const getSpecificStore = async (
  slug: string,
): Promise<ApiResponse<Store>> => {
  try {
    const response = await api.get(`/stores/${slug}`);
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

export const getStoresByMap = async (params: {
  ne_lat: number;
  ne_lng: number;
  sw_lat: number;
  sw_lng: number;
}): Promise<ApiResponse<{ count: number; stores: Store[] }>> => {
  try {
    const response = await api.post("/stores/map", params);
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

// Delivery Zone
export const checkDeliveryZone = async (params: {
  latitude: string | number;
  longitude: string | number;
}): Promise<ApiResponse<CheckDeliveryZone>> => {
  try {
    const response = await api.get("/delivery-zone/check", { params });
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return { success: false, message: "An error occurred.", data: undefined };
  }
};

export const getDeliveryZones = async (
  params: {
    page?: string | number;
    per_page?: string | number;
    search?: number | string;
  } = {},
): Promise<PaginatedResponse<DeliveryZone[]>> => {
  try {
    const response = await api.get("/delivery-zone", { params });
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackPaginateRes;
  }
};

export const getDeliveryZoneBySlug = async (
  params: {
    slug?: string;
  } = {},
): Promise<ApiResponse<DeliveryZone>> => {
  try {
    const { slug = "" } = params;
    const response = await api.get(`/delivery-zone/${slug}`, {
      params,
    });
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

//Products
export const getProducts = async (
  params: {
    page?: string | number;
    slug?: string;
    per_page?: string | number;
    exclude_product?: string;
    latitude?: number | string;
    longitude?: number | string;
    access_token?: string | undefined;
    categories?: string;
    brands?: string;
    search?: string;
    store?: string;
    include_child_categories?: number;
    attribute_values?: string;
  } = {},
): Promise<PaginatedResponse<Product[], { keywords: string[] }>> => {
  try {
    const response = await api.get("/delivery-zone/products", {
      params,
    });
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return {
      ...fallbackPaginateRes,
      data: {
        ...fallbackPaginateRes.data,
        keywords: [],
      },
    } as PaginatedResponse<Product[], { keywords: string[] }>;
  }
};

export const getSidebarFilters = async (params: {
  latitude: string | number;
  longitude: string | number;
  attribute_values?: string;
  categories?: string;
  brands?: string;
  type?: string;
  value?: string;
  access_token?: string;
}): Promise<ApiResponse<SidebarFilters>> => {
  try {
    const { access_token, ...rest } = params;
    const response = await api.get<ApiResponse<SidebarFilters>>(
      "/products/sidebar-filters",
      {
        params: rest,
        headers: access_token
          ? { Authorization: `Bearer ${access_token}` }
          : undefined,
      },
    );
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

export const getProductBySlug = async (
  params: {
    slug?: string;
    latitude?: number | string;
    longitude?: number | string;
    // [RESTORED 2026-09-22] Lost with the workspace; the caller still sends it.
    is_notify?: number;
    variant_id?: number | string;
    access_token?: string | undefined;
  } = {},
): Promise<ApiResponse<Product>> => {
  try {
    const { slug, ...rest } = params;
    const response = await api.get(`/products/${slug}`, {
      params: rest,
    });
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

export const getProductsByKeyword = async (
  params: {
    keywords?: string;
    latitude?: number | string;
    longitude?: number | string;
    per_page?: string | number;
  } = {},
): Promise<ApiResponse<KeywordSearch>> => {
  try {
    const response = await api.get(`/products/search-by-keywords`, {
      params,
    });
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

export const getProductReviews = async (params: {
  page: string | number;
  per_page: string | number;
  access_token?: string | null;
  slug?: string;
}): Promise<PaginatedResponse<ProductReviews>> => {
  try {
    const { slug } = params;
    const response = await api.get(`/products/${slug}/reviews`, {
      params,
    });
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackPaginateResOfProductReviews;
  }
};

export const getProductFAQs = async (params: {
  page: string | number;
  per_page: string | number;
  access_token?: string | null;
  slug?: string;
  search?: string;
}): Promise<PaginatedResponse<ProductFaq[]>> => {
  try {
    const { slug } = params;
    const response = await api.get(`/products/${slug}/faqs`, {
      params,
    });
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackPaginateRes;
  }
};

// Product Reviews
export const giveProductReview = async (
  params: {
    product_id?: string | number;
    order_item_id?: string | number;
    rating?: number;
    title?: string;
    comment?: string;
    images?: File[];
  } = {},
): Promise<ApiResponse<object>> => {
  try {
    const formData = new FormData();
    if (params.product_id)
      formData.append("product_id", params.product_id.toString());
    if (params.order_item_id)
      formData.append("order_item_id", params.order_item_id.toString());
    if (params.rating !== undefined)
      formData.append("rating", params.rating.toString());
    if (params.title) formData.append("title", params.title);
    if (params.comment) formData.append("comment", params.comment);

    if (params.images)
      params.images.forEach((file) => formData.append("review_images[]", file));

    const response = await api.post("/reviews", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

export const updateProductReview = async (
  params: {
    id?: string | number;
    rating?: number;
    title?: string;
    comment?: string;
    images?: File[];
  } = {},
): Promise<ApiResponse<object>> => {
  try {
    let response;

    if (params.images && params.images.length > 0) {
      // Use FormData when uploading images
      const formData = new FormData();

      if (params.id) formData.append("id", params.id.toString());
      if (params.rating !== undefined)
        formData.append("rating", params.rating.toString());
      if (params.title) formData.append("title", params.title);
      if (params.comment) formData.append("comment", params.comment);

      params.images.forEach((file) => {
        formData.append("review_images[]", file);
      });

      response = await api.post(`/reviews/${params.id}`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
    } else {
      // Send as JSON when no images
      response = await api.post(`/reviews/${params.id}`, params);
    }

    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

export const giveOrderItemSellerReview = async (
  params: {
    seller_id?: string | number;
    order_id?: number;
    order_item_id?: string | number;
    rating?: string | number;
    title?: string;
    description?: string;
  } = {},
): Promise<ApiResponse<SellerFeedbackItem>> => {
  try {
    const response = await api.post("/seller-feedback", params);
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

export const updateOrderItemSellerReview = async (
  params: {
    id?: number | string;
    rating?: string | number;
    title?: string;
    description?: string;
  } = {},
): Promise<ApiResponse<SellerFeedbackItem>> => {
  try {
    const response = await api.post(`/seller-feedback/${params.id}`, params);
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

//Sections
export const getSections = async (
  params: {
    latitude?: string | number;
    longitude?: string | number;
    page?: string | number;
    per_page?: string | number;
    products_limit?: string | number;
    section_type?: string;
    access_token?: string | undefined;
    scope_category_slug?: string;
  } = {},
): Promise<PaginatedResponse<FeaturedSection[]>> => {
  try {
    const response = await api.get("/featured-sections", { params });
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackPaginateRes;
  }
};

export const getSectionBySlug = async (
  params: {
    page?: string | number;
    slug?: string;
    per_page?: string | number;
    latitude?: number | string;
    longitude?: number | string;
    access_token?: string | undefined;
    categories?: string;
    brands?: string;
    colors?: string;
    sort?: string;
    search?: string;
    attribute_values?: string;
  } = {},
): Promise<PaginatedResponse<Product[]>> => {
  try {
    const { slug = "" } = params;
    const response = await api.get(`/featured-sections/${slug}/products`, {
      params,
    });
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackPaginateRes;
  }
};

// Cart Management
export const addToCart = async (params: {
  product_variant_id: string | number;
  store_id: string | number;
  quantity: string | number;
  replace_quantity?: boolean;
  // [RESTORED 2026-09-22] Lost with the workspace; the caller still sends it.
  is_notify?: number | boolean;
  addons?: { addon_group_id: number; addon_item_id: number }[];
}): Promise<ApiResponse<CartResponse>> => {
  try {
    const response = await api.post("/user/cart/add", params);
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

export const getCart = async (
  params: {
    address_id?: string | number;
    promo_code?: string;
    rush_delivery?: boolean;
    use_wallet?: boolean;
    latitude?: number | string;
    longitude?: number | string;
  } = {},
): Promise<ApiResponse<CartResponse>> => {
  try {
    const response = await api.get("/user/cart", {
      params,
    });
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

export const getSaveForLaterItems = async (): Promise<
  ApiResponse<CartResponse>
> => {
  try {
    const response = await api.get("/user/cart/item/save-for-later");
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

export const saveCartItemToSaveForLater = async (
  cartItemId: string | number,
  quantity: string | number,
): Promise<ApiResponse<{}>> => {
  try {
    const response = await api.post(
      `/user/cart/item/save-for-later/${cartItemId}`,
      { quantity },
    );
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

export const removeItemFromCart = async (
  cartItemId: string | number,
): Promise<ApiResponse<[]>> => {
  try {
    const response = await api.delete(`/user/cart/item/${cartItemId}`);
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

export const updateCartItem = async (params: {
  cartItemId: string | number;
  quantity?: string | number;
  addons?: { addon_group_id: number; addon_item_id: number }[];
}): Promise<ApiResponse<[]>> => {
  try {
    const { cartItemId, ...rest } = params;
    const response = await api.post(`/user/cart/item/${cartItemId}`, rest);
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

export const syncOfflineCart = async (params: {
  items: {
    store_id: number;
    product_variant_id: number;
    quantity: number;
  }[];
}): Promise<ApiResponse<CartSyncData>> => {
  try {
    const response = await api.post("/user/cart/sync", params);
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

export const clearCart = async (): Promise<ApiResponse<null>> => {
  try {
    const response = await api.get("/user/cart/clear-cart");
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

//Promo code
export const getPromoCodes = async (): Promise<ApiResponse<PromoCode[]>> => {
  try {
    const response = await api.get("/user/promos/available");
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

export const validatePromoCode = async (
  params: {
    cart_amount?: string | number;
    promo_code?: string;
    delivery_charge?: string | number;
  } = {},
): Promise<ApiResponse<{ promo_code: string; discount: string }>> => {
  try {
    const response = await api.get("/user/promos/validate", { params });
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

// Orders
export const getOrders = async (
  params: {
    per_page?: string | number;
    page?: string | number;
    access_token?: string | null;
    date_range?: string;
    status?: string;
  } = {},
): Promise<PaginatedResponse<Order[]>> => {
  try {
    const { access_token = "" } = params;
    const response = await api.get("/user/orders", {
      headers: access_token
        ? { Authorization: `Bearer ${access_token}` }
        : undefined,
      params: params,
    });
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackPaginateRes;
  }
};

export const reorderOrder = async (
  orderId: string | number,
): Promise<ApiResponse<any>> => {
  try {
    const response = await api.post(`/user/orders/${orderId}/reorder`);
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};
export const cancelOrderItem = async (
  params: {
    orderItemId?: string;
  } = {},
): Promise<ApiResponse<[]>> => {
  try {
    const response = await api.post(
      `/user/orders/items/${params.orderItemId}/cancel`,
      params,
    );
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

export const returnOrderItem = async (
  params: {
    orderItemId?: string;
    reason?: string;
    // [RESTORED 2026-09-22] Lost with the workspace; the caller still sends it.
    /** Id of the chosen option from `getReturnReasons`. */
    reasonId?: string;
    images?: File[];
  } = {},
): Promise<ApiResponse<[]>> => {
  try {
    const formData = new FormData();

    // Do NOT send orderItemId in the body
    if (params.reason) {
      formData.append("reason", params.reason);
    }

    if (params?.images && params.images.length > 0) {
      params.images.forEach((file) => {
        formData.append("images[]", file);
      });
    }

    const response = await api.post(
      `/user/orders/items/${params.orderItemId}/return`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );

    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

export const cancelReturnReq = async (
  params: {
    orderItemId?: string;
  } = {},
): Promise<ApiResponse<[]>> => {
  try {
    const { orderItemId } = params;
    const response = await api.post(
      `/user/orders/items/${orderItemId}/return-cancel`,
    );
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

export const getSpecificOrders = async (
  params: { slug?: string; access_token?: string | null } = {},
): Promise<ApiResponse<Order>> => {
  try {
    const { slug = "", access_token = "" } = params;
    const response = await api.get(`/user/orders/${slug}`, {
      headers: access_token
        ? { Authorization: `Bearer ${access_token}` }
        : undefined,
      params: params,
    });

    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

export const createOrder = async (
  params:
    | {
        payment_type?: string;
        promo_code?: string;
        promo_discount?: string;
        gift_card?: string;
        gift_card_discount?: string;
        rush_delivery?: boolean | string | number;
        use_wallet?: boolean | string | number;
        address_id?: string | number;
        order_note?: string;
        transaction_id?: string;
        razorpay_order_id?: string;
        razorpay_signature?: string;
        redirect_url?: string;
      }
    | FormData = {},
): Promise<ApiResponse<OrderCheckoutResponse>> => {
  try {
    const isFormData = params instanceof FormData;
    const response = await api.post("/user/orders", params, {
      headers: isFormData
        ? {
            "Content-Type": "multipart/form-data",
          }
        : undefined,
    });
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

export const getDeliveryBoyLocation = async (
  orderSlug: string,
): Promise<ApiResponse<DeliveryLocationResponse>> => {
  try {
    const response = await api.get(
      `/user/orders/${orderSlug}/delivery-boy-location`,
    );
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

// WishList Management
// get WishList with their Items
export const getWishListWithItems = async (
  params: {
    page?: string | number;
    per_page?: string | number;
    access_token?: string | null;
  } = {},
): Promise<PaginatedResponse<Wishlist[]>> => {
  try {
    const response = await api.get("/user/wishlists", {
      params,
    });
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackPaginateRes;
  }
};

// Create a new wishlist or add item to the existing / new wishlist
export const CreateWishListWithItems = async (
  params: {
    wishlist_title?: null | string;
    product_id?: null | number;
    product_variant_id?: null | number;
    store_id?: null | number;
  } = {},
): Promise<ApiResponse<object>> => {
  try {
    const response = await api.post("/user/wishlists", params);
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

export const CreateWishListWithOutItems = async (
  params: {
    title?: null | string;
  } = {},
): Promise<ApiResponse<object>> => {
  try {
    const response = await api.post("/user/wishlists/create", params);
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

// get all wishlist titles
export const getAllWishlistTitles = async (
  params: {
    access_token?: string | null;
  } = {},
): Promise<ApiResponse<WishTitle>> => {
  try {
    const response = await api.get("/user/wishlists/titles", { params });
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

// getSpecificWishlist
export const getWishlistById = async (
  id: string,
): Promise<ApiResponse<Wishlist>> => {
  try {
    const response = await api.get(`/user/wishlists/${id}`);
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

// Update a wishlist
export const UpdateWishlistById = async (
  params: {
    id?: null | number;
    title?: string | null;
  } = {},
): Promise<ApiResponse<object>> => {
  const { id = "" } = params;

  try {
    const response = await api.put(`/user/wishlists/${id}`, params);
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

// delete wishlist
export const deleteWishlistById = async (
  id: string,
): Promise<ApiResponse<object>> => {
  try {
    const response = await api.delete(`/user/wishlists/${id}`);
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

// Remove item from wishlist
export const deleteWishlistItemById = async (
  itemId: string | number,
): Promise<ApiResponse<object>> => {
  try {
    const response = await api.delete(`/user/wishlists/items/${itemId}`);
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

// Move item to another wishlist
export const moveItemFromAnotherWishList = async (
  params: {
    itemId?: null | number;
    target_wishlist_id?: string | number;
  } = {},
): Promise<ApiResponse<object>> => {
  const { itemId = "" } = params;

  try {
    const response = await api.put(
      `/user/wishlists/items/${itemId}/move`,
      params,
    );
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

// FAQs
export const getFaqs = async (
  params: {
    page?: string | number;
    per_page?: string | number;
    search?: string;
  } = {},
): Promise<PaginatedResponse<FAQ[]>> => {
  try {
    const response = await api.get("/faqs", { params });
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackPaginateRes;
  }
};

//Delivery Boy Review
export const giveDeliveryBoyReview = async (
  params: {
    delivery_boy_id?: string | number;
    order_id?: string | number;
    rating?: number;
    title?: string | number;
    description?: string;
  } = {},
): Promise<ApiResponse<object>> => {
  try {
    const response = await api.post("/delivery-boy/feedback", params);
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

export const updateDeliveryBoyReview = async (
  params: {
    id?: string | number;
    rating?: number;
    title?: string | number;
    description?: string;
  } = {},
): Promise<ApiResponse<object>> => {
  try {
    const { id } = params;
    const response = await api.post(`/delivery-boy/feedback/${id}`, params);
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

// RazorPay
export const createRazorPayOrder = async (
  params: {
    amount?: string | number;
    currency?: string;
    receipt?: string;
  } = {},
): Promise<ApiResponse<RazorpayOrderData>> => {
  try {
    const response = await api.post("/razorpay/create-order", params);
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

// Stripe
export const createStripeIntent = async (
  params: {
    amount?: string | number;
    currency?: string;
  } = {},
): Promise<ApiResponse<{ clientSecret: string }>> => {
  try {
    const response = await api.post("/stripe/create-order", params);
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

// PayStack
export const paystackCreateOrder = async (
  params: {
    amount?: string | number;
  } = {},
): Promise<ApiResponse<PaystackCreateOrderResponse>> => {
  try {
    const response = await api.post("/paystack/create-order", params);
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

export const sellerRegister = async (
  params:
    | FormData
    | {
        name?: string;
        email?: string;
        mobile?: string;
        password?: string;
        address?: string;
        city?: string;
        state?: string;
        landmark?: string;
        zipcode?: string;
        country?: string;
        latitude?: string;
        longitude?: string;
        business_license?: string | File;
        articles_of_incorporation?: string | File;
        national_identity_card?: string | File;
        authorized_signature?: string | File;
      },
): Promise<ApiResponse<PaystackCreateOrderResponse>> => {
  try {
    // Check if params is FormData
    const isFormData = params instanceof FormData;

    const response = await api.post("/seller/register", params, {
      headers: isFormData
        ? {
            // Let browser set Content-Type with boundary for FormData
            // Don't manually set 'Content-Type': 'multipart/form-data'
          }
        : {
            "Content-Type": "application/json",
          },
    });

    return response.data;
  } catch (error: any) {
    console.error("API error:", error);

    // Preserve error response if it exists (e.g., validation errors)
    if (error?.response?.data) {
      return error.response.data;
    }

    return fallbackApiRes;
  }
};

export const getSellerReviews = async (params: {
  seller_id?: string | number;
  page: string | number;
  per_page: string | number;
}): Promise<PaginatedResponse<SellerReview[]>> => {
  try {
    const response = await api.get(`seller-feedback`, {
      params,
    });
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackPaginateRes;
  }
};

// Membership APIs
export const getMembershipPlans = async (
  params: {
    page?: number;
    per_page?: number;
    plan_type?: string;
  } = {},
): Promise<PaginatedResponse<MembershipPlan[]>> => {
  try {
    const response = await api.get("/user/membership/plans", { params });
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackPaginateRes;
  }
};

export const getActiveMemberships = async (): Promise<
  ApiResponse<UserMembership[]>
> => {
  try {
    const response = await api.get("/user/membership/active");
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

export const buyMembership = async (params: {
  plan_id: number;
  payment_type: string;
  membership_id?: number;
  razorpay_payment_id?: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
  stripe_payment_intent_id?: string;
}): Promise<ApiResponse<MembershipBuyResponse>> => {
  try {
    const response = await api.post("/user/membership/buy", params);
    return response.data;
  } catch (error: any) {
    console.error("API error:", error);
    if (error?.response?.data) {
      return error.response.data;
    }
    return fallbackApiRes;
  }
};

export const deleteCustomerMembership = async (): Promise<ApiResponse<any>> => {
  try {
    // [CHANGE] The API route is DELETE /user/membership/pending (MembershipApiController::deletePending).
    // The exported function keeps its name so callers are untouched; only the path was wrong.
    const response = await api.delete("/user/membership/pending");
    return response.data;
  } catch (error: any) {
    console.error("API error:", error);
    if (error?.response?.data) {
      return error.response.data;
    }
    return fallbackApiRes;
  }
};

export const getMembershipTransactions = async (
  params: {
    page?: number;
    per_page?: number;
  } = {},
): Promise<PaginatedResponse<MembershipTransaction[]>> => {
  try {
    const response = await api.get("/user/membership/transactions", { params });
    return response.data;
  } catch (error: any) {
    console.error("API error:", error);
    if (error?.response?.data) {
      return error.response.data;
    }
    return fallbackPaginateRes;
  }
};

// [CHANGE] F64: customer support tickets on the web storefront.
//
// Deliberately the SAME six endpoints the three Flutter apps declare. The desk
// a ticket lands on is decided by the API from the route prefix, never from
// anything sent here, so the web customer and the app customer are
// indistinguishable to the backend.
export const getSupportTicketTypes = async (): Promise<ApiResponse<any>> => {
  try {
    const response = await api.get("/user/support-tickets/types");
    return response.data;
  } catch (error: any) {
    console.error("API error:", error);
    return error?.response?.data ?? fallbackApiRes;
  }
};

export const getSupportTickets = async (params?: any): Promise<ApiResponse<any>> => {
  try {
    const response = await api.get("/user/support-tickets", { params });
    return response.data;
  } catch (error: any) {
    console.error("API error:", error);
    return error?.response?.data ?? fallbackApiRes;
  }
};

export const getSupportTicket = async (id: string): Promise<ApiResponse<any>> => {
  try {
    const response = await api.get(`/user/support-tickets/${id}`);
    return response.data;
  } catch (error: any) {
    console.error("API error:", error);
    return error?.response?.data ?? fallbackApiRes;
  }
};

export const createSupportTicket = async (payload: any): Promise<ApiResponse<any>> => {
  try {
    const response = await api.post("/user/support-tickets", payload);
    return response.data;
  } catch (error: any) {
    console.error("API error:", error);
    return error?.response?.data ?? fallbackApiRes;
  }
};

export const replySupportTicket = async (id: string, message: string): Promise<ApiResponse<any>> => {
  try {
    const response = await api.post(`/user/support-tickets/${id}/reply`, { message });
    return response.data;
  } catch (error: any) {
    console.error("API error:", error);
    return error?.response?.data ?? fallbackApiRes;
  }
};

export const rateSupportTicket = async (
  id: string,
  rating: number,
  comment?: string,
): Promise<ApiResponse<any>> => {
  try {
    const response = await api.post(`/user/support-tickets/${id}/rate`, { rating, comment });
    return response.data;
  } catch (error: any) {
    console.error("API error:", error);
    return error?.response?.data ?? fallbackApiRes;
  }
};

// [CHANGE] F66: live support chat on the web storefront.
//
// The SAME seven endpoints the three Flutter apps declare — one API, four
// clients. The desk is decided by the API from the route prefix, never from
// anything sent here, so a web customer and an app customer are
// indistinguishable to the backend.
//
// TRANSPORT. There is no socket. The backend has no broadcast driver
// configured, so `poll` is a cursor endpoint: "everything after message id N".
// The message id is the cursor, which makes a reconnect safe — a client that
// re-polls from its last id can neither miss a message nor receive one twice.
export const getSupportChats = async (): Promise<ApiResponse<any>> => {
  try {
    const response = await api.get("/user/support-chat");
    return response.data;
  } catch (error: any) {
    console.error("API error:", error);
    return error?.response?.data ?? fallbackApiRes;
  }
};

export const startSupportChat = async (payload?: {
  subject?: string;
  // orders.id is a VARCHAR on the server (AMWP…/AMWC…). Never a number.
  order_id?: string;
}): Promise<ApiResponse<any>> => {
  try {
    const response = await api.post("/user/support-chat/start", payload ?? {});
    return response.data;
  } catch (error: any) {
    console.error("API error:", error);
    return error?.response?.data ?? fallbackApiRes;
  }
};

export const getSupportChat = async (id: string): Promise<ApiResponse<any>> => {
  try {
    const response = await api.get(`/user/support-chat/${id}`);
    return response.data;
  } catch (error: any) {
    console.error("API error:", error);
    return error?.response?.data ?? fallbackApiRes;
  }
};

export const pollSupportChat = async (
  id: string,
  afterId: number,
): Promise<ApiResponse<any>> => {
  try {
    const response = await api.get(`/user/support-chat/${id}/poll`, {
      params: { after_id: afterId },
    });
    return response.data;
  } catch (error: any) {
    console.error("API error:", error);
    return error?.response?.data ?? fallbackApiRes;
  }
};

// `clientUuid` makes a retry after a dropped connection idempotent: the server
// recognises the same uuid rather than storing the message twice.
export const sendSupportChatMessage = async (
  id: string,
  message: string,
  clientUuid: string,
): Promise<ApiResponse<any>> => {
  try {
    const response = await api.post(`/user/support-chat/${id}/message`, {
      message,
      client_uuid: clientUuid,
    });
    return response.data;
  } catch (error: any) {
    console.error("API error:", error);
    return error?.response?.data ?? fallbackApiRes;
  }
};

export const readSupportChat = async (
  id: string,
  messageId: number,
): Promise<ApiResponse<any>> => {
  try {
    const response = await api.post(`/user/support-chat/${id}/read`, {
      message_id: messageId,
    });
    return response.data;
  } catch (error: any) {
    console.error("API error:", error);
    return error?.response?.data ?? fallbackApiRes;
  }
};

// The explicit "talk to a support agent" path.
export const handoffSupportChat = async (id: string): Promise<ApiResponse<any>> => {
  try {
    const response = await api.post(`/user/support-chat/${id}/handoff`, {});
    return response.data;
  } catch (error: any) {
    console.error("API error:", error);
    return error?.response?.data ?? fallbackApiRes;
  }
};

/* ------------------------------------------------------------------------ *
 * Scheduled delivery
 *
 * [RESTORED 2026-09-22] Lost with the workspace; their tests survived the
 * recovery archive and their source did not. Rebuilt from
 * tests/api/scheduledDelivery.test.ts.
 * ------------------------------------------------------------------------ */

/**
 * The store's scheduled-delivery configuration.
 *
 * Scoped by NUMERIC store id — the slug 404s on these routes.
 *
 * A store with scheduled delivery switched off answers `success: false` with
 * `is_enabled: false`, which is a real answer and is returned as-is. Only a
 * transport failure falls back, so the caller can tell "this store does not
 * offer it" apart from "we could not ask".
 */
export const getScheduledDeliveryDates = async (
  storeId: number | string,
): Promise<ApiResponse<ScheduledDeliveryDates>> => {
  try {
    const response = await api.get(`/scheduled-delivery/stores/${storeId}/dates`);
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

/** The bookable slots for one date on one store. */
export const getScheduledDeliverySlots = async (
  storeId: number | string,
  date: string,
): Promise<ApiResponse<ScheduledDeliverySlots>> => {
  try {
    const response = await api.get(
      `/scheduled-delivery/stores/${storeId}/slots`,
      { params: { date } },
    );
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

/* ------------------------------------------------------------------------ *
 * Home Builder layout
 * ------------------------------------------------------------------------ */

/**
 * The admin-configured homepage layout.
 *
 * `platform` defaults to `web` because this client is the web storefront and a
 * missing platform returns the wrong layout rather than an error — the kind of
 * defect that looks like a content problem for a week.
 */
export const getHomeLayout = async (
  params: {
    platform?: string;
    latitude?: string | number;
    longitude?: string | number;
    // [RESTORED 2026-09-22] Lost with the workspace; the caller still sends it.
    category_slug?: string;
    page?: string | number;
    per_page?: string | number;
    // [RESTORED 2026-09-22] The SSR caller forwards the session token.
    access_token?: string | null;
    // [CHANGE 2026-09-23] Admin-issued Home Builder draft preview token.
    preview_token?: string;
  } = {},
): Promise<ApiResponse<HomeLayout>> => {
  try {
    const response = await api.get("/home-layout", {
      params: { platform: "web", ...params },
    });
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

/**
 * One section's feed, paginated independently of the layout.
 *
 * By section id, not by title: titles are admin-editable and two sections may
 * share one.
 */
export const getHomeLayoutSection = async (
  sectionId: number | string,
  params: {
    page?: string | number;
    per_page?: string | number;
    // [RESTORED 2026-09-22] Lost with the workspace; the caller still sends it.
    access_token?: string | null;
    latitude?: string | number;
    longitude?: string | number;
  } = {},
): Promise<ApiResponse<HomeLayoutSectionFeed>> => {
  try {
    const response = await api.get(`/home-layout/sections/${sectionId}`, {
      params,
    });
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackPaginateRes as unknown as ApiResponse<HomeLayoutSectionFeed>;
  }
};

/* ====================================================================
 * [RESTORED 2026-09-22] Client calls lost when the workspace was reclaimed.
 *
 * Every endpoint below was confirmed against `php artisan route:list` before
 * being restored — POST api/user/cart/tip, POST api/user/orders/{slug}/tip,
 * GET api/user/orders/items/{id}/return-reasons,
 * GET api/user/loyalty-points/transactions and POST api/xendit/create-order
 * all exist. The callers were still in the tree and failing to compile; it
 * was the call layer that went missing, not the feature.
 * ==================================================================== */

// PayStack
export const xenditCreateOrder = async (params: {
  amount: number | string;
  order_id: number | string;
  redirect_url: string;
  /**
   * Prefills the hosted checkout's name/email/mobile fields. Xendit only
   * honours these when they're part of the Create Invoice payload, so the
   * backend must forward this object as the invoice's `customer`.
   */
  customer?: {
    given_names?: string;
    surname?: string;
    email?: string;
    mobile_number?: string;
  };
}): Promise<ApiResponse<XenditCreateOrderResponse>> => {
  try {
    const response = await api.post("/xendit/create-order", params);
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

/**
 * ADDS to the order's existing tip (the backend accumulates, it does not
 * replace) and needs its own `payment_method` since the order is already
 * paid. Identified by order slug/uuid — the numeric id 404s.
 *
 * For gateway methods the payment is collected client-side FIRST (see
 * `collectRazorpayPayment`) and its ids are forwarded here so the backend
 * can tie the tip to the transaction.
 */
export const addOrderTip = async (params: {
  orderSlug: string;
  rider_tip_amount: number;
  payment_method: string;
  razorpay_order_id?: string;
  transaction_id?: string;
  razorpay_signature?: string;
  reference?: string;
}): Promise<ApiResponse<Order>> => {
  try {
    const { orderSlug, ...body } = params;
    const response = await api.post(`/user/orders/${orderSlug}/tip`, body);
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

//Promo code

/** [2026-10-06] Audits 3.3 / 3.5: choose the milestone gift for this order. */
export const chooseMilestoneReward = async (params: {
  gift_product_config_id: number;
  address_id?: number;
}): Promise<ApiResponse<{ milestone_reward: unknown }>> => {
  try {
    const response = await api.post("/user/cart/milestone-reward", params);
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

/** [2026-10-07] Milestone Reward Points: choose the ONE free gift for the next order (null clears). */
export const chooseRewardGift = async (params: {
  reward_gift_product_id: number | null;
  address_id?: number;
}): Promise<ApiResponse<{ reward_gifts: RewardGiftsBlock }>> => {
  try {
    const response = await api.post("/user/reward-gifts/choose", params);
    return response.data;
  } catch (error: any) {
    if (error?.response?.data) return error.response.data;
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

/** [2026-10-07] Account → Wallet → Gift Points. */
export const getRewardPoints = async (
  access_token?: string | null,
): Promise<ApiResponse<RewardPointsSummary>> => {
  try {
    const response = await api.get("/user/reward-points", {
      headers: access_token ? { Authorization: `Bearer ${access_token}` } : undefined,
    });
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return { success: false, message: "An error occurred.", data: undefined };
  }
};

/** [2026-10-07] "AmazeeNow Rewards" progress for the home card. */
export const getRewardsProgress = async (
  access_token?: string | null,
): Promise<ApiResponse<RewardsProgressData>> => {
  try {
    const response = await api.get("/user/rewards/progress", {
      headers: access_token ? { Authorization: `Bearer ${access_token}` } : undefined,
    });
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return { success: false, message: "An error occurred.", data: undefined };
  }
};

/** Replaces the cart's rider tip; `tip_amount: 0` removes it. */
export const setCartTip = async (params: {
  cart_id: number | string;
  tip_amount: number;
}): Promise<ApiResponse<{ cart_id: number; rider_tip_amount: number }>> => {
  try {
    const response = await api.post("/user/cart/tip", params);
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

/**
 * ADDS to the order's existing tip (the backend accumulates, it does not
 * replace) and needs its own `payment_method` since the order is already
 * paid. Identified by order slug/uuid — the numeric id 404s.
 *
 * For gateway methods the payment is collected client-side FIRST (see
 * `collectRazorpayPayment`) and its ids are forwarded here so the backend
 * can tie the tip to the transaction.
 */

export const getReturnReasons = async (
  params: {
    orderItemId?: string;
    access_token?: string | null;
  } = {},
): Promise<ApiResponse<ReturnReason[]>> => {
  try {
    const { orderItemId, ...rest } = params;
    const response = await api.get(
      `/user/orders/items/${orderItemId}/return-reasons`,
      { params: rest },
    );
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

// The transactions endpoint is the single source for loyalty data: it returns
// the summary fields (points_balance, redemption_value, …) alongside the
// paginated transactions, so no separate summary call is needed.
export const getLoyaltyPointsTransactions = async (
  params: LoyaltyTransactionQueryArgs = {},
): Promise<ApiResponse<LoyaltyPointsTransactionsData>> => {
  try {
    const response = await api.get("/user/loyalty-points/transactions", {
      params,
    });
    return response.data;
  } catch (error) {
    console.error("API error:", error);
    return {
      success: false,
      message: "",
      data: {
        is_enabled: true,
        points_balance: 0,
        redemption_value: 0,
        equivalent_monetary_value: 0,
        expiring_points_in_30_days: 0,
        transactions: [],
        pagination: { current_page: 1, last_page: 1, per_page: 15, total: 0 },
      },
    };
  }
};

/* ====================================================================
 * [RESTORED 2026-09-22] Order recovery + cart scheduling calls.
 *
 * Their callers (OrderRecoveryModal, Cart/ScheduledDelivery) survived the
 * workspace reclaim; these functions did not, so both files had been failing
 * to compile ever since.
 *
 * NOTE the two cart-scheduling URLs deliberately DIVERGE from V3. Upstream
 * calls `/cart/dates` and `/cart/slots`; this backend serves
 * `/user/scheduled-delivery/cart/dates` and `.../slots` (confirmed against
 * route:list). Copying upstream verbatim would have shipped a frontend call
 * to an endpoint that does not exist here — a 404 on every cart view.
 * ==================================================================== */

/** Cancel a flagged order. Triggers a refund for non-COD payments. */
export const cancelFlaggedOrder = async (
  orderId: string | number,
): Promise<ApiResponse<null>> => {
  try {
    const response = await api.post(
      `/user/orders/${orderId}/recovery/cancel`,
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data) {
      return error.response.data;
    }
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

/**
 * Bookable dates for the CURRENT cart — the backend resolves the store from the
 * cart, so no id is passed. Unlike the per-store `/dates`, this returns the days
 * themselves rather than rules to expand.
 *
 * A 404 means this contract isn't deployed; it's reported as an unsuccessful
 * response rather than thrown so callers can fall back to the store contract.
 */
export const getCartDeliveryDates = async (): Promise<
  ApiResponse<CartDeliveryDatesData>
> => {
  try {
    const response = await api.get("/user/scheduled-delivery/cart/dates");
    return response.data;
  } catch (error) {
    // 404 = contract absent, 422 = store doesn't schedule. Both are expected
    // answers rather than faults, and logging them would spam every cart view.
    if (
      axios.isAxiosError(error) &&
      (error.response?.status === 404 || error.response?.status === 422)
    ) {
      return fallbackApiRes;
    }
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

/**
 * Slots for one date on the current cart, with `remaining_capacity`.
 * `date` is a local YYYY-MM-DD.
 */

/**
 * Slots for one date on the current cart, with `remaining_capacity`.
 * `date` is a local YYYY-MM-DD.
 */
export const getCartDeliverySlots = async (
  date: string,
): Promise<ApiResponse<CartDeliverySlotsData>> => {
  try {
    const response = await api.get("/user/scheduled-delivery/cart/slots", { params: { date } });
    return response.data;
  } catch (error) {
    if (
      axios.isAxiosError(error) &&
      (error.response?.status === 404 || error.response?.status === 422)
    ) {
      return fallbackApiRes;
    }
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

/* --- Order recovery (flagged reschedule / cancellation) --- */

/**
 * The recovery slots endpoint takes its date as DD-MM-YYYY (per the API docs'
 * example, `date=12-07-1999`) while the app speaks YYYY-MM-DD everywhere.
 * Converted at the boundary so no caller has to know.
 */
const toRecoveryDateParam = (date: string): string => {
  const [y, m, d] = date.split("-");
  return `${d}-${m}-${y}`;
};

/**
 * Slots the flagged order can move into on one date. Order-scoped rather than
 * store-scoped: the backend resolves the store (and excludes the order's own
 * dead slot) itself. `date` is a local YYYY-MM-DD and is required.
 */

/**
 * Slots the flagged order can move into on one date. Order-scoped rather than
 * store-scoped: the backend resolves the store (and excludes the order's own
 * dead slot) itself. `date` is a local YYYY-MM-DD and is required.
 */
export const getOrderRecoverySlots = async (
  orderId: string | number,
  date: string,
): Promise<ApiResponse<CartDeliverySlotsData>> => {
  try {
    const response = await api.get(`/user/orders/${orderId}/recovery/slots`, {
      params: { date: toRecoveryDateParam(date) },
    });
    return response.data;
  } catch (error) {
    if (
      axios.isAxiosError(error) &&
      (error.response?.status === 404 || error.response?.status === 422)
    ) {
      return fallbackApiRes;
    }
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

/**
 * Move a flagged order to a new window. Rejected by the backend once
 * `reschedule_deadline` has passed, so the UI must not be the only guard.
 *
 * Unlike the getters above, a failure here is surfaced with the backend's own
 * message: the customer pressed a button and is owed the reason it didn't work.
 */

/**
 * Move a flagged order to a new window. Rejected by the backend once
 * `reschedule_deadline` has passed, so the UI must not be the only guard.
 *
 * Unlike the getters above, a failure here is surfaced with the backend's own
 * message: the customer pressed a button and is owed the reason it didn't work.
 */
export const rescheduleOrder = async (
  orderId: string | number,
  params: {
    scheduled_date: string;
    scheduled_slot_start_time?: string;
    scheduled_slot_end_time?: string;
  },
): Promise<ApiResponse<null>> => {
  try {
    const response = await api.post(
      `/user/orders/${orderId}/recovery/reschedule`,
      params,
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data) {
      return error.response.data;
    }
    console.error("API error:", error);
    return fallbackApiRes;
  }
};

/** Cancel a flagged order. Triggers a refund for non-COD payments. */

/* <----------------- Watch & Buy (v3.2 port, 2026-09-28) --------------------->
 *
 * Same URIs, query params and JSON shapes as the v3.2 customer API. Failures
 * return a typed fallback (never throw) tagged with `retryable` by
 * `withApiFailureMetadata`, in place of v3.2's `reportApiFailure`.
 *
 * Auth: the likes and seen endpoints are sanctum-protected. An explicit
 * `access_token` is moved into the Authorization header by the request
 * interceptor (it never reaches the URL); client-side calls without one pick up
 * the `access_token` cookie the same way every other authenticated call does.
 */

export const getWatchAndBuyConfig = async (): Promise<
  WatchAndBuyResponse<WatchAndBuyConfig>
> => {
  try {
    const response = await api.get<WatchAndBuyResponse<WatchAndBuyConfig>>(
      "/watch-and-buy/config",
    );
    return response.data;
  } catch (error) {
    return withApiFailureMetadata(
      error,
      { success: false, message: "Unable to load Watch & Buy.", data: null },
      "Watch & Buy config",
    );
  }
};

export const getWatchAndBuyReels = async (params: {
  latitude: number;
  longitude: number;
  /** Deep link: start the feed at this reel. */
  slug?: string;
  store_id?: string | number;
  store_slug?: string;
  cursor?: string | null;
  session_id?: string | null;
  per_page?: number;
  access_token?: string | null;
}): Promise<WatchAndBuyResponse<WatchAndBuyReelFeedData>> => {
  try {
    const response = await api.get<
      WatchAndBuyResponse<WatchAndBuyReelFeedData>
    >("/watch-and-buy/reels", { params });
    return response.data;
  } catch (error) {
    return withApiFailureMetadata(
      error,
      {
        success: false,
        message: "Unable to load Reels.",
        data: {
          items: [],
          meta: { next_cursor: null, per_page: params.per_page ?? 10 },
        },
      },
      "Watch & Buy Reel feed",
    );
  }
};

export const getWatchAndBuyProfile = async (
  username: string,
  params: {
    latitude: number;
    longitude: number;
    page?: number;
    per_page?: number;
    access_token?: string | null;
  },
): Promise<WatchAndBuyResponse<WatchAndBuyProfileReelsData>> => {
  try {
    const response = await api.get<
      WatchAndBuyResponse<WatchAndBuyProfileReelsData>
    >(`/watch-and-buy/profiles/${encodeURIComponent(username)}`, { params });
    return response.data;
  } catch (error) {
    return withApiFailureMetadata(
      error,
      { success: false, message: "Unable to load profile.", data: null },
      "Watch & Buy profile",
    );
  }
};

export const getWatchAndBuyStoryTray = async (
  params: {
    store_slug?: string;
    cursor?: string | null;
    session_id?: string | null;
    per_page?: number;
    access_token?: string | null;
  } = {},
): Promise<WatchAndBuyResponse<WatchAndBuyStoryTrayData>> => {
  try {
    const response = await api.get<
      WatchAndBuyResponse<WatchAndBuyStoryTrayData>
    >("/watch-and-buy/statuses", { params });
    return response.data;
  } catch (error) {
    return withApiFailureMetadata(
      error,
      {
        success: false,
        message: "Unable to load Stories.",
        data: {
          items: [],
          meta: { next_cursor: null, per_page: params.per_page ?? 10 },
        },
      },
      "Watch & Buy Story tray",
    );
  }
};

export const getWatchAndBuyProfileStories = async (
  username: string,
  params: {
    store_slug?: string;
    cursor?: string | null;
    per_page?: number;
    access_token?: string | null;
  } = {},
): Promise<WatchAndBuyResponse<WatchAndBuyProfileStoriesData>> => {
  try {
    const response = await api.get<
      WatchAndBuyResponse<WatchAndBuyProfileStoriesData>
    >(`/watch-and-buy/profiles/${encodeURIComponent(username)}/statuses`, {
      params,
    });
    return response.data;
  } catch (error) {
    return withApiFailureMetadata(
      error,
      { success: false, message: "Unable to load profile Stories.", data: null },
      "Watch & Buy profile Stories",
    );
  }
};

/** Batched like/unlike. Requires a signed-in customer. */
export const updateWatchAndBuyReelLikes = async (
  params: WatchAndBuyReelLikeParams,
): Promise<WatchAndBuyResponse<WatchAndBuyReelLikeResult[]>> => {
  const { access_token, ...body } = params;
  try {
    const response = await api.put<
      WatchAndBuyResponse<WatchAndBuyReelLikeResult[]>
    >("/watch-and-buy/reels/likes", body, {
      params: access_token ? { access_token } : undefined,
    });
    return response.data;
  } catch (error) {
    return withApiFailureMetadata(
      error,
      { success: false, message: "Unable to update Reel like.", data: null },
      "Watch & Buy Reel like",
    );
  }
};

/** Batched story-view receipts. Requires a signed-in customer. */
export const markWatchAndBuyStoriesSeen = async (
  params: WatchAndBuyStorySeenParams,
): Promise<WatchAndBuyResponse<WatchAndBuyStorySeenResult[]>> => {
  const { access_token, ...body } = params;
  try {
    const response = await api.put<
      WatchAndBuyResponse<WatchAndBuyStorySeenResult[]>
    >("/watch-and-buy/statuses/seen", body, {
      params: access_token ? { access_token } : undefined,
    });
    return response.data;
  } catch (error) {
    return withApiFailureMetadata(
      error,
      { success: false, message: "Unable to mark Story as seen.", data: null },
      "Watch & Buy Story seen",
    );
  }
};
