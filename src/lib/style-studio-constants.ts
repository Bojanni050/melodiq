export const STYLE_STORAGE_KEY = "melodiq-style-studio";
export const STYLE_SNAPSHOTS_KEY = "melodiq-style-studio-snapshots";

export const STYLE_SNAPSHOTS_MAX = 30;

export const PRIMARY_GENRES = [
  "Acoustic",
  "Acoustic Ballad",
  "Afro Pop",
  "Afrobeats",
  "Alien Soundscape",
  "Alternative",
  "Alternative Rock",
  "Ambient",
  "Ambient Music",
  "Americana",
  "Anime",
  "Arena Rock",
  "Art Pop",
  "Baroque Pop",
  "Bluegrass",
  "Blues",
  "Blues Rock",
  "Bollywood Pop",
  "Bossa Nova",
  "Britpop",
  "Celtic Folk",
  "Chillwave",
  "Choir",
  "Cinematic",
  "Cinematic Orchestra",
  "Circus Music",
  "Classic Rock",
  "Classical",
  "Country",
  "Country Rock",
  "Cyberpunk",
  "Dance Pop",
  "Dancehall",
  "Dark Ambient",
  "Disco",
  "Drill",
  "Dream Pop",
  "Drum and Bass",
  "Dubstep",
  "EDM",
  "Electro Swing",
  "Emo Rock",
  "Epic Trailer",
  "Experimental",
  "Experimental Pop",
  "Flamenco",
  "Folk",
  "Folk Pop",
  "Folk Rock",
  "Funk",
  "Future Bass",
  "Garage Rock",
  "Glitchcore",
  "Gospel",
  "Gregorian Chant",
  "Grunge",
  "Hard Rock",
  "Hip-Hop",
  "House Music",
  "Hyperpop",
  "Indie",
  "Indie Folk",
  "Indie Pop",
  "Indie Rock",
  "Irish Pub Song",
  "J Pop",
  "Jazz",
  "K Pop",
  "Latin",
  "Latin Pop",
  "Lo-Fi",
  "Medieval Folk",
  "Meditation Music",
  "Metal",
  "Motown",
  "Nature",
  "Neo Soul",
  "Nordic Folk",
  "Phonk",
  "Pirate Folk",
  "Pop",
  "Pop Music",
  "Pop Punk",
  "Post Apocalyptic Blues",
  "Power Metal",
  "Psychedelic Rock",
  "R&B",
  "Reggae",
  "Reggaeton",
  "Retrowave",
  "Rock",
  "Salsa",
  "Shoegaze",
  "Singer-Songwriter",
  "Soft Rock",
  "Soul",
  "Space Ambient",
  "Steampunk Music",
  "Surf Rock",
  "Symphonic Metal",
  "Synth Pop",
  "Synthwave",
  "Techno",
  "Trance",
  "Trap",
  "Trap Metal",
  "Vaporwave",
  "Viking Metal",
  "Western Film",
  "World",
] as const;

