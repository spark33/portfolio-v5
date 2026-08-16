import { DURATION, mountLoader } from "./index.ts";

/**
 * The loading animation, doing the job it was built for.
 *
 * A curtain over the home page that plays the sequence once and then lifts.
 * Everything here is about the difference between an intro and an obstacle:
 *
 * - **Once per session.** An animation you cannot get past is a toll booth.
 *   Second visit, second tab, back button — the page is just there.
 * - **Dismissible.** Any click, key, scroll or touch lifts it early. Someone
 *   who wants the content should never have to watch four seconds of type.
 * - **Never shown to reduced motion at all.** Not a static frame of it: a
 *   full-screen panel over the page, held for four seconds, is worse than no
 *   animation.
 * - **It cannot get stuck.** The element is in the HTML with a CSS failsafe
 *   that removes it on a timer whatever happens, so a script error takes the
 *   animation down with it and not the site.
 *
 * The page underneath is complete and readable the whole time — this is a
 * decorative panel over content that already exists, which is why the whole
 * thing is `aria-hidden` and the counter is not exposed as progress. It counts
 * out an animation, not a download, and dressing it up as the latter would be
 * a lie told to exactly the people least able to check it.
 */

/** Slack on the backstop, so it never races the animation's own ending. */
const GRACE = 400;

const SEEN = "loader:seen";

export function mountGate(host: HTMLElement | null): void {
  if (!host) return;
  const panel = host;

  const remove = () => panel.remove();

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    remove();
    return;
  }

  // sessionStorage throws outright in some privacy modes, and a loading
  // animation is not worth taking the page down for.
  let seen = false;
  try {
    seen = sessionStorage.getItem(SEEN) === "1";
    sessionStorage.setItem(SEEN, "1");
  } catch {
    seen = false;
  }
  if (seen) {
    remove();
    return;
  }

  const stage = document.createElement("div");
  stage.className = "gate__stage";
  panel.append(stage);

  const loader = mountLoader(stage, {
    autoplay: true,
    loop: false,
    onComplete: () => lift(),
  });

  let lifted = false;
  function lift() {
    if (lifted) return;
    lifted = true;

    window.removeEventListener("pointerdown", lift);
    window.removeEventListener("keydown", lift);
    window.removeEventListener("wheel", lift);
    window.removeEventListener("touchstart", lift);

    panel.classList.add("gate--lifting");
    // Torn down on the transition rather than on a matching timeout, so a
    // machine that skips the transition tears down immediately instead of
    // holding an invisible panel over the page.
    panel.addEventListener(
      "transitionend",
      () => {
        loader.dispose();
        remove();
      },
      { once: true },
    );
  }

  for (const event of ["pointerdown", "keydown", "wheel", "touchstart"] as const) {
    window.addEventListener(event, lift, { passive: true });
  }

  // Backstop. `onComplete` rides requestAnimationFrame, which a background tab
  // suspends — without this, a page opened in a background tab would still have
  // a full-screen panel over it whenever someone got round to looking.
  window.setTimeout(lift, DURATION + GRACE);
}
