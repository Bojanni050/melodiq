import { describe, expect, it } from "vitest";
import { buildApimartGenerationBody } from "@/lib/providers/apimart-generation-body";

const base = {
  prompt: "dreamy synthwave",
  custom: false,
  version: "v6",
};

describe("buildApimartGenerationBody", () => {
  it("sends the style prompt in non-custom mode, without the custom-only fields", () => {
    const body = buildApimartGenerationBody({
      ...base,
      title: "Not in simple mode",
      style: "Not in simple mode either",
    });

    expect(body).toMatchObject({ model: "suno", custom: false, version: "v6", prompt: "dreamy synthwave" });
    expect(body).not.toHaveProperty("style");
    expect(body).not.toHaveProperty("instrumental");
  });

  it("carries the persona and the custom-only styling in custom mode", () => {
    const body = buildApimartGenerationBody({
      prompt: "dreamy synthwave",
      custom: true,
      version: "v6",
      lyrics: "[Verse]\nhello",
      title: "Neon",
      style: "dreamy synthwave",
      instrumental: false,
      personaId: "persona_123",
      styleWeight: 0.6,
    });

    expect(body).toMatchObject({
      custom: true,
      prompt: "[Verse]\nhello",
      version: "v6",
      title: "Neon",
      style: "dreamy synthwave",
      instrumental: false,
      persona_id: "persona_123",
      style_weight: 0.6,
    });
  });

  it("drops version and persona when a custom model is used, and forces custom mode", () => {
    const body = buildApimartGenerationBody({
      prompt: "dreamy synthwave",
      custom: false,
      version: "v6",
      lyrics: "[Verse]\nhello",
      personaId: "persona_123",
      customModelId: "model_456",
    });

    expect(body.custom_model_id).toBe("model_456");
    expect(body.custom).toBe(true);
    expect(body).not.toHaveProperty("version");
    expect(body).not.toHaveProperty("persona_id");
    // Custom mode sends the lyrics as the prompt.
    expect(body.prompt).toBe("[Verse]\nhello");
  });

  it("only sends V6 options that were explicitly set", () => {
    const plain = buildApimartGenerationBody(base);
    expect(plain).not.toHaveProperty("variety");
    expect(plain).not.toHaveProperty("max_mode");
    expect(plain).not.toHaveProperty("audio_format");

    const tuned = buildApimartGenerationBody({
      ...base,
      variety: "high",
      maxMode: true,
      audioFormat: "wav",
      durationS: 180,
    });
    expect(tuned).toMatchObject({ variety: "high", max_mode: true, audio_format: "wav", duration_s: 180 });
  });

  it("clamps the duration to APIMart's 10–360 second window", () => {
    expect(buildApimartGenerationBody({ ...base, durationS: 5 })).not.toHaveProperty("duration_s");
    expect(buildApimartGenerationBody({ ...base, durationS: 400 })).not.toHaveProperty("duration_s");
  });
});
