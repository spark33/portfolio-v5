import * as THREE from "three";

const MAX_PIXEL_RATIO = 2;

export interface SceneHandle {
  dispose(): void;
}

/**
 * Boots the WebGL scene onto `canvas` and starts the render loop.
 * Call `dispose()` to tear down listeners, GPU resources, and the loop.
 */
export function createScene(canvas: HTMLCanvasElement): SceneHandle {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const darkScheme = window.matchMedia("(prefers-color-scheme: dark)");

  // The canvas covers the viewport, so it has to clear to the page's own
  // background or the type loses its contrast in whichever theme it does not
  // match. Reading the computed value keeps the scene tied to the CSS tokens.
  function pageBackground() {
    return new THREE.Color(getComputedStyle(document.body).backgroundColor);
  }

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));

  const scene = new THREE.Scene();
  const fog = new THREE.FogExp2(pageBackground().getHex(), 0.11);
  scene.fog = fog;

  function syncTheme() {
    const background = pageBackground();
    renderer.setClearColor(background);
    fog.color.copy(background);
  }

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 6);

  const geometry = new THREE.IcosahedronGeometry(1.6, 1);
  const material = new THREE.MeshStandardMaterial({
    color: 0x5b6cff,
    roughness: 0.35,
    metalness: 0.6,
    flatShading: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  const wireGeometry = new THREE.WireframeGeometry(geometry);
  const wireMaterial = new THREE.LineBasicMaterial({
    color: 0xa5b0ff,
    transparent: true,
    opacity: 0.18,
  });
  const wireframe = new THREE.LineSegments(wireGeometry, wireMaterial);
  mesh.add(wireframe);

  const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
  keyLight.position.set(3, 4, 5);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0xff7ac6, 1.2);
  rimLight.position.set(-4, -2, -3);
  scene.add(rimLight);

  scene.add(new THREE.AmbientLight(0x404060, 1.5));

  // Pointer parallax, smoothed toward the target each frame.
  const pointer = new THREE.Vector2();
  const pointerTarget = new THREE.Vector2();

  function onPointerMove(event: PointerEvent) {
    pointerTarget.set(
      (event.clientX / window.innerWidth) * 2 - 1,
      (event.clientY / window.innerHeight) * 2 - 1,
    );
  }

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    renderer.setSize(width, height, false);
  }

  const clock = new THREE.Clock();
  let frameId = 0;

  function tick() {
    frameId = requestAnimationFrame(tick);

    const delta = Math.min(clock.getDelta(), 0.1);

    if (!reducedMotion.matches) {
      mesh.rotation.x += delta * 0.15;
      mesh.rotation.y += delta * 0.25;

      pointer.lerp(pointerTarget, 1 - Math.exp(-6 * delta));
      camera.position.x = pointer.x * 0.6;
      camera.position.y = -pointer.y * 0.4;
      camera.lookAt(scene.position);
    }

    renderer.render(scene, camera);
  }

  resize();
  syncTheme();
  tick();

  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", onPointerMove);
  darkScheme.addEventListener("change", syncTheme);

  return {
    dispose() {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      darkScheme.removeEventListener("change", syncTheme);

      geometry.dispose();
      material.dispose();
      wireGeometry.dispose();
      wireMaterial.dispose();
      renderer.dispose();
    },
  };
}
