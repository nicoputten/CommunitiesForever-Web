// A stand-in for Everloot's population tool (WEB-109, WEB-108's census), for the e2e and design servers: made-up
// counts so the Hunt targets grid, the draw shares and "seen this week" have data. Never the real census, never the
// network. `node tests/design/everloot-stub.mjs <port>`; answers `GET /api/tools/population?faction=&class=&window=week`
// like Everloot (see tests/server/hunt.test.ts `everloot()`), and `GET /` for Playwright's readiness check.
import { createServer } from "node:http";

const port = Number(process.argv[2] ?? 3291);

const RACES = {
  Alliance: ["Human", "Dwarf", "Night Elf", "Gnome", "Skyborne"],
  Horde: ["Orc", "Undead", "Tauren", "Troll", "Skyborne"],
};
const CLASSES = ["WARRIOR", "PALADIN", "HUNTER", "ROGUE", "PRIEST", "SHAMAN", "MAGE", "WARLOCK", "DRUID"];

/** Made-up counts, rounded to 5: a spread from 40 to 400, a few too rare to draw (under 30), one not recorded. */
const RARE = { "Dwarf:ROGUE": 20, "Skyborne:WARRIOR": 10, "Troll:PRIEST": 25 };
const MISSING = new Set(["Skyborne:ROGUE"]);

function count(faction, race, cls) {
  const key = `${race}:${cls}`;
  if (RARE[key] !== undefined) return RARE[key];
  const r = RACES[faction].indexOf(race);
  const c = CLASSES.indexOf(cls);
  return 40 + ((r * 7 + c * 13 + (faction === "Horde" ? 3 : 0)) % 9) * 45;
}

createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
  if (url.pathname !== "/api/tools/population") {
    res.writeHead(200, { "content-type": "text/plain" }).end("ok");
    return;
  }
  const faction = url.searchParams.get("faction") === "Horde" ? "Horde" : "Alliance";
  const cls = (url.searchParams.get("class") ?? "").toUpperCase();
  const cells = RACES[faction]
    .filter((race) => !MISSING.has(`${race}:${cls}`))
    .map((race) => ({ slice: "raceClass", faction, race, class: cls, count: count(faction, race, cls) }));
  const body = {
    tool: "population",
    answer: {
      dataAsOf: "2026-11-09T20:00:00.000Z",
      page: {
        window: { id: "week", from: "2026-11-03T20:00:00.000Z", to: "2026-11-09T20:00:00.000Z" },
        characters: 16400,
        installs: 13,
        rule: { roundTo: 5 },
        cells,
      },
    },
  };
  res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(body));
}).listen(port, "127.0.0.1");
