import { readFileSync, existsSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { PAGES } from "../dist/library.mjs";
for (const file of ["app.mjs", "core.mjs", "puzzle-drag.mjs", "library.mjs", "storage.mjs", "sync.mjs", "sw.js"]) execFileSync(process.execPath, ["--check", "dist/" + file]);
const manifest = JSON.parse(readFileSync("dist/manifest.webmanifest"));
for (const icon of manifest.icons) if (!existsSync("dist" + icon.src)) throw new Error("Missing app icon " + icon.src);
const html = readFileSync("dist/index.html", "utf8"), app = readFileSync("dist/app.mjs", "utf8");
for (const match of app.matchAll(/\$\((["'])([^"']+)\1\)/g)) if (!html.includes(`id="${match[2]}"`)) throw new Error("Missing UI element " + match[2]);
if (!PAGES.length || new Set(PAGES.map((p) => p.id)).size !== PAGES.length) throw new Error("Invalid page catalog");
for (const theme of ["Animals", "Space", "Ocean", "Wheels", "Sports", "Fairy Tales", "Graphic Novels"]) if (!PAGES.some((p) => p.theme === theme)) throw new Error("Missing theme " + theme);
for (const page of PAGES) {
  const path = "dist" + page.image;
  if (!existsSync(path)) throw new Error("Missing coloring-book illustration " + page.id);
  const data = readFileSync(path);
  if (data.length < 2e4 || data.readUInt32BE(0) !== 2303741511) throw new Error("Invalid coloring-book asset " + page.id);
}
execFileSync(process.execPath, ["--test", ...readdirSync("tests").filter((n) => n.endsWith(".test.mjs")).map((n) => "tests/" + n)], { stdio: "inherit" });
console.log("Checked app modules, UI references, " + PAGES.length + " pages, install manifest, and tests.");
execFileSync(process.execPath, ["scripts/version-shell.mjs"], { stdio: "inherit" });
