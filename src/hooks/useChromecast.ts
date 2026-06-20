"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ── Minimal type declarations for Google Cast SDK ──────────────────────────
declare global {
  interface Window {
    __onGCastApiAvailable?: (isAvailable: boolean) => void;
    cast?: {
      framework: {
        CastContext: {
          getInstance(): CastContext;
        };
        CastContextEventType: {
          SESSION_STATE_CHANGED: string;
          CAST_STATE_CHANGED: string;
        };
        SessionState: Record<string, string>;
        CastState: {
          NO_DEVICES_AVAILABLE: string;
          NOT_CONNECTED: string;
          CONNECTING: string;
          CONNECTED: string;
        };
        RemotePlayer: new () => RemotePlayer;
        RemotePlayerController: new (player: RemotePlayer) => RemotePlayerController;
        RemotePlayerEventType: {
          IS_PAUSED_CHANGED: string;
          CURRENT_TIME_CHANGED: string;
        };
      };
    };
    chrome?: {
      cast: {
        media: {
          DEFAULT_MEDIA_RECEIVER_APP_ID: string;
          MediaInfo: new (contentId: string, contentType: string) => ChromecastMediaInfo;
          LoadRequest: new (mediaInfo: ChromecastMediaInfo) => ChromecastLoadRequest;
          StreamType: { BUFFERED: string; LIVE: string };
          MetadataType: { MUSIC_TRACK: number };
          MusicTrackMediaMetadata: new () => ChromecastMusicMetadata;
        };
        AutoJoinPolicy: { ORIGIN_SCOPED: string };
      };
    };
  }
}

interface RemotePlayer {
  isPaused: boolean;
  currentTime: number;
  duration: number;
  isConnected: boolean;
}

interface RemotePlayerController {
  playOrPause(): void;
  addEventListener(type: string, handler: () => void): void;
  removeEventListener(type: string, handler: () => void): void;
}

interface CastContext {
  setOptions(options: CastOptions): void;
  requestSession(): Promise<void>;
  endCurrentSession(stopCasting: boolean): void;
  getCurrentSession(): CastSession | null;
  getCastState(): string;
  addEventListener(type: string, handler: () => void): void;
  removeEventListener(type: string, handler: () => void): void;
}

interface CastSession {
  loadMedia(request: ChromecastLoadRequest): Promise<void>;
  getMediaSession(): ChromecastActiveMedia | null;
}

interface ChromecastActiveMedia {
  seek(seekRequest: { currentTime: number; callback?: () => void }): void;
}

interface CastOptions {
  receiverApplicationId: string;
  autoJoinPolicy: string;
  resumeSavedSession: boolean;
  /** When false, the SDK does not intercept local <audio>/<video> elements */
  castMediaElements?: boolean;
}

interface ChromecastMediaInfo {
  streamType: string;
  metadata: ChromecastMusicMetadata | null;
  duration: number | undefined;
}

interface ChromecastLoadRequest {
  currentTime?: number;
  autoplay?: boolean;
}

interface ChromecastMusicMetadata {
  metadataType: number;
  title?: string;
  images?: Array<{ url: string }>;
}
// ──────────────────────────────────────────────────────────────────────────

export type CastState = "unavailable" | "idle" | "connecting" | "connected";

export interface CastTrackInfo {
  streamUrl: string;
  contentType: string;
  title?: string;
  coverUrl?: string;
  currentTime?: number;
  duration?: number;
}

const CAST_APP_ID = "CC1AD845"; // Default Media Receiver (no registration needed)
let sdkLoaded = false;
let sdkLoading = false;

function loadCastSdk(): Promise<void> {
  if (sdkLoaded) return Promise.resolve();
  if (sdkLoading) {
    return new Promise((resolve) => {
      const prev = window.__onGCastApiAvailable;
      window.__onGCastApiAvailable = (ok) => {
        prev?.(ok);
        if (ok) resolve();
      };
    });
  }

  sdkLoading = true;
  return new Promise((resolve, reject) => {
    window.__onGCastApiAvailable = (isAvailable) => {
      if (isAvailable) {
        sdkLoaded = true;
        sdkLoading = false;
        resolve();
      } else {
        sdkLoading = false;
        reject(new Error("Cast SDK not available"));
      }
    };

    const script = document.createElement("script");
    script.src = "https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1";
    script.async = true;
    script.onerror = () => {
      sdkLoading = false;
      reject(new Error("Failed to load Cast SDK"));
    };
    document.head.appendChild(script);
  });
}

