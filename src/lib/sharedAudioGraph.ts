// Single Web Audio graph shared across every consumer that needs to tap the
// playing <audio> element (FullscreenPlayer's AudioVisualizer, the pop-out
// window's frequency broadcaster, the loudness-normalization gain stage,
// etc). An HTMLMediaElement can only ever be passed to
// createMediaElementSource once — the AudioContext + source node must live
// in exactly one place, or the second caller throws.
let audioCtx: AudioContext | null = null;
let sourceNode: MediaElementAudioSourceNode | null = null;
let sourceElement: HTMLAudioElement | null = null;
let normalizationGainNode: GainNode | null = null;
// Applied once the gain node exists, in case a gain was requested before the
// graph was ever initialized (e.g. before the first play gesture).
let pendingGain: number | null = null;

export function getSharedAudioGraph(audioElement: HTMLAudioElement) {
  if (!audioCtx || audioCtx.state === "closed") {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === "suspended") {
    void audioCtx.resume();
  }
  if (!sourceNode || sourceElement !== audioElement) {
    sourceNode = audioCtx.createMediaElementSource(audioElement);
    normalizationGainNode = audioCtx.createGain();
    normalizationGainNode.gain.value = pendingGain ?? 1;
    sourceNode.connect(normalizationGainNode);
    normalizationGainNode.connect(audioCtx.destination);
    sourceElement = audioElement;
  }
  return { audioCtx, sourceNode, normalizationGainNode: normalizationGainNode! };
}

/**
 * Sets the loudness-normalization multiplier (1 = unchanged, >1 = boost,
 * <1 = cut) applied uniformly to whatever is currently playing — a single
 * scalar, so it rebalances level between tracks without touching dynamics.
 * Ramps smoothly to avoid an audible click on track/setting changes. Safe to
 * call before the graph exists; the value is applied once it's created.
 */
export function setNormalizationGain(value: number): void {
  pendingGain = value;
  if (!audioCtx || !normalizationGainNode) return;
  const now = audioCtx.currentTime;
  normalizationGainNode.gain.cancelScheduledValues(now);
  normalizationGainNode.gain.setTargetAtTime(value, now, 0.15);
}
