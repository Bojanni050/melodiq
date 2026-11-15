declare module "music-tempo" {
  export default class MusicTempo {
    constructor(audioData: Float32Array | number[], parameters?: {
      expiryTime?: number;
      maxBeatInterval?: number;
      minBeatInterval?: number;
      /** Seconds per analysis hop; MusicTempo assumes 10 ms (441 samples at 44.1 kHz). */
      timeStep?: number;
    });
    tempo: number;
    beats: number[];
  }
}
