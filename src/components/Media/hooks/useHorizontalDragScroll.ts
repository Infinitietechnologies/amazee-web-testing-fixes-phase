import {
  type MouseEventHandler,
  type PointerEventHandler,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

interface DragState {
  pointerId: number;
  startX: number;
  startScrollLeft: number;
  moved: boolean;
}

export interface HorizontalDragScrollOptions {
  enabled?: boolean;
  threshold?: number;
  mouseOnly?: boolean;
  stopPropagation?: boolean;
}

export interface HorizontalDragScrollResult {
  isDragging: boolean;
  dragHandlers: {
    onClickCapture: MouseEventHandler<HTMLDivElement>;
    onPointerCancel: PointerEventHandler<HTMLDivElement>;
    onPointerDown: PointerEventHandler<HTMLDivElement>;
    onPointerMove: PointerEventHandler<HTMLDivElement>;
    onPointerUp: PointerEventHandler<HTMLDivElement>;
  };
}

/**
 * Adds desktop drag-to-scroll behavior without interfering with native touch
 * momentum. A drag suppresses the following click so rail items do not open
 * accidentally when the pointer is released.
 */
export const useHorizontalDragScroll = ({
  enabled = true,
  threshold = 6,
  mouseOnly = true,
  stopPropagation = false,
}: HorizontalDragScrollOptions = {}): HorizontalDragScrollResult => {
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const suppressClickTimerRef = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(
    () => () => {
      if (suppressClickTimerRef.current !== null) {
        window.clearTimeout(suppressClickTimerRef.current);
      }
    },
    [],
  );

  const onPointerDown = useCallback<PointerEventHandler<HTMLDivElement>>(
    (event) => {
      if (stopPropagation) event.stopPropagation();
      if (!enabled || event.button !== 0) return;
      if (mouseOnly && event.pointerType === "touch") return;

      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startScrollLeft: event.currentTarget.scrollLeft,
        moved: false,
      };
    },
    [enabled, mouseOnly, stopPropagation],
  );

  const onPointerMove = useCallback<PointerEventHandler<HTMLDivElement>>(
    (event) => {
      if (stopPropagation) event.stopPropagation();
      const drag = dragRef.current;
      if (!enabled || !drag || drag.pointerId !== event.pointerId) return;

      const distance = event.clientX - drag.startX;
      if (!drag.moved && Math.abs(distance) < threshold) return;

      if (!drag.moved) {
        drag.moved = true;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        setIsDragging(true);
      }

      event.preventDefault();
      event.currentTarget.scrollLeft = drag.startScrollLeft - distance;
    },
    [enabled, stopPropagation, threshold],
  );

  const finishDrag = useCallback<PointerEventHandler<HTMLDivElement>>(
    (event) => {
      if (stopPropagation) event.stopPropagation();
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;

      dragRef.current = null;
      setIsDragging(false);
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      if (!drag.moved) return;

      suppressClickRef.current = true;
      if (suppressClickTimerRef.current !== null) {
        window.clearTimeout(suppressClickTimerRef.current);
      }
      suppressClickTimerRef.current = window.setTimeout(() => {
        suppressClickRef.current = false;
        suppressClickTimerRef.current = null;
      }, 0);
    },
    [stopPropagation],
  );

  const onClickCapture = useCallback<MouseEventHandler<HTMLDivElement>>(
    (event) => {
      if (!enabled || !suppressClickRef.current) return;

      suppressClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
    },
    [enabled],
  );

  return {
    isDragging,
    dragHandlers: {
      onClickCapture,
      onPointerCancel: finishDrag,
      onPointerDown,
      onPointerMove,
      onPointerUp: finishDrag,
    },
  };
};
