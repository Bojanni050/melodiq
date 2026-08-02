// APIMart's remaster endpoint takes a fixed intensity, not an open-ended
// type like stems — keep in sync with the UI picker in TrackDetail.tsx.
export const MASTER_VARIATIONS = [
  { value: "subtle", label: "Subtle" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
] as const;

export type MasterVariation = (typeof MASTER_VARIATIONS)[number]["value"];

export function isValidMasterVariation(value: unknown): value is MasterVariation {
  return typeof value === "string" && MASTER_VARIATIONS.some((m) => m.value === value);
}

export function masterVariationLabel(value: string): string {
  return MASTER_VARIATIONS.find((m) => m.value === value)?.label ?? value;
}

const SUPPORTED_REMASTER_VERSIONS = new Set(["v4.5+", "v5", "v5.5"]);

// The remaster endpoint only supports these three versions; fall back to the
// newest one for tracks generated on an unsupported/older version string.
export function remasterVersionFor(providerModel: string | null | undefined): string {
  return providerModel && SUPPORTED_REMASTER_VERSIONS.has(providerModel) ? providerModel : "v5.5";
}
