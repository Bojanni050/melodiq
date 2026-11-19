/**
 * Turns the raw per-bucket energy arc (see audio-features.ts) into the one
 * thing the DNA page can show as a trait: the dominant shape of the song.
 *
 * The three shapes are deliberately coarse. A finer vocabulary ("double
 * chorus lift", "post-bridge drop") would need real section detection, and the
 * arc only has twelve RMS buckets to work with.
 */
export type EnergyArcShape = "builds" | "starts strong" | "steady";

// Difference (in 0-100 energy) between the first and second half that counts
// as a real move rather than mix-level noise.
const HALF_SHIFT = 12;
// How far the peak has to rise above the track's own average to count as a
// peak rather than a flat arc with a small ripple.
const PEAK_MARGIN = 6;

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function classifyEnergyArc(arc: number[] | null | undefined): EnergyArcShape | null {
  if (!arc) return null;
  const values = arc.filter((value) => Number.isFinite(value));
  if (values.length < 4) return null;

  const half = Math.floor(values.length / 2);
  const first = average(values.slice(0, half));
  const second = average(values.slice(half));

  if (second - first >= HALF_SHIFT) return "builds";
  if (first - second >= HALF_SHIFT) return "starts strong";

  // Flat on average, but one clear peak still says where the song lands. The
  // margin keeps a 1-point ripple in a steady mix from being read as a peak.
  const peak = Math.max(...values);
  if (peak - average(values) < PEAK_MARGIN) return "steady";
  const position = values.indexOf(peak) / (values.length - 1);
  if (position >= 0.75) return "builds";
  if (position <= 0.25) return "starts strong";
  return "steady";
}
