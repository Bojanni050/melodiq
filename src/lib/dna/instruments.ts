/**
 * "Signature instruments" as a DNA trait, read from the style prompts.
 *
 * Track DNA stores atmosphere tags (mood) and an LLM critique, but no
 * instrument list — asking the model again for every track would cost money
 * and still not cover the tracks analysed before the trait existed. The
 * prompt, however, is stored for every track and is where the user names
 * their palette ("upright piano, brushed drums, warm strings"), so a lexicon
 * is both cheap and explainable: every value traces back to words the user
 * typed.
 *
 * Matching happens against one haystack, longest term first, and a matched
 * span is consumed — "electric guitar" therefore never also counts as
 * "guitar", and "acoustic guitar" never lands under the electric entry.
 */

import { consume, normalise, termsByLength } from "./text-terms";

interface InstrumentDefinition {
  /** Display name; also the stored value the trait groups on. */
  name: string;
  terms: string[];
}

const INSTRUMENTS: InstrumentDefinition[] = [
  {
    name: "Piano",
    terms: [
      "piano",
      "pianos",
      "grand piano",
      "upright piano",
      "vleugel",
      "staande piano",
      "rhodes",
      "wurlitzer",
      "keys",
      "keyboards",
      "keyboard",
      "toetsen",
    ],
  },
  {
    name: "Acoustic guitar",
    terms: [
      "acoustic guitar",
      "akoestische gitaar",
      "classical guitar",
      "nylon guitar",
      "spanish guitar",
      "fingerpicked guitar",
      "guitar",
      "guitars",
      "gitaar",
      "gitaren",
    ],
  },
  {
    name: "Electric guitar",
    terms: [
      "electric guitar",
      "elektrische gitaar",
      "distorted guitar",
      "lead guitar",
      "guitar solo",
      "riffing guitar",
      "power chords",
    ],
  },
  {
    name: "Bass",
    terms: [
      "bass",
      "basses",
      "bass guitar",
      "basgitaar",
      "bassline",
      "basslines",
      "sub bass",
      "upright bass",
      "double bass",
      "contrabas",
      "staande bas",
    ],
  },
  {
    name: "Drums",
    terms: [
      "drums",
      "drum kit",
      "drumkit",
      "live drums",
      "brushed drums",
      "drum break",
      "percussion",
      "percussie",
      "tambourine",
      "shaker",
      "handclaps",
      "hand claps",
    ],
  },
  {
    name: "808",
    terms: ["808", "808s", "trap drums", "sub 808"],
  },
  {
    name: "Synth",
    terms: [
      "synth",
      "synths",
      "synthesizer",
      "synthesizers",
      "analog synth",
      "analogue synth",
      "synth pad",
      "synth lead",
      "supersaw",
      "saw lead",
      "arpeggio",
      "arpeggios",
      "arpeggiator",
      "arp",
    ],
  },
  {
    name: "Strings",
    terms: [
      "strings",
      "string section",
      "orchestral strings",
      "strijkers",
      "violin",
      "violins",
      "viool",
      "cello",
      "cellos",
      "viola",
      "altviool",
    ],
  },
  {
    name: "Brass",
    terms: [
      "brass",
      "horns",
      "horn section",
      "trumpet",
      "trumpets",
      "trompet",
      "saxophone",
      "saxofoon",
      "sax",
      "trombone",
      "tuba",
      "blazers",
    ],
  },
  {
    name: "Flute",
    terms: ["flute", "flutes", "fluit", "pan flute", "panfluit", "tin whistle"],
  },
  {
    name: "Organ",
    terms: ["organ", "orgel", "hammond", "church organ", "pipe organ"],
  },
  {
    name: "Harp",
    terms: ["harp", "harps"],
  },
  {
    name: "Folk strings",
    terms: ["banjo", "mandolin", "mandoline", "ukulele", "ukelele", "lap steel", "pedal steel", "dobro"],
  },
  {
    name: "Harmonica",
    terms: ["harmonica", "mondharmonica", "blues harp"],
  },
  {
    name: "Choir",
    terms: ["choir", "choirs", "koor", "gospel choir", "choir vocals"],
  },
];

// One flat list so a long term always wins over any of its words, regardless
// of which instrument it belongs to.
const PREPARED = INSTRUMENTS.flatMap((instrument) =>
  termsByLength(instrument.terms).map((term) => ({ name: instrument.name, term })),
).sort((a, b) => b.term.length - a.term.length);

const INSTRUMENT_NAMES = new Map(INSTRUMENTS.map((instrument) => [instrument.name.toLowerCase(), instrument.name]));

export function detectInstruments(prompt: string | null | undefined): string[] {
  if (!prompt || !prompt.trim()) return [];

  let haystack = normalise(prompt);
  const found: { name: string; at: number }[] = [];

  for (const { name, term } of PREPARED) {
    const at = haystack.indexOf(term);
    if (at === -1) continue;
    haystack = consume(haystack, term);
    if (!found.some((hit) => hit.name === name)) found.push({ name, at });
  }

  // Report in the order the user named them, not in term-length order — the
  // consumption order is an implementation detail, the reading order is not.
  return found.sort((a, b) => a.at - b.at).map((hit) => hit.name);
}

/** Restores the display casing after the trait layer lowercases values. */
export function instrumentDisplay(value: string): string {
  return INSTRUMENT_NAMES.get(value.toLowerCase()) ?? value;
}
