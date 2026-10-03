import { Component, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import { TOUCH, Vector3 } from "three";
import type { BufferGeometry, Group } from "three";
import { EdgesGeometry } from "three";
import { useLaunchpadStore } from "@/lib/state/store";
import { getAccessBases, planComposition } from "@/lib/compose-core";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { createBrilliantDiamondGeometry } from "./brilliantDiamond";
import {
  CATEGORY_COLORS,
  diamondCameraFrame,
  diamondPositions,
} from "./diamondLayout";
import type { DiamondFacetNode, DiamondPosition } from "./diamondLayout";
import { useGraphPointerGesture } from "./graphInteraction";
import { canRenderWebGL2 } from "./webglSupport";

class GraphRenderBoundary extends Component<
  { children: ReactNode; fallback: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function CompositionFallback({
  nodes,
  selectedId,
  onSelect,
  onClear,
}: {
  nodes: DiamondFacetNode[];
  selectedId?: string;
  onSelect: (node: DiamondFacetNode) => void;
  onClear: () => void;
}) {
  return (
    <div className="absolute inset-0 overflow-y-auto p-5 pt-16 sm:p-8 sm:pt-16">
      <div className="mx-auto flex max-w-2xl flex-col items-center">
        <svg
          viewBox="0 0 88 76"
          className="mb-3 h-16 w-20 text-[#6eb6c4]"
          aria-hidden="true"
        >
          <path
            d="M20 7h48l16 22-40 40L4 29Z"
            fill="currentColor"
            fillOpacity="0.08"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M4 29h80M20 7l9 22 15 40 15-40 9-22M29 29 44 7l15 22"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          />
        </svg>
        <h3 className="text-sm font-medium text-foreground">Project composition</h3>
        <p role="status" className="mt-1 text-center text-xs text-muted-foreground">
          3D preview unavailable. Your composition is shown below.
        </p>
        <ul
          className="mt-5 grid w-full grid-cols-1 gap-2 sm:grid-cols-2"
          aria-label="Selectable composition nodes"
        >
          {nodes.map((node) => (
            <li key={node.id}>
              <button
                type="button"
                aria-pressed={node.id === selectedId}
                aria-label={`${node.name} ${node.group}`}
                onClick={() => onSelect(node)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border bg-card/70 p-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  node.id === selectedId
                    ? "border-primary bg-primary/10"
                    : "border-border",
                )}
              >
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: node.color }}
                  aria-hidden="true"
                />
                <span className="min-w-0">
                  <span className="block break-words text-xs font-medium">{node.name}</span>
                  <span className="mt-1 block text-[10px] capitalize text-muted-foreground">
                    {node.group}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {selectedId && (
          <button
            type="button"
            onClick={onClear}
            className="mt-4 rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Clear selection
          </button>
        )}
      </div>
    </div>
  );
}

function CameraFrame({
  positions,
  viewKey,
}: {
  positions: Map<string, DiamondPosition>;
  viewKey: string;
}) {
  const { camera, size, invalidate } = useThree();
  const frame = diamondCameraFrame(size.width / size.height, positions);
  const [x, y, z] = frame.position;

  useEffect(() => {
    camera.position.set(x, y, z);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, invalidate, x, y, z, viewKey]);

  return (
    <OrbitControls
      key={viewKey}
      target={[0, 0, 0]}
      enablePan={false}
      minDistance={4}
      maxDistance={Math.max(32, frame.distance * 3)}
      touches={{ ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN }}
      autoRotate={false}
    />
  );
}

function StarSize({ children }: { children: ReactNode }) {
  const group = useRef<Group>(null);
  const position = useRef(new Vector3());
  useFrame(({ camera, viewport, size }) => {
    if (!group.current || size.height <= 0) return;
    group.current.getWorldPosition(position.current);
    const units =
      viewport.getCurrentViewport(camera, position.current).height /
      size.height;
    group.current.scale.setScalar(Math.max(1, (units * 2.5) / 0.07));
  });
  return <group ref={group}>{children}</group>;
}

function BrilliantDiamond() {
  const body = useMemo<BufferGeometry>(
    () => createBrilliantDiamondGeometry(0.5),
    [],
  );
  const edges = useMemo(() => new EdgesGeometry(body, 12), [body]);
  useEffect(
    () => () => {
      body.dispose();
      edges.dispose();
    },
    [body, edges],
  );

  return (
    <group name="draft-diamond" position={[0, 0, 0]}>
      <mesh geometry={body}>
        <meshStandardMaterial
          color="#2f7f91"
          emissive="#1a5564"
          emissiveIntensity={0.32}
          roughness={0.38}
          metalness={0.22}
          flatShading
        />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color="#b7e4ee" transparent opacity={0.88} />
      </lineSegments>
    </group>
  );
}

/** DOM labels projected from 3D — portal onto the canvas parent (not scene graph). */
function LabelOverlay({
  nodes,
  positions,
  activeId,
  hovered,
}: {
  nodes: DiamondFacetNode[];
  positions: Map<string, DiamondPosition>;
  activeId?: string;
  hovered?: string;
}) {
  const { camera, size, gl, invalidate } = useThree();
  const scratch = useRef(new Vector3());
  const itemEls = useRef(new Map<string, HTMLDivElement>());
  const rootEl = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = gl.domElement.parentElement;
    if (!host) return;

    const root = document.createElement("div");
    root.className =
      "pointer-events-none absolute left-0 top-0 z-20 overflow-hidden";
    root.setAttribute("aria-hidden", "true");
    host.appendChild(root);
    rootEl.current = root;

    const els = new Map<string, HTMLDivElement>();
    for (const node of nodes) {
      const el = document.createElement("div");
      el.className =
        "graph-label absolute hidden -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border px-2 py-1 text-[11px] font-medium leading-none shadow-sm";
      el.textContent = node.name;
      root.appendChild(el);
      els.set(node.id, el);
    }
    itemEls.current = els;

    invalidate();

    return () => {
      root.remove();
      rootEl.current = null;
      itemEls.current = new Map();
      els.clear();
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
      if (!point || !el) continue;
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

function GraphScene({
  nodes,
  selectedId,
  onSelect,
  onClear,
  viewKey,
}: {
  nodes: DiamondFacetNode[];
  selectedId?: string;
  onSelect: (node: DiamondFacetNode) => void;
  onClear: () => void;
  viewKey: string;
}) {
  const [hovered, setHovered] = useState<string>();
  const gesture = useGraphPointerGesture();
  const positions = useMemo(() => diamondPositions(nodes), [nodes]);
  const initialFrame = diamondCameraFrame(1, positions);
  const activeId = selectedId ?? hovered;

  useEffect(
    () => () => {
      document.body.style.cursor = "auto";
    },
    [],
  );

  return (
    <div className="absolute inset-0 bg-[var(--graph-background)] [&_canvas]:!absolute [&_canvas]:inset-0">
      <Canvas
        flat
        frameloop="always"
        {...gesture.capture}
        onPointerMissed={(event) => {
          if (event.type === "click" && gesture.isClick(event)) {
            setHovered(undefined);
            document.body.style.cursor = "auto";
            onClear();
          }
        }}
        camera={{ position: initialFrame.position, fov: initialFrame.fov }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        style={{ touchAction: "none", width: "100%", height: "100%" }}
        aria-label="Active project composition, 3D graph"
      >
        <CameraFrame positions={positions} viewKey={viewKey} />
        <ambientLight intensity={1.6} />
        <directionalLight position={[4, 6, 8]} intensity={1.4} color="#ffffff" />
        <directionalLight
          position={[-4, 2, -3]}
          intensity={0.45}
          color="#c5e7ef"
        />
        {nodes.map((node) => (
          <Line
            key={`link:${node.id}`}
            points={[[0, 0, 0], positions.get(node.id)!]}
            color={node.color}
            lineWidth={node.id === activeId ? 1.1 : 0.7}
            transparent
            opacity={node.id === activeId ? 0.85 : 0.55}
            raycast={() => null}
          />
        ))}
        <BrilliantDiamond />
        {nodes.map((node) => (
          <group key={node.id} position={positions.get(node.id)}>
            <StarSize>
              <group
                name={`facet:${node.id}`}
                onClick={(event) => {
                  event.stopPropagation();
                  if (gesture.isClick(event.nativeEvent)) onSelect(node);
                }}
                onPointerOver={(event) => {
                  event.stopPropagation();
                  setHovered(node.id);
                  document.body.style.cursor = "pointer";
                }}
                onPointerOut={() => {
                  setHovered(undefined);
                  document.body.style.cursor = "auto";
                }}
              >
                <mesh>
                  <sphereGeometry
                    args={[node.id === activeId ? 0.07 : 0.045, 12, 8]}
                  />
                  <meshBasicMaterial color={node.color} />
                </mesh>
                <mesh>
                  <sphereGeometry args={[0.22, 8, 6]} />
                  <meshBasicMaterial
                    transparent
                    opacity={0}
                    depthWrite={false}
                  />
                </mesh>
              </group>
            </StarSize>
          </group>
        ))}
        <LabelOverlay
          nodes={nodes}
          positions={positions}
          activeId={activeId}
          hovered={hovered}
        />
      </Canvas>
    </div>
  );
}

type DiamondGraphProps = {
  className?: string;
  /** Opt into a selectable DOM composition when WebGL cannot render. */
  enableWebGLFallback?: boolean;
};

export function DiamondGraph({
  className,
  enableWebGLFallback = false,
}: DiamondGraphProps) {
  const { catalog, activeProject } = useLaunchpadStore();
  const config = activeProject?.config;
  const [selectedId, setSelectedId] = useState<string>();
  const [rendererFailed, setRendererFailed] = useState(false);
  const webglAvailable = useMemo(
    () => !enableWebGLFallback || canRenderWebGL2(),
    [enableWebGLFallback],
  );
  const showFallback = enableWebGLFallback && (!webglAvailable || rendererFailed);

  const nodes = useMemo<DiamondFacetNode[]>(() => {
    if (!catalog || !config) return [];

    const plan = planComposition(catalog, config);

    const nodes: DiamondFacetNode[] = [];
    const push = (
      id: string,
      name: string,
      color: string,
      group: DiamondFacetNode["group"],
    ) => {
      if (!nodes.some((node) => node.id === id)) {
        nodes.push({ id, name, color, custom: false, group });
      }
    };

    for (const facet of plan.facets) {
      const group = facet.group === "library" ? "library" : "facet";
      push(
        `${group}:${facet.name}`,
        facet.name,
        group === "library"
          ? CATEGORY_COLORS.interfaceDetection
          : CATEGORY_COLORS.token,
        group,
      );
    }

    for (const name of config.selectedLibraries) {
      push(
        `library:${name}`,
        name,
        CATEGORY_COLORS.interfaceDetection,
        "library",
      );
    }

    const accessBases = getAccessBases(catalog, config.baseKey);
    for (const key of config.selectedAccess) {
      push(
        `access:${key}`,
        accessBases[key]?.label ?? key,
        CATEGORY_COLORS.access,
        "access",
      );
    }

    for (const key of config.selectedAccessExtensions) {
      push(
        `access-ext:${key}`,
        plan.accessExtensions.find((facet) => facet.name === key)?.name ?? key,
        CATEGORY_COLORS.access,
        "access",
      );
    }

    return nodes;
  }, [catalog, config]);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedId),
    [nodes, selectedId],
  );

  const viewKey = useMemo(
    () =>
      config
        ? [
        config.baseKey,
        config.selectedExtensions.join(","),
        config.selectedLibraries.join(","),
        config.selectedAccess.join(","),
        config.selectedAccessExtensions.join(","),
        nodes.length,
          ].join("|")
        : "empty",
    [config, nodes.length],
  );

  const fallback = (
    <CompositionFallback
      nodes={nodes}
      selectedId={selectedNode?.id}
      onSelect={(node) => setSelectedId(node.id)}
      onClear={() => setSelectedId(undefined)}
    />
  );
  const scene = (
    <GraphScene
      nodes={nodes}
      selectedId={selectedNode?.id}
      onSelect={(node) => setSelectedId(node.id)}
      onClear={() => setSelectedId(undefined)}
      viewKey={viewKey}
    />
  );

  return (
    <div
      className={cn(
        "flex h-full w-full min-h-0 min-w-0 flex-col bg-[var(--graph-background)] text-foreground",
        className,
      )}
    >
      <div className="relative min-h-0 w-full flex-1 overflow-hidden">
        <div className="pointer-events-none absolute right-4 top-4 z-30 flex items-center gap-2">
          {selectedNode && (
            <Badge
              variant="outline"
              className="border-border bg-card text-foreground shadow-sm"
            >
              {selectedNode.name}
            </Badge>
          )}
          <Badge
            variant="secondary"
            className="border-border bg-secondary text-secondary-foreground shadow-sm"
          >
            {nodes.length} nodes
          </Badge>
        </div>
        {nodes.length === 0 ? (
          <div className="flex h-full w-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
            Select a starting point to preview the project composition graph.
          </div>
        ) : showFallback ? fallback : enableWebGLFallback ? (
          <GraphRenderBoundary fallback={fallback} onError={() => setRendererFailed(true)}>
            {scene}
          </GraphRenderBoundary>
        ) : scene}
      </div>
      <div className="border-t border-border bg-[var(--graph-surface)] px-4 py-2 text-[11px] text-[var(--graph-muted)]">
        <span className="mr-3">
          {showFallback
            ? "Select a node to inspect your composition"
            : "Drag to rotate · scroll to zoom · click a node to select"}
        </span>
        <span className="mr-3">
          <span
            className="mr-1 inline-block size-2 rounded-full align-middle"
            style={{ background: CATEGORY_COLORS.token }}
          />
          Facets
        </span>
        <span className="mr-3">
          <span
            className="mr-1 inline-block size-2 rounded-full align-middle"
            style={{ background: CATEGORY_COLORS.interfaceDetection }}
          />
          Libraries
        </span>
        <span>
          <span
            className="mr-1 inline-block size-2 rounded-full align-middle"
            style={{ background: CATEGORY_COLORS.access }}
          />
          Access
        </span>
      </div>
      <ul className="sr-only" aria-label="Project composition nodes">
        {nodes.map((node) => (
          <li key={node.id}>{node.name} ({node.group})</li>
        ))}
      </ul>
    </div>
  );
}
