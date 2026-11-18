/**
 * Throwaway probe: run the writing-DNA extractor over real catalogue lyrics and
 * report coverage. Not part of the app; delete after the phase-1 check.
 *
 *   npx tsx scripts/style-dna-probe.ts /path/to/sample.json
 */
import { readFileSync } from "node:fs";
import { buildWritingDna } from "../src/lib/style-dna/aggregate";
import { extractWritingFeatures } from "../src/lib/style-dna/features";

type Row = { id: string; language: string | null; lyrics: string | null };

const rows: Row[] = JSON.parse(readFileSync(process.argv[2] ?? "", "utf8"));
const features = rows
  .map((row) => ({ row, feature: extractWritingFeatures({ lyrics: row.lyrics, language: row.language }) }))
  .filter((entry) => entry.feature !== null);

const byLanguage = new Map<string, number>();
for (const { feature } of features) {
  const key = feature!.language;
  byLanguage.set(key, (byLanguage.get(key) ?? 0) + 1);
}

const avg = (values: Array<number | null>): number | null => {
  const numbers = values.filter((value): value is number => value !== null);
  if (numbers.length === 0) return null;
  return Math.round((numbers.reduce((a, b) => a + b, 0) / numbers.length) * 1000) / 1000;
};

const schemes = new Map<string, number>();
for (const { feature } of features) {
  if (!feature!.rhymeScheme) continue;
  schemes.set(feature!.rhymeScheme, (schemes.get(feature!.rhymeScheme) ?? 0) + 1);
}

const themeCounts = new Map<string, number>();
for (const { feature } of features) {
  for (const theme of feature!.themes) themeCounts.set(theme, (themeCounts.get(theme) ?? 0) + 1);
}

const wordTracks = new Map<string, number>();
for (const { feature } of features) {
  for (const word of feature!.contentWords) wordTracks.set(word, (wordTracks.get(word) ?? 0) + 1);
}

const top = (map: Map<string, number>, limit: number) =>
  [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);

console.log(`rijen: ${rows.length} | features: ${features.length} (${Math.round((features.length / rows.length) * 100)}%)`);
console.log(`talen:`, top(byLanguage, 15));
console.log(`gem. rijmdichtheid: ${avg(features.map((f) => f.feature!.rhymeDensity))} | interne rijm: ${avg(features.map((f) => f.feature!.internalRhyme))} | multisyllabisch: ${avg(features.map((f) => f.feature!.multisyllabicRhyme))}`);
console.log(`gem. lettergrepen/regel: ${avg(features.map((f) => f.feature!.avgSyllables))} | spreiding: ${avg(features.map((f) => f.feature!.syllableSpread))}`);
console.log(`POV:`, top(
  features.reduce((acc, f) => acc.set(f.feature!.pov ?? "null", (acc.get(f.feature!.pov ?? "null") ?? 0) + 1), new Map<string, number>()),
  4,
));
console.log(`tense:`, top(
  features.reduce((acc, f) => acc.set(f.feature!.tense ?? "null", (acc.get(f.feature!.tense ?? "null") ?? 0) + 1), new Map<string, number>()),
  4,
));
console.log(`top rijmschema's:`, top(schemes, 8));
console.log(`top thema's:`, top(themeCounts, 10));
console.log(`signature words (documentfrequentie):`, top(wordTracks, 15));
const explicit = features.filter((f) => (f.feature!.explicitness ?? 0) > 0).length;
console.log(`tracks met expliciete taal: ${explicit}`);

// Dezelfde steekproef door de aggregator: laat zien welke traits eruit komen,
// per taal, met de confidence die de UI als zekerheid toont.
const dna = buildWritingDna(features.map((entry) => ({ features: entry.feature!, weight: 1 })));
console.log(`\n=== overall (${dna.overall.length} traits) ===`);
for (const trait of dna.overall) {
  console.log(`  ${trait.key.padEnd(22)} conf ${trait.confidence.toFixed(2)} src ${String(trait.sourceCount).padStart(4)}  ${trait.display}`);
}
console.log(`\n=== per taal ===`);
for (const entry of dna.byLanguage) {
  console.log(`  ${entry.language} (${entry.sourceCount} tracks, ${entry.traits.length} traits)`);
  for (const trait of entry.traits.slice(0, 4)) {
    console.log(`    ${trait.key.padEnd(26)} conf ${trait.confidence.toFixed(2)}  ${trait.display}`);
  }
}
