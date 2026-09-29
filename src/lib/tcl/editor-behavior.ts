export type TclEditorBehavior = "always" | "ask" | "never";

/**
 * Normalizes the TCL_AUTO_JUMP_EDITOR setting. The setting used to be a
 * boolean toggle ("true"/"false"); "false" maps to "never" and anything
 * else unset/legacy maps to "always", preserving the old auto-jump default.
 */
export function normalizeTclEditorBehavior(value: string | undefined | null): TclEditorBehavior {
  if (value === "ask" || value === "never" || value === "always") return value;
  if (value === "false") return "never";
  return "always";
}
