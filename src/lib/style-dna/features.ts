import { lyricSpectrumScores } from "@/lib/dna/lyric-spectra";
import type {
  LyricSection,
  WritingFeatureInput,
  WritingFeatures,
  WritingLanguage,
  WritingPov,
  WritingTense,
} from "@/lib/style-dna/types";

/**
 * A section of three lines is the shortest thing that can carry a scheme, and
 * four content words is the shortest that can say anything about vocabulary.
 * Below that we return null instead of a confident-looking guess.
 */
export const MIN_LINES = 2;
export const MIN_CONTENT_WORDS = 4;

/** Distinct content words kept per track; bounds the aggregation input. */
export const MAX_CONTENT_WORDS = 60;

const VOWELS = "aeiouy";

const LANGUAGE_ALIASES: Record<string, WritingLanguage> = {
  en: "en",
  eng: "en",
  english: "en",
  nl: "nl",
  dut: "nl",
  dutch: "nl",
  nederlands: "nl",
  es: "es",
  spa: "es",
  spanish: "es",
  espanol: "es",
  español: "es",
  pt: "pt",
  por: "pt",
  portuguese: "pt",
  portugues: "pt",
  português: "pt",
  fr: "fr",
  fre: "fr",
  french: "fr",
  francais: "fr",
  français: "fr",
  de: "de",
  ger: "de",
  german: "de",
  deutsch: "de",
  it: "it",
  ita: "it",
  italian: "it",
  italiano: "it",
};

/** Vowel-spelling → sound class, so "go"/"show" and "light"/"night" compare equal. */
const VOWEL_CLASSES: Record<WritingLanguage, Record<string, string>> = {
  en: { ai: "ai", ay: "ai", ea: "i", ee: "i", ie: "i", oa: "o", oe: "o", oo: "u", ou: "u", ow: "o", ue: "u", ui: "u", ew: "u", y: "i" },
  nl: { aa: "a", ee: "e", ie: "i", ij: "ij", ei: "ij", oo: "o", uu: "u", ou: "ou", au: "ou", eu: "eu", ui: "ui", oe: "u", ai: "ai", oei: "ui" },
  es: {},
  pt: { ao: "on", ae: "en", ão: "on", õe: "on" },
  fr: {},
  de: { ei: "ai", ai: "ai", ie: "i", eu: "oi", äu: "oi", au: "au" },
  it: {},
  xx: {},
};

/** Words that would otherwise dominate `signature_words`. */
const STOP_WORDS: Partial<Record<WritingLanguage, Set<string>>> = {
  en: new Set("the a an and or but if then than so that this these those it its is are was were be been am being do does did done have has had having i me my mine you your yours we our ours us he she it they them him her his their theirs of in on at to for with from by as not no nor too very can could will would shall should may might must just about into over out up down like".split(" ")),
  nl: new Set("de het een en of maar als dan dat die deze dit er is zijn was waren wees ben bent wordt worden heb hebt heeft hebben had hadden ik mij mijn me je jou jouw jij u uw we wij ons onze hij zij ze hem haar hun van in op aan te voor met bij uit over naar niet geen wel ook nog al zo om door omhoog omlaag".split(" ")),
  es: new Set("el la los las un una unos unas y o pero si entonces que este esta estos estas eso es son era eran ser estar estoy estas esta estan yo mi mis me tu tus nosotros nuestro de en a por para con sin sobre bajo no ni muy mas menos se lo le les su sus".split(" ")),
  pt: new Set("o a os as um uma uns umas e ou mas se entao que este esta estes estas isso e sao era eram ser estar estou estas esta estao eu meu minha me teu tua nos nosso de em para por com sem sobre sob nao nem muito mais menos se lhe lhes seu sua seus suas".split(" ")),
  fr: new Set("le la les un une des et ou mais si alors que ce cette ces cela est sont etait etaient etre je me mon ma mes tu ton ta tes nous notre vous votre il elle ils elles lui leur de en a pour avec sans sur sous ne pas ni tres plus moins se son sa ses".split(" ")),
  de: new Set("der die das ein eine einen und oder aber wenn dann dass dies diese dieser es ist sind war waren sein ich mich mein meine du dein deine wir unser ihr euer er sie ihm ihnen von in an auf zu fuer mit bei aus ueber nicht kein sehr auch noch so um durch".split(" ")),
  it: new Set("il lo la i gli le un uno una e o ma se allora che questo questa questi queste esso e sono era erano essere io mi mio mia noi nostro voi vostro lui lei loro di in a per con senza su sotto non ne molto piu meno si suo sua".split(" ")),
};

