import { describe, expect, it } from "vitest";
import { replacementStageState } from "@/helpers/replacementStage";

// [2026-10-06] Audit 7.6 — PDF §29: each replacement stage shows as done,
// delayed (past the admin's time limit) or pending.
describe("replacementStageState", () => {
  const base = { key: "seller_approved", label: "Seller Approved", at: null, expected_by: "2026-10-07 10:00:00" };

  it("a done stage is done even if it was late", () => {
    expect(replacementStageState({ ...base, at: "2026-10-08 09:00:00", done: true, delayed: false })).toBe("done");
  });

  it("a stage past its time limit is delayed", () => {
    expect(replacementStageState({ ...base, done: false, delayed: true })).toBe("delayed");
  });

  it("otherwise it is pending", () => {
    expect(replacementStageState({ ...base, done: false, delayed: false })).toBe("pending");
  });
});
