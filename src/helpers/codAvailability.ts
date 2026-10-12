/**
 * [2026-10-05] Audit 59.3 — owner decision 10: COD / prepaid per order type
 * is set by the admin, and the website follows the same setting as checkout.
 *
 * The cart API sends the server's COD answer for the checkout address
 * (`is_cod_available` + `cod_block_message`: zone switch, out-of-zone rule,
 * COD risk) and the per-order-type rules (`cod_rules`: scheduled orders).
 * A server without `cod_rules` refused COD on every scheduled order (the
 * 23 Sep rule), so that is assumed for it.
 */
export interface CodRules {
  scheduled_cod_allowed: boolean;
  scheduled_cod_message?: string | null;
  out_of_zone_cod_allowed?: boolean;
}

export interface CodCartFields {
  is_cod_available?: boolean;
  cod_block_message?: string | null;
  cod_rules?: CodRules | null;
}

/** Why COD cannot be used for this checkout, or null when it can. */
export function codUnavailableReason(
  cart: CodCartFields | null | undefined,
  isScheduled: boolean,
  fallbacks: { address: string; scheduled: string },
): string | null {
  if (cart?.is_cod_available === false) {
    return cart.cod_block_message || fallbacks.address;
  }
  if (isScheduled && !(cart?.cod_rules?.scheduled_cod_allowed ?? false)) {
    return cart?.cod_rules?.scheduled_cod_message || fallbacks.scheduled;
  }
  return null;
}
