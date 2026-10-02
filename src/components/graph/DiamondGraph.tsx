import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import { TOUCH, Vector3 } from "three";
import type { BufferGeometry, Group } from "three";
import { EdgesGeometry } from "three";
import { useLaunchpadStore } from "@/lib/state/store";
import { getAccessBases, resolveCatalogSelection } from "@/lib/compose-core";
import { Badge } from "@/components/ui/badge";
import { Gem } from "lucide-react";
import { cn } from "@/lib/utils";
import { createBrilliantDiamondGeometry } from "./brilliantDiamond";
import {
  CATEGORY_COLORS,
  diamondCameraFrame,
  diamondPositions,
} from "./diamondLayout";
import type { DiamondFacetNode, DiamondPosition } from "./diamondLayout";
import { useGraphPointerGesture } from "./graphInteraction";

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
    <div className="absolute inset-0 bg-[#f7f8fa] [&_canvas]:!absolute [&_canvas]:inset-0">
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
        aria-label="Active diamond composition, 3D graph"
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
  showHeader?: boolean;
};

export function DiamondGraph({ className, showHeader = true }: DiamondGraphProps) {
  const { catalog, config } = useLaunchpadStore();
  const [selectedId, setSelectedId] = useState<string>();

  const nodes = useMemo<DiamondFacetNode[]>(() => {
    if (!catalog) return [];

    const selection = resolveCatalogSelection(
      catalog,
      config.baseKey,
      config.selectedLibraries,
      config.selectedExtensions,
      config.selectedAccess,
      config.selectedAccessExtensions,
    );

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

    const facetNames = [
      ...new Set([
        ...Object.keys(selection.requiredFacets),
        ...config.selectedExtensions,
      ]),
    ];
    for (const name of facetNames) {
      push(`facet:${name}`, name, CATEGORY_COLORS.token, "facet");
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
        accessBases[key]?.label ?? key,
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
      [
        config.baseKey,
        config.selectedExtensions.join(","),
        config.selectedLibraries.join(","),
        config.selectedAccess.join(","),
        config.selectedAccessExtensions.join(","),
        nodes.length,
      ].join("|"),
    [config, nodes.length],
  );

  return (
    <div
      className={cn(
        "flex h-full w-full min-h-0 min-w-0 flex-col bg-[#f7f8fa] text-slate-900",
        className,
      )}
    >
      {showHeader && (
        <div className="flex items-center justify-between border-b border-slate-200 bg-white/80 px-4 py-3">
          <div className="flex items-center gap-2">
            <Gem className="size-4 text-slate-700" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-slate-800">Diamond Graph</h3>
          </div>
          <div className="flex items-center gap-2">
            {selectedNode && (
              <Badge
                variant="outline"
                className="border-slate-300 bg-white text-slate-800"
              >
                {selectedNode.name}
              </Badge>
            )}
            <Badge
              variant="secondary"
              className="border-slate-200 bg-slate-100 text-slate-700"
            >
              {nodes.length} nodes
            </Badge>
          </div>
        </div>
      )}
      <div className="relative min-h-0 w-full flex-1 overflow-hidden">
        {nodes.length === 0 ? (
          <div className="flex h-full w-full items-center justify-center p-6 text-center text-sm text-slate-500">
            Select a base to preview the diamond composition graph.
          </div>
        ) : (
          <GraphScene
            nodes={nodes}
            selectedId={selectedNode?.id}
            onSelect={(node) => setSelectedId(node.id)}
            onClear={() => setSelectedId(undefined)}
            viewKey={viewKey}
          />
        )}
      </div>
      <div className="border-t border-slate-200 bg-white/70 px-4 py-2 text-[11px] text-slate-600">
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
    </div>
  );
}
