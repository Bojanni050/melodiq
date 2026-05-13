import axios from "axios";

const API_KEY = process.env.LYRIA_API_KEY || "";

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
  const startTime = Date.now();
  try {
    const response = await axios.post(
      "https://api.lyria.google.com/v1/generate",
      {
        model: model || "lyria-3",
        prompt,
        lyrics: lyrics || undefined,
        instrumental: instrumental || false,
      },
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        responseType: "arraybuffer",
      }
    );

    const duration = Date.now() - startTime;
    return {
      audioBuffer: Buffer.from(response.data),
      duration,
      jobId: null,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    const isCopyright =
      error.response?.status === 400 &&
      /copyright|policy/i.test(error.response?.data?.message || "");
    throw {
      message: isCopyright
        ? "COPYRIGHT"
        : error.response?.data?.message || error.message,
      duration,
      statusCode: error.response?.status,
    };
  }
}
