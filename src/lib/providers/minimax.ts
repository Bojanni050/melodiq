import axios from "axios";
import { getSetting } from "@/lib/settings";

export async function generateMinimax({
  prompt,
  lyrics,
  instrumental,
}: {
  prompt: string;
  lyrics?: string;
  instrumental?: boolean;
}) {
  const API_KEY = await getSetting("MINIMAX_API_KEY");
  const startTime = Date.now();

  try {
    const response = await axios.post(
      "https://api.minimax.io/v1/music_generation",
      {
        model: "music-2.6",
        prompt,
        lyrics: instrumental ? "[Instrumental]" : (lyrics || undefined),
        is_instrumental: instrumental || false,
        audio_setting: {
          sample_rate: 44100,
          bitrate: 256000,
          format: "mp3",
        },
        output_format: "url",
      },
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 120000,
      }
    );

    const baseResp = response.data?.base_resp;
    if (baseResp?.status_code !== 0) {
      const statusMsg = baseResp?.status_msg || "Minimax generation failed";
      const isRateLimit = baseResp?.status_code === 1;
      const isCopyright = baseResp?.status_code === 1026;
      throw {
        message: isCopyright ? "COPYRIGHT" : statusMsg,
        duration: Date.now() - startTime,
        statusCode: isRateLimit ? 429 : 500,
        minimaxCode: baseResp?.status_code,
      };
    }

    const audioUrl = response.data?.data?.audio;
    if (!audioUrl) {
      throw {
        message: "Minimax returned no audio URL",
        duration: Date.now() - startTime,
        statusCode: 500,
      };
    }

    // Download audio from the URL
    const audioResponse = await axios.get(audioUrl, {
      responseType: "arraybuffer",
      timeout: 60000,
    });

    const audioBuffer = Buffer.from(audioResponse.data);
    const duration = Date.now() - startTime;

    return {
      audioBuffer,
      mimeType: "audio/mpeg",
      duration,
      jobId: null,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    if (error.minimaxCode) {
      throw error;
    }
    const isCopyright =
      error.response?.status === 400 &&
      /copyright|policy|sensitive/i.test(error.response?.data?.base_resp?.status_msg || error.message || "");
    throw {
      message: isCopyright
        ? "COPYRIGHT"
        : error.response?.data?.base_resp?.status_msg || error.message,
      duration,
      statusCode: error.response?.status,
    };
  }
}

export async function getMinimaxCredits() {
  const API_KEY = await getSetting("MINIMAX_API_KEY");
  try {
    const response = await axios.get(
      "https://api.minimax.io/v1/user_balance",
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
        },
        timeout: 10000,
      }
    );
    return response.data?.data?.balance ?? null;
  } catch {
    return null;
  }
}
