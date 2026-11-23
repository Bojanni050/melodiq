/**
 * Cross-component signal for the cloned-voice library.
 *
 * The Studio mounts its picker while the global player (or a track's action
 * menu) can start a clone on top of it. Without a signal the picker keeps
 * showing the list it fetched on mount, so a voice that was just created is
 * missing until a reload. Anything that adds, completes, renames or deletes a
 * voice fires this event; the picker refetches the whole list.
 */
export const VOICES_CHANGED_EVENT = "melodiq:voices-changed";

export function notifyVoicesChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(VOICES_CHANGED_EVENT));
}
