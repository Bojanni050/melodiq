// Wire format for APIMart's Suno inspiration endpoint
// (POST /v1/music/generations/inspo). Kept dependency-free so it can be
// unit-tested without pulling in the settings/db layer: the field names below
// are the contract — the endpoint rejects unknown or missing parameters.

export interface ApimartInspoBodyParams {
  audioUrls: string[];
  version: string;
  tags?: string;
  prompt?: string;
  title?: string;
  negativeTags?: string;
  styleWeight?: number;
  weirdness?: number;
  audioWeight?: number;
  vocalGender?: "Male" | "Female";
  variety?: "off" | "normal" | "high" | "extra" | "max";
  maxMode?: boolean;
  audioFormat?: "mp3" | "m4a" | "wav";
}

/**
 * Builds the request body in the documented shape. Optional fields are only
 * sent when they carry a value; `variety: "off"` and `audio_format: "mp3"` are
 * the API defaults and stay out of the payload.
 */
export function buildApimartInspoBody(params: ApimartInspoBodyParams): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: "suno",
    audio_urls: params.audioUrls,
    version: params.version,
  };

  // The inspo endpoint does not accept custom/instrumental/persona_id/duration.
  if (params.tags) body.tags = params.tags;
  if (params.prompt) body.prompt = params.prompt;
  if (params.title) body.title = params.title;
  if (params.negativeTags) body.negative_tags = params.negativeTags;
  if (typeof params.styleWeight === "number") body.style_weight = params.styleWeight;
  if (typeof params.weirdness === "number") body.weirdness = params.weirdness;
  if (typeof params.audioWeight === "number") body.audio_weight = params.audioWeight;
  if (params.vocalGender) body.vocal_gender = params.vocalGender;
  if (params.variety && params.variety !== "off") body.variety = params.variety;
  if (params.maxMode === true) body.max_mode = true;
  if (params.audioFormat && params.audioFormat !== "mp3") body.audio_format = params.audioFormat;

  return body;
}
