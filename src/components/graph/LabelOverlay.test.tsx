import { PerspectiveCamera } from 'three';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LabelOverlay } from './LabelOverlay';
import type { DiamondFacetNode, DiamondPosition } from './diamondLayout';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const scene = vi.hoisted(() => ({
  frame: undefined as (() => void) | undefined,
  state: undefined as unknown,
}));
vi.mock('@react-three/fiber', () => ({
  useThree: () => scene.state,
  useFrame: (frame: () => void) => {
    scene.frame = frame;
  },
}));

const nodes: DiamondFacetNode[] = [
  {
    id: 'facet:counter',
    name: 'CounterDataFacet',
    group: 'facet',
    path: 'src/facets/CounterDataFacet.sol',
    color: '#fff',
    custom: false,
  },
  { id: 'access:owner', name: 'Owner', group: 'access', color: '#fff', custom: false },
];
const positions = new Map<string, DiamondPosition>(
  nodes.map((node, index) => [node.id, [index, 0, 0]]),
);
let host: HTMLDivElement;
let captured: Map<number, HTMLButtonElement>;
const released = vi.fn<(id: number) => void>();

beforeEach(() => {
  const camera = new PerspectiveCamera(45, 2, 0.1, 100);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);
  host = document.createElement('div');
  const canvas = document.createElement('canvas');
  host.append(canvas);
  document.body.append(host);
  scene.state = {
    camera,
    size: { width: 800, height: 400 },
    gl: { domElement: canvas },
    invalidate: vi.fn(),
  };
  captured = new Map();
  released.mockClear();
});
afterEach(() => {
  cleanup();
  host.remove();
  scene.frame = undefined;
});

function label(name = 'CounterDataFacet facet') {
  return screen.getByRole('button', { name }) as HTMLButtonElement;
}
function mount(onSelect = vi.fn()) {
  const view = render(<LabelOverlay nodes={nodes} positions={positions} onSelect={onSelect} />);
  scene.frame!();
  for (const button of host.querySelectorAll('button')) {
    button.setPointerCapture = (id) => {
      captured.set(id, button);
    };
    button.hasPointerCapture = (id) => captured.get(id) === button;
    button.releasePointerCapture = (id) => {
      released(id);
      captured.delete(id);
      pointer(button, 'lostpointercapture', { pointerId: id });
    };
  }
  return { ...view, onSelect };
}
function pointer(target: Element, type: string, values: Partial<PointerEvent> = {}) {
  const event = new Event(type, { bubbles: true });
  Object.assign(event, {
    pointerId: 1,
    clientX: 100,
    clientY: 100,
    button: 0,
    isPrimary: true,
    ...values,
  });
  fireEvent(target, event);
}
function click(target: Element, options: MouseEventInit = {}) {
  fireEvent.click(target, { detail: 1, button: 0, clientX: 100, clientY: 100, ...options });
}
function tap(target: Element) {
  pointer(target, 'pointerdown');
  pointer(target, 'pointerup');
  click(target);
}

it('projects accessible native buttons and lets labels select their exact node once', () => {
  const { onSelect } = mount();
  const button = label();
  const root = button.parentElement!;
  expect(root.classList.contains('pointer-events-none')).toBe(true);
  expect(root.hasAttribute('aria-hidden')).toBe(false);
  expect(root.style.width).toBe('800px');
  expect(button.type).toBe('button');
  expect(button.style.display).toBe('block');
  expect(button.style.left).toBe('400px');
  expect(button.style.top).toBe('178px');
  expect(button.getAttribute('aria-pressed')).toBe('false');
  tap(button);
  click(button);
  expect(onSelect).toHaveBeenCalledExactlyOnceWith(nodes[0]);
  expect(captured.size).toBe(0);
  expect(released).toHaveBeenCalledWith(1);
});

it('keeps label events out of canvas bubbling, including blank-click clearing', () => {
  const down = vi.fn();
  const missed = vi.fn();
  host.addEventListener('pointerdown', down);
  host.addEventListener('click', missed);
  const { onSelect } = mount();
  tap(label());
  expect(onSelect).toHaveBeenCalledOnce();
  expect(down).not.toHaveBeenCalled();
  expect(missed).not.toHaveBeenCalled();
  fireEvent.click(host.querySelector('canvas')!);
  expect(missed).toHaveBeenCalledOnce();
});

it('uses native keyboard and assistive-technology activation without requiring pointer input', () => {
  const { onSelect } = mount();
  const button = label();
  button.focus();
  expect(document.activeElement).toBe(button);
  // Browsers synthesize detail=0 click for button Enter/Space activation.
  click(button, { detail: 0, clientX: 0, clientY: 0 });
  button.click();
  expect(onSelect).toHaveBeenCalledTimes(2);
  expect(onSelect).toHaveBeenLastCalledWith(nodes[0]);
});

