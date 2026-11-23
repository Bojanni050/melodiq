/**
 * The three writing-style spectra of the reference DNA screen, read from the
 * lyrics themselves: colloquial↔literary, literal↔imagery and serious↔playful.
 *
 * Same conventions as the prompt spectra in `dna/spectra.ts`: every score is a
 * position on a 0..100 line (0 = the left pole, 100 = the right pole), a term
 * counts once per song, and a match is consumed so a phrase cannot also fire on
 * one of its words. A song that names neither pole abstains instead of voting 50.
 *
 * Two deliberate differences from the prompt version, both because this reads a
 * whole lyric instead of a short style prompt:
 * - distinct terms, not occurrences: a chorus repeating "baby" twelve times says
 *   nothing extra about how colloquial the writing is;
 * - at least `MIN_LYRIC_SPECTRUM_HITS` matched terms before a track takes a
 *   position at all, because one word would otherwise read as a confident 100%.
 *
 * This is a lexicon, not a parser. It says which pole the vocabulary leans to,
 * never whether a line is good, and every value stays traceable to words the
 * user actually wrote.
 */

export type LyricSpectrumKey = "colloquial_literary" | "literal_imagery" | "serious_playful";

export type LyricSpectrumDefinition = {
  key: LyricSpectrumKey;
  /** 0 = left, 100 = right. */
  left: string;
  right: string;
  leftTerms: string[];
  rightTerms: string[];
};

export const LYRIC_SPECTRA: LyricSpectrumDefinition[] = [
  {
    key: "colloquial_literary",
    left: "colloquial",
    right: "literary",
    leftTerms: [
      // English
      "gonna",
      "wanna",
      "gotta",
      "ain't",
      "kinda",
      "sorta",
      "dunno",
      "lemme",
      "gimme",
      "yeah",
      "yep",
      "nah",
      "bro",
      "homie",
      "shawty",
      "lol",
      "omg",
      "tbh",
      "whoa",
      "huh",
      "meh",
      "cuz",
      "coz",
      "yo",
      // Dutch
      "effe",
      "ff",
      "gewoon",
      "joh",
      "nou",
      "gast",
      "toch",
      "weet je",
      "snap je",
      "zeg maar",
    ],
    rightTerms: [
      // English
      "metaphor",
      "silhouette",
      "melancholy",
      "ethereal",
      "ephemeral",
      "infinite",
      "cathedral",
      "symphony",
      "requiem",
      "labyrinth",
      "velvet",
      "porcelain",
      "azure",
      "crimson",
      "scarlet",
      "twilight",
      "whispers",
      "echoes",
      "ghosts",
      "constellations",
      "horizon",
      "oblivion",
      "serenade",
      "elegy",
      "parchment",
      "tapestry",
      "reverie",
      "sublime",
      "upon",
      "amid",
      "thou",
      "thee",
      "hath",
      // Dutch
      "melancholie",
      "weemoed",
      "oneindig",
      "kathedraal",
      "symfonie",
      "requiem",
      "doolhof",
      "fluweel",
      "porselein",
      "azuur",
      "karmozijn",
      "scharlaken",
      "schemering",
      "dageraad",
      "sterrenstof",
      "verheven",
      "subliem",
    ],
  },
  {
    key: "literal_imagery",
    left: "literal",
    right: "imagery",
    leftTerms: [
      // English: plain, prose-like vocabulary — appointments, dates, invoices.
      "said",
      "told",
      "asked",
      "because",
      "actually",
      "fact",
      "truth",
      "reason",
      "probably",
      "exactly",
      "problem",
      "answer",
      "question",
      "appointment",
      "schedule",
      "deadline",
      "invoice",
      "rent",
      "bills",
      "receipt",
      "minutes",
      "hours",
      "weeks",
      "months",
      "years",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
      "o clock",
      "texted",
      "emailed",
      "called",
      "office",
      // Dutch
      "zei",
      "zeiden",
      "gezegd",
      "gevraagd",
      "omdat",
      "eigenlijk",
      "feit",
      "waarheid",
      "reden",
      "precies",
      "probleem",
      "antwoord",
      "vraag",
      "afspraak",
      "agenda",
      "deadline",
      "rekening",
      "huur",
      "minuten",
      "uren",
      "weken",
      "maanden",
      "jaren",
      "maandag",
      "dinsdag",
      "woensdag",
      "donderdag",
      "vrijdag",
      "zaterdag",
      "zondag",
      "belde",
      "gebeld",
      "kantoor",
    ],
    rightTerms: [
      // English: sensory and natural images.
      "sky",
      "skies",
      "ocean",
      "sea",
      "river",
      "rain",
      "storm",
      "thunder",
      "lightning",
      "fire",
      "flames",
      "embers",
      "light",
      "shadow",
      "shadows",
      "moonlight",
      "starlight",
      "stars",
      "sun",
      "sunrise",
      "sunset",
      "clouds",
      "wind",
      "wings",
      "roots",
      "blood",
      "bones",
      "skin",
      "breath",
      "smoke",
      "dust",
      "gold",
      "silver",
      "crystal",
      "glass",
      "mirror",
      "roses",
      "garden",
      "forest",
      "desert",
      "mountain",
      "valley",
      // Dutch
      "lucht",
      "oceaan",
      "zee",
      "rivier",
      "regen",
      "storm",
      "donder",
      "bliksem",
      "vuur",
      "vlam",
      "vlammen",
      "sintels",
      "licht",
      "schaduw",
      "schaduwen",
      "maanlicht",
      "sterren",
      "sterrenlicht",
      "zon",
      "zonsopgang",
      "zonsondergang",
      "wolken",
      "wind",
      "vleugels",
      "wortels",
      "bloed",
      "botten",
      "huid",
      "adem",
      "rook",
      "stof",
      "goud",
      "zilver",
      "kristal",
      "glas",
      "spiegel",
      "rozen",
      "tuin",
      "bos",
      "woestijn",
      "berg",
      "vallei",
    ],
  },
  {
    key: "serious_playful",
    left: "serious",
    right: "playful",
    leftTerms: [
      // English
      "death",
      "died",
      "dying",
      "dead",
      "grave",
      "funeral",
      "grief",
      "crying",
      "tears",
      "pain",
      "hurt",
      "broken",
      "alone",
      "lonely",
      "fear",
      "afraid",
      "war",
      "fight",
      "lose",
      "lost",
      "sorry",
      "goodbye",
      "farewell",
      "empty",
      "hollow",
      "scars",
      "wounds",
      // Dutch
      "dood",
      "sterven",
      "gestorven",
      "graf",
      "begrafenis",
      "verdriet",
      "huilen",
      "tranen",
      "pijn",
      "gebroken",
      "alleen",
      "eenzaam",
      "angst",
      "bang",
      "oorlog",
      "vechten",
      "verliezen",
      "verloren",
      "afscheid",
      "leeg",
      "hol",
      "littekens",
      "wond",
    ],
    rightTerms: [
      // English
      "dance",
      "dancing",
      "party",
      "fun",
      "laugh",
      "laughing",
      "smile",
      "smiling",
      "joke",
      "silly",
      "wild",
      "bounce",
      "spin",
      "clap",
      "shout",
      "celebrate",
      "champagne",
      "groove",
      "shake",
      "sunshine",
      "candy",
      "bubblegum",
      "haha",
      "lalala",
      "playful",
      "cheeky",
      "mischief",
      "tickle",
      // Dutch
      "dansen",
      "feest",
      "plezier",
      "lachen",
      "grap",
      "gek",
      "dol",
      "springen",
      "klappen",
      "schreeuwen",
      "vieren",
      "swingen",
      "shaken",
      "zonneschijn",
      "snoep",
      "kauwgom",
      "speels",
      "plagen",
      "kietelen",
    ],
  },
];

