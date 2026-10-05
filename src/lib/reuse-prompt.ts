/**
 * What a "Reuse Prompt" action carries over into the Studio.
 *
 * Lives in its own module because both `TrackActionMenu` (which offers the
 * choice) and every page that implements the action need the type, and having
 * the menu import it back from the page-facing types file — or the types file
 * import it from the menu — creates a cycle.
 *
 * "both" is the default and the historical behaviour: the prompt becomes the
 * song idea and the lyrics are carried over as well.
 */
export type ReuseScope = "lyrics" | "style" | "both";

export type StudioVocalGender = "female" | "male" | "auto";

/** The track fields Reuse Prompt carries into the Studio. */
export interface ReuseTrack {
  prompt?: string | null;
  lyrics?: string | null;
  title?: string | null;
  vocalGender?: string | null;
}

/** Payload the Studio page reads on mount. Title/gender only ride along when known. */
export interface ReusePayload {
  songIdea: string;
  lyrics: string;
  title?: string;
  vocalGender?: "female" | "male";
}

function normalizeReuseVocalGender(value: unknown): "female" | "male" | undefined {
  return value === "female" || value === "male" ? value : undefined;
}

/** Human-readable label per scope, used by the submenu. */
export const REUSE_SCOPE_LABEL: Record<ReuseScope, string> = {
  lyrics: "Only Lyrics",
  style: "Only Styles",
  both: "Both",
};

/**
 * Builds the sessionStorage payload the Studio page reads on mount.
 *
 * A scope carries only its own field, and the other is sent as an empty string
 * rather than omitted: the Studio sets both fields unconditionally, so leaving
 * the key out would preserve whatever the user already had — which is the
 * opposite of "only lyrics" when their prompt field was filled.
 *
 * Title and vocal gender are track metadata rather than scope content, so they
 * ride along in every scope — but only when the track actually has them. An
 * absent key leaves the Studio's current value untouched (notably vocal
 * gender on pre-migration tracks, which stored none).
 */
export function buildReusePayload(track: ReuseTrack, scope: ReuseScope): ReusePayload {
  const payload: ReusePayload = {
    songIdea: scope === "lyrics" ? "" : track.prompt || "",
    lyrics: scope === "style" ? "" : track.lyrics || "",
  };
  const title = typeof track.title === "string" ? track.title.trim() : "";
  if (title) payload.title = track.title!.trim();
  const vocalGender = normalizeReuseVocalGender(track.vocalGender);
  if (vocalGender) payload.vocalGender = vocalGender;
  return payload;
}
