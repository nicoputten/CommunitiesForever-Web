// Runs once when the server starts (Next.js instrumentation, WEB-07): opens the database, which applies pending
// migrations (src/server/db openDatabase), so a new image migrates at start rather than on the first request, and a
// database that can't be opened stops the server at once.

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getDb } = await import("@/server/db");
  getDb();
}
