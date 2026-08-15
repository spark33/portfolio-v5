/**
 * Tiles a run of screenshots into one contact sheet.
 *
 * Shared by `film.mjs` (seeked frames) and `play.mjs` (real playback), which
 * differ only in how they decide when to shoot. Composited in the page rather
 * than in Node so there is no image dependency to install.
 */
import fs from "node:fs";

export const GROUNDS = {
  dark: { background: "#0a0a0f", ink: "#f4f4f5", accent: "#9aa6ff" },
  light: { background: "#fcfcfb", ink: "#16161a", accent: "#3f4fc4" },
};

/**
 * @param page      a Playwright page — used only as a canvas host
 * @param shots     `{ label, file }`, in reading order
 * @param options   `{ frame, cols, ground, out }`
 */
export async function writeSheet(page, shots, { frame, cols, ground, out }) {
  const colours = GROUNDS[ground] ?? GROUNDS.dark;

  const dataUrl = await page.evaluate(
    async ({ shots, frame, cols, colours }) => {
      const rows = Math.ceil(shots.length / cols);
      const canvas = document.createElement("canvas");
      canvas.width = frame.width * cols;
      canvas.height = frame.height * rows;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = colours.background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (const [i, shot] of shots.entries()) {
        const img = new Image();
        await new Promise((ok, no) => {
          img.onload = ok;
          img.onerror = no;
          img.src = shot.dataUrl;
        });
        const x = (i % cols) * frame.width;
        const y = Math.floor(i / cols) * frame.height;
        ctx.drawImage(img, x, y, frame.width, frame.height);
        ctx.fillStyle = colours.ink;
        ctx.font = "600 15px monospace";
        ctx.globalAlpha = 0.55;
        ctx.fillText(shot.label, x + 12, y + 24);
        ctx.globalAlpha = 1;
      }
      return canvas.toDataURL("image/png");
    },
    {
      frame,
      cols,
      colours,
      shots: shots.map((shot) => ({
        label: shot.label,
        dataUrl: `data:image/png;base64,${fs.readFileSync(shot.file).toString("base64")}`,
      })),
    },
  );

  fs.writeFileSync(out, Buffer.from(dataUrl.split(",")[1], "base64"));
  return out;
}

/** Overrides the ground without reaching for a node in Storybook's tree. */
export async function paintGround(page, ground) {
  const colours = GROUNDS[ground];
  if (!colours || ground === "dark") return;
  // Injected as a stylesheet rather than set on an element: the story paints
  // its own background inline, and a selector into Storybook's tree is one that
  // silently stops matching. The loader takes its fill from `currentColor`.
  await page.addStyleTag({
    content:
      `div { background: ${colours.background} !important; color: ${colours.ink} !important }` +
      // The one colour the loader does not take from `currentColor`, and it is
      // a different value on each ground by design.
      `:root { --accent: ${colours.accent} }`,
  });
}
