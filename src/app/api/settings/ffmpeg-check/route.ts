import { NextResponse } from "next/server";
import { execFileSync } from "node:child_process";
import { requireAuth } from "@/lib/require-auth";
import ffmpegStatic from "ffmpeg-static";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const result: Record<string, any> = {
    platform: process.platform,
    PATH: process.env.PATH,
    FFMPEG_PATH: process.env.FFMPEG_PATH ?? null,
    ffmpegStatic: ffmpegStatic ?? null,
  };

  // Check system ffmpeg via which/where
  try {
    const whichCmd = process.platform === "win32" ? "where" : "which";
    const out = execFileSync(whichCmd, ["ffmpeg"], { encoding: "utf-8" }).trim();
    result.whichFfmpeg = out || null;
  } catch (e: any) {
    result.whichFfmpeg = null;
    result.whichError = e?.message;
  }

  // Try running ffmpeg -version from system PATH
  try {
    const ver = execFileSync("ffmpeg", ["-version"], { encoding: "utf-8" });
    result.systemFfmpegVersion = ver.split("\n")[0];
  } catch (e: any) {
    result.systemFfmpegVersion = null;
    result.systemFfmpegError = e?.message;
  }

  // Try running ffmpeg-static binary
  if (ffmpegStatic) {
    try {
      const ver = execFileSync(ffmpegStatic, ["-version"], { encoding: "utf-8" });
      result.staticFfmpegVersion = ver.split("\n")[0];
    } catch (e: any) {
      result.staticFfmpegVersion = null;
      result.staticFfmpegError = e?.message;
    }
  }

  return NextResponse.json(result, { status: 200 });
}
