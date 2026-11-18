/**
 * Body for APIMart's Singer Persona endpoint.
 *
 * Contract: https://docs.apimart.ai/en/api-reference/audios/suno/persona
 *
 * The endpoint references the source generation by `task_id` plus a 1-based
 * `audio_index`, and requires a `name` — a submission without one is refused
 * with a 400 before anything is billed. The optional `vocal_start_s` /
 * `vocal_end_s` bound the voice clip inside the source track.
 */
export function buildApimartPersonaBody(params: {
  taskId: string;
  audioIndex?: number;
  name: string;
  vocalStartS?: number;
  vocalEndS?: number;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: "suno",
    task_id: params.taskId,
    audio_index: params.audioIndex ?? 1,
    name: params.name,
  };

  if (typeof params.vocalStartS === "number") body.vocal_start_s = params.vocalStartS;
  if (typeof params.vocalEndS === "number") body.vocal_end_s = params.vocalEndS;

  return body;
}
