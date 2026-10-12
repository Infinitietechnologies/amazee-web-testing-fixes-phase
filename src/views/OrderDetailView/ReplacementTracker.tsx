import { replacementStageState } from "@/helpers/replacementStage";
import { ReplacementStage } from "@/types/ApiResponse";
import { CheckCircle2, CircleDashed, AlertCircle } from "lucide-react";
import React, { FC } from "react";
import { useTranslation } from "react-i18next";

const formatWhen = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  const d = new Date(raw.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
};

/**
 * [2026-10-06] Audit 7.6 — PDF §29: the replacement's stages, each done
 * (with its time), expected by a time, or delayed past it.
 */
const ReplacementTracker: FC<{ stages: ReplacementStage[] }> = ({ stages }) => {
  const { t } = useTranslation();
  if (!stages || stages.length === 0) return null;

  return (
    <div className="col-span-full mt-2">
      <div className="font-semibold text-xs text-blue-900 dark:text-blue-300 mb-1">
        {t("replacementTracking", "Replacement tracking")}
      </div>
      <ul className="flex flex-col gap-1">
        {stages.map((stage) => {
          const state = replacementStageState(stage);
          const when = state === "done" ? formatWhen(stage.at) : formatWhen(stage.expected_by);
          return (
            <li key={stage.key} className="flex items-start gap-2">
              {state === "done" ? (
                <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-success-600" />
              ) : state === "delayed" ? (
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 text-danger-600" />
              ) : (
                <CircleDashed className="w-3.5 h-3.5 mt-0.5 text-gray-400" />
              )}
              <div>
                <div className={state === "done" ? "font-medium text-gray-800 dark:text-gray-200" : "text-gray-500 dark:text-gray-400"}>
                  {stage.label}
                </div>
                {when && (
                  <div className={state === "delayed" ? "text-danger-600" : "text-gray-500 dark:text-gray-400"}>
                    {state === "done"
                      ? when
                      : state === "delayed"
                        ? `${t("replacementDelayed", "Delayed — was expected by")} ${when}`
                        : `${t("replacementExpectedBy", "Expected by")} ${when}`}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default ReplacementTracker;
