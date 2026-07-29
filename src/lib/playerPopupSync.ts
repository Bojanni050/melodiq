import type { Track } from "@/lib/store";
import type { AudioSource, AudioSourceState } from "@/components/Player";

export const PLAYER_POPUP_CHANNEL = "melodiq-player-popup";
export const PLAYER_POPUP_WINDOW_NAME = "melodiq-player-popup";

export interface PlayerPopupStateMessage {
  type: "state";
  payload: {
    track: Track | null;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    audioSource: AudioSource;
    audioSourceState: AudioSourceState;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export interface PlayerPopupRequestStateMessage {
  type: "request-state";
}

export interface PlayerPopupControlMessage {
  type: "control";
  action: "toggle-play" | "next" | "previous" | "seek";
  value?: number;
}

export type PlayerPopupMessage =
  | PlayerPopupStateMessage
  | PlayerPopupRequestStateMessage
  | PlayerPopupControlMessage;
