export const STYLE_STORAGE_KEY = "melodiq-style-studio";
export const STYLE_SNAPSHOTS_KEY = "melodiq-style-studio-snapshots";

export const STYLE_SNAPSHOTS_MAX = 30;

export const PRIMARY_GENRES = [
  "Indie",
  "Indie Folk",
  "Indie Pop",
  "Indie Rock",
  "Pop",
  "Folk",
  "Singer-Songwriter",
  "Acoustic",
  "Alternative",
  "Alternative Rock",
  "Rock",
  "Soft Rock",
  "R&B",
  "Soul",
  "Hip-Hop",
  "Lo-Fi",
  "Jazz",
  "Blues",
  "Country",
  "Americana",
  "Electronic",
  "Ambient",
  "Cinematic",
  "Classical",
  "World",
  "Latin",
  "Reggae",
  "Funk",
  "Gospel",
  "Choir",
  "Experimental",
] as const;

export const MOOD_OPTIONS = [
  "Warm",
  "Dark",
  "Dreamy",
  "Energetic",
  "Melancholic",
  "Vintage",
  "Hopeful",
  "Aggressive",
  "Relaxed",
  "Epic",
  "Nostalgic",
  "Tender",
  "Brooding",
  "Uplifting",
  "Reflective",
  "Romantic",
  "Mysterious",
  "Playful",
  "Sober",
  "Joyful",
] as const;

export const INSTRUMENTATION_OPTIONS = [
  "Acoustic Guitar",
  "Electric Guitar",
  "Piano",
  "Keys",
  "Strings",
  "Synths",
  "Choir",
  "808",
  "Brass",
  "Woodwinds",
  "Mandolin",
  "Duduk",
  "Percussion",
  "Bass",
  "Pads",
  "Drums",
  "Cello",
  "Violin",
  "Ukulele",
  "Horns",
  "Organ",
  "Saxophone",
  "Harp",
  "Banjo",
  "Marimba",
] as const;

export const VOCAL_DIRECTION_OPTIONS = [
  "Intimate",
  "Conversational",
  "Close Mic",
  "Breathy",
  "Controlled",
  "Powerful",
  "Falsetto",
  "Soft",
  "Dry",
  "Layered",
  "Natural",
  "Raw",
  "Whispered",
  "Soaring",
  "Spoken",
  "Hushed",
  "Confident",
  "Vulnerable",
] as const;

export const TEMPO_OPTIONS = [
  { value: "slow", label: "Slow" },
  { value: "midtempo", label: "Midtempo" },
  { value: "fast", label: "Fast" },
] as const;

export const ERA_OPTIONS = [
  "Modern",
  "Vintage",
  "80s",
  "90s",
  "Retro",
  "Contemporary",
] as const;

export const PRODUCTION_OPTIONS = [
  "Organic",
  "Polished",
  "Minimal",
  "Radio",
  "Lo-Fi",
  "Wide",
  "Dry",
  "Ambient",
  "Cinematic",
  "Analog",
  "Clean",
  "Lush",
  "Gritty",
  "Spacious",
  "Intimate",
  "Punchy",
  "Ethereal",
] as const;

// --- Musical Foundation ---

export const KEY_OPTIONS = [
  "C major", "C minor", "C# major", "C# minor", "D major", "D minor",
  "D# major", "D# minor", "E major", "E minor", "F major", "F minor",
  "F# major", "F# minor", "G major", "G minor", "G# major", "G# minor",
  "A major", "A minor", "A# major", "A# minor", "B major", "B minor",
] as const;

export const TIME_SIGNATURE_OPTIONS = ["4/4", "3/4", "6/8", "2/4", "5/4", "7/8"] as const;

export const MELODY_CHARACTER_OPTIONS = [
  "Simple",
  "Catchy",
  "Haunting",
  "Melodic",
  "Rhythmic",
  "Experimental",
] as const;

export const HARMONY_CHARACTER_OPTIONS = [
  "Simple",
  "Rich",
  "Dark",
  "Bright",
  "Tense",
  "Dreamy",
] as const;

export const GROOVE_OPTIONS = [
  "Steady",
  "Syncopated",
  "Swung",
  "Driving",
  "Loose",
  "Polyrhythmic",
] as const;

export const BPM_MIN = 40;
export const BPM_MAX = 200;

// --- Vocals ---

export const VOCAL_NEGATIVE_OPTIONS = [
  "No belting",
  "No screaming",
  "No excessive vocal runs",
  "No exaggerated vibrato",
  "No large choir",
] as const;

// --- Production ---

export type ProductionAxisKey =
  | "modernVintage"
  | "dryAtmospheric"
  | "organicPolished"
  | "analogDigital"
  | "minimalLayered"
  | "narrowWide";

export const PRODUCTION_AXES: { key: ProductionAxisKey; left: string; right: string }[] = [
  { key: "modernVintage", left: "Modern", right: "Vintage" },
  { key: "dryAtmospheric", left: "Dry", right: "Atmospheric" },
  { key: "organicPolished", left: "Organic", right: "Polished" },
  { key: "analogDigital", left: "Analog", right: "Digital" },
  { key: "minimalLayered", left: "Minimal", right: "Layered" },
  { key: "narrowWide", left: "Narrow", right: "Wide" },
];

export type InstrumentTextureKey = "acousticElectronic" | "organicSynthetic";

export const INSTRUMENT_TEXTURE_AXES: { key: InstrumentTextureKey; left: string; right: string }[] = [
  { key: "acousticElectronic", left: "Acoustic", right: "Electronic" },
  { key: "organicSynthetic", left: "Organic", right: "Synthetic" },
];

// --- Avoid ---

export const AVOID_SUGGESTIONS = [
  "No EDM",
  "No disco drums",
  "No big choir",
  "No crowd sounds",
  "No excessive reverb",
  "No screaming",
  "No belting",
  "No excessive vocal runs",
  "No cheap 80s synths",
] as const;

export type ProductionAxes = Record<ProductionAxisKey, number>;
export type InstrumentTextureAxes = Record<InstrumentTextureKey, number>;

export const DEFAULT_PRODUCTION_AXES: ProductionAxes = {
  modernVintage: 50,
  dryAtmospheric: 50,
  organicPolished: 50,
  analogDigital: 50,
  minimalLayered: 50,
  narrowWide: 50,
};

export const DEFAULT_INSTRUMENT_TEXTURE_AXES: InstrumentTextureAxes = {
  acousticElectronic: 50,
  organicSynthetic: 50,
};

export type StyleDraftPayload = {
  // Genre & mood (existing)
  primaryGenre: string;
  secondaryGenre: string;
  moods: string[];
  instrumentation: string[];
  vocalDirection: string[];
  tempo: string;
  era: string;
  production: string[];

  // Musical Foundation
  bpm: number | null;
  musicalKey: string;
  timeSignature: string;
  melodyCharacter: string[];
  harmonyCharacter: string[];
  groove: string[];
  energy: number;

  // Instrumentation detail
  instrumentTexture: InstrumentTextureAxes;

  // Vocals
  vocalNegatives: string[];

  // Production
  productionAxes: ProductionAxes;

  // Avoid
  avoidTags: string[];
};
