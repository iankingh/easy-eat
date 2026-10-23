// Local/Docker preview adapter. Production uses Cloudflare Workers and D1.
import http from "node:http";
import path from "node:path";
import { createLocalD1 } from "./local-d1.mjs";
import worker from "../dist/server/index.js";
const port = Number(process.env.PORT || 8787),
  host = process.env.HOST || "127.0.0.1";
const DB = createLocalD1(
  process.env.LOCAL_DB_PATH ||
    path.resolve(import.meta.dirname, "../.local-data/lunch.sqlite"),
);
const env = { DB, LUNCH_ADMIN_CODE: process.env.LUNCH_ADMIN_CODE || "" };
if (!env.LUNCH_ADMIN_CODE)
  console.warn("LUNCH_ADMIN_CODE is unset; admin actions are disabled.");
const server = http.createServer(async (req, res) => {
  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 65536) {
        res.writeHead(413);
        res.end("Payload too large");
        return;
      }
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks);
    const request = new Request(
      `http://${req.headers.host || `${host}:${port}`}${req.url}`,
      {
        method: req.method,
        headers: req.headers,
        ...(body.length ? { body } : {}),
      },
    );
    const response = await worker.fetch(request, env, {
      waitUntil(promise) {
        promise.catch(console.error);
      },
    });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    res.writeHead(500, { "content-type": "application/json" });
    res.end(
      JSON.stringify({ error: "本機預覽未能完成操作，請檢查伺服器日誌。" }),
    );
  }
});
server.listen(port, host, () =>
  console.log(
    `Local: http://${host}:${port} (local SQLite; production D1 is untouched)`,
  ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () =>
    server.close(() => {
      DB.close();
      process.exit(0);
    }),
  );