/** Below this many matched terms a song abstains: one word is not a position. */
export const MIN_LYRIC_SPECTRUM_HITS = 2;

/**
 * Accent-insensitive, so "corazón" and "corazon" match; padded so terms only
 * match whole words. Local instead of reusing `dna/text-terms.ts` because that
 * one collapses accented characters into spaces.
 */
function normalise(text: string): string {
  const stripped = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return ` ${stripped} `;
}

/** Longest first, so "weet je" is not also counted as "je"-style noise later. */
function termsByLength(terms: string[]): string[] {
  return [...terms]
    .map((term) => normalise(term).trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map((term) => ` ${term} `);
}

/** Consumes every occurrence of `term` so its words cannot match again. */
function consume(haystack: string, term: string): string {
  return haystack.split(term).join(" ".repeat(term.length));
}

const PREPARED = LYRIC_SPECTRA.map((definition) => ({
  definition,
  left: termsByLength(definition.leftTerms),
  right: termsByLength(definition.rightTerms),
}));

/** One song's position per spectrum; absent axes had too little evidence. */
export function lyricSpectrumScores(
  lyrics: string | null | undefined,
): Partial<Record<LyricSpectrumKey, number>> {
  if (!lyrics || !lyrics.trim()) return {};

  const text = normalise(lyrics);
  const scores: Partial<Record<LyricSpectrumKey, number>> = {};

  for (const entry of PREPARED) {
    // Each axis gets its own copy: "fire" consumed by imagery must still be
    // visible to the serious↔playful lexicon.
    let haystack = text;
    let leftHits = 0;
    let rightHits = 0;

    for (const term of entry.left) {
      if (!haystack.includes(term)) continue;
      leftHits += 1;
      haystack = consume(haystack, term);
    }
    for (const term of entry.right) {
      if (!haystack.includes(term)) continue;
      rightHits += 1;
      haystack = consume(haystack, term);
    }

    const total = leftHits + rightHits;
    if (total < MIN_LYRIC_SPECTRUM_HITS) continue;
    scores[entry.definition.key] = Math.round((rightHits / total) * 100);
  }

  return scores;
}
