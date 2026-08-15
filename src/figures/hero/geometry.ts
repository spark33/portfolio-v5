import * as THREE from "three";

import blobUrl from "./hero-geometry.bin?url";
import { DEPTH, MESHES } from "./hero-geometry.ts";
import type { MeshEntry } from "./hero-geometry.ts";

/**
 * Loads the baked morph geometry.
 *
 * The blob is one fetch for all seventeen meshes; each entry is a view into it
 * rather than a copy, so building the BufferGeometries costs almost nothing
 * beyond the transfer.
 */

export interface HeroGeometry {
  entry: MeshEntry;
  geometry: THREE.BufferGeometry;
}

let pending: Promise<ArrayBuffer> | null = null;

/** Shared across mounts, so a second figure on the page does not refetch. */
function blob(): Promise<ArrayBuffer> {
  pending ??= fetch(blobUrl).then((response) => {
    if (!response.ok) throw new Error(`hero geometry: ${response.status}`);
    return response.arrayBuffer();
  });
  return pending;
}

function build(buffer: ArrayBuffer, entry: MeshEntry): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const vertices = entry.vertexCount;

  // Positions and normals are normalised Int16: both are bounded by 1, so the
  // attribute reads back as the original value with no scale to reapply.
  const vec3 = (offset: number) =>
    new THREE.BufferAttribute(new Int16Array(buffer, offset, vertices * 3), 3, true);

  geometry.setAttribute("position", vec3(entry.position));
  geometry.setAttribute("normal", vec3(entry.normal));
  // The morph target, and its normals. Interpolating position alone leaves the
  // baked normals describing a shape that is no longer there, and the bevel —
  // which is where most of the light lives — goes flat through the middle of
  // the morph.
  geometry.setAttribute("aTarget", vec3(entry.aTarget));
  geometry.setAttribute("aTargetNormal", vec3(entry.aTargetNormal));
  geometry.setAttribute(
    "aSeed",
    new THREE.BufferAttribute(new Uint8Array(buffer, entry.aSeed, vertices), 1, true),
  );

  geometry.setIndex(
    new THREE.BufferAttribute(new Uint16Array(buffer, entry.index, entry.indexCount), 1),
  );

  // The bounding volume has to cover both states, or a glyph gets frustum
  // culled partway through a morph that carries it outside its source bounds.
  // Taken from the manifest rather than measured, since the attributes are
  // quantised and three would only see the source state anyway.
  const [sx1, sy1, sx2, sy2] = entry.sourceBounds;
  const [tx1, ty1, tx2, ty2] = entry.targetBounds;
  const box = new THREE.Box3(
    new THREE.Vector3(Math.min(sx1, tx1), Math.min(sy1, ty1), -DEPTH),
    new THREE.Vector3(Math.max(sx2, tx2), Math.max(sy2, ty2), DEPTH),
  );
  geometry.boundingBox = box;
  geometry.boundingSphere = box.getBoundingSphere(new THREE.Sphere());

  return geometry;
}

export async function loadHeroGeometry(): Promise<HeroGeometry[]> {
  const buffer = await blob();
  return MESHES.map((entry) => ({ entry, geometry: build(buffer, entry) }));
}
