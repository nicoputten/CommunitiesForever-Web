import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { DB_FILE, openDatabase } from "@/server/db";
import { writeItemDatabase } from "@/server/itemDb";
import { SAMPLE_ICONS, SAMPLE_ITEM_DATABASE } from "./sampleItems";

// WEB-92: the sample item database and its icons for a test server (design checks, e2e), written straight into its
// data directory as `npm run import:items` and the icon cache would. The icons are invented pictures drawn by the
// browser (a coloured square with a letter), so the screens never fetch from a CDN and screenshots stay the same.

const COLOURS = ["#6b4c9a", "#2f5f8f", "#3d7a3d", "#8a6d3b", "#7a3d3d", "#3d6f7a", "#5a5a6e"];

export async function seedItems(page: Page, dataDir: string): Promise<void> {
  const db = openDatabase(path.join(dataDir, DB_FILE));
  try {
    writeItemDatabase(db, SAMPLE_ITEM_DATABASE, { build: "sample", era: "sample", cmangos: "sample" }, 0);
  } finally {
    db.$client.close();
  }
  const dir = path.join(dataDir, "icons");
  mkdirSync(dir, { recursive: true });
  for (const [i, name] of SAMPLE_ICONS.entries()) {
    const file = path.join(dir, `${name}.jpg`);
    if (existsSync(file)) continue;
    const dataUrl = await page.evaluate(
      ([colour, letter]) => {
        const canvas = document.createElement("canvas");
        canvas.width = 56;
        canvas.height = 56;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = colour!;
        ctx.fillRect(0, 0, 56, 56);
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.font = "bold 28px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(letter!, 28, 30);
        return canvas.toDataURL("image/jpeg", 0.9);
      },
      [COLOURS[i % COLOURS.length]!, name === "inv_misc_questionmark" ? "?" : name.replace("sample_", "")[0]!.toUpperCase()],
    );
    writeFileSync(file, Buffer.from(dataUrl.split(",")[1]!, "base64"));
  }
}
