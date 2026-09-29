import type { StyleDraftPayload } from "@/lib/style-studio-constants";

function joinWithAnd(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function listToNaturalPhrase(items: string[]): string {
  if (items.length === 0) return "";
  return joinWithAnd(items.map((i) => i.toLowerCase()));
}

export function buildStyleSummary(payload: StyleDraftPayload): string {
  const parts: string[] = [];

  const genreSegment = payload.secondaryGenre.trim()
    ? `${payload.primaryGenre.trim() || "Contemporary"} with ${payload.secondaryGenre.trim().toLowerCase()} influences`
    : `${payload.primaryGenre.trim() || "Contemporary"}`;
  parts.push(genreSegment);

  if (payload.moods.length > 0) {
    parts.push(listToNaturalPhrase(payload.moods));
  }

  if (payload.instrumentation.length > 0) {
    const instruments = listToNaturalPhrase(payload.instrumentation);
    parts.push(`featuring ${instruments}`);
  }

  if (payload.vocalDirection.length > 0) {
    const vocals = listToNaturalPhrase(payload.vocalDirection);
    parts.push(`${vocals} vocals`);
  }

  if (payload.tempo.trim()) {
    const tempoMap: Record<string, string> = {
      slow: "a slow tempo",
      midtempo: "a midtempo groove",
      fast: "a fast tempo",
    };
    parts.push(tempoMap[payload.tempo] || payload.tempo);
  }

  if (payload.era.trim()) {
    parts.push(`${payload.era.trim().toLowerCase()} aesthetic`);
  }

  if (payload.production.length > 0) {
    const production = listToNaturalPhrase(payload.production);
    parts.push(`${production} production`);
  }

  if (parts.length === 0) {
    return "Start selecting style properties to build your musical identity.";
  }

  return parts.join(", ") + ".";
}

export function isStylePayloadEmpty(payload: StyleDraftPayload): boolean {
  return (
    !payload.primaryGenre.trim() &&
    !payload.secondaryGenre.trim() &&
    payload.moods.length === 0 &&
    payload.instrumentation.length === 0 &&
    payload.vocalDirection.length === 0 &&
    !payload.tempo.trim() &&
    !payload.era.trim() &&
    payload.production.length === 0 &&
    !payload.bpm &&
    !payload.musicalKey.trim() &&
    !payload.timeSignature.trim() &&
    payload.melodyCharacter.length === 0 &&
    payload.harmonyCharacter.length === 0 &&
    payload.groove.length === 0 &&
    payload.vocalNegatives.length === 0 &&
    payload.avoidTags.length === 0
  );
}

function axisPhrase(value: number, left: string, right: string): string | null {
  if (value === 50) return null;
  const leaning = value < 50 ? left : right;
  const strength = Math.abs(value - 50);
  const intensity = strength >= 35 ? "strongly " : strength >= 15 ? "" : "slightly ";
  return `${intensity}${leaning.toLowerCase()}`.trim();
}

export type LyricsPromptContext = {
  language?: string;
  vocalistTag?: string;
  structureLabel?: string;
};

/**
 * Composes the human-readable, provider-neutral Music Prompt from the
 * lyrics context (already known from the Lyrics Generator) and the
 * Music Builder's structured payload. This is the text handed off to
 * Studio as songIdea/prompt.
 */
export function buildMusicPrompt(
  payload: StyleDraftPayload,
  instrumental: boolean,
  lyricsCtx: LyricsPromptContext = {}
): string {
  const parts: string[] = [];

  const genreSegment = payload.secondaryGenre.trim()
    ? `${payload.primaryGenre.trim() || "Contemporary"} with ${payload.secondaryGenre.trim().toLowerCase()} influences`
    : payload.primaryGenre.trim() || "Contemporary";
  let opener = genreSegment;
  if (payload.moods.length > 0) opener += `, ${listToNaturalPhrase(payload.moods)}`;
  if (payload.bpm) opener += `, ${payload.bpm} BPM`;
  if (payload.musicalKey.trim()) opener += `, ${payload.musicalKey.trim()}`;
  if (payload.timeSignature.trim()) opener += `, ${payload.timeSignature.trim()} time`;
  parts.push(opener + ".");

  const melodicBits: string[] = [];
  if (payload.melodyCharacter.length > 0) melodicBits.push(`${listToNaturalPhrase(payload.melodyCharacter)} melody`);
  if (payload.harmonyCharacter.length > 0) melodicBits.push(`${listToNaturalPhrase(payload.harmonyCharacter)} harmony`);
  if (payload.groove.length > 0) melodicBits.push(`${listToNaturalPhrase(payload.groove)} groove`);
  if (melodicBits.length > 0) parts.push(joinWithAnd(melodicBits).replace(/^./, (c) => c.toUpperCase()) + ".");

  if (!instrumental) {
    const vocalBits: string[] = [];
    if (payload.vocalDirection.length > 0) vocalBits.push(listToNaturalPhrase(payload.vocalDirection));
    if (lyricsCtx.vocalistTag && lyricsCtx.vocalistTag !== "auto") vocalBits.push(lyricsCtx.vocalistTag);
    if (vocalBits.length > 0) {
      parts.push(`${joinWithAnd(vocalBits)} vocal.`.replace(/^./, (c) => c.toUpperCase()));
    }
    if (payload.vocalNegatives.length > 0) {
      parts.push(payload.vocalNegatives.join(", ") + ".");
    }
  } else {
    parts.push("Instrumental — no vocals.");
  }

  const instrumentBits: string[] = [];
  if (payload.instrumentation.length > 0) instrumentBits.push(listToNaturalPhrase(payload.instrumentation));
  const textureAcoustic = axisPhrase(payload.instrumentTexture.acousticElectronic, "Acoustic", "Electronic");
  const textureOrganic = axisPhrase(payload.instrumentTexture.organicSynthetic, "Organic", "Synthetic");
  if (textureAcoustic) instrumentBits.push(textureAcoustic);
  if (textureOrganic) instrumentBits.push(textureOrganic);
  if (instrumentBits.length > 0) {
    parts.push(`Instrumentation: ${joinWithAnd(instrumentBits)}.`);
  }

  const productionBits: string[] = [];
  if (payload.production.length > 0) productionBits.push(...payload.production.map((p) => p.toLowerCase()));
  for (const axis of [
    { key: "modernVintage", left: "Modern", right: "Vintage" },
    { key: "dryAtmospheric", left: "Dry", right: "Atmospheric" },
    { key: "organicPolished", left: "Organic", right: "Polished" },
    { key: "analogDigital", left: "Analog", right: "Digital" },
    { key: "minimalLayered", left: "Minimal", right: "Layered" },
    { key: "narrowWide", left: "Narrow", right: "Wide" },
  ] as const) {
    const phrase = axisPhrase(payload.productionAxes[axis.key], axis.left, axis.right);
    if (phrase) productionBits.push(phrase);
  }
  if (payload.era.trim()) productionBits.push(`${payload.era.trim().toLowerCase()} aesthetic`);
  if (productionBits.length > 0) {
    parts.push(`Production: ${joinWithAnd(productionBits)}.`);
  }

  if (payload.avoidTags.length > 0) {
    parts.push(`Avoid: ${payload.avoidTags.join(", ")}.`);
  }

  if (lyricsCtx.language && lyricsCtx.language.trim() && lyricsCtx.language !== "English") {
    parts.push(`Lyrics language: ${lyricsCtx.language}.`);
  }

  return parts.join(" ");
}
