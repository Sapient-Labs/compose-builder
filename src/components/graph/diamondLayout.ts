export type DiamondPosition = [number, number, number];

export interface DiamondFacetNode {
  id: string;
  name: string;
  color: string;
  path?: string;
  custom: boolean;
  group: "base" | "facet" | "library" | "access";
}

export const DIAMOND_CENTER_ID = "draft-diamond:center";

/** Palette aligned with the Compose docs landing diamond graph. */
export const CATEGORY_COLORS = {
  access: "#c4a574",
  diamond: "#2f7f91",
  interfaceDetection: "#6eb6c4",
  token: "#d4a574",
  custom: "#b7a8d4",
} as const;

/** Stable spherical constellation with the facet centroid at the Diamond. */
export function diamondPositions(
  nodes: readonly Pick<DiamondFacetNode, "id">[],
): Map<string, DiamondPosition> {
  const ids = [...new Set(nodes.map((node) => node.id))].sort();
  const count = ids.length;
  const points: DiamondPosition[] = ids.map((_, index) => {
    if (count === 1) return [2.4, 1.5, -0.7];
    if (count === 2) {
      const sign = index === 0 ? 1 : -1;
      return [2.4 * sign, 1.2 * sign, -1.1 * sign];
    }
    const y = 1 - (2 * (index + 0.5)) / count;
    const radial = Math.sqrt(1 - y * y);
    const angle = index * Math.PI * (3 - Math.sqrt(5)) + 0.43;
    const radius = 2.9 + (index % 3) * 0.13;
    return [
      Math.cos(angle) * radial * radius,
      y * radius,
      Math.sin(angle) * radial * radius,
    ];
  });
  const center: DiamondPosition = [0, 0, 0];
  if (count > 1) {
    for (const point of points) {
      for (let axis = 0; axis < 3; axis++) center[axis] += point[axis] / count;
    }
  }
  return new Map([
    [DIAMOND_CENTER_ID, [0, 0, 0] as DiamondPosition],
    ...ids.map((id, index): [string, DiamondPosition] => [
      id,
      points[index].map((value, axis) => value - center[axis]) as DiamondPosition,
    ]),
  ]);
}

const directionLength = Math.hypot(0.42, 0.28, 1);
const direction: DiamondPosition = [
  0.42 / directionLength,
  0.28 / directionLength,
  1 / directionLength,
];
const rightLength = Math.hypot(direction[2], direction[0]);
const right: DiamondPosition = [
  direction[2] / rightLength,
  0,
  -direction[0] / rightLength,
];
const up: DiamondPosition = [
  direction[1] * right[2],
  direction[2] * right[0] - direction[0] * right[2],
  -direction[1] * right[0],
];
const dot = (a: DiamondPosition, b: DiamondPosition) =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export function diamondCameraFrame(
  aspect: number,
  positions: ReadonlyMap<string, DiamondPosition>,
) {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const fov = 42;
  const tangent = Math.tan((fov * Math.PI) / 360);
  let distance = 7.2;
  for (const point of positions.values()) {
    const depth = dot(point, direction);
    distance = Math.max(
      distance,
      depth +
        (Math.abs(dot(point, right)) + 0.45) / (tangent * safeAspect * 0.72),
      depth + (Math.abs(dot(point, up)) + 0.45) / (tangent * 0.68),
    );
  }
  return {
    position: direction.map((value) => value * distance) as DiamondPosition,
    target: [0, 0, 0] as DiamondPosition,
    fov,
    distance,
  };
}
