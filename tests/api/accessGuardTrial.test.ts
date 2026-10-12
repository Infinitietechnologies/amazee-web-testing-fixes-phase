import { describe, it, expect } from "vitest";
import { getSiteAccessStatus, hasActiveMembership } from "@/guards/accessGuard";
import { UserMembership } from "@/types/ApiResponse";

const membership = (status: string, is_expired: boolean) =>
  ({ id: 1, status, is_expired }) as UserMembership;

describe("site access during and after the free trial", () => {
  it("a running trial counts as membership", () => {
    expect(hasActiveMembership([membership("trial", false)])).toBe(true);
    expect(getSiteAccessStatus("/cart", true, [membership("trial", false)], false)).toBe("allowed");
  });

  it("an ended trial sends the customer to the membership screen", () => {
    expect(hasActiveMembership([membership("trial", true)])).toBe(false);
    expect(getSiteAccessStatus("/cart", true, [membership("trial", true)], false)).toBe("membership_required");
    expect(getSiteAccessStatus("/membership", true, [membership("trial", true)], false)).toBe("allowed");
  });

  it("a paid membership is unchanged", () => {
    expect(hasActiveMembership([membership("active", false)])).toBe(true);
    expect(hasActiveMembership([membership("expired", true)])).toBe(false);
  });
});
