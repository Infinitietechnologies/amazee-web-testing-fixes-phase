import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Address } from "@/types/ApiResponse";

/**
 * A booked delivery window.
 *
 * [RESTORED 2026-09-22] Lost with the workspace; the tests that specify it
 * survived the recovery archive and the source did not. Rebuilt from
 * tests/slices/checkoutSlice.test.ts.
 *
 * `slotDbId` is the real `delivery_time_slot_id` the backend books against and
 * is OPTIONAL on purpose: checkout state is persisted to localStorage, and a
 * session saved before the slots endpoint existed carries a generated
 * `slotId` ("2026-07-19-08") and no numeric id at all. Consumers must read that
 * as "the customer has to pick again" — never coerce `slotId` into a number,
 * because a generated one is not a slot and booking against it would send the
 * order to a window that does not exist.
 */
export interface ScheduledDelivery {
  /** Local YYYY-MM-DD. */
  date: string;
  /** String form of the slot id, kept for React keys and existing comparisons. */
  slotId: string;
  /**
   * The backend's `delivery_time_slot_id` — what createOrder must send.
   *
   * Optional because this state is persisted to localStorage: a session saved
   * before real slots existed has a generated `slotId` like "2026-07-19-08" and
   * no numeric id at all. Consumers must treat a missing value as "re-pick
   * required" rather than coercing the old string.
   */
  slotDbId?: number;
  /**
   * Raw "HH:MM:SS" bounds, set only on the cart contract, where slots have no
   * id and an order books a window by its times instead. Kept separate from
   * `startHour`/`endHour` (display-derived integers) because those lose the
   * minutes — a 14:30 slot would submit as "14:00:00" and book the wrong window.
   */
  slotStartTime?: string;
  slotEndTime?: string;
  startHour: number;
  endHour: number;
  /** Backend-formatted for display, e.g. "10:00 AM - 12:00 PM". */
  label: string;
  /** Store the slot belongs to — a slot is one store's promise, not portable. */
  storeId?: number;
}

export interface CheckoutState {
  /**
   * [RESTORED 2026-09-22] Whether the customer is spending loyalty points on
   * this checkout. The reducer and the CheckoutSection that reads it both
   * survived the workspace reclaim; the slice field did not.
   */
  useLoyaltyPoints: boolean;
  selectedAddress: Address | null;
  orderNote: string;
  useWallet: boolean;
  rushDelivery: boolean;
  scheduledDelivery: ScheduledDelivery | null;
  promoCode: string;
}

const initialState: CheckoutState = {
  useLoyaltyPoints: false,
  selectedAddress: null,
  orderNote: "",
  useWallet: false,
  rushDelivery: false,
  scheduledDelivery: null,
  promoCode: "",
};

const checkoutSlice = createSlice({
  name: "checkout",
  initialState,
  reducers: {
    setUseLoyaltyPoints: (state, action: PayloadAction<boolean>) => {
      state.useLoyaltyPoints = action.payload;
    },
    setSelectedAddress: (state, action: PayloadAction<Address | null>) => {
      state.selectedAddress = action.payload;
    },
    setOrderNote: (state, action: PayloadAction<string>) => {
      state.orderNote = action.payload;
    },
    setUseWallet: (state, action: PayloadAction<boolean>) => {
      state.useWallet = action.payload;
    },

    /**
     * Rush and a booked window contradict each other, and the backend takes
     * `rush_delivery` and `delivery_time_slot_id` as independent fields —
     * nothing server-side rejects the combination, so an order could ask to
     * arrive as soon as possible AND at 1pm on Thursday. These two reducers are
     * the only place that invariant can be enforced.
     *
     * Only switching rush ON conflicts. Switching it off must not discard a
     * window the customer just chose.
     */
    setRusDelivery: (state, action: PayloadAction<boolean>) => {
      state.rushDelivery = action.payload;

      if (action.payload) {
        state.scheduledDelivery = null;
      }
    },

    /**
     * A null payload is a CLEAR, not a booking, so it must not switch rush off
     * — otherwise clearing a window would silently change how the order ships.
     */
    setScheduledDelivery: (
      state,
      action: PayloadAction<ScheduledDelivery | null>,
    ) => {
      state.scheduledDelivery = action.payload;

      if (action.payload) {
        state.rushDelivery = false;
      }
    },

    /** Clears the window and leaves rush exactly as it was. */
    clearScheduledDelivery: (state) => {
      state.scheduledDelivery = null;
    },

    setPromoCode: (state, action: PayloadAction<string>) => {
      state.promoCode = action.payload;
    },
  },
});

export const {
  setSelectedAddress,
  setOrderNote,
  setUseWallet,
  setRusDelivery,
  setScheduledDelivery,
  clearScheduledDelivery,
  setPromoCode,
  setUseLoyaltyPoints,
} = checkoutSlice.actions;
export default checkoutSlice.reducer;
