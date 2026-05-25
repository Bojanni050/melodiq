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
    const parts: Array<{ text: string }> = [];

    if (instrumental) {
      parts.push({ text: `Instrumental. ${prompt}` });
    } else {
      parts.push({ text: prompt });
    }

    if (lyrics) {
      parts.push({ text: `Lyrics:\n${lyrics}` });
    }

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`,
      {
        contents: [{ role: "user", parts }],
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

    const audioBuffer = Buffer.from(data, "base64");
    const duration = Date.now() - startTime;
    return {
      audioBuffer,
      mimeType,
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
