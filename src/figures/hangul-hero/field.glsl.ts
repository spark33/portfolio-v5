/**
 * The mark, as one signed-distance field.
 *
 * Every jamo and every Latin letter is a tile in an atlas of distance fields.
 * Each pair is sampled through a rectangle that travels from where the jamo
 * sits in its Hangul block to where the letter sits on the line, and its
 * *shape* is blended from one tile to the other along the way. The nine
 * results are combined with a smooth minimum, so the mark is a single
 * connected surface at every frame rather than nine solids passing each other.
 *
 * That operator is the whole idea. Raising its blend radius through the middle
 * of the transit makes the parts neck together into one mass and then draw
 * apart into letters, which is what a name turning into another name should
 * look like — and it makes the ninth jamo's fusion the same operation as
 * everything else rather than a special case bolted on.
 *
 * Nothing is extruded. Depth comes from the field's own gradient, taken with
 * screen-space derivatives, which gives an exact edge normal at any zoom and
 * antialiases to the pixel for free.
 */
export const PAIR_COUNT = 9;

export const vertexShader = /* glsl */ `
  out vec2 vPos;

  uniform vec2 uViewport; // half-extent of the frame in design units

  void main() {
    // A full-screen triangle pair in clip space; vPos carries the frame
    // coordinate the fragment shader works in.
    vPos = position.xy * uViewport;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const fragmentShader = /* glsl */ `
  precision highp float;

  in vec2 vPos;
  out vec4 fragColour;

  uniform sampler2D uAtlas;
  uniform vec2 uAtlasGrid;   // cols, rows
  uniform float uAtlasTile;  // tile size in texels
  uniform float uSpread;     // tile-widths the encoded byte range spans, ±

  // Per pair: xy = centre, zw = half-extent of the sampled rectangle.
  uniform vec4 uRect[${PAIR_COUNT}];
  // Per pair: x = rotation, y = shape blend, z = from tile, w = to tile.
  uniform vec4 uForm[${PAIR_COUNT}];

  uniform float uBlend;    // smooth-union radius, in design units
  uniform vec3 uView;      // xy = pan, z = zoom
  uniform float uBevel;    // width of the edge roll-off, in design units
  uniform float uGrain;
  uniform float uSeed;

  uniform vec3 uInk;
  uniform vec3 uKey;
  uniform vec3 uRim;
  uniform vec3 uBackground;

  /** Samples one atlas tile, returning distance in tile-widths. */
  float tileDistance(float tile, vec2 uv) {
    float col = mod(tile, uAtlasGrid.x);
    float row = floor(tile / uAtlasGrid.x);

    // Half a texel of inset, so bilinear filtering at a tile's edge cannot
    // pull in the neighbouring glyph.
    vec2 inset = vec2(0.5 / uAtlasTile);
    vec2 clamped = clamp(uv, inset, 1.0 - inset);

    vec2 atlasUV = (vec2(col, row) + clamped) / uAtlasGrid;
    return (texture(uAtlas, atlasUV).r * 2.0 - 1.0) * uSpread;
  }

  /** Distance from a point to an axis-aligned box, in the box's own units. */
  float boxDistance(vec2 p, vec2 half_) {
    vec2 d = abs(p) - half_;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
  }

  /**
   * Polynomial smooth minimum. The blend radius is what turns nine fields into
   * one mark; at k → 0 it degrades to a plain union of separate shapes.
   */
  float smoothUnion(float a, float b, float k) {
    if (k <= 0.0001) return min(a, b);
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
  }

  /** The combined field at a point in design space. */
  float field(vec2 p) {
    float d = 1e6;

    for (int i = 0; i < ${PAIR_COUNT}; i++) {
      vec4 rect = uRect[i];
      vec4 form = uForm[i];

      vec2 offset = p - rect.xy;
      float c = cos(form.x);
      float s = sin(form.x);
      vec2 local = vec2(c * offset.x + s * offset.y, -s * offset.x + c * offset.y);
      local /= rect.zw;

      // The atlas was rasterised in image order, top row first, so v runs
      // opposite to design-space y.
      vec2 uv = vec2(local.x, -local.y) * 0.5 + 0.5;

      float from = tileDistance(form.z, uv);
      float to = tileDistance(form.w, uv);
      // Blending the two distance fields is the morph: it interpolates the
      // shapes themselves, so a stroke grows and bends into a letter instead
      // of one image dissolving into another.
      float shape = mix(from, to, form.y);

      // Tile distances are in tile-widths; the smaller half-extent converts
      // them to design units without ever overstating the distance, which
      // keeps the smooth union conservative under a stretched rect.
      float scale = min(rect.z, rect.w) * 2.0;

      // Outside its own rectangle a tile has no information — clamped sampling
      // would report a constant. Falling back to the distance to the rectangle
      // keeps the field honest far from the glyph.
      float outside = boxDistance(local, vec2(1.0)) * scale;

      d = smoothUnion(d, max(shape * scale, outside), uBlend);
    }

    return d;
  }

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed) * 43758.5453123);
  }

  void main() {
    vec2 p = vPos / uView.z + uView.xy;

    float d = field(p);

    // Screen-space gradient of the *combined* field: exact at any zoom, and it
    // absorbs the anisotropy of every stretched tile that fed into it.
    vec2 gradient = vec2(dFdx(d), dFdy(d));
    float slope = max(length(gradient), 1e-7);

    // One pixel of coverage, measured in the field's own units.
    float coverage = clamp(0.5 - d / slope, 0.0, 1.0);

    // A circular roll-off just inside the edge, read as a bevel.
    float t = clamp(-d / uBevel, 0.0, 1.0);
    float nz = sqrt(clamp(t * (2.0 - t), 0.0, 1.0));
    vec2 nxy = -(gradient / slope) * sqrt(max(1.0 - nz * nz, 0.0));
    vec3 normal = normalize(vec3(nxy, max(nz, 0.001)));

    vec3 lightDir = normalize(vec3(-0.44, 0.62, 0.65));
    float diffuse = max(dot(normal, lightDir), 0.0);
    float specular = pow(max(dot(reflect(-lightDir, normal), vec3(0.0, 0.0, 1.0)), 0.0), 64.0);
    // Grazing angles only — this is the cool edge light that separates the
    // mark from the ground, not an all-over glow.
    float rim = pow(1.0 - normal.z, 4.0);

    // The flat interior of a stroke has a constant normal, so lighting alone
    // gives it one value and the mark comes out as a flat fill with a rounded
    // edge. This is the missing gradient: a slow ramp across the mark in the
    // key's own direction, standing in for a source at finite distance.
    float sweep = smoothstep(-1.1, 0.9, dot(p, normalize(vec2(-0.44, 0.62))));

    vec3 surface = uInk;
    surface += uKey * (0.08 + 0.92 * diffuse) * (0.62 + 0.55 * sweep);
    surface += uKey * specular * 0.9;
    surface += uRim * rim * 0.85;

    // A short contact shade just inside the edge on the unlit side, which is
    // what reads as thickness rather than as a drawn outline.
    float lip = 1.0 - smoothstep(0.0, uBevel * 2.2, -d);
    surface *= 1.0 - 0.3 * lip * (1.0 - diffuse);

    // A wide, very shallow lift behind the mark, so the frame is not a flat
    // block of black. No bloom — this never brightens the mark itself.
    float vignette = 1.0 - smoothstep(0.0, 1.5, length(vPos * vec2(0.62, 1.0)));
    vec3 ground = uBackground + vec3(0.012, 0.013, 0.016) * vignette;

    vec3 colour = mix(ground, surface, coverage);

    // Grain last, at a low amplitude. It kills the banding that a near-black
    // gradient shows on an 8-bit display, and gives the surface a tooth.
    colour += (hash(gl_FragCoord.xy) - 0.5) * uGrain;

    fragColour = vec4(colour, 1.0);
  }
`;
