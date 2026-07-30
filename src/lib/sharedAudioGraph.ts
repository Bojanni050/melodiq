// Single Web Audio graph shared across every consumer that needs to tap the
// playing <audio> element (FullscreenPlayer's AudioVisualizer, the pop-out
// window's frequency broadcaster, etc). An HTMLMediaElement can only ever be
// passed to createMediaElementSource once — the AudioContext + source node
// must live in exactly one place, or the second caller throws.
let audioCtx: AudioContext | null = null;
let sourceNode: MediaElementAudioSourceNode | null = null;
let sourceElement: HTMLAudioElement | null = null;

export function getSharedAudioGraph(audioElement: HTMLAudioElement) {
  if (!audioCtx || audioCtx.state === "closed") {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === "suspended") {
    void audioCtx.resume();
  }
  if (!sourceNode || sourceElement !== audioElement) {
    sourceNode = audioCtx.createMediaElementSource(audioElement);
    sourceNode.connect(audioCtx.destination);
    sourceElement = audioElement;
  }
  return { audioCtx, sourceNode };
}
