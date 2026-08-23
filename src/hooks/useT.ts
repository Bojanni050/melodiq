"use client";

import { useCallback } from "react";
import { useLocaleStore } from "@/lib/store";
import { translate, type TranslationKey } from "@/lib/i18n/translate";

/** `const t = useT(); t("nav.discover")` — reactive to the current locale. */
export function useT() {
  const locale = useLocaleStore((s) => s.locale);
  return useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale]
  );
}
