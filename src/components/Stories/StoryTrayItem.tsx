import type { FC } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";

import StoryArtwork from "@/components/Stories/StoryArtwork";
import type { StoryGroup } from "@/components/Stories/types";
import type { StoryGroupProgress } from "@/components/Stories/storyProgress";

const STORY_LAYOUT_TRANSITION = {
  type: "spring" as const,
  stiffness: 330,
  damping: 34,
  mass: 0.82,
};

export interface StoryTrayItemProps {
  group: StoryGroup;
  progress: StoryGroupProgress;
  isDragging?: boolean;
  onOpen: (group: StoryGroup) => void;
}

const StoryTrayItem: FC<StoryTrayItemProps> = ({
  group,
  progress,
  isDragging = false,
  onOpen,
}) => {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const publisherLabel =
    group.publisherType === "admin"
      ? t("stories.viewer.official", { defaultValue: "Official" })
      : t("stories.viewer.seller", { defaultValue: "Seller" });
  const statusLabel =
    progress.state === "seen"
      ? t("stories.viewed", { defaultValue: "Viewed" })
      : progress.state === "partial"
        ? t("stories.viewedProgress", {
            seen: progress.seen,
            total: progress.total,
            defaultValue: "{{seen}}/{{total}} viewed",
          })
        : t("stories.newCount", {
            count: progress.unseen,
            defaultValue: "{{count}} new",
          });
  const viewedPercentage =
    progress.total > 0
      ? Math.round(
          Math.min(100, Math.max(0, (progress.seen / progress.total) * 100)) *
            100,
        ) / 100
      : 0;
  const unseenPercentage = Math.round((100 - viewedPercentage) * 100) / 100;
  const ringClass =
    progress.state === "seen"
      ? "bg-default-300"
      : progress.state === "partial"
        ? ""
        : "bg-linear-to-tr from-primary via-fuchsia-500 to-orange-400";
  const ringStyle =
    progress.state === "partial"
      ? {
          background: `conic-gradient(#f97316 0 ${unseenPercentage}%, #d4d4d8 ${unseenPercentage}% 100%)`,
        }
      : undefined;

  return (
    <motion.div
      className="w-[76px] shrink-0 snap-start sm:w-[82px]"
      data-story-group-id={group.id}
      layout={prefersReducedMotion ? false : "position"}
      role="listitem"
      transition={{
        layout: prefersReducedMotion
          ? { duration: 0 }
          : STORY_LAYOUT_TRANSITION,
      }}
    >
      <button
        type="button"
        aria-label={`${group.title}, ${statusLabel}, ${publisherLabel}, ${group.subtitle}`}
        className={`group/story flex w-full flex-col items-center rounded-2xl focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
          isDragging ? "cursor-grabbing" : "cursor-pointer"
        }`}
        data-state={progress.state}
        onClick={() => onOpen(group)}
      >
        <span
          className={`relative flex h-[68px] w-[68px] transform-gpu will-change-transform items-center justify-center rounded-full p-[3px] [backface-visibility:hidden] transition-[transform,box-shadow] duration-200 group-hover/story:scale-[1.035] group-hover/story:shadow-[0_0_0_3px] group-hover/story:shadow-primary/20 group-active/story:scale-95 group-active/story:shadow-none motion-reduce:transition-none sm:h-[72px] sm:w-[72px] ${ringClass}`}
          data-story-progress-percent={
            progress.state === "partial" ? unseenPercentage : undefined
          }
          data-story-viewed-percent={
            progress.state === "partial" ? viewedPercentage : undefined
          }
          data-story-ring
          style={ringStyle}
        >
          <span className="h-full w-full rounded-full bg-content1 p-[2px]">
            <span className="block h-full w-full overflow-hidden rounded-full">
              <StoryArtwork
                compact
                imageSrc={group.coverSrc}
                visual={group.visual}
              />
            </span>
          </span>

          {progress.state === "seen" && (
            <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-content1 bg-default-500 text-white">
              <Check aria-hidden="true" size={11} strokeWidth={3} />
            </span>
          )}
        </span>

        <span className="mt-1.5 w-full truncate text-center text-xs font-semibold text-foreground">
          {group.title}
        </span>
      </button>
    </motion.div>
  );
};

export default StoryTrayItem;
