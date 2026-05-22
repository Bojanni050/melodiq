import axios from "axios";
import { getSetting } from "@/lib/settings";

export interface MusicGptConversion {
  task_id: string;
  conversion_id?: string;
  conversion_id_1?: string;
  conversion_id_2?: string;
  status: string;
  status_msg?: string;
  message?: string;
  audio_url?: string;
  conversion_path?: string;
  conversion_path_1?: string;
  conversion_path_2?: string;
  conversion_path_wav_1?: string;
  conversion_path_wav_2?: string;
  album_cover_path?: string;
  conversion_duration_1?: number;
  conversion_duration_2?: number;
  title?: string;
  lyrics?: string;
  lyrics_timestamped_1?: string;
  music_style?: string;
}

export interface GenerateMusicGptRequest {
  prompt: string;
  lyrics?: string;
  instrumental?: boolean;
  model?: string;
  gender?: string;
  webhookUrl: string;
}

export interface GenerateMusicGptResponse {
  taskId: string;
  conversionId1: string;
  conversionId2: string;
  eta: number;
}

export async function getMusicGptConversionById(
  conversionId: string
): Promise<MusicGptConversion | null> {
  const apiKey = (await getSetting("MUSICGPT_API_KEY")) || process.env.MUSICGPT_API_KEY;
  if (!apiKey) throw new Error("MUSICGPT_API_KEY not configured");

  try {
    const response = await axios.get(
      "https://api.musicgpt.com/api/public/v1/byId",
      {
        headers: {
          Authorization: apiKey,
          "Content-Type": "application/json",
        },
        params: {
          conversionType: "MUSIC_AI",
          conversion_id: conversionId,
        },
        timeout: 15000,
      }
    );

    if (response.data?.success && response.data?.conversion) {
      return response.data.conversion as MusicGptConversion;
    }

    return null;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || error.message || "MusicGPT byId lookup failed");
  }
}

export async function generateMusicGpt(
  req: GenerateMusicGptRequest
): Promise<GenerateMusicGptResponse> {
  const apiKey = (await getSetting("MUSICGPT_API_KEY")) || process.env.MUSICGPT_API_KEY;
  if (!apiKey) throw new Error("MUSICGPT_API_KEY not configured");

  const {
    prompt,
    lyrics = "",
    instrumental = false,
    gender = "",
    webhookUrl,
  } = req;

  const payload: any = {
    prompt: prompt.slice(0, 280), // MusicGPT recommends max 280 chars
    music_style: "", // Use prompt as the main input
    lyrics,
    make_instrumental: instrumental,
    webhook_url: webhookUrl,
  };

  if (gender) {
    payload.gender = gender;
  }

  try {
    const response = await axios.post(
      "https://api.musicgpt.com/api/public/v1/MusicAI",
      payload,
      {
        headers: {
          Authorization: apiKey,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    if (!response.data.success) {
      throw new Error(response.data.message || "MusicGPT request failed");
    }

    console.log(`[musicgpt] task submitted — task_id=${response.data.task_id} eta=${response.data.eta}s`);

    return {
      taskId: response.data.task_id,
      conversionId1: response.data.conversion_id_1,
      conversionId2: response.data.conversion_id_2,
      eta: response.data.eta,
    };
  } catch (error: any) {
    if (error.response?.status === 402) {
      throw new Error("Insufficient credits");
    }
    throw new Error(error.response?.data?.message || error.message || "MusicGPT generation failed");
  }
}
