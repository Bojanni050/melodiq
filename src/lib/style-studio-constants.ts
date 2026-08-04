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
  "Strings",
  "Synths",
  "Choir",
  "808",
  "Brass",
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

export type StyleDraftPayload = {
  primaryGenre: string;
  secondaryGenre: string;
  moods: string[];
  instrumentation: string[];
  vocalDirection: string[];
  tempo: string;
  era: string;
  production: string[];
};
