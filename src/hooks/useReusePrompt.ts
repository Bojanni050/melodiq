"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useStudioStore } from "@/lib/store";
import { buildReusePayload, type ReuseScope, type ReuseTrack } from "@/lib/reuse-prompt";

export const REUSE_PROMPT_STORAGE_KEY = "melodiq-reuse-prompt-payload";

/**
 * The "Reuse Prompt" action, in one place.
 *
 * This was previously copy-pasted into four pages (Library, Archive, Playlists,
 * Releases) and each copy was slightly different: some used a window.confirm,
 * the others a styled dialog, and none of them knew about scopes. Slim Archive
 * then added a fifth surface and simply omitted the handler — which, before the
 * menu entry was made conditional, produced a button that silently did nothing.
 *
 * The one decision left to the caller is how to ask for confirmation, because
 * two of those pages already own a styled dialog and re-implementing it here
 * would throw that away. Pass `hasExistingContent` and decide what to do with
 * it; the default is a window.confirm.
 */
export function useReusePrompt() {
  const router = useRouter();
  const [pendingReuse, setPendingReuse] = useState<{ track: ReuseTrack; scope: ReuseScope } | null>(null);

  /** Writes the payload and navigates. Safe to call directly once confirmed. */
  const performReuse = useCallback(
    (track: ReuseTrack, scope: ReuseScope) => {
      sessionStorage.setItem(REUSE_PROMPT_STORAGE_KEY, JSON.stringify(buildReusePayload(track, scope)));
      router.push("/studio");
    },
    [router]
  );

  /**
   * The handler to hand to `onReusePrompt`. When the Studio already holds a
   * prompt or lyrics, the reuse would overwrite them, so the pending reuse is
   * parked in state instead of being executed.
   */
  const handleReusePrompt = useCallback(
    (
      track: ReuseTrack,
      scope: ReuseScope = "both",
      options?: { confirm?: (message: string) => boolean }
    ) => {
      const { songIdea, lyrics } = useStudioStore.getState();
      if (songIdea.trim() || lyrics.trim()) {
        const message = "Dit vervangt de huidige inhoud van de Studio. Doorgaan?";
        if (options?.confirm) {
          if (options.confirm(message)) performReuse(track, scope);
          return;
        }
        setPendingReuse({ track, scope });
        return;
      }
      performReuse(track, scope);
    },
    [performReuse]
  );

  /** Call after the user confirms the parked reuse. */
  const confirmPendingReuse = useCallback(() => {
    if (!pendingReuse) return;
    const { track, scope } = pendingReuse;
    setPendingReuse(null);
    performReuse(track, scope);
  }, [pendingReuse, performReuse]);

  const cancelPendingReuse = useCallback(() => setPendingReuse(null), []);

  return {
    handleReusePrompt,
    pendingReuse,
    confirmPendingReuse,
    cancelPendingReuse,
  };
}
