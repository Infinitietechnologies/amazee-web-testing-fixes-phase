import {
  setActiveMemberships,
  setUserDataRedux,
} from "@/lib/redux/slices/authSlice";
import { store } from "@/lib/redux/store";
import {
  addToCart,
  checkDeliveryZone,
  createOrder,
  getActiveMemberships,
  getProductBySlug,
  getUserData,
  updateCartItem,
} from "@/routes/api";
import {
  ApiResponse,
  CartResponse,
  Product,
  ProductVariant,
  Settings,
  userData,
  UserMembership,
} from "@/types/ApiResponse";
import { staticLat, staticLng } from "@/config/constants";
import { addToast } from "@heroui/react";
import axios, { AxiosError } from "axios";
import { GetServerSidePropsContext } from "next";
// Import the new actions
import {
  setCartData,
  setCartLoading,
  setError,
} from "@/lib/redux/slices/cartSlice";
import { fallbackApiRes } from "@/config/constants";
import i18n from "../../i18n";
import { isValidUrl } from "./validator";
import {
  setPromoCode,
  setRusDelivery,
  setSelectedAddress,
  setUseWallet,
} from "@/lib/redux/slices/checkoutSlice";
import { updateCartData } from "./updators";
import {
  addOfflineCartItem,
  updateOfflineCartItem,
} from "@/lib/redux/slices/offlineCartSlice";
import { trackPurchase } from "@/lib/analytics";

export const makeTabClick = (dataKey: string): void => {
  // Select the button using the data-key attribute
  const button = document.querySelector<HTMLButtonElement>(
    `button[data-key="${dataKey}"]`,
  );

  // Check if the button exists
  if (!button) {
    console.error(`Button with data-key="${dataKey}" not found.`);
    return;
  }

  // Trigger a click event on the button
  button.click();

  // Scroll the button into view
  button.scrollIntoView({
    behavior: "smooth",
    block: "start",
    inline: "start",
  });
};

export const updateUserDataInRedux = async () => {
  try {
    const isLoggedIn = store.getState().auth.isLoggedIn;
    if (!isLoggedIn) {
      store.dispatch(setUserDataRedux({} as any));
      return;
    }

    const res: ApiResponse<userData> = await getUserData();

    if (res.success) {
      store.dispatch(setUserDataRedux(res.data || {}));
    } else {
      console.error(
        "Failed to update user data in Redux:",
        res.message || "Unknown error",
      );
    }
  } catch (error) {
    // Handle network or unexpected errors
    console.error("An error occurred while updating user data:", error);
  }
};

export const updateMembershipDataInRedux = async () => {
  try {
    const isLoggedIn = store.getState().auth.isLoggedIn;
    if (!isLoggedIn) {
      store.dispatch(setActiveMemberships([]));
      return;
    }

    const res: ApiResponse<UserMembership[]> = await getActiveMemberships();

    if (res.success) {
      store.dispatch(setActiveMemberships(res.data || []));
    } else {
      console.error(
        "Failed to update membership data in Redux:",
        res.message || "Unknown error",
      );
    }
  } catch (error) {
    console.error("An error occurred while updating membership data:", error);
  }
};

export const handleCheckZone = async (
  latitude: string | number,
  longitude: string | number,
): Promise<boolean> => {
  try {
    const res = await checkDeliveryZone({ latitude, longitude });

    if (res.success && res.data?.is_deliverable) {
      return true;
    }

    return false;
  } catch (error) {
    console.error("Error checking delivery zone:", error);
    return false;
  }
};

/**
 * [2026-09-28] Like handleCheckZone, but says HOW the point is served:
 * inside a Live zone, through the hub network (out of zone, with the promise
 * in days), or not at all.
 */
export const checkZoneDetailed = async (
  latitude: string | number,
  longitude: string | number,
): Promise<{ ok: boolean; mode: "zone" | "out_of_zone" | "none"; promiseDays: number | null }> => {
  try {
    const res = await checkDeliveryZone({ latitude, longitude });
    const ok = !!(res.success && res.data?.is_deliverable);
    const mode = res.data?.delivery_mode ?? (ok ? "zone" : "none");
    return { ok, mode, promiseDays: res.data?.promise_days ?? null };
  } catch (error) {
    console.error("Error checking delivery zone:", error);
    return { ok: false, mode: "none", promiseDays: null };
  }
};

