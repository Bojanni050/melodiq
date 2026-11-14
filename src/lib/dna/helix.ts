// Geometry for the Melody DNA helix.
//
// The page renders this as an SVG: two strands crossing in a projected 2D
// helix, one rung per trait, a node riding the front-most strand. Pure maths
// only — no React, no DOM — so the shape is testable and the same layout can be
// reused by the share card.

export const HELIX_WIDTH = 620;
/** Horizontal centre of the strands; the right side is reserved for labels. */
export const HELIX_CENTER_X = 196;
export const HELIX_RADIUS = 58;
/** Vertical distance between two rungs. */
export const HELIX_ROW_HEIGHT = 34;
/** Extra space inserted where the category changes. */
export const HELIX_CATEGORY_GAP = 18;
/** Radians of twist per rung; ~0.62 gives a full turn every ten rungs. */
export const HELIX_PHASE_STEP = 0.62;
export const HELIX_PADDING_Y = 34;
/** Labels start here, measured from the left edge. */
export const HELIX_LABEL_X = HELIX_WIDTH - 8;
export const HELIX_LABEL_MAX_CHARS = 38;

export type HelixPoint = { x: number; y: number };

export type HelixTraitInput = {
  key: string;
  category: string;
  label: string;
  display: string;
  confidence: number;
  verdict?: string | null;
  direction?: string | null;
};

export type HelixNode = {
  key: string;
  category: string;
  label: string;
  display: string;
  confidence: number;
  verdict: string | null;
  direction: string | null;
  /** Where the label sits on its connector, so text never collides with a rung. */
  x: number;
  y: number;
  /** 1 = front of the helix, -1 = behind it. Drives size and opacity. */
  depth: number;
  /** Start of the rung (left strand) and end (right strand). */
  rung: { x1: number; x2: number };
};

export type HelixLayout = {
  width: number;
  height: number;
  nodes: HelixNode[];
  leftStrand: HelixPoint[];
  rightStrand: HelixPoint[];
};

/** Shortens label text for the SVG so one long trait cannot run off the card. */
export function truncate(text: string, max: number): string {
  if (max <= 0) return "";
  if (text.length <= max) return text;
  if (max <= 1) return text.slice(0, max);
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Builds the projected helix. `rotation` (radians) lets the UI spin the shape
 * without rebuilding trait data; the layout stays deterministic for a given
 * input, which is what the tests rely on. `gaps` holds indices that start a new
 * category (see categoryGapIndices).
 */
export function buildHelixLayout(traits: HelixTraitInput[], rotation = 0, gaps: number[] = []): HelixLayout {
  const gapsBefore = new Set(gaps);

  // Row positions accumulate so a category change leaves a visible break
  // between the groups instead of a smooth run of rungs.
  const rows: number[] = [];
  let y = HELIX_PADDING_Y;
  traits.forEach((_, index) => {
    y += gapsBefore.has(index) ? HELIX_CATEGORY_GAP : 0;
    rows.push(y);
    y += HELIX_ROW_HEIGHT;
  });

  const lastRow = rows[rows.length - 1] ?? HELIX_PADDING_Y;
  const height =
    traits.length === 0 ? HELIX_PADDING_Y * 2 : lastRow + HELIX_PADDING_Y;

  const nodes: HelixNode[] = traits.map((trait, index) => {
    const phase = index * HELIX_PHASE_STEP + rotation;
    const x1 = HELIX_CENTER_X + HELIX_RADIUS * Math.sin(phase);
    const x2 = HELIX_CENTER_X + HELIX_RADIUS * Math.sin(phase + Math.PI);
    const depth = Math.cos(phase);
    // The node rides whichever strand is closest to the viewer.
    const x = depth >= 0 ? x1 : x2;
    return {
      key: trait.key,
      category: trait.category,
      label: trait.label,
      display: trait.display,
      confidence: trait.confidence,
      verdict: trait.verdict ?? null,
      direction: trait.direction ?? null,
      x,
      y: rows[index] ?? HELIX_PADDING_Y,
      depth,
      rung: { x1, x2 },
    };
  });

  return {
    width: HELIX_WIDTH,
    height,
    nodes,
    leftStrand: sampleStrand(rows, rotation, 0),
    rightStrand: sampleStrand(rows, rotation, Math.PI),
  };
}

/**
 * Samples both strands between rungs so the curve bends instead of drawing a
 * zigzag between nodes.
 */
function sampleStrand(rows: number[], rotation: number, offset: number): HelixPoint[] {
  if (rows.length === 0) return [];
  const steps = 6;
  const points: HelixPoint[] = [];
  let globalRow = 0;

  for (let index = 0; index < rows.length - 1; index += 1) {
    const startY = rows[index];
    const endY = rows[index + 1];
    for (let step = 0; step < steps; step += 1) {
      const t = step / steps;
      const phase = (globalRow + t) * HELIX_PHASE_STEP + rotation + offset;
      points.push({
        x: HELIX_CENTER_X + HELIX_RADIUS * Math.sin(phase),
        y: startY + (endY - startY) * t,
      });
    }
    globalRow += 1;
  }

  const tailPhase = globalRow * HELIX_PHASE_STEP + rotation + offset;
  points.push({
    x: HELIX_CENTER_X + HELIX_RADIUS * Math.sin(tailPhase),
    y: rows[rows.length - 1],
  });
  return points;
}

/** Converts points into an SVG path so strands render as one smooth line. */
export function toPath(points: HelixPoint[]): string {
  if (points.length === 0) return "";
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
}

/**
 * Indices that start a new category in a sorted trait list; the layout uses
 * them for gaps so the helix visually separates sound/voice/structure/words/taste.
 */
export function categoryGapIndices(traits: { category: string }[]): number[] {
  const gaps: number[] = [];
  for (let index = 1; index < traits.length; index += 1) {
    if (traits[index].category !== traits[index - 1].category) gaps.push(index);
  }
  return gaps;
}

export function nodeRadius(depth: number): number {
  return 3.2 + 2.6 * ((depth + 1) / 2);
}
