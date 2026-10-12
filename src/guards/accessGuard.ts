import { UserMembership } from "@/types/ApiResponse";

/** Set to false to disable login + membership gating (e.g. during development). */
export const REQUIRE_SITE_ACCESS_GATE =
  process.env.NEXT_PUBLIC_REQUIRE_SITE_ACCESS_GATE !== "false";

/** Accessible without login (auth recovery, legal, etc.). */
export const PUBLIC_ROUTES = [
  "/forgot-password",
  "/seller-register",
  "/privacy-policy",
  "/terms-and-conditions",
  "/shipping-policy",
  "/return-refund-policy",
];

/** Accessible when logged in but membership not purchased yet. */
export const MEMBERSHIP_ONBOARDING_ROUTES = ["/membership"];

export type SiteAccessStatus =
  | "allowed"
  | "login_required"
  | "membership_required"
  | "checking";

export const normalizePath = (path: string) =>
  path !== "/" ? path.replace(/\/+$/, "") : "/";

export const hasActiveMembership = (
  memberships: UserMembership[] | undefined,
): boolean =>
  Boolean(
    // [2026-10-06] Audit 56.3: a running free trial counts; once it has
    // ended the customer is sent to /membership (the mandatory screen).
    memberships?.some(
      (m) => (m.status === "active" || m.status === "trial") && !m.is_expired,
    ),
  );

const matchesRoute = (path: string, routes: string[]) =>
  routes.some((route) => path === route || path.startsWith(`${route}/`));

export const isPublicRoute = (pathname: string) =>
  matchesRoute(normalizePath(pathname), PUBLIC_ROUTES);

export const isMembershipOnboardingRoute = (pathname: string) =>
  matchesRoute(normalizePath(pathname), MEMBERSHIP_ONBOARDING_ROUTES);

export const getSiteAccessStatus = (
  pathname: string,
  isLoggedIn: boolean,
  memberships: UserMembership[] | undefined,
  isCheckingMembership: boolean,
): SiteAccessStatus => {
  if (!REQUIRE_SITE_ACCESS_GATE) {
    return "allowed";
  }

  const path = normalizePath(pathname);

  // Public routes are only freely accessible to guests (not logged in).
  // Logged-in users without an active membership must still go through the gate.
  if (!isLoggedIn && isPublicRoute(path)) {
    return "allowed";
  }

  if (!isLoggedIn) {
    return "login_required";
  }

  if (isCheckingMembership) {
    return "checking";
  }

  // Logged-in + membership onboarding route (e.g. /membership) — always allowed
  if (isMembershipOnboardingRoute(path)) {
    return "allowed";
  }

  if (!hasActiveMembership(memberships)) {
    return "membership_required";
  }

  return "allowed";
};
