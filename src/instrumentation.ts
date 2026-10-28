// Runs once when the server starts (Next.js instrumentation, WEB-07): opens the database, which applies pending
// migrations (src/server/db openDatabase), so a new image migrates at start rather than on the first request, and a
// database that can't be opened stops the server at once. Then checks every minute whether the weekly recap is due
// (WEB-41c, src/server/recap.ts): at start too, so a recap missed during downtime comes at once. The same minute
// writes Doomsday's board and ladder posts when a reset passed (WEB-58, src/server/doomsdayPosts.ts).

const RECAP_CHECK_MS = 60_000;

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getDb } = await import("@/server/db");
  getDb();
  const { nowSeconds } = await import("@/app/clock");
  const { getSiteInfo } = await import("@/app/site");
  const { runDueRecap } = await import("@/server/recap");
  const { runDueDoomsday } = await import("@/server/doomsdayPosts");
  const check = () => {
    try {
      runDueRecap(getDb(), nowSeconds(), getSiteInfo().name);
    } catch (e) {
      // Never stop the server for the recap; the next minute tries again.
      console.error(`recap: ${e instanceof Error ? e.message : "failed"}`);
    }
    try {
      runDueDoomsday(getDb(), nowSeconds());
    } catch (e) {
      console.error(`doomsday: ${e instanceof Error ? e.message : "failed"}`);
    }
  };
  check();
  setInterval(check, RECAP_CHECK_MS).unref();
}
