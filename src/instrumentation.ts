export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initializeDatabase } = await import("./db/init");
    const { ensureWorkspaceSchema } = await import("./lib/workspaces");

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) return;

    await initializeDatabase();
    await ensureWorkspaceSchema();
  }
}
