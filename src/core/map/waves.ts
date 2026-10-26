// Wave strokes of the animated sea (DESIGN.md §5 "wave strokes (2 groups)"). The layout is the map board's
// (design/boards/map): a grid of small double curls, 56 apart and 34 rows apart, each nudged by a fixed hash so the
// pattern looks hand-scattered but is the same on every render. Decoration, not game data.

/** World coordinates (DESIGN.md §5). */
const WIDTH = 1440;
const HEIGHT = 900;

/** Fractional part of a sine hash: a stable pseudo-random value in [0, 1) per grid point. */
function jitter(x: number, y: number): number {
  const h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return h - Math.floor(h);
}

/**
 * One SVG path (all curls as subpaths) for wave group 0 or 1; group 1 sits half a cell off group 0.
 * `top` is the first row (the map board starts at 70, the sign-in board at 40).
 */
export function wavePath(group: 0 | 1, top = 70): string {
  const parts: string[] = [];
  for (let y = top + group * 17; y < HEIGHT; y += 34) {
    for (let x = 10 + group * 28; x < WIDTH; x += 56) {
      const j = jitter(x, y);
      const w = 6 + j * 6;
      const px = (x + j * 24).toFixed(1);
      const py = (y + (j - 0.5) * 12).toFixed(1);
      parts.push(`M${px} ${py}q${(w / 2).toFixed(1)} -3 ${w.toFixed(1)} 0t${w.toFixed(1)} 0`);
    }
  }
  return parts.join("");
}