const POV_PRONOUNS: Record<WritingLanguage, { first: string[]; second: string[]; third: string[] }> = {
  en: { first: ["i", "i'm", "im", "me", "my", "mine", "we", "us", "our", "ours"], second: ["you", "your", "yours", "you're", "youre"], third: ["he", "she", "it", "they", "him", "her", "his", "hers", "their", "theirs", "them"] },
  nl: { first: ["ik", "me", "mij", "mijn", "we", "wij", "ons", "onze"], second: ["jij", "je", "jou", "jouw", "u", "uw"], third: ["hij", "zij", "ze", "hem", "haar", "hun", "die", "hen"] },
  es: { first: ["yo", "me", "mi", "mis", "nosotros", "nuestro", "nuestra"], second: ["tu", "tú", "te", "usted", "tuyo"], third: ["el", "él", "ella", "ellos", "ellas", "le", "su", "sus"] },
  pt: { first: ["eu", "me", "mim", "meu", "minha", "nós", "nos", "nosso", "nossa"], second: ["tu", "te", "você", "voce", "seu", "sua"], third: ["ele", "ela", "eles", "elas", "lhe", "dele", "dela"] },
  fr: { first: ["je", "j'", "moi", "mon", "ma", "mes", "nous", "notre"], second: ["tu", "toi", "ton", "ta", "tes", "vous", "votre"], third: ["il", "elle", "ils", "elles", "lui", "leur", "son", "sa", "ses"] },
  de: { first: ["ich", "mich", "mir", "mein", "meine", "wir", "uns", "unser"], second: ["du", "dich", "dir", "dein", "deine", "ihr", "euer"], third: ["er", "sie", "es", "ihm", "ihnen", "sein", "seine", "ihre"] },
  it: { first: ["io", "mi", "mio", "mia", "noi", "nostro", "nostra"], second: ["tu", "ti", "tuo", "tua", "voi", "vostro"], third: ["lui", "lei", "loro", "suo", "sua", "essi"] },
  xx: { first: ["i", "ik", "me", "my"], second: ["you", "je"], third: ["he", "she", "hij", "zij"] },
};

/**
 * Tense markers, not a parser. Where a language has no list here the trait stays
 * null on purpose: a wrong tense is worse than a dark trait.
 */
const TENSE_MARKERS: Partial<Record<WritingLanguage, { past: string[]; present: string[] }>> = {
  en: {
    past: ["was", "were", "had", "did", "said", "went", "came", "saw", "knew", "thought", "told", "felt", "kept", "left", "made", "took", "gave", "found", "held", "brought", "wrote", "sang", "ran", "got", "heard", "stood", "sat", "met", "lost", "won", "fell", "gone", "been", "loved", "lived", "walked", "looked", "talked", "turned", "watched", "waited", "wanted", "needed", "called", "tried", "cried", "died", "smiled", "danced", "played", "asked", "answered", "remembered", "forgot"],
    present: ["is", "are", "am", "has", "have", "do", "does", "go", "goes", "come", "comes", "see", "sees", "know", "knows", "think", "thinks", "feel", "feels", "keep", "keeps", "take", "takes", "give", "gives", "find", "finds", "hold", "holds", "stand", "stands", "want", "wants", "need", "needs", "can", "will", "let"],
  },
  nl: {
    past: ["was", "waren", "had", "hadden", "werd", "werden", "ging", "gingen", "kwam", "kwamen", "zag", "zagen", "wist", "wisten", "dacht", "dachten", "deed", "deden", "zei", "zeiden", "kon", "konden", "moest", "moesten", "wilde", "wilden", "bleef", "bleven", "nam", "namen", "gaf", "gaven", "vond", "vonden", "voelde", "stond", "stonden", "zat", "zaten", "liep", "liepen", "zong", "zongen", "schreef", "keek", "keek", "zweeg", "vloog"],
    present: ["ben", "bent", "is", "zijn", "heb", "hebt", "heeft", "hebben", "word", "wordt", "worden", "ga", "gaat", "gaan", "kom", "komt", "komen", "zie", "ziet", "zien", "weet", "weten", "denk", "denkt", "doe", "doet", "zeg", "zegt", "kan", "kunnen", "moet", "moeten", "wil", "willen", "blijf", "blijven", "neem", "neemt", "geef", "geeft", "vind", "vindt", "voel", "voelt", "sta", "staat", "zit", "zit", "loop", "loopt", "zing", "zingt"],
  },
  es: {
    past: ["era", "eran", "fue", "fueron", "estaba", "estaban", "tuve", "tuvo", "tenia", "hice", "hizo", "dije", "dijo", "pude", "pudo", "quise", "quiso", "vi", "vio", "vine", "vino", "estuve", "supo", "supe"],
    present: ["soy", "eres", "es", "somos", "estoy", "estas", "esta", "tengo", "tiene", "hago", "hace", "digo", "dice", "puedo", "puede", "quiero", "quiere", "veo", "ve", "vengo", "viene"],
  },
  pt: {
    past: ["era", "eram", "foi", "foram", "estava", "estavam", "tive", "teve", "tinha", "fiz", "fez", "disse", "pude", "pode", "quis", "queria", "vi", "viu", "vim", "veio", "soube"],
    present: ["sou", "é", "e", "somos", "estou", "está", "esta", "tenho", "tem", "faço", "faco", "faz", "digo", "diz", "posso", "pode", "quero", "quer", "vejo", "vê", "venho", "vem"],
  },
};

