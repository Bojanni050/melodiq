import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-dev-secret";
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || "7d") as jwt.SignOptions["expiresIn"];

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string };
  } catch {
    return null;
  }
}
