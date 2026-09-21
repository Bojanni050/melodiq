import { describe, it, expect, vi, beforeEach } from "vitest";
import { usePlayerStore, type Track } from "@/lib/stores/playerStore";

function makeTrack(id: string, audioUrl: string): Track {
  return {
    id,
    title: `Track ${id}`,
    provider: "test",
    providerModel: "test-model",
    prompt: "test prompt",
    status: "done",
    audioUrl,
    audioUrlHd: null,
    s3Key: null,
    s3KeyHd: null,
    s3KeyMp3: null,
    s3KeyOgg: null,
    format: "mp3",
    formatHd: null,
    duration: 120,
    lyrics: null,
    lyricsTimestamps: null,
    createdAt: new Date().toISOString(),
    error: null,
    coverUrl: null,
    s3KeyCover: null,
    s3KeyCoverThumb: null,
  };
}

function makeAudioElement() {
  return {
    src: "",
    currentTime: 0,
    volume: 0.8,
    paused: true,
    readyState: 4,
    error: null,
    dataset: {} as Record<string, string>,
    pause: vi.fn(function (this: any) {
      this.paused = true;
    }),
    load: vi.fn(),
    play: vi.fn(function (this: any) {
      this.paused = false;
      return Promise.resolve();
    }),
  };
}

describe("player track switching (A -> B gesture)", () => {
  beforeEach(() => {
    usePlayerStore.setState({
      currentTrack: null,
      queue: [],
      history: [],
      isPlaying: false,
      playContext: null,
      audioElement: null,
    });
    vi.restoreAllMocks();
  });

  it("switches audio src from A to B on consecutive gestures", async () => {
    const store = usePlayerStore.getState();
    const audio = makeAudioElement();
    store.setAudioElement(audio as unknown as HTMLAudioElement);

    const trackA = makeTrack("track-a", "https://example.com/a.mp3");
    const trackB = makeTrack("track-b", "https://example.com/b.mp3");

    // Capture rAF callbacks so we can flush them deterministically
    const rafCallbacks: FrameRequestCallback[] = [];
    vi.stubGlobal(
      "requestAnimationFrame",
      (cb: FrameRequestCallback) => {
        rafCallbacks.push(cb);
        return rafCallbacks.length;
      }
    );
    const flushRaf = () => {
      const pending = rafCallbacks.splice(0);
      pending.forEach((cb) => cb(0));
    };

    // Play A
    usePlayerStore.getState().playTrackFromGesture(trackA);
    expect(usePlayerStore.getState().currentTrack?.id).toBe("track-a");
    flushRaf();
    await Promise.resolve();
    expect(audio.src).toContain("a.mp3");
    expect(audio.play).toHaveBeenCalled();

    // Now switch to B while A is "playing"
    audio.paused = false;
    usePlayerStore.getState().playTrackFromGesture(trackB);
    expect(usePlayerStore.getState().currentTrack?.id).toBe("track-b");
    flushRaf();
    await Promise.resolve();

    expect(audio.src).toContain("b.mp3");
    expect(audio.pause).toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("reloads when the gesture marker is stale after a non-gesture load (autoplay)", async () => {
    const store = usePlayerStore.getState();
    const audio = makeAudioElement();
    store.setAudioElement(audio as unknown as HTMLAudioElement);

    const trackA = makeTrack("track-a", "https://example.com/a.mp3");
    const trackB = makeTrack("track-b", "https://example.com/b.mp3");

    const rafCallbacks: FrameRequestCallback[] = [];
    vi.stubGlobal(
      "requestAnimationFrame",
      (cb: FrameRequestCallback) => {
        rafCallbacks.push(cb);
        return rafCallbacks.length;
      }
    );
    const flushRaf = () => {
      rafCallbacks.splice(0).forEach((cb) => cb(0));
    };
    const gesture = (track: Track) => {
      usePlayerStore.getState().playTrackFromGesture(track);
      flushRaf();
    };

    // 1. User plays B via gesture
    gesture(trackB);
    await Promise.resolve();
    expect(audio.src).toContain("b.mp3");

    // 2. Autoplay advances to A WITHOUT touching dataset markers
    // (playNext only sets currentTrack; the Player effect swaps .src).
    // Simulate the effect's full-load swap, old behavior: marker untouched.
    usePlayerStore.getState().setCurrentTrack(trackA);
    audio.src = "https://example.com/a.mp3";
    expect(audio.dataset.gestureTrackId).toBe("track-b"); // stale!
    expect(usePlayerStore.getState().currentTrack?.id).toBe("track-a");

    // 3. User clicks B again -> must actually reload B, not resume A
    const loadsBefore = audio.load.mock.calls.length;
    gesture(trackB);
    await Promise.resolve();

    expect(usePlayerStore.getState().currentTrack?.id).toBe("track-b");
    expect(audio.src).toContain("b.mp3");
    expect(audio.load.mock.calls.length).toBeGreaterThan(loadsBefore);

    vi.unstubAllGlobals();
  });

  it("still skips reload when the same track is genuinely loaded", async () => {
    const store = usePlayerStore.getState();
    const audio = makeAudioElement();
    store.setAudioElement(audio as unknown as HTMLAudioElement);

    const trackB = makeTrack("track-b", "https://example.com/b.mp3");

    const rafCallbacks: FrameRequestCallback[] = [];
    vi.stubGlobal(
      "requestAnimationFrame",
      (cb: FrameRequestCallback) => {
        rafCallbacks.push(cb);
        return rafCallbacks.length;
      }
    );
    const flushRaf = () => {
      rafCallbacks.splice(0).forEach((cb) => cb(0));
    };

    usePlayerStore.getState().playTrackFromGesture(trackB);
    flushRaf();
    await Promise.resolve();
    expect(audio.src).toContain("b.mp3");

    // Clicking the already-loaded track again (e.g. detail-panel replay)
    // must NOT restart it from 0.
    const loadsBefore = audio.load.mock.calls.length;
    usePlayerStore.getState().playTrackFromGesture(trackB);
    flushRaf();
    await Promise.resolve();

    expect(audio.load.mock.calls.length).toBe(loadsBefore);
    expect(audio.play).toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