export const isAxiosError = (
  error: unknown,
): error is AxiosError<{ message?: string }> => {
  return axios.isAxiosError(error);
};

export const getUserLocationFromContext = async (
  context: GetServerSidePropsContext,
): Promise<{ lat: string; lng: string } | null> => {
  try {
    const raw = context.req.cookies.userLocation;
    if (raw) {
      let parsedLocation: { lat: string; lng: string } | null = null;
      try {
        parsedLocation = JSON.parse(decodeURIComponent(raw));
      } catch {
        parsedLocation = JSON.parse(raw);
      }
      return parsedLocation;
    }
    return null;
  } catch (error) {
    console.error("Error getting user Location from context:", error);
    return null;
  }
};

export const handleUpdateCartItem = async (params: {
  cartItemId: string | number;
  quantity: string | number;
  addons: { addon_group_id: number; addon_item_id: number }[];
  onClose: () => void;
  renderToast: boolean;
}) => {
  const { onClose = () => {}, renderToast = true } = params;

  try {
    store.dispatch(setCartLoading(true));

    const updateRes = await updateCartItem({
      cartItemId: params.cartItemId,
      quantity: params.quantity,
      addons: params.addons,
    });

    if (updateRes.success) {
      onClose();
      if (renderToast) {
        addToast({
          title: i18n.t("cart_updated_title"),
          color: "success",
        });
      }

      let passAddress = false;
      if (
        window.location.pathname === "/cart" ||
        window.location.pathname === "/cart/"
      ) {
        passAddress = true;
      }

      const cartRes = await updateCartData(passAddress, true, 0, false);
      if (cartRes?.success && cartRes.data) {
        store.dispatch(setCartData(cartRes.data));
      }
    } else {
      if (renderToast) {
        addToast({
          title: i18n.t("update_failed_title"),
          description: updateRes.message || i18n.t("update_failed_description"),
          color: "danger",
        });
      }
    }
    return updateRes;
  } catch (error) {
    console.error("handleUpdateCartItem error", error);
    if (renderToast) {
      addToast({
        title: i18n.t("cart.error_title"),
        description: i18n.t("cart.error_description"),
        color: "danger",
      });
    }
    return { success: false, message: "Error updating cart item", data: null };
  } finally {
    store.dispatch(setCartLoading(false));
  }
};

