import { useState } from "react";

type PointerSample = {
  clientX: number;
  clientY: number;
  button: number;
  pointerId?: number;
  isPrimary?: boolean;
};

/** Track the whole gesture so orbit drags are not treated as clicks. */
export function createGraphPointerGesture() {
  let start:
    | { x: number; y: number; id?: number; moved: boolean; released: boolean }
    | undefined;
  const update = (event: PointerSample) => {
    if (!start || event.pointerId !== start.id) return;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 3)
      start.moved = true;
  };
  return {
    down(event: PointerSample) {
      if (event.button !== 0 || event.isPrimary === false) {
        if (start) start.moved = true;
        return;
      }
      start = {
        x: event.clientX,
        y: event.clientY,
        id: event.pointerId,
        moved: false,
        released: false,
      };
    },
    move: update,
    up(event: PointerSample) {
      update(event);
      if (start && event.pointerId === start.id) start.released = true;
    },
    cancel() {
      start = undefined;
    },
    isClick(event: Pick<MouseEvent, "button" | "clientX" | "clientY">) {
      return Boolean(
        start &&
          start.released &&
          !start.moved &&
          event.button === 0 &&
          Math.hypot(event.clientX - start.x, event.clientY - start.y) <= 3,
      );
    },
  };
}

export function useGraphPointerGesture() {
  const [gesture] = useState(createGraphPointerGesture);
  return {
    capture: {
      onPointerDownCapture: gesture.down,
      onPointerMoveCapture: gesture.move,
      onPointerUpCapture: gesture.up,
      onPointerCancelCapture: gesture.cancel,
    },
    isClick: gesture.isClick,
  };
}
