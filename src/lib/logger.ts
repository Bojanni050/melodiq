import { prisma } from "./prisma";

export async function logApi({
  userId,
  type,
  provider,
  endpoint,
  request,
  response,
  statusCode,
  duration,
}: {
  userId?: string | null;
  type: string;
  provider: string;
  endpoint: string;
  request: string;
  response?: string;
  statusCode?: number;
  duration?: number;
}) {
  if (process.env.ENABLE_API_LOGGING !== "true") return;
  try {
    await prisma.apiLog.create({
      data: {
        userId,
        type,
        provider,
        endpoint,
        request,
        response,
        statusCode,
        duration,
      },
    });
  } catch (e) {
    console.error("Failed to log API call:", e);
  }
}
