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
    payload.production.length === 0
  );
}
