/**
 * HistoryManager — immutable snapshot-based undo/redo stack.
 *
 * Each state is a complete LyricLine[] snapshot — no diff, no patching.
 * This is safe and simple: there will rarely be more than a few hundred lines.
 */

import type { LyricLine } from "./LyricsParser";

const MAX_HISTORY = 100;

export class HistoryManager {
  private past: LyricLine[][] = [];
  private future: LyricLine[][] = [];

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  /**
   * Push a new state onto the history stack.
   * Clears the redo stack (future).
   */
  push(state: LyricLine[]): void {
    this.past.push(state);
    if (this.past.length > MAX_HISTORY) {
      this.past.shift(); // discard oldest
    }
    this.future = []; // new edit invalidates redo
  }

  /**
   * Undo: returns the previous state and pushes current onto redo stack.
   * @param currentState The current live state (will become the redo target)
   */
  undo(currentState: LyricLine[]): LyricLine[] | null {
    if (!this.canUndo) return null;
    const previous = this.past.pop()!;
    this.future.push(currentState);
    return previous;
  }

  /**
   * Redo: returns the next state and pushes current onto undo stack.
   * @param currentState The current live state (will become the undo target)
   */
  redo(currentState: LyricLine[]): LyricLine[] | null {
    if (!this.canRedo) return null;
    const next = this.future.pop()!;
    this.past.push(currentState);
    return next;
  }

  /** Reset the history entirely (e.g. after a new file is loaded). */
  clear(): void {
    this.past = [];
    this.future = [];
  }
}
