/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useSelector } from "react-redux";
import { RootState } from "@/lib/redux/store";
import { updateMembershipDataInRedux } from "@/helpers/functionalHelpers";
import {
  getSiteAccessStatus,
  REQUIRE_SITE_ACCESS_GATE,
  SiteAccessStatus,
} from "@/guards/accessGuard";

export function useSiteAccess() {
  const router = useRouter();
  const isLoggedIn = useSelector((state: RootState) => state.auth.isLoggedIn);
  const activeMemberships = useSelector(
    (state: RootState) => state.auth.activeMemberships,
  );
  const [prevIsLoggedIn, setPrevIsLoggedIn] = useState(isLoggedIn);
  const [isCheckingMembership, setIsCheckingMembership] = useState(
    REQUIRE_SITE_ACCESS_GATE && isLoggedIn,
  );

  if (isLoggedIn !== prevIsLoggedIn) {
    setPrevIsLoggedIn(isLoggedIn);
    if (isLoggedIn && REQUIRE_SITE_ACCESS_GATE) {
      setIsCheckingMembership(true);
    }
  }

  useEffect(() => {
    if (!REQUIRE_SITE_ACCESS_GATE || !isLoggedIn) {
      setIsCheckingMembership(false);
      return;
    }

    let cancelled = false;
    setIsCheckingMembership(true);

    updateMembershipDataInRedux().finally(() => {
      if (!cancelled) {
        setIsCheckingMembership(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

  const status: SiteAccessStatus = useMemo(
    () =>
      getSiteAccessStatus(
        router.pathname,
        isLoggedIn,
        activeMemberships,
        isCheckingMembership,
      ),
    [
      router.pathname,
      isLoggedIn,
      activeMemberships,
      isCheckingMembership,
    ],
  );

  return { status, isCheckingMembership };
}
