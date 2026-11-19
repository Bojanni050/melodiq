/**
 * Shared text matching for the lexicon-based DNA traits (spectra, instruments).
 *
 * Both read the user's own style prompt, which is free text in whatever
 * language they type, so matching has to be case-, accent- and
 * punctuation-insensitive and must not let "acoustic guitar" also count as
 * "guitar".
 */

/** Lowercased, punctuation collapsed; padded so terms match whole words. */
export function normalise(text: string): string {
  return ` ${text.toLowerCase().replace(/[^a-z0-9&]+/g, " ").trim()} `;
}

/** Longest first, so "acoustic guitar" is not also counted as "guitar". */
export function termsByLength(terms: string[]): string[] {
  return [...terms]
    .map((term) => normalise(term).trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map((term) => ` ${term} `);
}

/** Consumes every occurrence of `term` so its words cannot match again. */
export function consume(haystack: string, term: string): string {
  return haystack.split(term).join(" ".repeat(term.length));
}
