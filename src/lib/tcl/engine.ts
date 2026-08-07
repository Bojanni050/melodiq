import type { TclDocument } from "./types";

export interface AlignmentInput {
  /** Publicly fetchable audio URL (e.g. an S3 presigned URL). */
  audioUrl: string;
  /** Final lyrics to forced-align against the audio. */
  lyrics: string;
}

/**
 * Swap point for alignment engines. Keep implementations here free of any
 * knowledge of the editor/DB — they only ever take audio + lyrics in and
 * hand back a TclDocument.
 */
export interface AlignmentEngine {
  align(input: AlignmentInput): Promise<TclDocument>;
}
