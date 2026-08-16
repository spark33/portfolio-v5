/**
 * The only script the board needs.
 *
 * Everything structural — the lattice, the star points, the solved field —
 * is already in the HTML and the CSS by the time this runs. All this does is
 * publish the pointer's position so the lift mask has somewhere to sit, and
 * honour `?board` for the debug view.
 *
 * If it never loads, the page is the page. That is the point.
 */

/** Matches --board-reach in tokens.css, so the listener can sleep off-page. */
const REACH = 260;

export function mountBoard() {
  if (new URLSearchParams(location.search).has("board")) {
    document.body.classList.add("show-board");
  }

  // No pointer, or no appetite for motion: the lift is display:none anyway,
  // so there is nothing to publish and no listener worth attaching.
  const wants =
    matchMedia("(hover: hover)").matches &&
    !matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!wants) return;

  const root = document.documentElement;
  let frame = 0;
  let x = 0;
  let y = 0;

  const write = () => {
    frame = 0;
    root.style.setProperty("--mx", `${x}px`);
    root.style.setProperty("--my", `${y}px`);
  };

  // Coalesce to one write per frame. Pointer events fire far faster than the
  // compositor can use them, and the mask is a paint.
  const onMove = (event: PointerEvent) => {
    x = event.clientX;
    y = event.clientY + scrollY;
    if (!frame) frame = requestAnimationFrame(write);
  };

  const onLeave = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    root.style.setProperty("--mx", `${-REACH * 4}px`);
  };

  addEventListener("pointermove", onMove, { passive: true });
  document.addEventListener("pointerleave", onLeave);
}
