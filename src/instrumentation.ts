import { initializeDatabase } from "./db/init";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await initializeDatabase();
  }
}
