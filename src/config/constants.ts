import {
  OrderItem,
  OrderItemReturnRequest,
  OrderStatus,
} from "@/types/ApiResponse";

export const fallbackPaginateRes = {
  success: false,
  message: "An error occurred.",
  data: {
    current_page: 0,
    data: [],
    per_page: 0,
    total: 0,
  },
};
export const fallbackPaginateResOfProductReviews = {
  success: false,
  message: "An error occurred.",
  data: {
    current_page: 0,
    data: {
      total_reviews: 0,
      average_rating: "0",
      ratings_breakdown: {
        "1_star": "0",
        "2_star": "0",
        "3_star": "0",
        "4_star": "0",
        "5_star": "0",
      },
      reviews: [],
    },
    per_page: 0,
    total: 0,
  },
};

export const fallbackApiRes = {
  success: false,
  message: "An error occurred.",
  data: undefined,
};

export const fallbackBannerRes = {
  success: false,
  message: "An error occurred.",
  data: {
    current_page: 0,
    data: { top: [], carousel: [], sidebar: [] },
    per_page: 0,
    total: 0,
  },
};

export const orderStatusColorMap = (
  // [CHANGE 2026-09-22] Widened from `OrderStatus` to plain string. The switch
  // already has a default branch, and the order payload can carry a status the
  // union does not list yet — narrowing here only moved that risk to a cast.
  status: OrderStatus | string | undefined
): "default" | "primary" | "secondary" | "success" | "warning" | "danger" => {
  switch (status) {
    case "awaiting_store_response":
      return "warning";
    case "ready_for_pickup":
      return "secondary";
    case "assigned":
      return "primary";
    case "out_for_delivery":
      return "warning";
    case "delivered":
      return "success";
    case "cancelled":
      return "danger";
    default:
      return "default";
  }
};
export const orderStatusPriority: Record<string, number> = {
  pending: 1,
  awaiting_store_response: 2,
  partially_accepted: 3,
  accepted: 3,
  rejected_by_seller: 3.5,
  preparing: 4,
  ready_for_pickup: 5,
  assigned: 6,
  out_for_delivery: 7,
  delivered: 8,
  cancelled: 9,
  returned: 10,
};

export const staticProfileImage =
  "https://i.pravatar.cc/150?u=a042581f4e29026704d";

export const TILE_LAYERS = [
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
  "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
  "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
  "https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}.png",
  "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}.png",
  "https://tiles.stadiamaps.com/tiles/terrain/{z}/{x}/{y}.png",
];

export const staticLat = 23.242;
export const staticLng = 69.6669;

export const demoEmail = "user@gmail.com";
export const demoPassword = "12345678";
export const demoNumber = "9000000000";

/* ------------------------------------------------------------------------ *
 * Order-item display status
 *
 * [RESTORED 2026-09-22] These three helpers were lost when the workspace was
 * reclaimed — their tests survived the recovery archive and their source did
 * not. Rebuilt from tests/helpers/itemDisplayStatus.test.ts, which specifies
 * the behaviour precisely.
 * ------------------------------------------------------------------------ */

/** What the colour props on the status chip accept. */
export type ReturnStatusColor =
  | "default"
  | "primary"
  | "success"
  | "warning"
  | "danger";

/**
 * The return request a customer is actually waiting on.
 *
 * An item can accumulate several — a rejected attempt followed by a fresh one —
 * and the array order is whatever the API happened to serialise, so the most
 * recently touched request wins rather than the first. `updated_at` is the
 * signal; `created_at` covers a row that has never been updated, and a date
 * neither field can parse sorts last rather than throwing the whole list away.
 */
export const getActiveReturnRequest = (
  item?: Pick<OrderItem, "status" | "returns"> | null,
): OrderItemReturnRequest | null => {
  const returns = item?.returns;

  if (!Array.isArray(returns) || returns.length === 0) {
    return null;
  }

  const touchedAt = (request: OrderItemReturnRequest): number => {
    for (const value of [request?.updated_at, request?.created_at]) {
      const parsed = Date.parse(String(value ?? "").replace(" ", "T"));
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
    // Unparseable: keep the row, but never let it outrank a dated one.
    return Number.NEGATIVE_INFINITY;
  };

  return returns.reduce((latest, candidate) =>
    touchedAt(candidate) > touchedAt(latest) ? candidate : latest,
  );
};

/**
 * The status to show for an order item.
 *
 * An item's own status stops moving once it is delivered, so an item with a
 * return in progress would sit on "Delivered" for ever and tell the customer
 * nothing about the thing they are actually waiting for. An active return
 * therefore supersedes it — but only when it carries a status of its own; a
 * blank one is no information and must not blank out the item's.
 */
export const getItemDisplayStatus = (
  item?: Pick<OrderItem, "status" | "returns"> | null,
): { status: string; color: ReturnType<typeof orderStatusColorMap>; isReturn: boolean } => {
  const active = getActiveReturnRequest(item);
  const returnStatus = String(active?.return_status ?? "").trim();

  if (active && returnStatus !== "") {
    return {
      status: returnStatus,
      // [RESTORED 2026-09-22] The chip colour travels with the status. Both
      // callers in OrderItems read `.color`, and the reconstruction after the
      // workspace reclaim had dropped it — so the orders page did not compile.
      color: getReturnStatusColor(returnStatus),
      isReturn: true,
    };
  }

  const status = String(item?.status ?? "");

  return { status, color: orderStatusColorMap(status), isReturn: false };
};

/**
 * Chip colour for a return status.
 *
 * Keyed on the statuses the backend actually sends. Anything unrecognised —
 * including a status added later — goes grey rather than throwing, because a
 * new workflow state must never be able to break the orders page.
 */
export const getReturnStatusColor = (
  status?: string | null,
): ReturnStatusColor => {
  const colours: Record<string, ReturnStatusColor> = {
    pending: "warning",
    requested: "warning",
    seller_approved: "primary",
    store_approved: "primary",
    approved: "primary",
    picked_up: "primary",
    received: "primary",
    refund_initiated: "primary",
    refund_processed: "success",
    completed: "success",
    store_rejected: "danger",
    seller_rejected: "danger",
    rejected: "danger",
    cancelled: "danger",
  };

  return colours[String(status ?? "").trim().toLowerCase()] ?? "default";
};