export const handleAddToCart = async (params: {
  product_variant_id: string | number;
  store_id: string | number;
  quantity: string | number;
  onClose: () => void;
  renderToast: boolean;
  replace_quantity?: boolean;
  addons?: { addon_group_id: number; addon_item_id: number }[];
  /**
   * [RESTORED 2026-09-22] Back-in-stock opt-in, forwarded to `addToCart`.
   * ProductVariantModal sends it when the customer taps the bell on a variant
   * that is out of stock; without it here the modal would not compile.
   */
  is_notify?: number | boolean;
}) => {
  const { onClose = () => {}, renderToast = true } = params;

  try {
    const isLoggedIn = store.getState().auth.isLoggedIn;

    if (!isLoggedIn) {
      onClose();
      const btn = document.getElementById("login-btn");
      btn?.click();
      addToast({
        title: i18n.t("cart.login_required"),
        color: "warning",
      });

      return {
        success: false,
        message: `${i18n.t("cart.login_required")}`,
        data: null,
      };
    }

    store.dispatch(setCartLoading(true));

    const addRes: ApiResponse<CartResponse> = await addToCart(params);

    if (addRes.success) {
      onClose();
      if (renderToast) {
        addToast({
          title: i18n.t("cart.add_success"),
          color: "success",
        });
      }
      let passAddress = false;

      if (
        window.location.pathname === "/cart" ||
        window.location.pathname === "/cart/"
      ) {
        passAddress = true;
      }

      const cartRes = await updateCartData(passAddress, true, 0, false);

      if (cartRes?.success && cartRes.data) {
        store.dispatch(setCartData(cartRes.data));
        if (window.location.pathname.startsWith("/cart")) {
          document.getElementById("refetch-similar-products")?.click();
        }
      } else {
        store.dispatch(setError(i18n.t("cart.fetch_failed")));

        if (renderToast) {
          addToast({
            title: i18n.t("cart.fetch_failed_title"),
            description: i18n.t("cart.fetch_failed_description"),
            color: "warning",
          });
        }
      }
    } else {
      store.dispatch(setError(addRes.message || i18n.t("cart.add_failed")));
      if (renderToast) {
        addToast({
          title: i18n.t("cart.add_failed_title"),
          description: addRes.message || i18n.t("cart.add_failed_description"),
          color: "danger",
        });
      }
    }

    return addRes;
  } catch (error) {
    console.error("handleAddToCart error", error);
    store.dispatch(setError(i18n.t("cart.error_message")));
    if (renderToast) {
      addToast({
        title: i18n.t("cart.error_title"),
        description: i18n.t("cart.error_description"),
        color: "danger",
      });
    }

    return {
      success: false,
      message: i18n.t("cart.error_description"),
      data: {
        id: null,
        uuid: null,
        user_id: null,
        items_count: 0,
        total_quantity: 0,
        items: [],
        payment_summary: {
          items_total: null,
          per_store_drop_off_fee: null,
          is_rush_delivery: false,
          is_rush_delivery_available: false,
          delivery_charges: 0,
          handling_charges: 0,
          delivery_distance_charges: 0,
          delivery_distance_km: 0,
          total_stores: 0,
          total_delivery_charges: 0,
          membership_discount: 0,
          estimated_delivery_time: 0,
          use_wallet: false,
          wallet_balance: 0,
          wallet_amount_used: 0,
          payable_amount: 0,

          promo_code: "",
          promo_discount: 0,
          promo_applied: [],
          promo_error: null,
        },
        created_at: "",
        updated_at: "",
      },
    };
  } finally {
    store.dispatch(setCartLoading(false));
  }
};

export const handleOfflineAddToCart = (params: {
  product: Product;
  variant: ProductVariant;
  quantity: number;
  onClose?: () => void;
  renderToast?: boolean;
  addons?: {
    addon_group_id: number;
    addon_item_id: number;
    title: string;
    price: number;
  }[];

}) => {
  const {
    product,
    variant,
    quantity,
    onClose,
    renderToast = true,
    addons = [],
  } = params;
  const minQuantity = product.minimum_order_quantity || 1;
  const stepSize = product.quantity_step_size || 1;
  const maxAllowed = product.total_allowed_quantity || 1;
  const stock = variant.stock || 0;
  const maxQuantity = Math.min(maxAllowed, stock);
  const finalPrice =
    Number(variant.special_price) > 0 &&
    Number(variant.special_price) < Number(variant.price)
      ? Number(variant.special_price)
      : Number(variant.price);
  const addonSuffix =
    addons.length > 0
      ? `-${addons
          .map((a) => a.addon_item_id)
          .sort()
          .join("-")}`
      : "";
  const itemId = `${variant.id}${addonSuffix}`;

  store.dispatch(
    addOfflineCartItem({
      id: itemId,
      name: product.title || variant.title,
      slug: product.slug,
      image: variant.image || product.main_image,
      price: finalPrice,
      quantity: quantity || minQuantity,
      storeName: variant.store_name,
      storeSlug: variant.store_slug,
      minQuantity: minQuantity,
      maxQuantity: maxQuantity,
      stepSize: stepSize || 1,
      stock: stock,
      product_variant_id: variant.id,
      store_id: variant.store_id,
      addons: addons,
    }),
  );

  if (renderToast) {
    addToast({
      title: i18n.t("cart.add_success"),
      description: i18n.t("cart.login_required"),
      color: "primary",
    });
  }

  onClose?.();

  return {
    success: true,
    data: null,
    message: "offline_cart_updated",
  };
};

