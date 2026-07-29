import axios from "axios";
import { getSetting } from "@/lib/settings";

const APIMART_BASE_URL = "https://api.apimart.ai/v1/music";

export interface ApimartGenerationParams {
  prompt: string;
  custom: boolean;
  version: string;
  lyrics?: string;
  title?: string;
  style?: string;
  instrumental?: boolean;
  vocalGender?: "Male" | "Female";
  negativeTags?: string;
  styleWeight?: number;
  weirdnessConstraint?: number;
  audioWeight?: number;
  personaId?: string;
}

export interface ApimartTrackResult {
  audioUrl: string;
  imageUrl?: string;
  title?: string;
  duration?: number;
}

export interface ApimartTaskStatus {
  status: "pending" | "completed" | "failed";
  progress?: number;
  tracks: ApimartTrackResult[];
  error?: string;
  rawResult?: unknown;
}

async function getApimartApiKey(): Promise<string> {
  const key = (await getSetting("APIMART_API_KEY")) || process.env.APIMART_API_KEY;
  if (!key) throw new Error("APIMART_API_KEY not configured");
  return key;
}

function mapApimartError(error: any): { message: string; statusCode?: number; duration: number } {
  const statusCode = error.response?.status;
  const data = error.response?.data;
  const message =
    data?.error?.message ||
    data?.message ||
    (statusCode === 400 && "Invalid request to APIMart (check version/custom mode fields)") ||
    (statusCode === 401 && "APIMart API key is invalid") ||
    (statusCode === 402 && "APIMart account has insufficient credits") ||
    (statusCode === 403 && "APIMart request forbidden") ||
    (statusCode === 429 && "APIMart rate limit exceeded, try again shortly") ||
    (statusCode && statusCode >= 500 && "APIMart service is temporarily unavailable") ||
    error.message ||
    "APIMart request failed";

  return { message, statusCode, duration: 0 };
}

export async function createApimartGeneration(
  params: ApimartGenerationParams
): Promise<{ taskId: string }> {
  const apiKey = await getApimartApiKey();

  const body: Record<string, any> = {
    model: "suno",
    custom: params.custom,
    version: params.version,
    prompt: params.custom ? params.lyrics : params.prompt,
  };

  if (params.custom) {
    body.instrumental = !!params.instrumental;
    if (params.title) body.title = params.title;
    if (params.style) body.style = params.style;
    if (params.negativeTags) body.negative_tags = params.negativeTags;
    if (typeof params.styleWeight === "number") body.style_weight = params.styleWeight;
    if (typeof params.weirdnessConstraint === "number") body.weirdness_constraint = params.weirdnessConstraint;
    if (typeof params.audioWeight === "number") body.audio_weight = params.audioWeight;
    if (params.personaId) body.persona_id = params.personaId;
  }
  if (params.vocalGender) body.vocal_gender = params.vocalGender;

  try {
    const response = await axios.post(`${APIMART_BASE_URL}/generations`, body, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    });

    const taskId = response.data?.data?.[0]?.task_id;
    if (!taskId) {
      throw new Error(`APIMart returned no task_id. Response: ${JSON.stringify(response.data)}`);
    }

    console.log(`[apimart] generation submitted — taskId=${taskId}`);
    return { taskId };
  } catch (error: any) {
    if (error.response) throw mapApimartError(error);
    throw error;
  }
}

export async function createApimartVoice(audioUrl: string): Promise<{ taskId: string }> {
  const apiKey = await getApimartApiKey();

  try {
    const response = await axios.post(
      `${APIMART_BASE_URL}/generations/createVoice`,
      { model: "suno", audio_url: audioUrl },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    const taskId = response.data?.data?.[0]?.task_id;
    if (!taskId) {
      throw new Error(`APIMart returned no task_id for createVoice. Response: ${JSON.stringify(response.data)}`);
    }

    console.log(`[apimart] voice creation submitted — taskId=${taskId}`);
    return { taskId };
  } catch (error: any) {
    if (error.response) throw mapApimartError(error);
    throw error;
  }
}

export async function createApimartAlignedLyrics(
  taskId: string,
  audioIndex: number
): Promise<{ taskId: string }> {
  const apiKey = await getApimartApiKey();

  try {
    const response = await axios.post(
      `${APIMART_BASE_URL}/generations/alignedLyrics`,
      { model: "suno", task_id: taskId, audio_index: audioIndex },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    const lyricsTaskId = response.data?.data?.[0]?.task_id;
    if (!lyricsTaskId) {
      throw new Error(`APIMart returned no task_id for alignedLyrics. Response: ${JSON.stringify(response.data)}`);
    }

    console.log(`[apimart] aligned lyrics submitted — taskId=${lyricsTaskId}`);
    return { taskId: lyricsTaskId };
  } catch (error: any) {
    if (error.response) throw mapApimartError(error);
    throw error;
  }
}

export async function getApimartRawTaskStatus(taskId: string): Promise<any> {
  const apiKey = await getApimartApiKey();

  try {
    const response = await axios.get(`${APIMART_BASE_URL}/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 15000,
    });
    return response.data;
  } catch (error: any) {
    if (error.response) throw mapApimartError(error);
    throw error;
  }
}

export async function getApimartTaskStatus(taskId: string): Promise<ApimartTaskStatus> {
  const apiKey = await getApimartApiKey();

  try {
    const response = await axios.get(`${APIMART_BASE_URL}/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 15000,
    });

    const data = response.data?.data;
    const rawStatus = (data?.status ?? "pending").toLowerCase();
    const music = Array.isArray(data?.result?.music) ? data.result.music : [];

    return {
      status: rawStatus === "completed" ? "completed" : rawStatus === "failed" ? "failed" : "pending",
      progress: typeof data?.progress === "number" ? data.progress : undefined,
      tracks: music.map((m: any) => ({
        audioUrl: m.audio_url,
        imageUrl: m.image_url,
        title: m.title,
        duration: m.duration,
      })),
      error: data?.error?.message,
      rawResult: data?.result,
    };
  } catch (error: any) {
    if (error.response) throw mapApimartError(error);
    throw error;
  }
}
