// Runs the standalone build the way the Docker image will (WEB-07): `next start` does not support
// `output: "standalone"`, which leaves static files out of .next/standalone, so copy them in first.
import { cpSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";

const standalone = ".next/standalone";
if (!existsSync(`${standalone}/server.js`)) {
  console.error("No standalone build: run `npm run build` first.");
  process.exit(1);
}
cpSync(".next/static", `${standalone}/.next/static`, { recursive: true });
if (existsSync("public")) cpSync("public", `${standalone}/public`, { recursive: true });

const server = spawn(process.execPath, [`${standalone}/server.js`], { stdio: "inherit" });
server.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.kill(signal));
