import * as THREE from "three";

import blobUrl from "./hero-geometry.bin?url";
import { MESHES } from "./hero-geometry.ts";
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

  const vec3 = (offset: number) =>
    new THREE.BufferAttribute(new Float32Array(buffer, offset, vertices * 3), 3);

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
    new THREE.BufferAttribute(new Float32Array(buffer, entry.aSeed, vertices), 1),
  );

  geometry.setIndex(
    new THREE.BufferAttribute(new Uint32Array(buffer, entry.index, entry.indexCount), 1),
  );

  // The bounding sphere has to cover both states, or a glyph gets frustum
  // culled partway through a morph that carries it outside its source bounds.
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const target = new THREE.Box3().setFromBufferAttribute(
    geometry.getAttribute("aTarget") as THREE.BufferAttribute,
  );
  box.union(target);
  geometry.boundingSphere = box.getBoundingSphere(new THREE.Sphere());

  return geometry;
}

export async function loadHeroGeometry(): Promise<HeroGeometry[]> {
  const buffer = await blob();
  return MESHES.map((entry) => ({ entry, geometry: build(buffer, entry) }));
}
