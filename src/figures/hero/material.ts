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
    // Front side. Both options were built and rendered; this is the lesser
    // fault. See the fragment patch below for the full reasoning.
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

    // On the cap fold-over, and why this material is front-sided.
    //
    // Where a glyph has a contour its partner lacks, the missing one collapses
    // to a point inside its own ink, and the cap triangulation becomes a fan
    // from that point. A fan only tessellates a star-shaped polygon, and
    // neither N nor ㅂ is one, so some triangles fold over.
    //
    // Three things were tried. Culling them (this) leaves hairline gaps where
    // the fold is small — a faint scratch across N's diagonal. Drawing them
    // double-sided lights them as though they faced away, because
    // <normal_fragment_begin> negates the normal on back faces. Drawing them
    // double-sided *and* restoring the normal from `vNormal` fixes N
    // completely — and then renders ㅂ as a solid slab, because its fold is
    // large enough to sweep well outside the letterform, and a fold you can
    // see is far worse than a seam you can barely find.
    //
    // So the folds are culled. The real fix is a cap triangulation valid in
    // both states rather than in one — bridging the hole to the outer contour
    // as a keyhole slit, so there is no fan and no apex. That is a rewrite of
    // the triangulation step in the bake, not a material setting.
  };

  return { material, uniforms };
}

/**
 * Depth material for the same morph.
 *
 * Shadow maps are drawn with three's own depth material, which knows nothing
 * about the patch above — so without this the shadow is cast by the *source*
 * geometry for the whole sequence, and 박상현's shadow sits under "SEAN PARK".
 * It is the kind of error that reads as "something is wrong with the lighting"
 * long before anyone works out that the shadow never moved.
 *
 * Assign to `mesh.customDepthMaterial`, sharing the surface's uniforms so both
 * are driven by one write.
 */
export function createMorphDepthMaterial(uniforms: MorphUniforms): THREE.MeshDepthMaterial {
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });

  depth.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        /* glsl */ `
        #include <common>
        attribute vec3 aTarget;
        attribute float aSeed;
        uniform float uProgress;
        uniform float uSpread;
        `,
      )
      .replace(
        "#include <begin_vertex>",
        /* glsl */ `
        float heroDelay = aSeed * uSpread;
        float heroMorph = clamp((uProgress - heroDelay) / (1.0 - uSpread), 0.0, 1.0);
        heroMorph = heroMorph * heroMorph * (3.0 - 2.0 * heroMorph);
        vec3 transformed = mix(position, aTarget, heroMorph);
        `,
      );
  };

  return depth;
}
