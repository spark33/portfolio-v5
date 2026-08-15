import { createScene } from "./scene.ts";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");

if (!canvas) {
  throw new Error("Missing #scene canvas");
}

const handle = createScene(canvas);

if (import.meta.hot) {
  import.meta.hot.dispose(() => handle.dispose());
}