const EXPLICIT_WORDS: Partial<Record<WritingLanguage, Set<string>>> = {
  en: new Set("shit fuck fucking fucked damn goddamn bitch ass bastard dick cock pussy hell whore slut nigga".split(" ")),
  nl: new Set("klote kut kutzooi fuck fucking godverdomme verdomme tyfus pleuris hoer mafklapper lul lullen neuken neuk schijt kk".split(" ")),
  es: new Set("puta puto joder mierda coño cojones cabron cabrón gilipollas hostia follar".split(" ")),
  pt: new Set("puta puto merda caralho foder porra crl buceta".split(" ")),
  fr: new Set("merde putain con salope foutre enculé baiser".split(" ")),
  de: new Set("scheisse scheiße fick fotze arsch hurensohn verdammt".split(" ")),
  it: new Set("merda cazzo puttana stronzo vaffanculo figa".split(" ")),
  xx: new Set("shit fuck merda"),
};

/** Keyword → theme, deliberately small and explainable. */
const THEME_KEYWORDS: Record<string, string[]> = {
  love: ["love", "liefde", "lief", "hart", "heart", "amor", "amar", "amo", "amour", "liebe", "amore", "querer", "teamo"],
  night: ["night", "nacht", "noche", "noite", "nuit", "notte", "nachts", "midnight", "maan", "moon"],
  street: ["street", "straat", "calle", "rua", "rue", "strasse", "strada", "city", "stad", "ghetto"],
  nostalgia: ["remember", "herinner", "recuerdo", "recordar", "lembrar", "souvenir", "memory", "memories", "verleden", "yesterday", "vroeger", "nostalgia"],
  motivation: ["rise", "opstaan", "sta op", "fight", "vecht", "luchar", "vencer", "stronger", "sterker", "battle", "win", "winnen", "never give"],
  heartbeat: ["heartbeat", "hartslag", "pulso", "batida", "pulse"],
  pain: ["pain", "pijn", "dolor", "dor", "schmerz", "dolore", "tears", "tranen", "lágrimas", "broken"],
  freedom: ["free", "vrij", "vrijheid", "libre", "livre", "frei", "libertad", "liberdade", "libertà"],
  status: ["money", "geld", "dinero", "dinheiro", "cash", "rich", "rijk", "success", "fame", "famous"],
  party: ["dance", "dansen", "baila", "dança", "danse", "party", "feest", "fiesta", "festa"],
};

const SECTION_HEADING = /^\s*\[([^\]]{1,60})\]\s*$/;
const INLINE_TAG = /\[[^\]]*\]/g;

/** A song is described by its block order, so eight to twelve blocks is plenty. */
const MAX_STRUCTURE_SECTIONS = 16;

