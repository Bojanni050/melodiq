import type { Track } from "@/lib/store";
import type { AudioSource, AudioSourceState } from "@/components/player/playerUtils";

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
  action: "toggle-play" | "next" | "previous" | "seek" | "viz-subscribe" | "viz-unsubscribe";
  value?: number;
}

export interface PlayerPopupVizMessage {
  type: "viz";
  payload: {
    // Sent as the analyser's own Uint8Array: structured clone handles typed
    // arrays natively and copies far more cheaply than the 512-element plain
    // Array this used to build 20x a second.
    data: Uint8Array;
  };
}

export type PlayerPopupMessage =
  | PlayerPopupStateMessage
  | PlayerPopupRequestStateMessage
  | PlayerPopupControlMessage
  | PlayerPopupVizMessage;
