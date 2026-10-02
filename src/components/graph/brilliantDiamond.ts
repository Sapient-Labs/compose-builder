import * as THREE from "three";

/**
 * Round brilliant cut diamond, ported from the Compose docs DiamondScene.
 * Procedural symmetry keeps facet edges sharp for a crystalline look.
 */
export function createBrilliantDiamondGeometry(radius = 0.48): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();

  const rTable = radius * 0.54;
  const rGirdle = radius;
  const rMidCrown = radius * 0.82;

  const hCrown = radius * 0.3;
  const hMidCrown = radius * 0.12;
  const hGirdle = 0;
  const hTip = -radius * 0.75;

  const vertices: number[] = [];
  const indices: number[] = [];

  const tableVerts: number[] = [];
  for (let i = 0; i < 8; i++) {
    const theta = (i / 8) * Math.PI * 2;
    vertices.push(Math.cos(theta) * rTable, hCrown, Math.sin(theta) * rTable);
    tableVerts.push(i);
  }

  const midCrownVerts: number[] = [];
  for (let i = 0; i < 8; i++) {
    const theta = ((i + 0.5) / 8) * Math.PI * 2;
    vertices.push(
      Math.cos(theta) * rMidCrown,
      hMidCrown,
      Math.sin(theta) * rMidCrown,
    );
    midCrownVerts.push(8 + i);
  }

  const girdleVerts: number[] = [];
  for (let i = 0; i < 16; i++) {
    const theta = (i / 16) * Math.PI * 2;
    vertices.push(Math.cos(theta) * rGirdle, hGirdle, Math.sin(theta) * rGirdle);
    girdleVerts.push(16 + i);
  }

  const pavMidVerts: number[] = [];
  for (let i = 0; i < 16; i++) {
    const theta = (i / 16) * Math.PI * 2;
    vertices.push(
      Math.cos(theta) * (rGirdle * 0.5),
      hGirdle + (hTip - hGirdle) * 0.5,
      Math.sin(theta) * (rGirdle * 0.5),
    );
    pavMidVerts.push(32 + i);
  }

  const tipIdx = 48;
  vertices.push(0, hTip, 0);
  const topCenterIdx = 49;
  vertices.push(0, hCrown, 0);

  for (let i = 0; i < 8; i++) {
    indices.push(topCenterIdx, tableVerts[i], tableVerts[(i + 1) % 8]);
  }

  for (let i = 0; i < 8; i++) {
    const T_curr = tableVerts[i];
    const T_next = tableVerts[(i + 1) % 8];
    const M_curr = midCrownVerts[i];
    const M_prev = midCrownVerts[(i + 7) % 8];
    const G_curr = girdleVerts[i * 2];
    const G_mid = girdleVerts[i * 2 + 1];
    const G_next = girdleVerts[(i * 2 + 2) % 16];

    indices.push(T_curr, M_curr, T_next);
    indices.push(M_curr, G_curr, G_mid);
    indices.push(M_curr, G_mid, G_next);
    indices.push(T_curr, M_prev, G_curr);
    indices.push(T_curr, G_curr, M_curr);
  }

  for (let i = 0; i < 16; i++) {
    const G_curr = girdleVerts[i];
    const G_next = girdleVerts[(i + 1) % 16];
    const P_curr = pavMidVerts[i];
    const P_next = pavMidVerts[(i + 1) % 16];

    indices.push(G_curr, P_curr, G_next);
    indices.push(G_next, P_curr, P_next);
    indices.push(P_curr, tipIdx, P_next);
  }

  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
