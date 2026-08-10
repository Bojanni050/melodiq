"use client";

import { useState } from "react";

export function useCopyToClipboard() {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  async function handleCopy(text: string, field: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }

  return { copiedField, handleCopy };
}
