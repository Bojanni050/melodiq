// Geometry for the Melody DNA helix.
//
// The page draws this as SVG, but the maths behind it is real 3D: every point
// lives on a cylinder (radius + phase + row), is spun around the vertical axis
// and then projected with a perspective divide. Depth drives line weight,
// opacity and node size, and segments are sorted far-to-near so the front
// strand genuinely covers the one behind it.
//
// Pure maths only — no React, no DOM — so the shape is testable and stays
// deterministic for a given input. `rotation` is the only thing that changes
// while the user drags or lets it spin.

export const HELIX_WIDTH = 700;
/** Horizontal centre of the strands; the right side is reserved for labels. */
export const HELIX_CENTER_X = 210;
/** Cylinder radius in world units. */
export const HELIX_RADIUS = 112;
/**
 * Distance from the viewer to the axis. Smaller than a few radii would distort
 * badly; this gives roughly a 25% size difference between front and back.
 */
export const HELIX_CAMERA = 480;
/** Vertical distance between two rungs. */
export const HELIX_ROW_HEIGHT = 32;
/** Extra space inserted where the category changes. */
export const HELIX_CATEGORY_GAP = 20;
/** Radians of twist per rung; ~0.62 gives a full turn every ten rungs. */
export const HELIX_PHASE_STEP = 0.62;
export const HELIX_PADDING_Y = 40;
/**
 * Labels start here, measured from the left edge. They sit just right of the
 * widest part of the helix so the text never floats away from its node.
 */
export const HELIX_LABEL_X = 356;
export const HELIX_LABEL_MAX_CHARS = 34;
/** Curve samples drawn between two rungs. */
const SEGMENT_SAMPLES = 10;

/** A projected point. `depth` is -1 (far) .. 1 (near). */
export type HelixPoint = { x: number; y: number; depth: number };

/** One drawn piece of a strand, with the depth used for painter's order. */
export type HelixSegment = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  depth: number;
};

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
  /** Screen position of the near end of the rung: the clickable node. */
  x: number;
  y: number;
  /** Depth of that near end, -1..1. Drives size and opacity. */
  depth: number;
  /** Both ends of the rung, already projected. */
  rung: { x1: number; y1: number; x2: number; y2: number };
  /** The far end, drawn as a dimmer dot behind the helix. */
  back: { x: number; y: number };
};

export type HelixScene = {
  width: number;
  height: number;
  nodes: HelixNode[];
  /** Both strands merged and sorted far-to-near. */
  segments: HelixSegment[];
};

