import axios from "axios";
import { getSetting } from "@/lib/settings";

export async function generateLyria({
  prompt,
  lyrics,
  instrumental,
  model,
}: {
  prompt: string;
  lyrics?: string;
  instrumental?: boolean;
  model?: string;
}) {
  const API_KEY = await getSetting("LYRIA_API_KEY");
  const startTime = Date.now();
  try {
    const modelId = model || "lyria-3-clip-preview";
    const textParts: Array<{ type: string; text: string }> = [];

    if (instrumental) {
      textParts.push({ type: "text", text: `Instrumental. ${prompt}` });
    } else {
      textParts.push({ type: "text", text: prompt });
    }

    if (lyrics) {
      textParts.push({ type: "text", text: `Lyrics:\n${lyrics}` });
    }

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`,
      {
        contents: [{ parts: textParts }],
        generationConfig: {
          responseModalities: ["AUDIO"],
        },
      },
      {
        headers: {
          "x-goog-api-key": API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    const audioPart = response.data.candidates?.[0]?.content?.parts?.find(
      (p: any) => p.inline_data?.mime_type?.startsWith("audio/")
    );

    if (!audioPart?.inline_data?.data) {
      throw new Error("No audio data in response");
    }

    const audioBuffer = Buffer.from(audioPart.inline_data.data, "base64");
    const duration = Date.now() - startTime;
    return {
      audioBuffer,
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
