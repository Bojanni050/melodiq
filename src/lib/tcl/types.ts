/**
 * Canonical Time Coded Lyrics format. Every alignment engine produces this
 * shape, every exporter and the editor only ever consume this shape — never
 * an engine-specific response format directly.
 */

export interface TclWord {
  word: string;
  /** seconds */
  start: number;
  /** seconds */
  end: number;
}

export interface TclLine {
  /** seconds */
  start: number;
  /** seconds */
  end: number;
  text: string;
  words: TclWord[];
}

export interface TclDocument {
  version: 1;
  lines: TclLine[];
}
