/**
 * Body builder for POST /generations, kept in its own module so the rules that
 * APIMart enforces (custom mode, custom_model_id vs persona_id/version) can be
 * unit-tested without axios or settings.
 */

export interface ApimartGenerationParams {
  prompt: string;
  custom: boolean;
  version: string;
  /** Only sent in custom mode: APIMart's `prompt` field carries the lyrics. */
  lyrics?: string;
  title?: string;
  style?: string;
  instrumental?: boolean;
  vocalGender?: "Male" | "Female";
  /** 0–1 */
  styleWeight?: number;
  /** 0–1 */
  weirdnessConstraint?: number;
  /** 0–1 */
  audioWeight?: number;
  negativeTags?: string;
  variety?: "off" | "normal" | "high" | "extra" | "max";
  maxMode?: boolean;
  audioFormat?: "mp3" | "m4a" | "wav";
  durationS?: number;
  /** APIMart persona id (cloned voice). Excluded by `customModelId`. */
  personaId?: string;
  /** APIMart custom model id (trained from the user's own tracks). */
  customModelId?: string;
}

export function buildApimartGenerationBody(params: ApimartGenerationParams): Record<string, any> {
  // A custom model is only usable in custom mode, so it forces it — the prompt
  // field must therefore already carry the lyrics, not the style string.
  const custom = params.custom || Boolean(params.customModelId);

  const body: Record<string, any> = {
    model: "suno",
    custom,
    prompt: custom ? params.lyrics : params.prompt,
  };

  // custom_model_id is mutually exclusive with version per the docs, so the
  // version is only sent when no model is picked.
  if (!params.customModelId) body.version = params.version;

  if (custom) {
    body.instrumental = !!params.instrumental;
    if (params.title) body.title = params.title;
    if (params.style) body.style = params.style;
    if (params.negativeTags) body.negative_tags = params.negativeTags;
    if (typeof params.styleWeight === "number") body.style_weight = params.styleWeight;
    if (typeof params.weirdnessConstraint === "number") body.weirdness_constraint = params.weirdnessConstraint;
    if (typeof params.audioWeight === "number") body.audio_weight = params.audioWeight;
    // Same exclusivity the other way around: the persona gives way to the model
    // rather than letting APIMart reject the request as a 400.
    if (params.personaId && !params.customModelId) body.persona_id = params.personaId;
  }
  if (params.vocalGender) body.vocal_gender = params.vocalGender;

  if (params.customModelId) body.custom_model_id = params.customModelId;

  // V6-specific options (only send when explicitly set)
  if (params.variety && params.variety !== "off") body.variety = params.variety;
  if (params.maxMode === true) body.max_mode = true;
  if (params.audioFormat && params.audioFormat !== "mp3") body.audio_format = params.audioFormat;
  if (typeof params.durationS === "number" && params.durationS >= 10 && params.durationS <= 360) {
    body.duration_s = params.durationS;
  }

  return body;
}
