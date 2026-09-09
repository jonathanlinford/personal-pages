#!/usr/bin/env node
// Validates that every .html page in the repo has the social preview metadata
// needed to render with a thumbnail in iMessage, Slack, Facebook Messenger, etc.
//
// Run locally: `node scripts/check-og-metadata.mjs`
// Runs in CI via .github/workflows/og-check.yml on every push and PR.
//
// To exempt a page (e.g. fragments, partials, error pages), add a comment
// anywhere in its <head>:  <!-- og-check-skip: reason -->

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIP_DIRS = new Set([".git", "node_modules", "scripts", ".github", "assets"]);

const REQUIRED = [
  { tag: "og:title",       kind: "property" },
  { tag: "og:description", kind: "property" },
  { tag: "og:image",       kind: "property" },
  { tag: "og:url",         kind: "property" },
  { tag: "og:type",        kind: "property" },
  { tag: "twitter:card",   kind: "name" },
];

function findHtml(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".") && name !== ".github") continue;
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) findHtml(full, out);
    else if (name.endsWith(".html")) out.push(full);
  }
  return out;
}

function hasMeta(html, tag, kind) {
  const re = new RegExp(`<meta\\s+[^>]*${kind}\\s*=\\s*["']${tag}["'][^>]*content\\s*=\\s*["']([^"']+)["']`, "i");
  const m = html.match(re);
  return m ? m[1] : null;
}

function isAbsoluteHttps(url) {
  return /^https:\/\//i.test(url);
}

function validate(file) {
  const html = readFileSync(file, "utf8");
  if (/<!--\s*og-check-skip/.test(html)) return { skip: true };

  const problems = [];
  const values = {};

  for (const { tag, kind } of REQUIRED) {
    const v = hasMeta(html, tag, kind);
    if (!v) problems.push(`missing meta ${kind}="${tag}"`);
    else values[tag] = v;
  }

  // og:image must be absolute https URL
  if (values["og:image"] && !isAbsoluteHttps(values["og:image"])) {
    problems.push(`og:image must be an absolute https:// URL (got: ${values["og:image"]})`);
  }
  // og:url must be absolute https URL
  if (values["og:url"] && !isAbsoluteHttps(values["og:url"])) {
    problems.push(`og:url must be an absolute https:// URL (got: ${values["og:url"]})`);
  }

  // If og:image points at our own pages site, verify the file exists in the repo
  if (values["og:image"]) {
    const m = values["og:image"].match(/^https:\/\/jonathanlinford\.github\.io\/personal-pages\/(.+)$/);
    if (m) {
      const localPath = path.join(repoRoot, m[1]);
      if (!existsSync(localPath)) {
        problems.push(`og:image references ${m[1]} but that file does not exist in the repo`);
      }
    }
  }

  return { problems, values };
}

const files = findHtml(repoRoot);
const failures = [];
const skipped = [];
const passed = [];
for (const f of files) {
  const rel = path.relative(repoRoot, f);
  const result = validate(f);
  if (result.skip) skipped.push(rel);
  else if (result.problems.length) failures.push({ file: rel, problems: result.problems });
  else passed.push(rel);
}

const RED = (s) => `\x1b[31m${s}\x1b[0m`;
const GREEN = (s) => `\x1b[32m${s}\x1b[0m`;
const DIM = (s) => `\x1b[2m${s}\x1b[0m`;

for (const f of passed)  console.log(`  ${GREEN("✓")} ${f}`);
for (const f of skipped) console.log(`  ${DIM("·")} ${f} ${DIM("(skipped)")}`);
for (const { file, problems } of failures) {
  console.log(`  ${RED("✗")} ${file}`);
  for (const p of problems) console.log(`      ${RED("·")} ${p}`);
}

console.log("");
if (failures.length) {
  console.error(RED(`✗ ${failures.length} of ${files.length} pages missing required social preview metadata.`));
  console.error("");
  console.error("Every published page in this repo must include:");
  for (const { tag, kind } of REQUIRED) console.error(`  - <meta ${kind}=\"${tag}\" content=\"...\">`);
  console.error("");
  console.error("og:image and og:url must be absolute https:// URLs. og:image must");
  console.error("point to a real image file in the repo (typically <page>-og.png).");
  console.error("");
  console.error("To exempt a page (rare; for fragments/partials), put this in its <head>:");
  console.error("  <!-- og-check-skip: <reason> -->");
  process.exit(1);
}
console.log(GREEN(`✓ all ${passed.length} pages have required social preview metadata`));