/** Parenthetical backing vocals and ad-libs, e.g. "(yeah)" or "(oh-oh)". */
const AD_LIB = /\([^()]{1,80}\)/;

/**
 * Section labels are free text and come in several languages. They are matched
 * after lowercasing and dropping digits, so "Verse 1", "verse" and "Couplet 2"
 * collapse to the same code. Unknown labels return null: a structure string full
 * of "x" says less than no structure at all.
 */
const SECTION_CODES: { code: string; pattern: RegExp }[] = [
  { code: "i", pattern: /^(intro|introduction|introduccion|introductie|inleiding|entrada)\b/ },
  { code: "o", pattern: /^(outro|ending|slot|finale|einde|final|salida)\b/ },
  { code: "p", pattern: /^(pre[- ]?chorus|prechorus|pre[- ]?refrein|voorrefrein|pre[- ]?estribillo|build[- ]?up)\b/ },
  { code: "h", pattern: /^(post[- ]?chorus|postchorus|post[- ]?refrein|post[- ]?estribillo|hook)\b/ },
  { code: "c", pattern: /^(chorus|refrein|refrain|refrao|estribillo|ritornello|chant)\b/ },
  { code: "v", pattern: /^(verse|couplet|strofe|strophe|strofa|stanza|vers|verso|estrofa)\b/ },
  { code: "b", pattern: /^(bridge|brug|pont|puente|ponte|middle[- ]?8|breakdown)\b/ },
  { code: "d", pattern: /^(drop)\b/ },
  { code: "n", pattern: /^(interlude|break|instrumental|solo|spoken)\b/ },
];

