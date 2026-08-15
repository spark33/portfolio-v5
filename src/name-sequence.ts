/**
 * The name sequence: 박상현 → ㅂㅏㄱ ㅅㅏㅇ ㅎㅕㄴ → PARK SANGHYEON → Sean Park.
 *
 * This is the placeholder implementation. A WebGL version of the same
 * sequence is being built separately and drops in behind this one interface:
 *
 *     mountNameSequence(root) -> { destroy() }
 *
 * The contract the replacement has to keep:
 *
 *   - The server already rendered the finished sequence into `root`. Mounting
 *     is an enhancement of something complete, never the thing that makes it
 *     appear. If this module never loads, the page is correct.
 *   - `destroy()` releases everything and leaves the DOM in its finished state.
 *   - Nothing runs under `prefers-reduced-motion: reduce`, and nothing runs on
 *     a repeat visit. Both are decided before mount, by the inline script in
 *     the page head, so the first frame is already right.
 *
 * The placeholder uses the Web Animations API rather than a library. GSAP was
 * here and cost 70 KB to stagger four rows, which is not a trade a placeholder
 * gets to make; the replacement is free to pull in whatever it genuinely needs,
 * because it is isolated behind this function. The easing is read from the
 * `--ease-resolve` custom property, so the curve has exactly one definition
 * and a tween cannot drift from a CSS transition using the same token.
 */

export interface NameSequenceHandle {
  destroy(): void;
}

/** Set by the inline head script when, and only when, the sequence should play. */
const PENDING = "pending";
const SEEN_KEY = "sp:name-sequence-seen";
const STAGGER_MS = 150;
const DURATION_MS = 620;

const NOOP: NameSequenceHandle = { destroy() {} };

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Private mode, or storage disabled. The sequence simply plays again.
  }
}

/** Hands the page back to CSS, whatever happened. */
function reveal() {
  delete document.documentElement.dataset.seq;
}

export function mountNameSequence(root: HTMLElement): NameSequenceHandle {
  if (document.documentElement.dataset.seq !== PENDING) {
    return NOOP; // Reduced motion, a repeat visit, or the failsafe already fired.
  }

  const steps = [...root.querySelectorAll<HTMLElement>(".name-step")];
  if (!steps.length || typeof root.animate !== "function") {
    reveal();
    return NOOP;
  }

  const easing =
    getComputedStyle(document.documentElement)
      .getPropertyValue("--ease-resolve")
      .trim() || "ease-out";

  // Each encoding arrives after the one above it, with a little momentum and
  // a settle. `backwards` fill holds the start state through the delay, so
  // nothing flashes before its turn.
  const animations = steps.map((step, i) =>
    step.animate(
      [
        { opacity: 0, transform: "translateY(18px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      {
        duration: DURATION_MS,
        delay: i * STAGGER_MS,
        easing,
        fill: "backwards",
      },
    ),
  );

  // Reveal on the same frame the animations start, so the `opacity: 0` the
  // head script set is never visible on its own.
  reveal();

  const last = animations[animations.length - 1];
  last.addEventListener("finish", markSeen, { once: true });

  return {
    destroy() {
      for (const animation of animations) animation.cancel();
      reveal();
    },
  };
}
