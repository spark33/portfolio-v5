/**
 * Home page entry.
 *
 * Everything here is enhancement. The server rendered a finished page; this
 * file animates the name sequence on a first visit and nothing else. If it
 * never runs, the only difference is that the sequence is already in its
 * final state — which is also what a reader who has asked for reduced motion,
 * or who has been here before, gets on purpose.
 *
 * There was a ScrollTrigger reveal on the position strip here. It cost 43.6 KB
 * to fade in four numbers, and it left them at opacity 0 until the reader
 * happened to scroll past — hiding the credentials the page exists to deliver.
 * A site whose job is three minutes long cannot spend them waiting for prose
 * to arrive, so scroll now only scrolls.
 */
import { mountNameSequence } from "./name-sequence.ts";

const sequence = document.querySelector<HTMLElement>("[data-name-sequence]");
const handle = sequence ? mountNameSequence(sequence) : undefined;

if (import.meta.hot) {
  import.meta.hot.dispose(() => handle?.destroy());
}
