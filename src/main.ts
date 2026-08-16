/**
 * Site entry.
 *
 * Everything here is enhancement. The pages are rendered complete — including
 * the board's solved geometry, which is computed at build time in lib/board.ts
 * and arrives as cell coordinates in the HTML. This file publishes the pointer
 * position for the lattice lift, and nothing else.
 *
 * Two things were removed during the build and should stay removed unless
 * something changes. GSAP cost 70 KB to stagger four rows. ScrollTrigger faded
 * in the position strip, which left the site's credentials at opacity 0 until
 * the reader happened to scroll past — on a site with a three-minute budget,
 * scroll only scrolls.
 */
import { mountBoard } from "./board.ts";

mountBoard();
