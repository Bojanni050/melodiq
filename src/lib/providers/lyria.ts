import axios from "axios";
import { getSetting } from "@/lib/settings";

async function fetchLyriaAudio({
  promptText,
  lyrics,
  modelId,
  apiKey,
  responseFormat,
}: {
  promptText: string;
  lyrics?: string;
  modelId: string;
  apiKey: string;
  responseFormat?: { mimeType: { audioType: string } };
}) {
  const generationConfig: Record<string, unknown> = {
    responseModalities: ["AUDIO"],
  };

  if (responseFormat) {
    generationConfig.responseFormat = responseFormat;
  }

  const requestBody: Record<string, unknown> = {
    contents: [{
      parts: [
        { text: promptText },
        ...(lyrics ? [{ text: `Lyrics:\n${lyrics}` }] : []),
      ],
    }],
    generationConfig,
  };

  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`,
    requestBody,
    {
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
    }
  );

  const audioPart = response.data.candidates?.[0]?.content?.parts?.find(
    (p: any) => {
      const inlineData = p.inlineData || p.inline_data;
      const mimeType = inlineData?.mimeType || inlineData?.mime_type;
      return mimeType?.startsWith("audio/");
    }
  );

  const inlineData = audioPart?.inlineData || audioPart?.inline_data;
  const mimeType = inlineData?.mimeType || inlineData?.mime_type;
  const data = inlineData?.data;

  if (!data) {
    throw new Error("No audio data in response");
  }

  return {
    audioBuffer: Buffer.from(data, "base64"),
    mimeType,
  };
}

export async function generateLyria({
  prompt,
  lyrics,
  instrumental,
  model,
  returnBothFormats,
}: {
  prompt: string;
  lyrics?: string;
  instrumental?: boolean;
  model?: string;
  returnBothFormats?: boolean;
}) {
  const API_KEY = await getSetting("LYRIA_API_KEY");
  const startTime = Date.now();
  try {
    // Normalize model ID to valid API model ID
    const MODEL_MAP: Record<string, string> = {
      "lyria-3": "lyria-3-pro-preview",
      "lyria-3-clip": "lyria-3-clip-preview",
      "lyria-3-pro": "lyria-3-pro-preview",
    };
    const rawModel = model || "lyria-3-pro-preview";
    const modelId = MODEL_MAP[rawModel] || rawModel;
    const promptText = instrumental ? `Instrumental. ${prompt}` : prompt;

    // Check if model supports WAV (only Pro does)
    const supportsWav = modelId.includes("-pro-");
    const shouldFetchBoth = returnBothFormats && supportsWav;

    if (shouldFetchBoth) {
      const [mp3Result, wavResult] = await Promise.all([
        fetchLyriaAudio({ promptText, lyrics, modelId, apiKey: API_KEY }),
        fetchLyriaAudio({
          promptText,
          lyrics,
          modelId,
          apiKey: API_KEY,
          responseFormat: { mimeType: { audioType: "audio/wav" } },
        }),
      ]);

      const duration = Date.now() - startTime;
      return {
        audioBuffer: mp3Result.audioBuffer,
        mimeType: mp3Result.mimeType,
        audioBufferHd: wavResult.audioBuffer,
        mimeTypeHd: wavResult.mimeType,
        duration,
        jobId: null,
      };
    }

    const result = await fetchLyriaAudio({ promptText, lyrics, modelId, apiKey: API_KEY });
    const duration = Date.now() - startTime;
    return {
      audioBuffer: result.audioBuffer,
      mimeType: result.mimeType,
      audioBufferHd: null,
      mimeTypeHd: null,
      duration,
      jobId: null,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    const isCopyright =
      error.response?.status === 400 &&
      /copyright|policy|blocked/i.test(error.response?.data?.error?.message || "");
    throw {
      message: isCopyright
        ? "COPYRIGHT"
        : error.response?.data?.error?.message || error.message,
      duration,
      statusCode: error.response?.status,
    };
  }
}
