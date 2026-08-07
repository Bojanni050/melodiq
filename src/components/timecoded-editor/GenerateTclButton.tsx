"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Status = "idle" | "processing" | "failed";

const POLL_INTERVAL_MS = 4000;
const MAX_WAIT_MS = 180_000;

export default function GenerateTclButton({ trackId }: { trackId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAtRef = useRef(0);

  useEffect(() => {
    return () => {
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    };
  }, []);

  function schedulePoll() {
    pollTimeoutRef.current = setTimeout(poll, POLL_INTERVAL_MS);
  }

  async function poll() {
    if (Date.now() - startedAtRef.current > MAX_WAIT_MS) {
      setStatus("failed");
      setError("Generation is taking longer than expected — check back shortly.");
      return;
    }
    try {
      const res = await fetch(`/api/tracks/${trackId}/generate-tcl`);
      const data = await res.json().catch(() => null);
      if (data?.status === "done") {
        router.refresh();
        return;
      }
      if (data?.status === "failed") {
        setStatus("failed");
        setError(data?.error || "Generation failed");
        return;
      }
    } catch {
      // transient network hiccup — keep polling rather than aborting the wait
    }
    schedulePoll();
  }

  async function handleGenerate() {
    setStatus("processing");
    setError(null);
    try {
      const res = await fetch(`/api/tracks/${trackId}/generate-tcl`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("failed");
        setError(data?.error || "Generation failed");
        return;
      }
      startedAtRef.current = Date.now();
      schedulePoll();
    } catch {
      setStatus("failed");
      setError("Network error — could not reach the server.");
    }
  }

  const busy = status === "processing";

  return (
    <div className="tce-generate-cta">
      <button
        type="button"
        className="btn-primary"
        onClick={handleGenerate}
        disabled={busy}
      >
        {busy ? (
          <><span className="tce-spinner" aria-hidden="true" /> Generating…</>
        ) : (
          "Generate Time-Coded Lyrics"
        )}
      </button>
      {error && <p className="tce-generate-cta__error">{error}</p>}
    </div>
  );
}
