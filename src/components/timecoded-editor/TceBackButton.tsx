"use client";

import { useRouter } from "next/navigation";

/**
 * Round back button (circle with a left arrow), visually identical to the one
 * on the public artist page. History-aware: goes back when there is a history
 * entry, otherwise to `fallback`.
 */
export default function TceBackButton({ fallback = "/library" }: { fallback?: string }) {
  const router = useRouter();

  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      aria-label="Back"
      className="tce-back-btn"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 12H5" />
        <path d="M12 19l-7-7 7-7" />
      </svg>
    </button>
  );
}
