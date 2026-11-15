import { getSetting } from "@/lib/settings";

export const TCL_AUTO_GENERATE_SETTING_KEY = "TCL_AUTO_GENERATE";

/**
 * Normalizes the TCL_AUTO_GENERATE setting. The switch is opt-out: an unset
 * row means "on", which is how every track behaved before the switch existed.
 * Only the literal "false" turns the automatic provider fetch off.
 */
export function normalizeTclAutoGenerate(value: string | undefined | null): boolean {
  return value !== "false";
}

export async function isTclAutoGenerateEnabled(): Promise<boolean> {
  return normalizeTclAutoGenerate(await getSetting(TCL_AUTO_GENERATE_SETTING_KEY));
}