/** Shortens label text for the SVG so one long trait cannot run off the card. */
export function truncate(text: string, max: number): string {
  if (max <= 0) return "";
  if (text.length <= max) return text;
  if (max <= 1) return text.slice(0, max);
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Perspective projection of one point on the cylinder. `y` is untouched: rows
 * keep their vertical slot, which is what keeps the label column readable and
 * the height stable while the helix spins. The depth cue comes from the
 * horizontal scale plus the shading the renderer derives from `depth`.
 */
function project(phase: number, y: number): HelixPoint {
  const x = HELIX_RADIUS * Math.sin(phase);
  const z = HELIX_RADIUS * Math.cos(phase);
  const scale = HELIX_CAMERA / (HELIX_CAMERA - z);
  return { x: HELIX_CENTER_X + x * scale, y, depth: z / HELIX_RADIUS };
}

/**
 * Builds the scene. `gaps` holds indices that start a new category (see
 * categoryGapIndices) so the groups separate instead of running together.
 */
export function buildHelixScene(
  traits: HelixTraitInput[],
  rotation = 0,
  gaps: number[] = []
): HelixScene {
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
  const height = traits.length === 0 ? HELIX_PADDING_Y * 2 : lastRow + HELIX_PADDING_Y;

  const nodes: HelixNode[] = traits.map((trait, index) => {
    const phase = index * HELIX_PHASE_STEP + rotation;
    const rowY = rows[index] ?? HELIX_PADDING_Y;
    const a = project(phase, rowY);
    const b = project(phase + Math.PI, rowY);
    // The node rides whichever end is closer to the viewer.
    const front = a.depth >= b.depth ? a : b;
    const back = front === a ? b : a;
    return {
      key: trait.key,
      category: trait.category,
      label: trait.label,
      display: trait.display,
      confidence: trait.confidence,
      verdict: trait.verdict ?? null,
      direction: trait.direction ?? null,
      x: front.x,
      y: front.y,
      depth: front.depth,
      rung: { x1: a.x, y1: a.y, x2: b.x, y2: b.y },
      back: { x: back.x, y: back.y },
    };
  });

  const segments: HelixSegment[] = [];
  for (const offset of [0, Math.PI]) {
    const points = sampleStrand(rows, rotation, offset);
    for (let index = 1; index < points.length; index += 1) {
      const prev = points[index - 1];
      const current = points[index];
      segments.push({
        x1: prev.x,
        y1: prev.y,
        x2: current.x,
        y2: current.y,
        depth: (prev.depth + current.depth) / 2,
      });
    }
  }
  // Painter's algorithm: far pieces first, so the near strand sits on top.
  segments.sort((left, right) => left.depth - right.depth);

  return { width: HELIX_WIDTH, height, nodes, segments };
}

/**
 * Samples one strand between rungs so the curve bends instead of drawing a
 * zigzag between nodes.
 */
function sampleStrand(rows: number[], rotation: number, offset: number): HelixPoint[] {
  if (rows.length === 0) return [];
  const points: HelixPoint[] = [];

  // A single rung still deserves a visible ring instead of an empty strand.
  if (rows.length === 1) {
    for (let step = 0; step <= 24; step += 1) {
      points.push(project(offset + (step / 24) * Math.PI * 2, rows[0]));
    }
    return points;
  }

  let globalRow = 0;

  for (let index = 0; index < rows.length - 1; index += 1) {
    const startY = rows[index];
    const endY = rows[index + 1];
    for (let step = 0; step < SEGMENT_SAMPLES; step += 1) {
      const t = step / SEGMENT_SAMPLES;
      const phase = (globalRow + t) * HELIX_PHASE_STEP + rotation + offset;
      points.push(project(phase, startY + (endY - startY) * t));
    }
    globalRow += 1;
  }

  const tailPhase = globalRow * HELIX_PHASE_STEP + rotation + offset;
  points.push(project(tailPhase, rows[rows.length - 1]));
  return points;
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

/** Bead size in SVG units: 6 when far, 10 when close. */
export function nodeRadius(depth: number): number {
  return 6 + 4 * ((depth + 1) / 2);
}

/**
 * Strand width in SVG units. Proportioned to the reference artwork: the tube is
 * over half a row tall, and the near side is noticeably fatter.
 */
export function strandWidth(depth: number): number {
  return 8 + 5 * ((depth + 1) / 2);
}

/**
 * Rough advance width of a label string in SVG units. Only used to size the
 * label pill, so an approximation beats measuring text that does not exist yet.
 */
export function estimateTextWidth(text: string, fontSize: number, bold = false): number {
  return text.length * fontSize * (bold ? 0.6 : 0.54);
}

/** Dot + gap + right padding inside a label pill. */
const PILL_CHROME = 34;
const PILL_GAP = 6;

/**
 * Fits "label value" into the label column. The value gives way first — a
 * truncated label ("Signature in…") reads worse than a shortened number.
 */
export function fitHelixLabel(
  label: string,
  display: string,
  maxWidth: number
): { label: string; display: string; width: number } {
  const fits = (candidateLabel: string, candidateDisplay: string) =>
    PILL_CHROME +
    estimateTextWidth(candidateLabel, 11.5, true) +
    PILL_GAP +
    estimateTextWidth(candidateDisplay, 11);

  let nextDisplay = display;
  let guard = display.length;
  while (nextDisplay.length > 0 && fits(label, nextDisplay) > maxWidth && guard > 0) {
    nextDisplay = truncate(nextDisplay, nextDisplay.length - 1);
    guard -= 1;
  }

  let nextLabel = label;
  guard = label.length;
  while (nextLabel.length > 0 && fits(nextLabel, nextDisplay) > maxWidth && guard > 0) {
    nextLabel = truncate(nextLabel, nextLabel.length - 1);
    guard -= 1;
  }

  return { label: nextLabel, display: nextDisplay, width: Math.ceil(fits(nextLabel, nextDisplay)) };
}
