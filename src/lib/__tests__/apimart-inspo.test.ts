import { describe, expect, it } from "vitest";
import { buildApimartInspoBody } from "@/lib/providers/apimart-inspo";

// Contract test against https://docs.apimart.ai/en/api-reference/audios/suno/inspo
// The endpoint takes 1–4 public audio URLs plus Suno options; the field names
// are snake_case and any stray key comes back as a 400.

describe("buildApimartInspoBody", () => {
  const audioUrls = [
    "https://s3.example.com/tracks/a.mp3?X-Amz-Signature=aaa",
    "https://s3.example.com/tracks/b.mp3?X-Amz-Signature=bbb",
  ];

  it("sends the selected songs as audio_urls, in selection order", () => {
    const body = buildApimartInspoBody({ audioUrls, version: "v6" });

    expect(body.model).toBe("suno");
    expect(body.version).toBe("v6");
    expect(body.audio_urls).toEqual(audioUrls);
  });

  it("maps the studio fields to their documented snake_case names", () => {
    const body = buildApimartInspoBody({
      audioUrls,
      version: "v6-wild",
      tags: "dreamy pop, female vocal",
      prompt: "[Verse]\nhello",
      title: "Test song",
      negativeTags: "metal",
      styleWeight: 0.65,
      weirdness: 0.4,
      audioWeight: 0.2,
      vocalGender: "Female",
      variety: "high",
      maxMode: true,
      audioFormat: "wav",
    });

    expect(body).toMatchObject({
      model: "suno",
      version: "v6-wild",
      tags: "dreamy pop, female vocal",
      prompt: "[Verse]\nhello",
      title: "Test song",
      negative_tags: "metal",
      style_weight: 0.65,
      weirdness: 0.4,
      audio_weight: 0.2,
      vocal_gender: "Female",
      variety: "high",
      max_mode: true,
      audio_format: "wav",
    });
  });

  it("never sends the keys the inspo endpoint rejects", () => {
    const body = buildApimartInspoBody({
      audioUrls,
      version: "v6",
      prompt: "lyrics",
      audioWeight: 0.3,
    });

    for (const rejected of ["custom", "instrumental", "persona_id", "gpt_description", "duration"]) {
      expect(body).not.toHaveProperty(rejected);
    }
  });

  it("leaves defaults and empty values out of the payload", () => {
    const body = buildApimartInspoBody({
      audioUrls,
      version: "v6",
      tags: "",
      prompt: "",
      negativeTags: "",
      variety: "off",
      audioFormat: "mp3",
    });

    expect(Object.keys(body).sort()).toEqual(["audio_urls", "model", "version"]);
  });

  it("keeps a 0 weight instead of dropping it", () => {
    const body = buildApimartInspoBody({ audioUrls, version: "v6", audioWeight: 0, styleWeight: 0 });

    expect(body.audio_weight).toBe(0);
    expect(body.style_weight).toBe(0);
  });
});
