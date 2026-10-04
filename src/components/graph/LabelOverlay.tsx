import { useEffect, useLayoutEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import type { DiamondFacetNode, DiamondPosition } from "./diamondLayout";
import { createGraphPointerGesture } from "./graphInteraction";

/** Interactive DOM labels projected from 3D without per-frame React updates. */
export function LabelOverlay({
  nodes,
  positions,
  activeId,
  hovered,
  selectedId,
  onSelect,
}: {
  nodes: DiamondFacetNode[];
  positions: Map<string, DiamondPosition>;
  activeId?: string;
  hovered?: string;
  selectedId?: string;
  onSelect: (node: DiamondFacetNode) => void;
}) {
  const { camera, size, gl, invalidate } = useThree();
  const scratch = useRef(new Vector3());
  const itemEls = useRef(new Map<string, HTMLButtonElement>());
  const rootEl = useRef<HTMLDivElement | null>(null);
  const select = useRef(onSelect);
  useLayoutEffect(() => {
    select.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const host = gl.domElement.parentElement;
    if (!host) return;

    const root = document.createElement("div");
    root.className =
      "pointer-events-none absolute left-0 top-0 z-20 overflow-hidden";
    host.appendChild(root);
    rootEl.current = root;

    const els = new Map<string, HTMLButtonElement>();
    const buttonNodes = new Map<HTMLButtonElement, DiamondFacetNode>();
    for (const node of nodes) {
      const el = document.createElement("button");
      el.type = "button";
      el.className =
        "graph-label absolute -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border px-2 py-1 text-[11px] font-medium leading-none shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
      el.style.display = "none";
      el.textContent = node.name;
      el.setAttribute("aria-label", `${node.name} ${node.group}`);
      el.setAttribute("aria-pressed", "false");
      root.appendChild(el);
      els.set(node.id, el);
      buttonNodes.set(el, node);
    }
    itemEls.current = els;

    // Keep label gestures separate from canvas gestures, but use the same
    // movement threshold. A drag that began on the canvas cannot select a label.
    const gesture = createGraphPointerGesture();
    let pointer: { id: number; button: HTMLButtonElement; released: boolean } | undefined;
    const release = () => {
      if (pointer?.button.hasPointerCapture?.(pointer.id)) {
        pointer.button.releasePointerCapture(pointer.id);
      }
    };
    const cancel = () => {
      const previous = pointer;
      pointer = undefined;
      gesture.cancel();
      if (previous?.button.hasPointerCapture?.(previous.id)) {
        previous.button.releasePointerCapture(previous.id);
      }
    };
    const buttonFor = (event: Event) =>
      event.target instanceof HTMLButtonElement && buttonNodes.has(event.target)
        ? event.target
        : undefined;
    const down = (event: PointerEvent) => {
      event.stopPropagation();
      cancel();
      const button = buttonFor(event);
      if (!button || event.button !== 0 || event.isPrimary === false) return;
      gesture.down(event);
      pointer = { id: event.pointerId, button, released: false };
      button.setPointerCapture?.(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      event.stopPropagation();
      gesture.move(event);
    };
    const up = (event: PointerEvent) => {
      event.stopPropagation();
      if (pointer?.id !== event.pointerId) return;
      gesture.up(event);
      pointer.released = true;
      // Expected capture loss after release must not cancel the ensuing click.
      release();
    };
    const interrupted = (event: PointerEvent) => {
      event.stopPropagation();
      if (pointer?.id === event.pointerId) cancel();
    };
    const lostCapture = (event: PointerEvent) => {
      event.stopPropagation();
      if (!pointer?.released) interrupted(event);
    };
    const click = (event: MouseEvent) => {
      event.stopPropagation();
      const button = buttonFor(event);
      // Native button Enter/Space and assistive-technology clicks do not have
      // a pointer gesture. Pointer-generated clicks always need a matching one.
      const keyboard = event.detail === 0 &&
        !("pointerType" in event && event.pointerType);
      const activate = button && event.button === 0 &&
        (keyboard || (pointer?.button === button && gesture.isClick(event)));
      cancel();
      if (activate) select.current(buttonNodes.get(button)!);
    };
    root.addEventListener("pointerdown", down);
    root.addEventListener("pointermove", move);
    root.addEventListener("pointerup", up);
    root.addEventListener("pointercancel", interrupted);
    root.addEventListener("lostpointercapture", lostCapture);
    root.addEventListener("click", click);
    window.addEventListener("blur", cancel);
    invalidate();

    return () => {
      root.removeEventListener("pointerdown", down);
      root.removeEventListener("pointermove", move);
      root.removeEventListener("pointerup", up);
      root.removeEventListener("pointercancel", interrupted);
      root.removeEventListener("lostpointercapture", lostCapture);
      root.removeEventListener("click", click);
      window.removeEventListener("blur", cancel);
      cancel();
      root.remove();
      rootEl.current = null;
      itemEls.current = new Map();
      els.clear();
      buttonNodes.clear();
    };
  }, [gl, invalidate, nodes]);

  useFrame(() => {
    const root = rootEl.current;
    if (!root) return;
    root.style.width = `${size.width}px`;
    root.style.height = `${size.height}px`;
    camera.updateMatrixWorld();

    for (const node of nodes) {
      const point = positions.get(node.id);
      const el = itemEls.current.get(node.id);
      if (!el) continue;
      el.setAttribute("aria-pressed", node.id === selectedId ? "true" : "false");
      if (!point) {
        el.style.display = "none";
        continue;
      }
      scratch.current.set(point[0], point[1], point[2]).project(camera);
      const visible = scratch.current.z > -1 && scratch.current.z < 1;
      el.style.display = visible ? "block" : "none";
      if (!visible) continue;
      el.style.left = `${(scratch.current.x * 0.5 + 0.5) * size.width}px`;
      el.style.top = `${(-scratch.current.y * 0.5 + 0.5) * size.height - 22}px`;
      el.dataset.active =
        node.id === activeId || node.id === hovered ? "true" : "false";
    }
  });

  return null;
}
