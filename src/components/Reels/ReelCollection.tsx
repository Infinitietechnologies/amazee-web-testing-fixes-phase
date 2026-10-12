import type { FC } from "react";

import { useHorizontalDragScroll } from "@/components/Media";
import ReelCard from "@/components/Reels/ReelCard";
import type { Reel } from "@/components/Reels/types";

export interface ReelCollectionProps {
  reels: readonly Reel[];
  label: string;
  layout?: "rail" | "grid";
  viewCounts?: Readonly<Record<string, number>>;
  onOpen: (reel: Reel) => void;
  className?: string;
}

/** Reusable Reel grid/rail. Viewer selection remains owned by its caller. */
const ReelCollection: FC<ReelCollectionProps> = ({
  reels,
  label,
  layout = "rail",
  viewCounts,
  onOpen,
  className = "",
}) => {
  const isGrid = layout === "grid";
  const { isDragging, dragHandlers } = useHorizontalDragScroll({
    enabled: !isGrid,
  });

  return (
    <div
      aria-label={label}
      aria-roledescription={isGrid ? undefined : "carousel"}
      className={`${
        isGrid
          ? "grid w-full grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 min-[1100px]:grid-cols-4 lg:grid-cols-5 lg:gap-5"
          : `scrollbar-hide -mt-4 -mb-6 flex w-full max-w-full touch-pan-x select-none snap-x snap-proximity gap-3 overflow-x-auto overscroll-x-contain pt-4 pb-6 sm:gap-4 ${
              isDragging ? "cursor-grabbing" : "cursor-grab"
            }`
      } ${className}`.trim()}
      data-dragging={isDragging || undefined}
      data-layout={layout}
      role="list"
      {...(isGrid ? {} : dragHandlers)}
    >
      {reels.map((reel, index) => (
        <ReelCard
          key={reel.id}
          index={index}
          isDragging={isDragging}
          reel={reel}
          viewCount={viewCounts?.[reel.id]}
          variant={layout}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
};

export default ReelCollection;
