/**
 * Resume playback across a full document load.
 *
 * The <audio> element lives on `window` (see Player.tsx's
 * getSharedAudioElement), so client-side navigation never interrupts playback.
 * A real document load still throws that element away — an F5, a crash, or an
 * RSC payload that fails so Next.js falls back to a browser navigation.
 *
 * To keep the music going across one, the player store persists whether
 * playback was running plus the last moment it was known to be alive. That
 * flag is only honoured while it is still fresh: reopening the app hours later
 * should not start playing by itself.
 */
export const PLAYBACK_RESUME_WINDOW_MS = 60_000;

export function shouldResumePlayback(
  isPlaying: unknown,
  lastActiveAt: unknown,
  now: number = Date.now()
): boolean {
  if (isPlaying !== true) return false;
  if (
    typeof lastActiveAt !== "number" ||
    !Number.isFinite(lastActiveAt) ||
    lastActiveAt <= 0
  ) {
    return false;
  }
  // `Math.abs` also covers a timestamp from the future (system clock moved
  // backwards between the reload and the write).
  return Math.abs(now - lastActiveAt) <= PLAYBACK_RESUME_WINDOW_MS;
}
