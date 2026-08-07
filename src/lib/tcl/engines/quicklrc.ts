import axios from "axios";
import { getSetting } from "@/lib/settings";
import { parseTtml } from "../ttml";
import type { AlignmentEngine, AlignmentInput } from "../engine";
import type { TclDocument } from "../types";

const QUICKLRC_TRANSCRIBE_URL = "https://www.quicklrc.com/api/v1/transcribe";

export const quicklrcEngine: AlignmentEngine = {
  async align({ audioUrl, lyrics }: AlignmentInput): Promise<TclDocument> {
    const apiKey = await getSetting("QUICKLRC_API_KEY");
    if (!apiKey) {
      throw new Error("QUICKLRC_API_KEY is not configured. Add it in Settings.");
    }

    let response;
    try {
      response = await axios.post(
        QUICKLRC_TRANSCRIBE_URL,
        {
          fileUrl: audioUrl,
          lyrics,
          isWordLevel: true,
          format: "ttml",
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 90000,
          responseType: "text",
        }
      );
    } catch (error: any) {
      const message =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        "QuickLRC request failed";
      throw new Error(`QuickLRC alignment failed: ${message}`);
    }

    const xml = typeof response.data === "string" ? response.data : String(response.data);
    const doc = parseTtml(xml);

    if (doc.lines.length === 0) {
      throw new Error("QuickLRC returned no aligned lines");
    }

    return doc;
  },
};
