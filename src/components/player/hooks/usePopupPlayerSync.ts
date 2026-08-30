import { useState, useRef, useEffect, useCallback, type RefObject } from "react";
import { usePlayerStore } from "@/lib/store";
import {
  PLAYER_POPUP_CHANNEL,
  PLAYER_POPUP_WINDOW_NAME,
  type PlayerPopupMessage,
  type PlayerPopupStateMessage,
  type PlayerPopupVizMessage,
} from "@/lib/playerPopupSync";
import { getSharedAudioGraph } from "@/lib/sharedAudioGraph";
import type { AudioSource, AudioSourceState } from "@/components/player/playerUtils";

export function usePopupPlayerSync({
  audioRef,
  audioSource,
  audioSourceState,
  togglePlay,
  handleNext,
  handlePrevious,
  setCurrentTime,
}: {
  audioRef: RefObject<HTMLAudioElement | null>;
  audioSource: AudioSource;
  audioSourceState: AudioSourceState;
  togglePlay: () => void;
  handleNext: () => void;
  handlePrevious: () => void;
  setCurrentTime: (time: number) => void;
}) {
  const [popupOpen, setPopupOpen] = useState(false);
  const popupWindowRef = useRef<Window | null>(null);
  const popupChannelRef = useRef<BroadcastChannel | null>(null);
  const vizAnalyserRef = useRef<AnalyserNode | null>(null);
  const vizIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioSourceRef = useRef<AudioSource>(audioSource);
  const audioSourceStateRef = useRef<AudioSourceState>(audioSourceState);

  useEffect(() => {
    audioSourceRef.current = audioSource;
  }, [audioSource]);

  useEffect(() => {
    audioSourceStateRef.current = audioSourceState;
  }, [audioSourceState]);

  const broadcastPopupState = useCallback(() => {
    const channel = popupChannelRef.current;
    if (!channel) return;
    const state = usePlayerStore.getState();
    const message: PlayerPopupStateMessage = {
      type: "state",
      payload: {
        track: state.currentTrack,
        isPlaying: state.isPlaying,
        currentTime: audioRef.current?.currentTime || 0,
        duration: audioRef.current?.duration || 0,
        audioSource: audioSourceRef.current,
        audioSourceState: audioSourceStateRef.current,
        hasNext: state.queue.length > 0,
        hasPrevious: state.history.length > 0 || (audioRef.current?.currentTime || 0) > 3,
      },
    };
    channel.postMessage(message);
  }, [audioRef]);

  const startVizBroadcast = useCallback(() => {
    if (vizIntervalRef.current || !audioRef.current) return;
    try {
      const { sourceNode } = getSharedAudioGraph(audioRef.current);
      if (!vizAnalyserRef.current) {
        const analyser = sourceNode.context.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.7;
        sourceNode.connect(analyser);
        vizAnalyserRef.current = analyser;
      }
      const analyser = vizAnalyserRef.current;
      const data = new Uint8Array(analyser.frequencyBinCount);
      vizIntervalRef.current = setInterval(() => {
        const channel = popupChannelRef.current;
        if (!channel) return;
        analyser.getByteFrequencyData(data);
        const message: PlayerPopupVizMessage = { type: "viz", payload: { data } };
        channel.postMessage(message);
      }, 50);
    } catch (e) {
      console.warn("[Player] viz broadcast start error:", e);
    }
  }, [audioRef]);

  const stopVizBroadcast = useCallback(() => {
    if (vizIntervalRef.current) {
      clearInterval(vizIntervalRef.current);
      vizIntervalRef.current = null;
    }
  }, []);

  const controlHandlersRef = useRef({
    togglePlay,
    handleNext,
    handlePrevious,
    broadcastPopupState,
    startVizBroadcast,
    stopVizBroadcast,
  });

  useEffect(() => {
    controlHandlersRef.current = {
      togglePlay,
      handleNext,
      handlePrevious,
      broadcastPopupState,
      startVizBroadcast,
      stopVizBroadcast,
    };
  });

  useEffect(() => {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;
    const channel = new BroadcastChannel(PLAYER_POPUP_CHANNEL);
    popupChannelRef.current = channel;

    channel.onmessage = (event: MessageEvent<PlayerPopupMessage>) => {
      const data = event.data;
      if (!data) return;
      const handlers = controlHandlersRef.current;

      if (data.type === "request-state") {
        handlers.broadcastPopupState();
        return;
      }

      if (data.type === "control") {
        if (data.action === "toggle-play") handlers.togglePlay();
        else if (data.action === "next") handlers.handleNext();
        else if (data.action === "previous") handlers.handlePrevious();
        else if (data.action === "seek" && typeof data.value === "number" && audioRef.current) {
          audioRef.current.currentTime = data.value;
          setCurrentTime(data.value);
        } else if (data.action === "viz-subscribe") handlers.startVizBroadcast();
        else if (data.action === "viz-unsubscribe") handlers.stopVizBroadcast();
      }
    };

    return () => {
      channel.close();
      popupChannelRef.current = null;
      stopVizBroadcast();
    };
  }, [audioRef, setCurrentTime, stopVizBroadcast]);

  // Sync popup state when underlying playback values change
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const queueLength = usePlayerStore((s) => s.queue.length);
  const historyLength = usePlayerStore((s) => s.history.length);

  useEffect(() => {
    broadcastPopupState();
  }, [
    currentTrack,
    isPlaying,
    queueLength,
    historyLength,
    audioSource,
    audioSourceState,
    broadcastPopupState,
  ]);

  // Poll window closed state. There is no event for "the user closed the popup",
  // hence the poll — but it only needs to run while a popup is actually open,
  // rather than every second for the whole session in the common case where one
  // is never opened at all.
  useEffect(() => {
    if (!popupOpen) return;
    const interval = setInterval(() => {
      if (popupWindowRef.current?.closed) {
        popupWindowRef.current = null;
        setPopupOpen(false);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [popupOpen]);

  const handlePopOutPlayer = useCallback(() => {
    if (typeof window === "undefined") return;
    if (popupWindowRef.current && !popupWindowRef.current.closed) {
      popupWindowRef.current.close();
      popupWindowRef.current = null;
      setPopupOpen(false);
      return;
    }
    const popup = window.open(
      "/player-window",
      PLAYER_POPUP_WINDOW_NAME,
      "width=1100,height=720,menubar=no,toolbar=no,location=no,status=no"
    );
    if (popup) {
      popupWindowRef.current = popup;
      popup.focus();
      setPopupOpen(true);
    }
  }, []);

  return {
    popupOpen,
    handlePopOutPlayer,
    broadcastPopupState,
    popupChannelRef,
  };
}
