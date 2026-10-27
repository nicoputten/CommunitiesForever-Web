import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { getSiteInfo } from "./site";

// The web app manifest (WEB-36), served at /manifest.webmanifest: the site name from the data (CLAUDE.md rule 11, the
// fallback "CommunitiesForever" before the first upload) and Nico's icon set (`design/favicons/`, the PNGs in
// `public/`). Open without a session like the sign-in page, which shows the same name (src/proxy.ts).

/** `--bg-night` (src/styles/tokens.css); tests/server/icons.test.ts keeps them the same. */
export const NIGHT = "#070c15";

/** The manifest for a site name. */
export function manifestFor(name: string): MetadataRoute.Manifest {
  return {
    name,
    short_name: name,
    start_url: "/",
    display: "standalone",
    theme_color: NIGHT,
    background_color: NIGHT,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  // Per request: the name changes with the admin's uploads.
  await connection();
  return manifestFor(getSiteInfo().name);
}
