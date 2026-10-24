import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  rmSync,
  cpSync,
} from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ts from "../easy-eat-front/node_modules/typescript/lib/typescript.js";
const root = path.resolve(import.meta.dirname, "..");
const source = readFileSync(
  path.join(root, "worker/ordering.ts"),
  "utf8",
).replace(/^import \{ env \} from "cloudflare:workers";\s*/m, "");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
  },
  reportDiagnostics: true,
});
if (compiled.diagnostics?.length)
  throw new Error(
    ts.formatDiagnosticsWithColorAndContext(compiled.diagnostics, {
      getCurrentDirectory: () => root,
      getCanonicalFileName: (x) => x,
      getNewLine: () => "\n",
    }),
  );
const apiCode = compiled.outputText.replace(/^export /gm, "");
let provenance = "// Source-Commit: unversioned\n// Source-Tree: unversioned\n";
try {
  const commit = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
  const tree = execFileSync("git", ["rev-parse", "HEAD^{tree}"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
  provenance = `// Source-Commit: ${commit}\n// Source-Tree: ${tree}\n`;
} catch {
  /* Docker preview has no Git metadata; formal releases reject unversioned output. */
}
const assets = {};
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};
function collect(directory, prefix = "") {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name),
      url = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) collect(file, url);
    else
      assets[url] = {
        body: readFileSync(file).toString("base64"),
        type: types[path.extname(file)] || "application/octet-stream",
      };
  }
}
collect(path.join(root, "easy-eat-front/dist"));
if (!assets["/index.html"]) throw new Error("Build the Vue frontend first.");
const worker = `// Generated from worker/ordering.ts and easy-eat-front/dist. Do not edit.\nfunction createApi(env) {\n${apiCode}\nreturn { GET, POST };\n}\nconst assets = ${JSON.stringify(assets)};\nexport default { async fetch(request, env, ctx) {\nconst url = new URL(request.url);\nif (url.pathname === '/api/ordering') {\n const api = createApi(env);\n if (request.method === 'GET') return api.GET(request);\n if (request.method === 'POST') return api.POST(request);\n return new Response('Method not allowed', {status:405,headers:{Allow:'GET, POST'}});\n}\nif (url.pathname.startsWith('/api/')) return Response.json({error:'找不到這個 API。'}, {status:404});\nif (!['GET','HEAD'].includes(request.method)) return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}});\nconst asset = assets[url.pathname === '/' ? '/index.html' : url.pathname];\nif (!asset) return new Response('Not found',{status:404});\nconst bytes = Uint8Array.from(atob(asset.body), char => char.charCodeAt(0));\nreturn new Response(request.method === 'HEAD' ? null : bytes, {headers:{'content-type':asset.type,'cache-control':url.pathname.startsWith('/assets/')?'public, max-age=31536000, immutable':'no-cache','x-content-type-options':'nosniff','referrer-policy':'same-origin','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"}});\n}};\n`;
rmSync(path.join(root, "dist"), { recursive: true, force: true });
mkdirSync(path.join(root, "dist/server"), { recursive: true });
mkdirSync(path.join(root, "dist/.openai"), { recursive: true });
writeFileSync(path.join(root, "dist/server/index.js"), provenance + worker);
cpSync(
  path.join(root, ".openai/hosting.json"),
  path.join(root, "dist/.openai/hosting.json"),
);
const mod = await import(
  `data:text/javascript;base64,${Buffer.from(worker).toString("base64")}`
);
if (typeof mod.default?.fetch !== "function")
  throw new Error("Worker must export fetch.");
console.log(
  `Built Vue 3 + existing Workers API: ${Object.keys(assets).length} assets, ${Buffer.byteLength(worker)} bytes; D1 binding unchanged.`,
);
