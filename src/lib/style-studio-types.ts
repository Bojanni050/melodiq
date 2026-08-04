import type { StyleDraftPayload } from "@/lib/style-studio-constants";

export type StyleSnapshot = {
  id: string;
  name: string;
  createdAt: string;
  payload: StyleDraftPayload;
};

export type StyleNotice = {
  type: "error" | "success" | "info";
  message: string;
};

export type StyleConfirmAction = "clearAll" | "replaceStyle" | null;