export const handleUpdateOfflineCartItem = (params: {
  product: Product;
  variant: ProductVariant;
  quantity: number;
  oldId: string;
  onClose?: () => void;
  renderToast?: boolean;
  addons?: {
    addon_group_id: number;
    addon_item_id: number;
    title: string;
    price: number;
  }[];
}) => {
  const {
    product,
    variant,
    quantity,
    oldId,
    onClose,
    renderToast = true,
    addons = [],
  } = params;
  const minQuantity = product.minimum_order_quantity || 1;
  const stepSize = product.quantity_step_size || 1;
  const maxAllowed = product.total_allowed_quantity || 1;
  const stock = variant.stock || 0;
  const maxQuantity = Math.min(maxAllowed, stock);
  const finalPrice =
    Number(variant.special_price) > 0 &&
    Number(variant.special_price) < Number(variant.price)
      ? Number(variant.special_price)
      : Number(variant.price);

  const addonSuffix =
    addons.length > 0
      ? `-${addons
          .map((a) => a.addon_item_id)
          .sort()
          .join("-")}`
      : "";
  const nextId = `${variant.id}${addonSuffix}`;

  store.dispatch(
    updateOfflineCartItem({
      id: oldId,
      newItem: {
        id: nextId,
        name: product.title || variant.title,
        slug: product.slug,
        image: variant.image || product.main_image,
        price: finalPrice,
        quantity: quantity || minQuantity,
        storeName: variant.store_name,
        storeSlug: variant.store_slug,
        minQuantity: minQuantity,
        maxQuantity: maxQuantity,
        stepSize: stepSize || 1,
        stock: stock,
        product_variant_id: variant.id,
        store_id: variant.store_id,
        addons: addons,
      },
    }),
  );

  if (renderToast) {
    addToast({
      title: i18n.t("cart_updated_title"),
      color: "primary",
    });
  }

  onClose?.();

  return {
    success: true,
    data: null,
    message: "offline_cart_updated",
  };
};

export const resetCheckOutState = () => {
  store.dispatch(setPromoCode(""));
  store.dispatch(setRusDelivery(false));
  store.dispatch(setUseWallet(false));
  store.dispatch(setSelectedAddress(null));
  // Clear attachments from window
  if (typeof window !== "undefined") {
    (window as any).__cartAttachments = {};
  }
};

/**
 * Gateways where the customer pays on the provider's hosted page AFTER the
 * order is created. The server returns that page as `payment_response.link`.
 */
export const REDIRECT_GATEWAYS = [
  "flutterwavePayment",
  "xenditPayment",
  "cashfreePayment",
] as const;

export const isRedirectGateway = (paymentType: string): boolean =>
  (REDIRECT_GATEWAYS as readonly string[]).includes(paymentType);

