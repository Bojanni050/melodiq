import axios from "axios";
import { getSetting } from "@/lib/settings";
import { regroupWordsByLyricsLines } from "../ttml";
import type { AlignmentEngine, AlignmentInput } from "../engine";
import type { TclDocument } from "../types";

const FORCED_ALIGNMENT_URL = "https://api.elevenlabs.io/v1/forced-alignment";

interface ElevenLabsWord {
  text: string;
  start: number; // seconds
  end: number;
  type?: "word" | "spacing";
}

export const elevenlabsEngine: AlignmentEngine = {
  async align({ audioUrl, lyrics }: AlignmentInput): Promise<TclDocument> {
    const apiKey = await getSetting("ELEVENLABS_API_KEY");
    if (!apiKey) {
      throw new Error("ELEVENLABS_API_KEY is not configured. Add it in Settings.");
    }

    // The endpoint takes a raw audio file, not a URL — fetch it first.
    const audioRes = await axios.get(audioUrl, { responseType: "arraybuffer", timeout: 60000 });

    const plainLyrics = lyrics
      .split("\n")
      .filter((line) => !line.trim().startsWith("["))
      .join("\n");

    const form = new FormData();
    form.append("file", new Blob([audioRes.data]), "audio.mp3");
    form.append("text", plainLyrics);

    let response;
    try {
      response = await axios.post(FORCED_ALIGNMENT_URL, form, {
        headers: { "xi-api-key": apiKey },
        timeout: 90000,
      });
    } catch (error: any) {
      const message =
        error.response?.data?.detail?.message ||
        error.response?.data?.detail ||
        error.message ||
        "ElevenLabs request failed";
      throw new Error(`ElevenLabs alignment failed: ${message}`);
    }

    const words: ElevenLabsWord[] = response.data?.words ?? [];
    const flat = words
      .filter((w) => w.type !== "spacing" && w.text.trim().length > 0)
      .map((w) => ({ word: w.text.trim(), start: w.start, end: w.end }));

    if (flat.length === 0) {
      throw new Error("ElevenLabs returned no aligned words");
    }

    // Same line-chunking helper QuickLRC uses — it only needs a flat word list.
    const doc = regroupWordsByLyricsLines(flat, lyrics);
    if (doc.lines.length === 0) {
      throw new Error("Alignment produced no lines");
    }
    return doc;
  },
};
