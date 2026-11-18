import { describe, expect, it } from "vitest";
import { buildApimartPersonaBody } from "@/lib/providers/apimart-persona";

// Contract test against https://docs.apimart.ai/en/api-reference/audios/suno/persona
// The endpoint refuses a submission without `name` and references the source
// track by `task_id` + a 1-based `audio_index`.

describe("buildApimartPersonaBody", () => {
  it("references the source generation and names the persona", () => {
    const body = buildApimartPersonaBody({
      taskId: "task_01M7KQJK4TW7E4N458H3F9797P",
      audioIndex: 2,
      name: "Geen Huisdier",
    });

    expect(body).toEqual({
      model: "suno",
      task_id: "task_01M7KQJK4TW7E4N458H3F9797P",
      audio_index: 2,
      name: "Geen Huisdier",
    });
  });

  it("defaults to the first track of the generation", () => {
    const body = buildApimartPersonaBody({
      taskId: "task_abc",
      name: "Stem",
    });

    expect(body.audio_index).toBe(1);
  });

  it("bounds the voice clip only when a window is given", () => {
    expect(buildApimartPersonaBody({ taskId: "task_abc", name: "Stem" })).not.toHaveProperty(
      "vocal_start_s"
    );

    const body = buildApimartPersonaBody({
      taskId: "task_abc",
      name: "Stem",
      vocalStartS: 0,
      vocalEndS: 120,
    });

    expect(body.vocal_start_s).toBe(0);
    expect(body.vocal_end_s).toBe(120);
  });
});