export const handleCheckout = async (
  payment_type: string = "cod",
  extra_params: object,
) => {
  try {
    const state = store.getState();
    const address_id = state?.checkout?.selectedAddress?.id || "";
    const order_note = state?.checkout?.orderNote || "";
    const use_wallet = state?.checkout?.useWallet || false;
    const rush_delivery = state?.checkout?.rushDelivery || false;
    const promo_code = state?.checkout?.promoCode || "";

    if (!address_id) {
      console.error(i18n.t("checkout.no_address"));
      return fallbackApiRes;
    }

    // Get attachments from window
    const attachments = (window as any).__cartAttachments || {};

    // Always use FormData
    const formData = new FormData();
    formData.append("payment_type", payment_type);
    formData.append("promo_code", promo_code);
    formData.append("gift_card", "");
    formData.append("gift_card_discount", "");
    // [2026-09-23 final approval, item 12] The delivery choice travels with
    // the order: `delivery_type` (required by the server — it was never sent,
    // so every web checkout was refused) and the booked window, if any.
    // resolveDeliveryParams is the one place that decides it; a booked window
    // also switches rush off.
    const delivery = resolveDeliveryParams({
      rushDelivery: rush_delivery,
      scheduledDelivery: state?.checkout?.scheduledDelivery ?? null,
    });
    formData.append("delivery_type", delivery.delivery_type);
    formData.append("rush_delivery", delivery.rush_delivery ? "1" : "0");
    if (delivery.scheduled_date) {
      formData.append("scheduled_date", delivery.scheduled_date);
    }
    if (delivery.delivery_time_slot_id !== null) {
      formData.append("delivery_time_slot_id", String(delivery.delivery_time_slot_id));
    }
    if (delivery.scheduled_slot_start_time && delivery.scheduled_slot_end_time) {
      formData.append("scheduled_slot_start_time", delivery.scheduled_slot_start_time);
      formData.append("scheduled_slot_end_time", delivery.scheduled_slot_end_time);
    }
    formData.append("use_wallet", use_wallet ? "1" : "0");
    formData.append("address_id", address_id.toString());
    formData.append("order_note", order_note);
    formData.append(
      "redirect_url",
      `${window.location.origin}/my-account/orders`,
    );

    // Add extra params
    Object.entries(extra_params).forEach(([key, value]) => {
      formData.append(key, value as string);
    });

    // Add attachments if any
    Object.entries(attachments).forEach(
      ([productId, attachment]: [string, any]) => {
        if (Array.isArray(attachment)) {
          attachment.forEach((fileItem) => {
            if (fileItem && fileItem.file) {
              formData.append(`attachments[${productId}][]`, fileItem.file);
            }
          });
        } else if (attachment && attachment.file) {
          formData.append(`attachments[${productId}][]`, attachment.file);
        }
      },
    );

    const response = await createOrder(formData);

    if (response.success) {
      const { data } = response;

      if (data) {
        trackPurchase(
          data?.id?.toString?.() || "",
          data?.final_total || 0,
          data?.currency_code || "",
          data?.promo_code || "",
          data?.delivery_charge,
          data?.items || [],
        );
      }

      const paymentLink = response?.data?.payment_response?.link || "";

      // [CHANGE 2026-09-23] Every pay-AFTER-order gateway, not just Flutterwave.
      //
      // For these gateways the order is created PENDING and the customer pays
      // on the provider's own page, whose address the server returns as
      // `payment_response.link`. Only Flutterwave was followed; a Xendit or
      // Cashfree order was confirmed with a success toast and the customer was
      // never sent to pay — so switching the Pay Online gateway to either of
      // them in Payment Settings produced orders that could never be paid.
      if (isRedirectGateway(payment_type)) {
        if (isValidUrl(paymentLink)) {
          resetCheckOutState();
          window.location.href = paymentLink;

          return { success: true, data: null, message: "Redirected" };
        } else {
          const isFlutterwave = payment_type === "flutterwavePayment";
          addToast({
            title: i18n.t(
              isFlutterwave
                ? "checkout.flutterwave_link_invalid"
                : "checkout.payment_link_invalid",
            ),
            description:
              i18n.t(
                isFlutterwave
                  ? "checkout.flutterwave_link_error_message"
                  : "checkout.payment_link_error_message",
              ) || "Payment link is invalid or missing. Please try again.",
            color: "danger",
          });
          console.error(`Invalid ${payment_type} payment link:`, paymentLink);
          return response; // stop here if invalid
        }
      }

      addToast({
        title: i18n.t("checkout.success"),
        size: "lg",
      });
      document.getElementById("confetti-btn")?.click();
      resetCheckOutState();
      // Refresh and clear Redux cart state since the items are now ordered
      void updateCartData(false, false, 0, false);
    } else {
      addToast({
        title: response.message || i18n.t("checkout.error_title"),
        color: "danger",
      });
      console.error(response.message || i18n.t("checkout.error_console"));
    }
    return response;
  } catch (error) {
    console.error("Checkout error:", error);
    return fallbackApiRes;
  }
};

export const formatAmount = (value: number | string) => {
  if (!value) return "0.00";
  return Number(value).toFixed(2);
};

export const urlToFile = async (
  url: string,
  filename: string,
): Promise<File> => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const file = new File([blob], filename, { type: blob.type });
    return file;
  } catch (error) {
    console.error(`Failed to fetch image from ${url}:`, error);
    throw error;
  }
};

export const isRTL = (currentLang: string = "") => {
  return ["ar", "fa", "ur"].includes(currentLang);
};

