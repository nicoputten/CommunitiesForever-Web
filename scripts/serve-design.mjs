// Serves design/ so the Claude Design boards can be viewed (their scripts do not load over file://).
import { createReadStream, existsSync, readdirSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve("design");
const port = Number(process.env.PORT ?? 4400);
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".md": "text/plain" };

function index() {
  const boards = readdirSync(join(root, "boards")).flatMap((dir) =>
    readdirSync(join(root, "boards", dir))
      .filter((f) => f.endsWith(".dc.html"))
      .map((f) => `<li><a href="/boards/${encodeURIComponent(dir)}/${encodeURIComponent(f)}">${dir}</a></li>`),
  );
  return `<!doctype html><meta charset="utf-8"><title>Design boards</title><h1>Design boards</h1><ul>${boards.join("")}</ul>`;
}

createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
  if (path === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(index());
    return;
  }
  const file = normalize(join(root, path));
  if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404).end("Not found");
    return;
  }
  res.writeHead(200, { "content-type": `${types[extname(file)] ?? "application/octet-stream"}; charset=utf-8` });
  createReadStream(file).pipe(res);
}).listen(port, "127.0.0.1", () => console.log(`Design boards: http://localhost:${port}`));
