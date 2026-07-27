declare module "music-tempo" {
  export default class MusicTempo {
    constructor(audioData: Float32Array | number[], parameters?: {
      expiryTime?: number;
      maxBeatInterval?: number;
      minBeatInterval?: number;
    });
    tempo: number;
    beats: number[];
  }
}
