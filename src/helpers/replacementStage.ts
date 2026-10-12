import { ReplacementStage } from "@/types/ApiResponse";

/**
 * [2026-10-06] Audit 7.6 — PDF §29: a replacement stage is done (even if it
 * was late), delayed (past the admin's time limit) or still pending.
 */
export const replacementStageState = (stage: ReplacementStage): "done" | "delayed" | "pending" =>
  stage.done ? "done" : stage.delayed ? "delayed" : "pending";
