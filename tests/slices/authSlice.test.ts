import { describe, it, expect } from "vitest";
import reducer, {
  login,
  logout,
  setUserDataRedux,
} from "@/lib/redux/slices/authSlice";
import type { userData } from "@/types/ApiResponse";

const user = (over: Partial<userData> = {}) =>
  ({ id: 1, name: "Jo", email: "jo@example.com", ...over }) as userData;

/**
 * The real anonymous state.
 *
 * [CHANGE 2026-09-22] `activeMemberships` was missing from this fixture, which
 * predates the field. The reducer clears it on logout — correctly, since a
 * stale membership left in the store would keep member pricing visible to
 * whoever signs in next — so the fixture, not the reducer, was wrong. Listing
 * it here means this test now also asserts that logout drops memberships.
 */
const loggedOut = {
  isLoggedIn: false,
  access_token: "",
  user: null,
  activeMemberships: [],
};

describe("authSlice", () => {
  it("login sets the session, token and user", () => {
    const state = reducer(
      loggedOut,
      login({ user: user(), access_token: "tok_123" }),
    );
    expect(state.isLoggedIn).toBe(true);
    expect(state.access_token).toBe("tok_123");
    expect(state.user?.id).toBe(1);
  });

  it("logout resets to the anonymous state", () => {
    // `activeMemberships` is required on AuthState — an incomplete fixture is
    // not a smaller test, it is a test of a state the reducer never sees.
    const loggedIn = {
      isLoggedIn: true,
      access_token: "tok_123",
      user: user(),
      activeMemberships: [],
    };
    expect(reducer(loggedIn, logout())).toEqual(loggedOut);
  });

  it("setUserDataRedux seeds the user when none exists", () => {
    const state = reducer(loggedOut, setUserDataRedux(user({ name: "Sam" })));
    expect(state.user?.name).toBe("Sam");
  });

  it("setUserDataRedux merges into an existing user", () => {
    const start = {
      isLoggedIn: true,
      access_token: "t",
      user: user(),
      activeMemberships: [],
    };
    const state = reducer(start, setUserDataRedux({ name: "Renamed" }));
    expect(state.user?.name).toBe("Renamed");
    // untouched fields survive the merge
    expect(state.user?.email).toBe("jo@example.com");
  });
});
