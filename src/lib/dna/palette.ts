// One colour per DNA category, as hex: the SVG helix and the share card cannot
// use Tailwind classes, and they must match the five dots used in the UI.
export const DNA_CATEGORY_COLORS: Record<string, string> = {
  sound: "#67c7e8",
  voice: "#b39af5",
  structure: "#f0c069",
  words: "#6fd4a5",
  taste: "#f18bb6",
};

export const DNA_FALLBACK_COLOR = "#9fb4ac";

export function dnaCategoryColor(category: string): string {
  return DNA_CATEGORY_COLORS[category] ?? DNA_FALLBACK_COLOR;
}

/** Order the card and helix read categories in, matching DNA_CATEGORIES. */
export const DNA_CATEGORY_ORDER = ["sound", "voice", "structure", "words", "taste"];