/* ------------------------------------------------------------------------ *
 * Delivery timing and the SSR location fallback
 *
 * [RESTORED 2026-09-22] Lost with the workspace; their tests survived the
 * recovery archive and their source did not. Rebuilt from
 * tests/helpers/deliveryParams.test.ts, cartScheduling.test.ts and
 * fallbackLocation.test.ts.
 * ------------------------------------------------------------------------ */

/** What checkout sends the order endpoint about when the parcel should arrive. */
export interface DeliveryParams {
  delivery_time_slot_id: number | null;
  rush_delivery: boolean;
  delivery_type: "delivery";
  scheduled_date: string | null;
  scheduled_slot_start_time: string | null;
  scheduled_slot_end_time: string | null;
}

/** ISO date, exactly — `30-07-2026` and `2026-7-3` are not bookings. */
const isIsoDate = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

/** `HH:MM` or `HH:MM:SS`, 24-hour. A display label like "2 PM" is not a time. */
const isClockTime = (value: unknown): value is string =>
  typeof value === "string" &&
  /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value);

/**
 * The delivery fields for an order, resolved from checkout state.
 *
 * This is the last gate before an order is created, and it exists because the
 * backend takes `rush_delivery` and the scheduling fields as INDEPENDENT
 * inputs — nothing server-side rejects an order that asks to arrive as soon as
 * possible *and* at 2pm on Thursday. The reducers keep the two apart in state;
 * this keeps them apart on the wire even if state somehow holds both.
 *
 * A booked window always beats rush, and a booking is only sent when it is
 * complete:
 *
 *  - by **id**: a positive `slotDbId` plus a valid ISO `date`;
 *  - by **time**: `slotStartTime` AND `slotEndTime` plus a valid ISO `date`.
 *
 * Anything partial is dropped rather than half-sent. A legacy session saved
 * before the slots endpoint existed carries a generated `slotId`
 * ("2026-07-19-08") and no numeric id; coercing that would book a window that
 * does not exist, so it counts as no booking and rush is free to apply. Slot id
 * 0 and negatives are likewise not bookings — backend ids are 1-based, so a
 * falsy-but-present id must not read as "scheduled" in one branch and "not
 * scheduled" in the next.
 *
 * `delivery_type` is always "delivery": the field is required on every order
 * and this storefront has no self-collection flow. A booked window is flagged
 * by the backend's own `is_scheduled_delivery`, not by this field.
 */
export const resolveDeliveryParams = (state?: {
  rushDelivery?: boolean;
  scheduledDelivery?: {
    slotDbId?: number;
    slotId?: string;
    date?: string;
    slotStartTime?: string;
    slotEndTime?: string;
  } | null;
}): DeliveryParams => {
  const scheduled = state?.scheduledDelivery ?? null;

  const hasDate = isIsoDate(scheduled?.date);

  const slotId =
    typeof scheduled?.slotDbId === "number" &&
    Number.isFinite(scheduled.slotDbId) &&
    scheduled.slotDbId > 0
      ? scheduled.slotDbId
      : null;

  const bookedById = slotId !== null && hasDate;

  // Both ends or neither: half an identity books the wrong window, or is
  // rejected outright.
  const bookedByTime =
    !bookedById &&
    hasDate &&
    isClockTime(scheduled?.slotStartTime) &&
    isClockTime(scheduled?.slotEndTime);

  const booked = bookedById || bookedByTime;

  return {
    delivery_time_slot_id: bookedById ? slotId : null,
    // A booked window suppresses rush. Not the other way round: by the time an
    // order is submitted the window is the more specific instruction.
    rush_delivery: booked ? false : Boolean(state?.rushDelivery),
    delivery_type: "delivery",
    scheduled_date: booked ? (scheduled?.date as string) : null,
    scheduled_slot_start_time: bookedByTime
      ? (scheduled?.slotStartTime as string)
      : null,
    scheduled_slot_end_time: bookedByTime
      ? (scheduled?.slotEndTime as string)
      : null,
  };
};

