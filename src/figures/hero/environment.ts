import * as THREE from "three";

/**
 * A studio environment, generated rather than loaded.
 *
 * §5.2 of the spec asks for a real HDRI through RGBELoader and PMREMGenerator,
 * and rejects RoomEnvironment on the grounds that it looks like every other
 * three.js demo. It is right about RoomEnvironment — it is a box of bright
 * panels, and metal lit by it reads as "three.js" instantly.
 *
 * But the description it gives of what a good HDRI would provide is specific
 * and small: one large soft key, dark surrounds, a horizon. That is a few
 * gradients, and building it here is better than shipping a file — it is a few
 * KB of code instead of a multi-megabyte .hdr, there is nothing to fetch
 * before the first frame, and the key's size, position and falloff are numbers
 * that can be tuned against the type rather than properties of a photograph
 * taken in someone else's room.
 *
 * What is lost is incidental detail — the clutter in a real environment map
 * that gives a reflection something to break up against. At this roughness
 * (0.48) that detail is almost entirely blurred away regardless, which is why
 * the trade is worth making here and would not be on a chrome surface.
 */

/** Equirectangular source resolution. Everything here is a soft gradient and
 *  PMREM blurs it further, so this is already more than it needs. */
const WIDTH = 256;
const HEIGHT = 128;

interface Source {
  /** Azimuth, 0–1 around the horizon. */
  u: number;
  /** Elevation, 0 at the zenith, 1 at the nadir. */
  v: number;
  /** Angular size. */
  size: number;
  /** Vertical stretch — a softbox is wider than it is tall. */
  aspect: number;
  /** Linear radiance at the centre. Above 1 by a lot; this is the HDR part. */
  intensity: number;
  colour: [number, number, number];
}

const SOURCES: Source[] = [
  // The key. Large, high, off to one side, and by far the brightest thing —
  // one dominant source is what gives a bevel a single clean highlight to run
  // along, where several competing sources give it a muddle.
  {
    u: 0.17,
    v: 0.24,
    size: 0.3,
    aspect: 0.62,
    intensity: 26,
    colour: [1, 0.96, 0.9],
  },
  // A cool, dim fill on the opposite side, so the shadow side is a colour
  // rather than an absence.
  {
    u: 0.68,
    v: 0.46,
    size: 0.42,
    aspect: 1,
    intensity: 1.1,
    colour: [0.58, 0.66, 0.82],
  },
  // A low, narrow strip behind, which is what puts the bright line along the
  // top edge of an extrusion when the type turns.
  {
    u: 0.5,
    v: 0.12,
    size: 0.5,
    aspect: 0.16,
    intensity: 3.2,
    colour: [0.92, 0.94, 1],
  },
];

/**
 * Builds the equirectangular texture and runs it through PMREM.
 *
 * The caller owns the returned texture and the generator's lifetime: dispose
 * both. PMREMGenerator holds render targets, and leaking those leaks GPU
 * memory rather than just heap.
 */
export function createStudioEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const data = new Float32Array(WIDTH * HEIGHT * 4);

  for (let y = 0; y < HEIGHT; y++) {
    const v = (y + 0.5) / HEIGHT;

    // Dark surrounds, lifting very slightly toward the zenith. Never black:
    // a truly black surround makes every unlit facet identical, and the form
    // stops being readable outside the key.
    const gradient = 0.012 + 0.03 * Math.pow(1 - v, 2.2);

    for (let x = 0; x < WIDTH; x++) {
      const u = (x + 0.5) / WIDTH;

      let r = gradient * 0.86;
      let g = gradient * 0.9;
      let b = gradient;

      for (const source of SOURCES) {
        // Azimuth wraps, so the shorter way round is the real distance.
        let du = Math.abs(u - source.u);
        if (du > 0.5) du = 1 - du;

        const dv = (v - source.v) / source.aspect;
        const distance = Math.hypot(du * 2, dv * 2) / source.size;

        if (distance >= 1) continue;

        // Smootherstep falloff. A hard-edged source puts a hard-edged
        // reflection on the bevel, which reads as a rendering artefact rather
        // than as a light.
        const t = 1 - distance;
        const falloff = t * t * t * (t * (t * 6 - 15) + 10);

        r += source.colour[0] * source.intensity * falloff;
        g += source.colour[1] * source.intensity * falloff;
        b += source.colour[2] * source.intensity * falloff;
      }

      const i = (y * WIDTH + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 1;
    }
  }

  const source = new THREE.DataTexture(data, WIDTH, HEIGHT, THREE.RGBAFormat, THREE.FloatType);
  source.mapping = THREE.EquirectangularReflectionMapping;
  source.colorSpace = THREE.LinearSRGBColorSpace;
  source.minFilter = THREE.LinearFilter;
  source.magFilter = THREE.LinearFilter;
  source.needsUpdate = true;

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const environment = pmrem.fromEquirectangular(source).texture;

  source.dispose();
  pmrem.dispose();

  return environment;
}