export const GENRE_DESCRIPTIONS: Record<string, string> = {
  "Lo-Fi": "mellow lo-fi beats, dusty vinyl texture, jazzy chords, chill late-night",
  "Indie Folk": "warm indie folk, acoustic guitar, soft vocals, reflective",
  "Classic Rock": "classic rock anthem, electric guitar riffs, powerful vocals, stadium energy",
  "Pop Music": "modern pop, catchy hooks, polished, upbeat rhythm",
  "Hip-Hop": "boom bap hip hop, rhythmic flow, gritty drums, confident vocals",
  "Trap": "trap beat, heavy 808 bass, hi-hat rolls, dark atmospheric tone",
  "EDM": "festival EDM, big synth leads, massive drop, crowd energy",
  "Dance Pop": "dance pop, upbeat tempo, glossy synths, energetic vocals",
  "Country": "modern country, acoustic guitar, heartfelt, warm storytelling",
  "R&B": "smooth R&B groove, soulful vocals, mellow chords, romantic tone",
  "Alternative Rock": "alt rock, gritty guitars, emotional vocals, driving rhythm",
  "Pop Punk": "pop punk, fast guitars, punchy drums, youthful energy",
  "Grunge": "grunge rock, distorted guitars, raw vocals, 90s angst",
  "Synth Pop": "synth pop, bright analog synths, dreamy vocals, retro vibe",
  "Indie Pop": "indie pop, playful synths, light vocals, catchy melodies",
  "Folk Pop": "folk pop blend, acoustic guitar, soft harmonies, uplifting tone",
  "Soft Rock": "soft rock ballad, warm guitar tones, emotional vocals, nostalgic",
  "Blues Rock": "blues rock, gritty guitar solos, soulful vocals, smoky bar vibe",
  "Jazz": "smooth jazz, piano chords, upright bass, late-night lounge mood",
  "Soul": "classic soul, expressive vocals, horns, rich emotional delivery",
  "Neo Soul": "neo soul groove, jazzy chords, smooth vocals, mellow rhythm",
  "Funk": "funky bass groove, rhythmic guitar, energetic horns, danceable beat",
  "Disco": "disco groove, shimmering synths, upbeat, retro dancefloor vibe",
  "House Music": "house beat, steady four-on-the-floor kick, synth stabs, club energy",
  "Techno": "dark techno, driving kick drum, hypnotic synth loops, underground club vibe",
  "Trance": "uplifting trance, atmospheric pads, melodic synths, euphoric build",
  "Drum and Bass": "drum and bass, fast breakbeats, deep bassline, high-energy rhythm",
  "Dubstep": "dubstep drop, wobble bass, glitch effects, heavy electronic energy",
  "Future Bass": "future bass, bright synth chords, emotional drops, modern EDM vibe",
  "Chillwave": "chillwave, dreamy synth pads, nostalgic vibe, relaxed tempo",
  "Dream Pop": "dream pop, airy guitars, echo vocals, hazy atmosphere",
  "Shoegaze": "shoegaze rock, wall of guitars, reverb-heavy vocals, atmospheric",
  "Acoustic Ballad": "acoustic ballad, gentle guitar, emotional lyrics, soft vocals",
  "Singer-Songwriter": "singer-songwriter style, acoustic guitar, storytelling",
  "Emo Rock": "emo rock, emotional vocals, dramatic guitars, intense energy",
  "Garage Rock": "garage rock, raw guitars, lo-fi production, rebellious tone",
  "Psychedelic Rock": "psychedelic rock, swirling guitars, experimental",
  "Surf Rock": "surf rock, twangy guitar, upbeat rhythm, beach vibe",
  "Britpop": "Britpop, melodic guitar riffs, confident vocals, nostalgic tone",
  "Arena Rock": "arena rock, massive chorus, soaring vocals, big guitar sound",
  "Hard Rock": "hard rock, distorted riffs, pounding drums, aggressive vocals",
  "Metal": "heavy metal, crushing guitars, fast drums, intense vocals",
  "Power Metal": "power metal, epic guitars, heroic vocals, fantasy tone",
  "Symphonic Metal": "symphonic metal, orchestral strings, dramatic vocals",
  "Folk Rock": "folk rock, acoustic rhythm, storytelling lyrics, warm vocals",
  "Country Rock": "country rock, twangy guitars, driving rhythm, southern tone",
  "Bluegrass": "bluegrass, banjo picking, fast tempo, rustic Americana vibe",
  "Gospel": "gospel choir, uplifting harmonies, spiritual energy",
  "Motown": "Motown soul, groovy bassline, smooth harmonies, vintage feel",
  "Reggae": "reggae rhythm, offbeat guitar, relaxed island vibe",
  "Dancehall": "dancehall groove, rhythmic bass, Caribbean energy",
  "Latin Pop": "Latin pop, rhythmic guitars, upbeat vocals, tropical vibe",
  "Reggaeton": "reggaeton beat, dembow rhythm, energetic club vibe",
  "Salsa": "salsa groove, lively percussion, horns, dance rhythm",
  "Flamenco": "flamenco guitar, passionate vocals, Spanish rhythm",
  "Bossa Nova": "bossa nova, soft guitar chords, smooth jazz rhythm",
  "Afrobeats": "afrobeats groove, bright percussion, rhythmic vocals",
  "Afro Pop": "afro pop, melodic hooks, vibrant rhythms, dance energy",
  "K Pop": "K-pop style, polished production, catchy chorus, upbeat vibe",
  "J Pop": "J-pop, bright melodies, energetic vocals, glossy production",
  "Anime": "anime opening theme, fast tempo, epic energy",
  "Bollywood Pop": "Bollywood pop, cinematic strings, rhythmic drums",
  "Celtic Folk": "Celtic folk, fiddle melodies, acoustic guitar, mystical tone",
  "Irish Pub Song": "Irish pub song, lively fiddle, group vocals",
  "Nordic Folk": "Nordic folk, haunting vocals, ancient melodies",
  "Medieval Folk": "medieval folk, lute sounds, storytelling tone",
  "Viking Metal": "Viking metal, pounding drums, epic battle energy",
  "Pirate Folk": "pirate folk, sea shanty vocals, lively rhythm",
  "Western Film": "spaghetti western soundtrack, twang guitar, cinematic mood",
  "Cinematic Orchestra": "cinematic orchestra, sweeping strings, dramatic build",
  "Epic Trailer": "epic trailer music, pounding drums, heroic orchestration",
  "Ambient": "ambient soundscape, atmospheric pads, meditative tone",
  "Ambient Music": "ambient soundscape, atmospheric pads, meditative tone",
  "Meditation Music": "meditation music, soft drones, peaceful atmosphere",
  "Nature": "nature soundscape, gentle piano, birds and wind ambience",
  "Space Ambient": "space ambient, cosmic synths, floating textures",
  "Dark Ambient": "dark ambient, eerie pads, mysterious atmosphere",
  "Cyberpunk": "cyberpunk synthwave, futuristic bass, neon city mood",
  "Synthwave": "retro synthwave, neon city vibes, analog synth bass, cinematic 1980s mood",
  "Retrowave": "retrowave, nostalgic synth leads, 80s arcade energy",
  "Vaporwave": "vaporwave aesthetic, slowed samples, dreamy retro texture",
  "Phonk": "phonk trap, distorted bass, Memphis rap influence",
  "Drill": "drill rap, sliding 808s, dark street energy",
  "Trap Metal": "trap metal, aggressive vocals, distorted guitars",
  "Hyperpop": "hyperpop chaos, glitchy vocals, bright synth overload",
  "Glitchcore": "glitchcore electronic, digital distortion, chaotic beats",
  "Experimental Pop": "experimental pop, unexpected rhythms, quirky textures",
  "Art Pop": "art pop, cinematic production, dramatic vocals",
  "Electro Swing": "electro swing, vintage horns, modern electronic beat",
  "Steampunk Music": "steampunk style, brass instruments, mechanical rhythm",
  "Circus Music": "carnival circus music, playful horns, whimsical tone",
  "Baroque Pop": "baroque pop, harpsichord, orchestral elegance",
  "Gregorian Chant": "Gregorian chant, cathedral reverb, sacred choir",
  "Alien Soundscape": "alien soundscape, strange synth tones, futuristic atmosphere",
  "Post Apocalyptic Blues": "post-apocalyptic blues, gritty harmonica, haunting tone",
};

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
  "Theatrical",
  "Restrained",
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
