"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GenerateTclButton({ trackId }: { trackId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tracks/${trackId}/generate-tcl`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Generation failed");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error — could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="tce-generate-cta">
      <button
        type="button"
        className="btn-primary"
        onClick={handleGenerate}
        disabled={loading}
      >
        {loading ? (
          <><span className="tce-spinner" aria-hidden="true" /> Generating…</>
        ) : (
          "Generate Time-Coded Lyrics"
        )}
      </button>
      {error && <p className="tce-generate-cta__error">{error}</p>}
    </div>
  );
}
