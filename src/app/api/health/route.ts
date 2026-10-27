import { getDb } from "@/server/db";

// Health check for Docker's HEALTHCHECK and the TrueNAS app (WEB-07). The one route open without a session besides
// sign-in (CLAUDE.md rule 6, src/proxy.ts), so it says nothing about the data: only whether the database opens (and
// is migrated) and which image version runs.

export const dynamic = "force-dynamic";

export function GET(): Response {
  // The release tag, set at image build time (Dockerfile `APP_VERSION`); "dev" outside the image.
  const version = process.env.APP_VERSION || "dev";
  try {
    getDb().$client.prepare("select 1").get();
  } catch {
    // No error text: it could name paths.
    return Response.json({ ok: false, version }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  return Response.json({ ok: true, version }, { headers: { "cache-control": "no-store" } });
}
