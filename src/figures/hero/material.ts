import * as THREE from "three";

/**
 * The morph material: MeshPhysicalMaterial, patched to interpolate between the
 * two baked vertex sets.
 *
 * Patching rather than replacing is the whole point of the contour-matched
 * approach. Everything three.js does for a physical material — image-based
 * lighting, shadow reception, tone mapping, the full BRDF — keeps working,
 * because the only thing changed is where the vertices are before any of that
 * runs.
 */

export interface MorphUniforms {
  uProgress: { value: number };
  uSpread: { value: number };
}

export interface MorphMaterial {
  material: THREE.MeshPhysicalMaterial;
  uniforms: MorphUniforms;
}

/** Look constants, shared by every glyph so the set reads as one material. */
export const SURFACE = {
  color: 0xd8d2c6,
  roughness: 0.48,
  metalness: 0.35,
  envMapIntensity: 1.1,
} as const;

/**
 * Fraction of a glyph's morph spent staggering its own vertices.
 *
 * This is the second level of stagger — the scene timeline offsets whole
 * glyphs against each other, and this offsets the strokes *within* a glyph
 * against each other. Having both is what stops it reading as a single tween
 * with a delay on it.
 */
const DEFAULT_SPREAD = 0.35;

export function createMorphMaterial(options: { spread?: number } = {}): MorphMaterial {
  const uniforms: MorphUniforms = {
    uProgress: { value: 0 },
    uSpread: { value: options.spread ?? DEFAULT_SPREAD },
  };

  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(SURFACE.color),
    roughness: SURFACE.roughness,
    metalness: SURFACE.metalness,
    envMapIntensity: SURFACE.envMapIntensity,
    // Front side, deliberately, and the alternative was tried.
    //
    // Known limitation: where a glyph has a hole its partner lacks (ㅇ→N,
    // ㅇ→G, ㅎ→H), the hole collapses to an interior point and the cap
    // triangulation around it becomes a fan from that point. A fan only
    // tessellates a star-shaped polygon, and N is not one, so a few triangles
    // fold over near its concave notch.
    //
    // Culling them leaves hairline gaps — faint dark scratches on the face.
    // Drawing them double-sided looked like the fix, since normals come from
    // the vertex attribute rather than the winding, but three.js negates the
    // normal for back-facing fragments in <normal_fragment_begin>: the folded
    // triangles then light as though they face away, and a subtle dark scratch
    // becomes an obvious bright fan. Culling is the quieter of the two faults.
    //
    // The real fix is a cap triangulation valid in both states rather than in
    // one; collapsing the hole onto the outer contour as a keyhole slit is the
    // usual route. Not attempted here — it is a rewrite of the triangulation
    // step, and the artefact is only visible on three of the thirteen pairs.
    side: THREE.FrontSide,
  });

  material.onBeforeCompile = (shader) => {
    // The same uniform objects, not copies — so writing `uniforms.uProgress`
    // reaches the shader whether or not it has compiled yet, and a caller
    // never has to wait for `onBeforeCompile` to fire.
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        /* glsl */ `
        #include <common>

        attribute vec3 aTarget;
        attribute vec3 aTargetNormal;
        attribute float aSeed;

        uniform float uProgress;
        uniform float uSpread;

        // Written in <beginnormal_vertex>, read again in <begin_vertex>.
        // three.js emits the former first, so this is set before it is used.
        float heroMorph;
        `,
      )
      // Normals first, because three.js puts this include ahead of the
      // position one and the morph factor is computed here for both.
      .replace(
        "#include <beginnormal_vertex>",
        /* glsl */ `
        float heroDelay = aSeed * uSpread;
        heroMorph = clamp((uProgress - heroDelay) / (1.0 - uSpread), 0.0, 1.0);
        heroMorph = heroMorph * heroMorph * (3.0 - 2.0 * heroMorph);

        // Renormalised after the mix: interpolating two unit vectors gives a
        // shorter one everywhere except the endpoints, and an under-length
        // normal reads as a dark band sweeping across the bevel.
        vec3 objectNormal = normalize(mix(normal, aTargetNormal, heroMorph));
        `,
      )
      .replace(
        "#include <begin_vertex>",
        /* glsl */ `
        vec3 transformed = mix(position, aTarget, heroMorph);
        `,
      );
  };

  return { material, uniforms };
}