export function sectionCode(label: string): string | null {
  const normalised = stripAccents(label.toLowerCase())
    .replace(/\d+/g, " ")
    .replace(/[^a-z\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalised) return null;
  return SECTION_CODES.find((entry) => entry.pattern.test(normalised))?.code ?? null;
}

function normaliseLine(line: string): string {
  return stripAccents(line.toLowerCase())
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveWritingLanguage(raw: string | null | undefined): WritingLanguage {
  if (!raw) return "xx";
  const key = String(raw).trim().toLowerCase();
  return LANGUAGE_ALIASES[key] ?? "xx";
}

/** Strips accents so "corazón" and "corazon" count the same. */
function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normaliseWord(value: string): string {
  return stripAccents(value.toLowerCase()).replace(/[^a-z']/g, "");
}

function isVowel(char: string, language: WritingLanguage): boolean {
  if ("aeiou".includes(char)) return true;
  if (char === "y" && (language === "en" || language === "xx")) return true;
  return false;
}

/** Maximal vowel runs, e.g. "beautiful" → ["eau", "i", "u"]. */
function vowelGroups(word: string, language: WritingLanguage): string[] {
  const groups: string[] = [];
  let current = "";
  let previousWasVowel = false;
  for (const char of word) {
    // English "ow"/"ew" spell a single vowel sound: "show" is one group, not
    // "o" plus a consonant. Only for languages where w is never a full vowel.
    const glidingW: boolean = char === "w" && previousWasVowel && (language === "en" || language === "xx");
    const vowel: boolean = isVowel(char, language) || glidingW;
    if (vowel) {
      current += char;
    } else if (current) {
      groups.push(current);
      current = "";
    }
    previousWasVowel = vowel;
  }
  if (current) groups.push(current);
  return groups;
}

function vowelClass(group: string, language: WritingLanguage): string {
  const table = VOWEL_CLASSES[language] ?? {};
  return table[group] ?? group[0] ?? "";
}

/** English "love" rhymes with "of", not with the silent e: drop it before keying. */
function rhymeSurface(word: string, language: WritingLanguage): string {
  if (language !== "en" && language !== "xx") return word;
  if (word.length > 2 && word.endsWith("e") && !/(le|re|ee|ie|oe|ue)$/.test(word)) {
    return word.slice(0, -1);
  }
  return word;
}

/**
 * Approximate syllable count. Vowel groups, minus the English silent e, minus
 * nothing for languages whose final e is its own syllable (Dutch "mooie").
 */
export function countSyllables(word: string, language: WritingLanguage = "xx"): number | null {
  const normalised = normaliseWord(word ?? "");
  if (!normalised) return null;
  const groups = vowelGroups(normalised, language);
  if (groups.length === 0) return null;
  let count = groups.length;
  if (language === "en" || language === "xx") {
    if (normalised.length > 2 && normalised.endsWith("e") && !/(le|re|ee|ie|oe|ue)$/.test(normalised) && count > 1) {
      count -= 1;
    }
    // "going" is go-ing, not one vowel run; "sing" stays one syllable.
    if (/[aeiou]ing$/.test(normalised) && normalised.length > 4) count += 1;
  }
  // Dutch keeps the final e of "mooie"/"goeie" as its own syllable.
  if (language === "nl" && /[aeiou]ie$/.test(normalised)) count += 1;
  return count;
}

/**
 * Sound class of the rhyme tail: last vowel class plus the final consonant
 * cluster (capped at two letters, doubled consonants collapsed), so
 * "light"/"night" both key as "i-ht" while "light"/"love" do not.
 */
export function rhymeKey(word: string, language: WritingLanguage = "xx"): string | null {
  const surface = rhymeSurface(normaliseWord(word ?? ""), language);
  if (!surface) return null;
  const groups = vowelGroups(surface, language);
  if (groups.length === 0) return null;
  const lastGroup = groups[groups.length - 1];
  const index = surface.lastIndexOf(lastGroup);
  const coda = surface.slice(index + lastGroup.length).replace(/(.)\1+/g, "$1").slice(-2);
  const soundClass = vowelClass(lastGroup, language);
  return coda ? `${soundClass}-${coda}` : soundClass;
}

/** True when the rhyme tail carries two or more syllables (multisyllabic rhyme). */
function isMultisyllabicTail(word: string, language: WritingLanguage): boolean {
  const surface = rhymeSurface(normaliseWord(word ?? ""), language);
  return vowelGroups(surface, language).length >= 2;
}

/** Splits lyrics on [Section] headings; inline tags are dropped, empty lines too. */
export function splitSections(lyrics: string | null | undefined): LyricSection[] {
  if (!lyrics) return [];
  const sections: LyricSection[] = [];
  let current: LyricSection | null = null;
  for (const rawLine of String(lyrics).split(/\r?\n/)) {
    const heading = SECTION_HEADING.exec(rawLine);
    if (heading) {
      current = { label: heading[1].trim(), lines: [] };
      sections.push(current);
      continue;
    }
    const line = rawLine.replace(INLINE_TAG, " ").replace(/\s+/g, " ").trim();
    if (!line) continue;
    if (!current) {
      current = { label: "", lines: [] };
      sections.push(current);
    }
    current.lines.push(line);
  }
  return sections.filter((section) => section.lines.length > 0);
}

function wordsOf(line: string): string[] {
  return line
    .split(/\s+/)
    .map((token) => normaliseWord(token))
    .filter((token) => token.length > 0);
}

/** Last word that carries a rhyme key — the word the line's rhyme actually rests on. */
function lastWordOf(line: string): string {
  const words = wordsOf(line);
  return words.length > 0 ? words[words.length - 1] : "";
}

function lineKey(line: string, language: WritingLanguage): string | null {
  const words = wordsOf(line);
  for (let i = words.length - 1; i >= 0; i -= 1) {
    const key = rhymeKey(words[i], language);
    if (key) return key;
  }
  return null;
}

type SectionRhymes = {
  scheme: string;
  lineCount: number;
  rhymingLines: number;
  internalLines: number;
  pairs: number;
  multisyllabicPairs: number;
};

function analyseSection(section: LyricSection, language: WritingLanguage): SectionRhymes {
  const keys = section.lines.map((line) => lineKey(line, language));
  const letters = new Map<string, string>();
  let scheme = "";
  let rhymingLines = 0;
  let pairs = 0;
  let multisyllabicPairs = 0;

  keys.forEach((key, index) => {
    if (!key) {
      scheme += "·";
      return;
    }
    if (!letters.has(key)) letters.set(key, String.fromCharCode(65 + letters.size));
    scheme += letters.get(key);
    const peers = keys.filter((other, otherIndex) => otherIndex !== index && other === key);
    if (peers.length > 0) {
      rhymingLines += 1;
      pairs += peers.length;
      // The tail of the *rhyming word*, not of the whole line: measuring the line
      // made every pair look multisyllabic.
      if (isMultisyllabicTail(lastWordOf(section.lines[index]), language)) multisyllabicPairs += peers.length;
    }
  });

  const internalLines = section.lines.filter((line) => {
    const words = wordsOf(line);
    if (words.length < 2) return false;
    const keyed = words.map((word) => rhymeKey(word, language));
    return keyed.some((key, i) => key !== null && keyed.some((other, j) => j !== i && other === key));
  }).length;

  return { scheme, lineCount: section.lines.length, rhymingLines, internalLines, pairs, multisyllabicPairs };
}

function dominantScheme(analyses: SectionRhymes[]): string | null {
  const counts = new Map<string, number>();
  for (const analysis of analyses) {
    if (!analysis.scheme || analysis.scheme.includes("·")) continue;
    counts.set(analysis.scheme, (counts.get(analysis.scheme) ?? 0) + 1);
  }
  let best: { scheme: string; count: number } | null = null;
  for (const [scheme, count] of counts) {
    if (!best || count > best.count) best = { scheme, count };
  }
  return best?.scheme ?? null;
}

function detectPov(words: string[], language: WritingLanguage): WritingPov | null {
  const pronouns = POV_PRONOUNS[language] ?? POV_PRONOUNS.xx;
  const counts = { first: 0, second: 0, third: 0 };
  for (const word of words) {
    if (pronouns.first.includes(word)) counts.first += 1;
    else if (pronouns.second.includes(word)) counts.second += 1;
    else if (pronouns.third.includes(word)) counts.third += 1;
  }
  const entries = (Object.entries(counts) as Array<[WritingPov, number]>).filter(([, count]) => count > 0);
  if (entries.length === 0) return null;
  entries.sort((a, b) => b[1] - a[1]);
  const [top, second] = entries;
  if (second && top[1] - second[1] <= Math.max(1, Math.round(top[1] * 0.2))) return "mixed";
  return top[0];
}

function detectTense(words: string[], language: WritingLanguage): WritingTense | null {
  const markers = TENSE_MARKERS[language];
  if (!markers) return null;
  let past = 0;
  let present = 0;
  for (const word of words) {
    if (markers.past.includes(word)) past += 1;
    else if (markers.present.includes(word)) present += 1;
  }
  if (past === 0 && present === 0) return null;
  if (past === present) return "mixed";
  if (past > present) return present === 0 ? "past" : "mixed";
  return past === 0 ? "present" : "mixed";
}

/**
 * Word-boundary matching, found the hard way: a plain substring test mapped
 * "door" onto the Portuguese "dor" (pain) and "window" onto "win" (motivation),
 * which put motivation in 297 of 400 tracks. Keywords of five characters or more
 * may act as a stem ("herinner" → "herinneringen"); shorter ones must match a
 * whole word.
 */
function detectThemes(lines: string[]): string[] {
  const tokens = lines.flatMap((line) => wordsOf(line));
  const found = new Map<string, number>();
  for (const [theme, keywords] of Object.entries(THEME_KEYWORDS)) {
    const hits = keywords.filter((keyword) =>
      keyword.includes(" ")
        ? lines.some((line) => line.toLowerCase().includes(keyword))
        : tokens.some((token) => (keyword.length >= 5 ? token.startsWith(keyword) : token === keyword)),
    ).length;
    if (hits > 0) found.set(theme, hits);
  }
  return [...found.entries()]
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
    .map(([theme]) => theme);
}

function contentWordsOf(words: string[], language: WritingLanguage): string[] {
  const stop = STOP_WORDS[language] ?? STOP_WORDS.en!;
  const seen = new Set<string>();
  for (const word of words) {
    if (word.length < 4) continue;
    // Contractions ("don't", "you're") are function words in disguise; they were
    // the top of the signature list on a 400-track sample.
    if (word.includes("'")) continue;
    if (stop.has(word)) continue;
    seen.add(word);
    if (seen.size >= MAX_CONTENT_WORDS) break;
  }
  return [...seen];
}

/**
 * The whole per-track writing profile. Returns null when the text is too thin to
 * say anything — a dark trait beats a confident guess.
 */
export function extractWritingFeatures(input: WritingFeatureInput): WritingFeatures | null {
  const language = resolveWritingLanguage(input.language);
  const sections = splitSections(input.lyrics);
  const lines = sections.flatMap((section) => section.lines);
  const words = lines.flatMap((line) => wordsOf(line));
  if (lines.length < MIN_LINES || words.length < MIN_CONTENT_WORDS) return null;

  const perLine = lines.map((line) => countLineSyllables(line, language));
  const counted = perLine.filter((value): value is number => value !== null && value > 0);
  const avgSyllables = counted.length > 0 ? round2(counted.reduce((a, b) => a + b, 0) / counted.length) : null;
  const syllableSpread =
    counted.length > 1
      ? round2(Math.sqrt(counted.reduce((sum, value) => sum + (value - (avgSyllables ?? 0)) ** 2, 0) / counted.length))
      : null;

  const analyses = sections.map((section) => analyseSection(section, language));
  const analysedLines = analyses.reduce((sum, analysis) => sum + analysis.lineCount, 0);
  const rhymingLines = analyses.reduce((sum, analysis) => sum + analysis.rhymingLines, 0);
  const internalLines = analyses.reduce((sum, analysis) => sum + analysis.internalLines, 0);
  const pairs = analyses.reduce((sum, analysis) => sum + analysis.pairs, 0);
  const multisyllabicPairs = analyses.reduce((sum, analysis) => sum + analysis.multisyllabicPairs, 0);

  const explicit = EXPLICIT_WORDS[language] ?? EXPLICIT_WORDS.xx!;
  const explicitLines = lines.filter((line) => wordsOf(line).some((word) => explicit.has(word))).length;

  const codes = sections
    .map((section) => sectionCode(section.label))
    .filter((code): code is string => code !== null);
  const sectionStructure = codes.length >= 2 ? codes.slice(0, MAX_STRUCTURE_SECTIONS).join("-") : null;

  const chorusSections = sections.filter((section) => sectionCode(section.label) === "c");
  const chorusLines =
    chorusSections.length > 0
      ? round2(chorusSections.reduce((sum, section) => sum + section.lines.length, 0) / chorusSections.length)
      : null;

  const lineCounts = new Map<string, number>();
  for (const line of lines) {
    const key = normaliseLine(line);
    if (!key) continue;
    lineCounts.set(key, (lineCounts.get(key) ?? 0) + 1);
  }
  // A line counts as repeated when the same text appears more than once in the
  // song — the chorus therefore counts, which is precisely the repetition this
  // trait is about.
  const repeatedLines = [...lineCounts.values()].reduce((sum, count) => sum + (count > 1 ? count : 0), 0);
  const repetition = lines.length > 0 ? round2(repeatedLines / lines.length) : null;
  const adLibLines = lines.filter((line) => AD_LIB.test(line)).length;
  const adLibs = lines.length > 0 ? round2(adLibLines / lines.length) : null;

  return {
    language,
    lineCount: lines.length,
    wordCount: words.length,
    avgSyllables,
    syllableSpread,
    rhymeScheme: dominantScheme(analyses),
    rhymeDensity: analysedLines > 0 ? round2(rhymingLines / analysedLines) : null,
    internalRhyme: analysedLines > 0 ? round2(internalLines / analysedLines) : null,
    multisyllabicRhyme: pairs > 0 ? round2(multisyllabicPairs / pairs) : null,
    pov: detectPov(words, language),
    tense: detectTense(words, language),
    explicitness: lines.length > 0 ? round2(explicitLines / lines.length) : null,
    sectionStructure,
    chorusLines,
    repetition,
    adLibs,
    hasBridge: codes.includes("b"),
    contentWords: contentWordsOf(words, language),
    themes: detectThemes(lines),
    lyricSpectra: lyricSpectrumScores(lines.join("\n")),
  };
}

function countLineSyllables(line: string, language: WritingLanguage): number | null {
  const tokens = wordsOf(line);
  if (tokens.length === 0) return null;
  let total = 0;
  let counted = 0;
  for (const token of tokens) {
    const value = countSyllables(token, language);
    if (value !== null) {
      total += value;
      counted += 1;
    }
  }
  return counted > 0 ? total : null;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