it('does not select after a drag, even if the pointer returns to its start', () => {
  const { onSelect } = mount();
  const button = label();
  pointer(button, 'pointerdown');
  pointer(button, 'pointermove', { clientX: 140 });
  pointer(button, 'pointermove');
  pointer(button, 'pointerup');
  click(button);
  expect(onSelect).not.toHaveBeenCalled();
  tap(button);
  expect(onSelect).toHaveBeenCalledExactlyOnceWith(nodes[0]);
});

it('ignores gestures that began outside a label or finish on a different label', () => {
  const { onSelect } = mount();
  pointer(host.querySelector('canvas')!, 'pointerdown');
  pointer(label(), 'pointerup');
  click(label());
  pointer(label(), 'pointerdown');
  pointer(label('Owner access'), 'pointerup');
  click(label('Owner access'));
  expect(onSelect).not.toHaveBeenCalled();
});

it.each(['pointercancel', 'lostpointercapture', 'blur'])(
  'ignores %s interruptions and permits a subsequent click',
  (type) => {
    const { onSelect } = mount();
    const button = label();
    pointer(button, 'pointerdown');
    if (type === 'blur') fireEvent(window, new Event('blur'));
    else pointer(button, type);
    pointer(button, 'pointerup');
    click(button);
    expect(onSelect).not.toHaveBeenCalled();
    tap(button);
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(nodes[0]);
  },
);

it('rejects nonprimary input, incomplete gestures and pointer clicks with zero detail', () => {
  const { onSelect } = mount();
  const button = label();
  for (const values of [{ button: 2 }, { isPrimary: false }, { pointerId: 2, isPrimary: false }]) {
    pointer(button, 'pointerdown', values);
    pointer(button, 'pointerup', values);
    click(button);
  }
  pointer(button, 'pointerdown');
  click(button);
  const zeroDetailPointerClick = new MouseEvent('click', { bubbles: true, detail: 0, button: 0 });
  Object.assign(zeroDetailPointerClick, { pointerType: 'touch' });
  fireEvent(button, zeroDetailPointerClick);
  expect(onSelect).not.toHaveBeenCalled();
});

it('cancels a primary gesture when another pointer interrupts it', () => {
  const { onSelect } = mount();
  const button = label();
  pointer(button, 'pointerdown');
  pointer(button, 'pointerdown', { pointerId: 2, isPrimary: false });
  pointer(button, 'pointerup');
  click(button);
  expect(onSelect).not.toHaveBeenCalled();
  expect(captured.size).toBe(0);
});

it('updates selection, hover and callbacks without replacing the projected buttons', () => {
  const { rerender, onSelect } = mount();
  const original = label();
  const latest = vi.fn();
  rerender(
    <LabelOverlay
      nodes={nodes}
      positions={positions}
      activeId={nodes[0].id}
      selectedId={nodes[0].id}
      hovered={nodes[1].id}
      onSelect={latest}
    />,
  );
  scene.frame!();
  expect(label()).toBe(original);
  expect(original.dataset.active).toBe('true');
  expect(original.getAttribute('aria-pressed')).toBe('true');
  expect(label('Owner access').dataset.active).toBe('true');
  expect(label('Owner access').getAttribute('aria-pressed')).toBe('false');
  tap(original);
  expect(onSelect).not.toHaveBeenCalled();
  expect(latest).toHaveBeenCalledExactlyOnceWith(nodes[0]);
});

it('hides labels behind the camera or without positions', () => {
  const { rerender, onSelect } = mount();
  const original = label();
  const hiddenPositions = new Map<string, DiamondPosition>([[nodes[0].id, [0, 0, 11]]]);
  rerender(<LabelOverlay nodes={nodes} positions={hiddenPositions} onSelect={onSelect} />);
  scene.frame!();
  expect(original.style.display).toBe('none');
  expect(screen.queryByRole('button')).toBeNull();
});

it('removes obsolete buttons, listeners and captured pointers on rebuild and unmount', () => {
  const { rerender, unmount, onSelect } = mount();
  const obsolete = label();
  pointer(obsolete, 'pointerdown');
  rerender(<LabelOverlay nodes={[nodes[1]]} positions={positions} onSelect={onSelect} />);
  scene.frame!();
  expect(captured.size).toBe(0);
  expect(screen.queryByRole('button', { name: 'CounterDataFacet facet' })).toBeNull();
  pointer(obsolete, 'pointerup');
  click(obsolete);
  obsolete.click();
  const remaining = label('Owner access');
  unmount();
  remaining.click();
  expect(onSelect).not.toHaveBeenCalled();
  expect(host.querySelector('.graph-label')).toBeNull();
});
