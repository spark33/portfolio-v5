import { mountGate } from "./loader/gate.ts";

// First, and from a chunk that carries nothing else. The curtain is in the
// markup and something has to take it away — including in every case where it
// never plays at all.
mountGate(document.querySelector<HTMLElement>("#gate"));

const canvas = document.querySelector<HTMLCanvasElement>("#scene");

if (!canvas) {
  throw new Error("Missing #scene canvas");
}

// Split out on purpose: three.js is most of this page's weight and the
// animation is a fraction of it. Bundled together, the loading animation could
// not start until the thing it is covering for had finished downloading.
void import("./scene.ts").then(({ createScene }) => {
  const handle = createScene(canvas);

  if (import.meta.hot) {
    import.meta.hot.dispose(() => handle.dispose());
  }
});
