import {
  type FC,
  type UIEventHandler,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { ChevronRight } from "lucide-react";

import { useHorizontalDragScroll } from "@/components/Media";
import StoryTrayItem from "@/components/Stories/StoryTrayItem";
import type { StoryGroup } from "@/components/Stories/types";
import type { StoryGroupProgress } from "@/components/Stories/storyProgress";

export interface StoryTrayEntry {
  group: StoryGroup;
  progress: StoryGroupProgress;
}

export interface StoryTrayProps {
  entries: readonly StoryTrayEntry[];
  label: string;
  onOpen: (group: StoryGroup) => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  className?: string;
}

/** A reusable, sortable Story source rail with native touch scrolling. */
const StoryTray: FC<StoryTrayProps> = ({
  entries,
  label,
  onOpen,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  className = "",
}) => {
  const { isDragging, dragHandlers } = useHorizontalDragScroll();
  const loadRequestedRef = useRef(false);
  const loadMore = useCallback(() => {
    if (
      !hasMore ||
      isLoadingMore ||
      loadRequestedRef.current ||
      !onLoadMore
    )
      return;
    loadRequestedRef.current = true;
    onLoadMore();
  }, [hasMore, isLoadingMore, onLoadMore]);
  const handleScroll = useCallback<UIEventHandler<HTMLDivElement>>(
    (event) => {
      const rail = event.currentTarget;
      const remaining =
        rail.scrollWidth - rail.clientWidth - Math.abs(rail.scrollLeft);
      if (remaining <= 220) loadMore();
    },
    [loadMore],
  );

  useEffect(() => {
    if (!isLoadingMore) loadRequestedRef.current = false;
  }, [entries.length, isLoadingMore]);

  return (
    <div
      aria-label={label}
      aria-roledescription="carousel"
      className={`scrollbar-hide flex touch-pan-x select-none snap-x snap-mandatory gap-3 overflow-x-auto pb-1 pt-2 ${
        isDragging ? "cursor-grabbing" : "cursor-grab"
      } ${className}`.trim()}
      data-dragging={isDragging || undefined}
      role="list"
      onScroll={handleScroll}
      {...dragHandlers}
    >
      {entries.map(({ group, progress }) => (
        <StoryTrayItem
          key={group.id}
          group={group}
          isDragging={isDragging}
          progress={progress}
          onOpen={onOpen}
        />
      ))}
      {hasMore && !isLoadingMore && (
        <div className="h-[72px] w-[72px] shrink-0" role="listitem">
          <button
            type="button"
            aria-label="Load more Stories"
            className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-full bg-default-100 text-[10px] font-bold text-foreground/65 outline-none transition-colors hover:bg-default-200 focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"
            onClick={loadMore}
          >
            <ChevronRight aria-hidden="true" size={18} />
            More
          </button>
        </div>
      )}
      {isLoadingMore && (
        <div className="h-[72px] w-[72px] shrink-0" role="listitem">
          <span
            aria-label="Loading more Stories"
            className="flex h-full w-full items-center justify-center rounded-full bg-default-100"
            role="status"
          >
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-default-300 border-t-primary motion-reduce:animate-none" />
          </span>
        </div>
      )}
    </div>
  );
};

export default StoryTray;
