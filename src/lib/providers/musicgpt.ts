import axios from "axios";
import { getSetting } from "@/lib/settings";

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
