import { getSetting } from "@/lib/settings";

// Server-only — reads the Settings-page value (DB), falling back to the env
// var for first-boot/no-UI-access setups. Same fallback pattern as APP_URL
// and the S3_* settings in src/lib/settings.ts. Never import this from a
// "use client" file: it pulls in the DB client.
export async function getCdnUrl(): Promise<string> {
  const dbValue = await getSetting("CDN_URL");
  return dbValue || process.env.NEXT_PUBLIC_CDN_URL || "";
}