/**
 * Coordinates to render with when the visitor has given none.
 *
 * Crawlers send no cookies and the catalog API rejects blank coordinates with a
 * 422, so without this every bot-rendered product page came back empty — which
 * is an SEO problem, not a UX one. The backend's configured default is
 * preferred because `generate-sitemap.mjs` resolves its URLs at exactly those
 * coordinates, so everything in the sitemap resolves.
 *
 * A junk coordinate is strictly worse than the static constant: the API answers
 * a non-numeric one with a validation error rather than an empty list. Both
 * values must parse as numbers, and both must be present — but 0 is a real
 * longitude (Greenwich) and must never be read as "unset".
 *
 * Always returns usable coordinates. There is no branch that can produce a
 * blank.
 */
export const getFallbackLocation = (
  settings?: Settings | null,
): { lat: string; lng: string } => {
  const fallback = { lat: String(staticLat), lng: String(staticLng) };

  if (!Array.isArray(settings)) {
    if (settings) {
      console.warn("getFallbackLocation: settings is not the expected list");
    }
    return fallback;
  }

  const web = settings.find(
    (entry) =>
      entry &&
      typeof entry === "object" &&
      (entry as { variable?: unknown }).variable === "web",
  ) as { value?: unknown } | undefined;

  const value = web?.value;

  if (!value || typeof value !== "object") {
    return fallback;
  }

  const { defaultLatitude, defaultLongitude } = value as {
    defaultLatitude?: unknown;
    defaultLongitude?: unknown;
  };

  const usable = (coord: unknown): coord is string | number =>
    coord !== null &&
    coord !== undefined &&
    String(coord).trim() !== "" &&
    Number.isFinite(Number(coord));

  if (!usable(defaultLatitude) || !usable(defaultLongitude)) {
    return fallback;
  }

  return { lat: String(defaultLatitude), lng: String(defaultLongitude) };
};

/**
 * [RESTORED 2026-09-22] Back-in-stock notification toggle.
 *
 * Four components import this (ProductModal, both variant modals and the
 * product detail section) and none of them compiled without it. It rides on
 * `getProductBySlug`'s `is_notify` parameter rather than a dedicated endpoint,
 * which is why there is no route to add for it.
 */
export const handleNotifyProduct = async (params: {
  slug: string;
  variant_id: string | number;
  is_notify: number;
  onClose?: () => void;
}) => {
  const { onClose = () => {}, is_notify, slug, variant_id } = params;
  try {
    const isLoggedIn = store.getState().auth.isLoggedIn;

    if (!isLoggedIn) {
      onClose();
      const btn = document.getElementById("login-btn");
      btn?.click();
      addToast({
        title: i18n.t("cart.login_required"),
        color: "warning",
      });

      return {
        success: false,
        message: i18n.t("cart.login_required"),
        data: null,
      };
    }

    const cookieLoc = document.cookie
      .split("; ")
      .find((row) => row.startsWith("userLocation="));
    const userLocStr = cookieLoc
      ? decodeURIComponent(cookieLoc.split("=")[1])
      : null;
    let lat: string | number = "";
    let lng: string | number = "";
    if (userLocStr) {
      try {
        const userLoc = JSON.parse(userLocStr);
        lat = userLoc.lat;
        lng = userLoc.lng;
      } catch {
        // ignore
      }
    }

    const res = await getProductBySlug({
      slug,
      latitude: lat,
      longitude: lng,
      is_notify,
      variant_id,
    });

    if (res.success) {
      if (is_notify === 1) {
        addToast({
          title: i18n.t("notification_set_success", {
            defaultValue: "Notification set! We'll notify you when this item is back in stock.",
          }),
          color: "success",
        });
      } else {
        addToast({
          title: i18n.t("notification_cancelled", {
            defaultValue: "Notification reminder updated.",
          }),
          color: "default",
        });
      }
      return { success: true };
    } else {
      addToast({
        title: res.message || "Failed to update notification.",
        color: "danger",
      });
      return { success: false, message: res.message };
    }
  } catch {
    addToast({
      title: i18n.t("cart.error_title"),
      description: "Something went wrong.",
      color: "danger",
    });
    return { success: false };
  }
};
