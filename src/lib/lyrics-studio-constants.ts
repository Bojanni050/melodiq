import type { BlockType } from "@/lib/lyrics-utils";

export const LANGUAGES = [
  "English",
  "Spanish",
  "French",
  "Frisian",
  "German",
  "Polish",
  "Serbian",
  "Japanese",
  "Korean",
  "Hindi",
  "Portuguese",
  "Italian",
  "Mandarin",
  "Dutch",
  "Other...",
];

export const TRANSLATION_LANGUAGES = [
  { value: "nl", label: "Nederlands (nl)" },
  { value: "en", label: "English (en)" },
  { value: "fr", label: "French (fr)" },
  { value: "de", label: "German (de)" },
  { value: "es", label: "Spanish (es)" },
  { value: "it", label: "Italian (it)" },
  { value: "pt", label: "Portuguese (pt)" },
  { value: "pl", label: "Polish (pl)" },
  { value: "sr", label: "Serbian (sr)" },
  { value: "ja", label: "Japanese (ja)" },
  { value: "ko", label: "Korean (ko)" },
  { value: "hi", label: "Hindi (hi)" },
  { value: "zh", label: "Mandarin (zh)" },
  { value: "other", label: "Other..." },
];

export type StructureOption = {
  value?: string;
  label: string;
  desc?: string;
  group?: boolean;
};

export const STRUCTURES: StructureOption[] = [
  { label: "Eenvoudige pop-variaties", group: true },
  { value: "abab", label: "ABAB", desc: "Vers - Refrein - Vers - Refrein. Simpel, radio-vriendelijk." },
  { value: "ababcb", label: "ABABCB", desc: "Vers - Refrein - Vers - Refrein - Brug - Refrein. Klassieke pop-structuur." },
  { value: "ababcbc", label: "ABABCBC", desc: "Extra herhaling van B/C voor dramatische build-up. Festival-stijl." },
  { value: "aaa", label: "AAA (alleen couplet)", desc: "Alles is tekst-vers, muziek herhaalt zich. Volksliedjes, ballads." },
  { value: "aaba", label: "AABA (klassieke 32-bar)", desc: "A-vers - A-vers - B-brug - A-vers. Jazz, ballads, cine-muziek." },
  { label: "Dance / TCH-stijl", group: true },
  { value: "dance-2drops", label: "Intro -> Verse -> Build -> Drop -> Verse -> Build -> Drop -> Outro", desc: "Klassieke 2-drops-structuur. House/techno." },
  { value: "dance-breaks", label: "Intro -> Break -> Build -> Drop -> Break -> Build -> Drop -> Outro", desc: "Twee break-build-drop-blokken. Ideaal voor clubs." },
  { value: "dance-earlydrop", label: "Intro -> Verse -> Drop -> Verse -> Break -> Build -> Drop -> Outro", desc: "Direct in de drop. Festival/peak-hour." },
  { value: "one-drop", label: "One-drop / minimal", desc: "Intro -> Break -> Build -> Drop -> Outro. Focus op textuur." },
  { label: "Singer-songwriter pop", group: true },
  { value: "pop-classic", label: "Intro -> Verse -> Chorus -> Verse -> Chorus -> Bridge -> Chorus -> Outro", desc: "Klassieke pop-structuur (ABABCB). Radio-ready." },
  { value: "pop-default", label: "Intro -> Verse -> Pre-Chorus -> Chorus -> Verse -> Pre-Chorus -> Chorus -> Bridge -> Chorus", desc: "Standaard pop-structuur met pre-chorus builds." },
  { value: "pop-finallift", label: "Intro -> Verse -> Chorus -> Bridge -> Chorus -> Final lift", desc: "Extra brug + lift (strip-down + build-up)." },
  { value: "pop-prechorus", label: "Intro -> Verse -> Chorus -> Pre-Chorus -> Chorus -> Bridge -> Outro", desc: "Pre-chorus voegt spanning toe. Dramatische pop." },
  { value: "pop-triplechorus", label: "Intro -> Verse -> Chorus -> Verse -> Chorus -> Chorus -> Outro", desc: "Drie keer refrein voor sticky effect." },
  { value: "pop-instrumental", label: "Intro -> Verse -> Chorus -> Bridge -> Instrumental -> Chorus -> Outro", desc: "Instrumentale highlight na de brug. Solo/pads." },
  { value: "ai-choose", label: "Kies jij maar", desc: "AI kiest de beste structuur." },
  { value: "manual", label: "Handmatig", desc: "Typ je eigen structuur." },
];

