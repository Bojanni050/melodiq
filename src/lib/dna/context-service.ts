import { buildDnaContext, type DnaStrength } from "./context";
import { serialiseDnaProfile } from "./present";
import { getDnaProfile } from "./repository";

export type LoadedDnaContext = {
  strength: DnaStrength;
  /** Empty when the user has no profile or nothing cleared the confidence bar. */
  text: string;
  sourceCount: number;
};

/**
 * Loads the caller's current profile and turns it into a generator hint.
 *
 * Deliberately reads only what is stored: recomputing here would put a full
 * re-analysis in the path of every generation. A stale profile is still the
 * user's profile, and /dna already offers an explicit rebuild.
 */
export async function loadDnaContext(
  userId: string,
  strength: DnaStrength
): Promise<LoadedDnaContext> {
  if (strength === "off") return { strength, text: "", sourceCount: 0 };

  const stored = await getDnaProfile(userId);
  const payload = serialiseDnaProfile(stored);

  return {
    strength,
    text: buildDnaContext({ traits: payload.traits }, strength),
    sourceCount: payload.profile?.sourceCount ?? 0,
  };
}

export function isDnaStrength(value: unknown): value is DnaStrength {
  return value === "off" || value === "subtle" || value === "strong";
}
