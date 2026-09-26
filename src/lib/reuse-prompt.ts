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
 */
export function buildReusePayload(
  track: { prompt?: string | null; lyrics?: string | null },
  scope: ReuseScope
): { songIdea: string; lyrics: string } {
  return {
    songIdea: scope === "lyrics" ? "" : track.prompt || "",
    lyrics: scope === "style" ? "" : track.lyrics || "",
  };
}