export function useChromecast() {
  const [castState, setCastState] = useState<CastState>("unavailable");
  const [isRemotePaused, setIsRemotePaused] = useState(true);
  const contextRef = useRef<CastContext | null>(null);
  const remotePlayerRef = useRef<RemotePlayer | null>(null);
  const remoteControllerRef = useRef<RemotePlayerController | null>(null);

  // Initialize Cast SDK
  useEffect(() => {
    if (typeof window === "undefined") return;

    loadCastSdk()
      .then(() => {
        if (!window.cast || !window.chrome?.cast) return;

        const ctx = window.cast.framework.CastContext.getInstance();
        ctx.setOptions({
          receiverApplicationId: window.chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
          autoJoinPolicy: window.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
          resumeSavedSession: false,
          // Prevent the SDK from intercepting local <audio> elements —
          // we want the app player to keep running independently of Cast.
          castMediaElements: false,
        } as CastOptions);
        contextRef.current = ctx;

        // RemotePlayer + Controller track live cast playback state
        const { RemotePlayer, RemotePlayerController, RemotePlayerEventType } = window.cast.framework;
        const rp = new RemotePlayer();
        const rc = new RemotePlayerController(rp);
        remotePlayerRef.current = rp;
        remoteControllerRef.current = rc;
        const handlePauseChange = () => setIsRemotePaused(rp.isPaused);
        rc.addEventListener(RemotePlayerEventType.IS_PAUSED_CHANGED, handlePauseChange);

        const syncState = () => {
          const state = ctx.getCastState();
          const { CastState } = window.cast!.framework;
          if (state === CastState.NO_DEVICES_AVAILABLE) setCastState("unavailable");
          else if (state === CastState.CONNECTED) setCastState("connected");
          else if (state === CastState.CONNECTING) setCastState("connecting");
          else setCastState("idle");
        };

        syncState();
        ctx.addEventListener(
          window.cast.framework.CastContextEventType.CAST_STATE_CHANGED,
          syncState
        );
        ctx.addEventListener(
          window.cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
          syncState
        );

        return () => {
          ctx.removeEventListener(
            window.cast!.framework.CastContextEventType.CAST_STATE_CHANGED,
            syncState
          );
          ctx.removeEventListener(
            window.cast!.framework.CastContextEventType.SESSION_STATE_CHANGED,
            syncState
          );
        };
      })
      .catch(() => {
        // Cast not available (non-Chrome browser or blocked)
        setCastState("unavailable");
      });
  }, []);

  // Step 1: open the device-picker dialog immediately on user gesture.
  // Must be called synchronously within the click handler so Chrome treats
  // it as a trusted interaction.
  const requestCastSession = useCallback(async (): Promise<boolean> => {
    const ctx = contextRef.current;
    if (!ctx) return false;
    if (castState === "connected") return true;
    try {
      await ctx.requestSession();
      return true;
    } catch {
      return false;
    }
  }, [castState]);

  // Step 2: load media into the already-established Cast session.
  // Call this after fetching the presigned URL (async is fine here because
  // the session is already open — no user-gesture requirement).
  // Returns true on success so the caller can pause local playback.
  const loadCastMedia = useCallback(async (info: CastTrackInfo): Promise<boolean> => {
    const ctx = contextRef.current;
    if (!ctx || !window.chrome?.cast) return false;

    const session = ctx.getCurrentSession();
    if (!session) return false;

    try {
      const { MediaInfo, LoadRequest, StreamType, MetadataType, MusicTrackMediaMetadata } =
        window.chrome.cast.media;

      const mediaInfo = new MediaInfo(info.streamUrl, info.contentType);
      mediaInfo.streamType = StreamType.BUFFERED;

      if (info.title || info.coverUrl) {
        const meta = new MusicTrackMediaMetadata();
        meta.metadataType = MetadataType.MUSIC_TRACK;
        if (info.title) meta.title = info.title;
        if (info.coverUrl) meta.images = [{ url: info.coverUrl }];
        mediaInfo.metadata = meta;
      }

      const request = new LoadRequest(mediaInfo) as ChromecastLoadRequest & {
        currentTime?: number;
        autoplay?: boolean;
      };
      request.autoplay = true;
      if (info.currentTime && info.currentTime > 1) {
        request.currentTime = info.currentTime;
      }

      await session.loadMedia(request as ChromecastLoadRequest);

      // Pause local audio — Chromecast is now playing
      const sharedAudio =
        typeof window !== "undefined"
          ? (window as Window & { __melodiqSharedAudioElement?: HTMLAudioElement })
              .__melodiqSharedAudioElement ?? null
          : null;
      if (sharedAudio && !sharedAudio.paused) {
        sharedAudio.pause();
      }

      return true;
    } catch (err) {
      console.error("Cast load error:", err);
      return false;
    }
  }, []);

  const togglePlayCast = useCallback(() => {
    remoteControllerRef.current?.playOrPause();
  }, []);

  const stopCasting = useCallback(() => {
    contextRef.current?.endCurrentSession(true);
  }, []);

  const seekCast = useCallback((time: number) => {
    const session = contextRef.current?.getCurrentSession();
    const media = session?.getMediaSession();
    if (media) {
      media.seek({ currentTime: time });
    }
  }, []);

  return { castState, isRemotePaused, requestCastSession, loadCastMedia, togglePlayCast, stopCasting, seekCast };
}
