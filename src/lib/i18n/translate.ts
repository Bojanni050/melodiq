import en from "./messages/en";
import nl from "./messages/nl";
import type { Locale } from "@/lib/stores/localeStore";

const MESSAGES: Record<Locale, typeof en> = { en, nl };

// Dot-path key into the messages object, e.g. "nav.discover" — typed so
// invalid keys are caught at compile time instead of silently rendering
// nothing.
type PathsToStrings<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : T[K] extends Record<string, unknown>
      ? PathsToStrings<T[K], `${Prefix}${K}.`>
      : never;
}[keyof T & string];

export type TranslationKey = PathsToStrings<typeof en>;

function getByPath(obj: unknown, path: string): string | undefined {
  const value = path.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object" && part in acc) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
  return typeof value === "string" ? value : undefined;
}

export function translate(
  locale: Locale,
  key: TranslationKey,
  vars?: Record<string, string | number>
): string {
  const raw = getByPath(MESSAGES[locale], key) ?? getByPath(en, key) ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
}
