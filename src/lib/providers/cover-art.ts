import axios from "axios";
import { getSetting } from "@/lib/settings";
import { generateImagePrompt } from "@/lib/providers/llm";

const PIXAZO_GENERATE_URL = "https://gateway.pixazo.ai/flux-1-schnell/v1/getData";
const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 15;

type PixazoGenerateResponse = {
  output?: string;
  request_id?: string;
};

type PixazoStatusResponse = {
  status?: string;
  output?: {
    media_url?: string[];
  };
  error?: string;
};

export async function generateCoverArt({
  prompt,
  title,
  instrumental,
  lyrics,
}: {
  prompt: string;
  title: string;
  instrumental: boolean;
  lyrics?: string | null;
}): Promise<Buffer> {
  const apiKey = (await getSetting("PIXAZO_API_KEY")) || process.env.PIXAZO_API_KEY || "";

  if (!apiKey) {
    throw new Error("PIXAZO_API_KEY not configured");
  }

  const imagePrompt = await buildImagePrompt({ prompt, title, instrumental, lyrics });

  const generateRes = await axios.post<PixazoGenerateResponse>(
    PIXAZO_GENERATE_URL,
    {
      prompt: imagePrompt,
      width: 1024,
      height: 1024,
      num_steps: 4,
    },
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "Ocp-Apim-Subscription-Key": apiKey,
      },
      timeout: 60000,
    }
  );

  const directUrl = generateRes.data?.output;
  if (directUrl) {
    return await downloadImage(directUrl);
  }

  const requestId = generateRes.data?.request_id;
  if (!requestId) {
    throw new Error(`Pixazo: unexpected response — ${JSON.stringify(generateRes.data)}`);
  }

  for (let i = 0; i < MAX_POLLS; i++) {
    await sleep(POLL_INTERVAL_MS);

    const statusRes = await axios.get<PixazoStatusResponse>(
      `https://gateway.pixazo.ai/v2/requests/status/${requestId}`,
      {
        headers: { "Ocp-Apim-Subscription-Key": apiKey },
        timeout: 10000,
      }
    );

    const status = statusRes.data?.status;

    if (status === "COMPLETED") {
      const mediaUrl = statusRes.data?.output?.media_url?.[0];
      if (!mediaUrl) throw new Error("Pixazo: COMPLETED but no media_url");
      return await downloadImage(mediaUrl);
    }

    if (status === "FAILED" || status === "ERROR") {
      throw new Error(`Pixazo ${status}: ${statusRes.data?.error ?? "unknown"}`);
    }

    console.log(`[cover-art] Pixazo status: ${status} (poll ${i + 1}/${MAX_POLLS})`);
  }

  throw new Error("Pixazo: cover art timed out after 45 seconds");
}

async function downloadImage(url: string): Promise<Buffer> {
  const res = await axios.get(url, { responseType: "arraybuffer", timeout: 30000 });
  return Buffer.from(res.data);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function buildImagePrompt({
  prompt,
  title,
  instrumental,
  lyrics,
}: {
  prompt: string;
  title: string;
  instrumental: boolean;
  lyrics?: string | null;
}): Promise<string> {
  const type = instrumental ? "instrumental" : "vocal";

  let visualSummary: string;
  try {
    visualSummary = await generateImagePrompt(prompt, title, instrumental, lyrics);
  } catch {
    // fallback if LLM fails
    visualSummary = prompt.replace(/[^\w\s,.-]/g, " ").slice(0, 150).trim();
  }

  return (
    `Create an expressive, artsy album cover for a ${type} music track. ` +
    `${visualSummary} ` +
    `Ensure the artwork is rendered in the specified style with high quality, dramatic composition, bold contrast, atmospheric color grading, tactile grain, and layered depth. ` +
    `Square format, no text, no letters, no logos, no watermarks.`
  );
}