export const BLOCK_TYPES: BlockType[] = [
  "intro",
  "verse",
  "pre-chorus",
  "chorus",
  "post-chorus",
  "bridge",
  "intrumental",
  "instrumetal-drop",
  "outro",
];

export const BLOCK_PRESETS: Record<string, BlockType[]> = {
  Pop: ["intro", "verse", "pre-chorus", "chorus", "verse", "pre-chorus", "chorus", "bridge", "chorus"],
  ABABCB: ["verse", "chorus", "verse", "chorus", "bridge", "chorus"],
  AABA: ["verse", "verse", "bridge", "verse"],
  Extended: ["intro", "verse", "chorus", "verse", "chorus", "bridge", "chorus", "chorus", "outro"],
  "EDM — 2 Drops": ["intro", "verse", "pre-chorus", "chorus", "verse", "pre-chorus", "chorus", "outro"],
  "EDM — Build & Drop": ["intro", "verse", "chorus", "bridge", "chorus", "outro"],
  "Dance — Early Drop": ["intro", "chorus", "verse", "pre-chorus", "chorus", "bridge", "chorus", "outro"],
  "Minimal / One Drop": ["intro", "verse", "chorus", "outro"],
};

export const BLOCK_COLORS: Record<BlockType, string> = {
  intro: "rgba(255,255,255,0.15)",
  verse: "#3b82f6",
  "pre-chorus": "#eab308",
  chorus: "#ff530c",
  "post-chorus": "#22c55e",
  bridge: "#a855f7",
  intrumental: "#06b6d4",
  "instrumetal-drop": "#0ea5a4",
  outro: "rgba(255,255,255,0.15)",
};

export const STRUCTURE_PRESET_MAP: Record<string, string> = {
  abab: "ABABCB",
  ababcb: "ABABCB",
  ababcbc: "Extended",
  aaa: "AABA",
  aaba: "AABA",
  "dance-2drops": "EDM — 2 Drops",
  "dance-breaks": "EDM — Build & Drop",
  "dance-earlydrop": "Dance — Early Drop",
  "one-drop": "Minimal / One Drop",
  "pop-classic": "Pop",
  "pop-default": "Pop",
  "pop-finallift": "Extended",
  "pop-prechorus": "Pop",
  "pop-triplechorus": "Extended",
  "pop-instrumental": "Extended",
};

// 50 Vibe / Mood / Atmosphere suggesties
export const MOOD_SUGGESTIONS = [
  "sensual", "sad", "melancholic", "ironic", "happy", "nostalgic", "euphoric", "dark", 
  "dreamy", "ethereal", "energetic", "aggressive", "romantic", "mystical", "gloomy", 
  "uplifting", "peaceful", "haunting", "rebellious", "intimate", "chill", "fierce", 
  "hypnotic", "quirky", "epic", "somber", "hopeful", "cinematic", "retro", "futuristic", 
  "cozy", "lonely", "trippy", "grungy", "smooth", "vintage", "soulful", "brooding", 
  "playful", "seductive", "angry", "reflective", "magical", "moody", "whimsical", 
  "tender", "suspenseful", "relaxed", "shadowy", "warm"
];

// 50 Genre / Stijl suggesties
export const STYLE_SUGGESTIONS = [
  "pop", "rock", "indie", "synthwave", "lofi", "jazz", "blues", "r&b", "soul", "hip hop", 
  "rap", "trap", "metal", "punk", "folk", "country", "acoustic", "ambient", "techno", 
  "house", "edm", "future bass", "dubstep", "drum & bass", "classical", "orchestral", 
  "cinematic", "disco", "funk", "reggae", "ska", "grunge", "shoegaze", "post-rock", 
  "dream pop", "afrobeat", "latin", "reggaeton", "salsa", "metalcore", "hyperpop", 
  "cyberpunk", "americana", "bluegrass", "psychedelic", "garage rock", "electro swing", 
  "deep house", "neo-classical", "trip-hop"
];
