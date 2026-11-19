/**
 * The four style spectra of the reference DNA screen, read from the prompt you
 * generated with.
 *
 * Deliberately heuristic and additive to the existing traits: tempo and energy
 * say how a track moves, these say what it is made of. Every score is a
 * position on a 0..100 line (0 = the left pole, 100 = the right pole) and is
 * only produced when the prompt actually names one of the poles — a prompt
 * without evidence makes the whole track abstain instead of voting 50, so a
 * sparse catalogue cannot fake a balanced profile.
 *
 * Audio-side hints (energy for intimate↔open, transient density for
 * minimal↔dense) are not used yet: they would need segment analysis that
 * `audioDna` does not store. Prompt evidence keeps the trait explainable —
 * every value can be traced back to words the user typed.
 */

export type SpectrumKey =
  | "rap_melodic"
  | "intimate_open"
  | "minimal_dense"
  | "electronic_organic";

export type SpectrumDefinition = {
  key: SpectrumKey;
  /** 0 = left, 100 = right. */
  left: string;
  right: string;
  leftTerms: string[];
  rightTerms: string[];
};

export const SPECTRA: SpectrumDefinition[] = [
  {
    key: "rap_melodic",
    left: "rap",
    right: "melodic",
    leftTerms: [
      "rap",
      "rapped",
      "rapping",
      "hip hop",
      "hip-hop",
      "trap",
      "drill",
      "grime",
      "boom bap",
      "freestyle",
      "spoken word",
    ],
    rightTerms: [
      "melodic",
      "melody",
      "sung",
      "singing",
      "croon",
      "crooning",
      "soulful",
      "r&b",
      "neo soul",
      "belted",
      "pop vocals",
    ],
  },
  {
    key: "intimate_open",
    left: "intimate",
    right: "open",
    leftTerms: [
      "intimate",
      "intiem",
      "whisper",
      "whispered",
      "hushed",
      "close-mic",
      "close mic",
      "bedroom",
      "lo-fi",
      "lofi",
      "fragile",
      "understated",
      "bare",
    ],
    rightTerms: [
      "anthemic",
      "stadium",
      "arena",
      "cinematic",
      "epic",
      "episch",
      "widescreen",
      "weids",
      "soaring",
      "festival",
      "huge",
      "wall of sound",
    ],
  },
  {
    key: "minimal_dense",
    left: "minimal",
    right: "dense",
    leftTerms: [
      "minimal",
      "minimalist",
      "minimalistisch",
      "sparse",
      "stripped",
      "stripped-back",
      "uncluttered",
      "just piano",
      "solo piano",
      "solo guitar",
      "fingerpicked",
    ],
    rightTerms: [
      "dense",
      "layered",
      "gelaagd",
      "layers",
      "lush",
      "maximal",
      "orchestral",
      "full band",
      "stacked harmonies",
      "busy",
      "wall of sound",
    ],
  },
  {
    key: "electronic_organic",
    left: "electronic",
    right: "organic",
    leftTerms: [
      "electronic",
      "elektronisch",
      "synth",
      "synths",
      "synthwave",
      "edm",
      "techno",
      "house",
      "808",
      "drum machine",
      "glitch",
      "industrial",
    ],
    rightTerms: [
      "organic",
      "acoustic",
      "akoestisch",
      "live drums",
      "upright bass",
      "piano",
      "guitar",
      "gitaar",
      "folk",
      "brushed drums",
      "handclaps",
      "strings",
      "cello",
      "violin",
    ],
  },
];

/** Lowercased, punctuation collapsed; padded so terms match whole words. */
function normalise(text: string): string {
  return ` ${text.toLowerCase().replace(/[^a-z0-9&]+/g, " ").trim()} `;
}

/** Longest first, so "acoustic guitar" is not also counted as "guitar". */
function termsByLength(terms: string[]): string[] {
  return [...terms]
    .map((term) => normalise(term).trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map((term) => ` ${term} `);
}

const PREPARED = SPECTRA.map((definition) => ({
  definition,
  left: termsByLength(definition.leftTerms),
  right: termsByLength(definition.rightTerms),
}));

/**
 * One track's position per spectrum. A term is counted once, and the matched
 * span is consumed so a phrase cannot also fire on one of its words.
 */
export function spectrumScores(prompt: string | null): Partial<Record<SpectrumKey, number>> {
  if (!prompt || !prompt.trim()) return {};

  const text = normalise(prompt);
  const scores: Partial<Record<SpectrumKey, number>> = {};

  for (const entry of PREPARED) {
    // Each spectrum gets its own copy: a word consumed by one spectrum (say
    // "piano") must still be visible to the next.
    let haystack = text;
    let leftHits = 0;
    let rightHits = 0;

    for (const term of entry.left) {
      if (!haystack.includes(term)) continue;
      leftHits += 1;
      haystack = haystack.split(term).join(" ".repeat(term.length));
    }
    for (const term of entry.right) {
      if (!haystack.includes(term)) continue;
      rightHits += 1;
      haystack = haystack.split(term).join(" ".repeat(term.length));
    }

    const total = leftHits + rightHits;
    if (total === 0) continue;
    scores[entry.definition.key] = Math.round((rightHits / total) * 100);
  }

  return scores;
}
