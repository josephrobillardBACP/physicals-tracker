/**
 * Builds the shareable sample-data preview (no Google sign-in, fictional patients)
 * and rewrites its index.html for a host that supplies its own document skeleton.
 *
 *   npm run build:preview
 *
 * Output: dist-demo/  — index.html plus assets/, ready to upload or publish.
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

execSync("npx vite build --base=./ --outDir dist-demo", {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, VITE_DEMO_ONLY: "1" },
});

const file = new URL("../dist-demo/index.html", import.meta.url);
const src = readFileSync(file, "utf8");
const head = src.match(/<head>(.*?)<\/head>/s)[1];
const body = src.match(/<body>(.*?)<\/body>/s)[1];

const keep = head
  .split("\n")
  .map((l) => l.trim())
  .filter(
    (l) =>
      l &&
      !l.startsWith("<meta") && // host supplies charset + viewport
      !l.includes("accounts.google.com") && // unused here, and often CSP-blocked
      !l.includes('rel="icon"'),
  )
  .map((l) => "  " + l);

writeFileSync(
  file,
  `${keep.join("\n")}
  <style>
    /* Single light palette by design — paint it so the page holds on any ground. */
    html, body { background: #F6F1E9; }
  </style>
${body.trimEnd()}
`,
);

console.log("\nPreview build ready in dist-demo/");
