// APIMart's stems endpoint supports 100+ stem_type values; this is a curated
// subset covering the stems people actually ask for. Keep in sync with the
// UI picker in TrackDetail.tsx.
export const STEM_TYPES = [
  { value: "lead_vocal", label: "Lead vocals" },
  { value: "backing_vocals", label: "Backing vocals" },
  { value: "drum_kit", label: "Drums" },
  { value: "bass", label: "Bass" },
  { value: "piano", label: "Piano" },
  { value: "electric_guitar", label: "Electric guitar" },
] as const;

export type StemType = (typeof STEM_TYPES)[number]["value"];

export function isValidStemType(value: unknown): value is StemType {
  return typeof value === "string" && STEM_TYPES.some((s) => s.value === value);
}

export function stemTypeLabel(value: string): string {
  return STEM_TYPES.find((s) => s.value === value)?.label ?? value;
}
