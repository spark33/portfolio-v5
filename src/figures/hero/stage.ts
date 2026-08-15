import * as THREE from "three";

import { createStudioEnvironment } from "./environment.ts";

/**
 * Renderer, scene, camera and lights — the parts that are the same whether the
 * scene is showing one glyph for evaluation or the whole sequence.
 *
 * Kept separate from the sequence so that acceptance criterion 3 is testable:
 * the base render has to look right on its own, before any post-processing is
 * involved, and it is much easier to be honest about that when the base is a
 * thing you can mount by itself.
 */

const MAX_PIXEL_RATIO = 2;

export interface Stage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** Everything that should be lit and framed goes in here. */
  root: THREE.Group;
  key: THREE.DirectionalLight;
  resize(width: number, height: number): void;
  dispose(): void;
}

export function createStage(canvas: HTMLCanvasElement): Stage {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  // VSM, for genuinely soft shadow edges. A hard-edged shadow under type this
  // size announces the shadow map's resolution.
  renderer.shadowMap.type = THREE.VSMShadowMap;

  const scene = new THREE.Scene();
  // Reflect an environment you cannot see: the surroundings light the metal
  // and give it something to reflect, while the frame stays a flat near-black.
  scene.environment = createStudioEnvironment(renderer);
  scene.background = new THREE.Color(0x07080a);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0, 8);

  const root = new THREE.Group();
  scene.add(root);

  // --- Lights --------------------------------------------------------------
  // The environment does most of the work; these three shape it.
  const key = new THREE.DirectionalLight(0xfff2e0, 1.4);
  key.position.set(-4.2, 5.4, 4.6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.radius = 6;
  key.shadow.blurSamples = 16;
  key.shadow.bias = -0.0006;
  // A tight frustum around the type. An oversized one spends the whole 2048
  // on empty space and the shadow comes back soft in the wrong way — blocky
  // rather than diffuse.
  const shadowCamera = key.shadow.camera;
  shadowCamera.left = -4.5;
  shadowCamera.right = 4.5;
  shadowCamera.top = 3;
  shadowCamera.bottom = -3;
  shadowCamera.near = 1;
  shadowCamera.far = 16;
  shadowCamera.updateProjectionMatrix();
  scene.add(key, key.target);

  const fill = new THREE.DirectionalLight(0x93a9bf, 0.3);
  fill.position.set(5, -1.4, 3);
  scene.add(fill);

  // Behind and above. This is what separates the letterforms from the
  // background — without it the silhouette closes up against the ground and
  // acceptance criterion 4 fails at any size.
  const rim = new THREE.DirectionalLight(0xbcd0e8, 0.4);
  rim.position.set(1.6, 3.2, -5);
  scene.add(rim);

  function resize(width: number, height: number) {
    if (width === 0 || height === 0) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    renderer.setSize(width, height, false);
  }

  return {
    renderer,
    scene,
    camera,
    root,
    key,
    resize,
    dispose() {
      scene.environment?.dispose();
      renderer.dispose();
    },
  };
}

/**
 * A plane beneath the type to catch the contact shadow.
 *
 * §5.3 is right that this matters more than it should. Without a surface for
 * the type to sit against, the objects float and the whole frame reads as a
 * render of some geometry rather than as a photograph of some objects.
 * ShadowMaterial means the plane itself is invisible — only the shadow lands.
 */
export function createShadowCatcher(y: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 24),
    new THREE.ShadowMaterial({ opacity: 0.44 }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  mesh.receiveShadow = true;
  return mesh;
}
