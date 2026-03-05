// Run: node scripts/verify-pages.mjs /path/to/json/folder
// Checks that every page JSON ends at a verse conclusion.

import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const folder = process.argv[2];
if (!folder) {
  console.error("Usage: node scripts/verify-pages.mjs <folder-with-json-files>");
  process.exit(1);
}

const files = readdirSync(folder)
  .filter((f) => f.endsWith(".json"))
  .sort();

let ok = 0;
let fail = 0;
const problems = [];

for (const file of files) {
  const data = JSON.parse(readFileSync(join(folder, file), "utf8"));
  const textLines = data.lines.filter((l) => l.type === "text" && l.words?.length > 0);
  if (!textLines.length) {
    console.warn(`  SKIP  page ${data.page} — no text lines`);
    continue;
  }
  const lastLine = textLines.at(-1);
  const lastWord = lastLine.words.at(-1);
  const wordText = lastWord?.word ?? "";
  // Arabic-Indic numerals ٠١٢٣٤٥٦٧٨٩ (U+0660–U+0669)
  const endsAtVerse = /[\u0660-\u0669]/.test(wordText);

  if (endsAtVerse) {
    ok++;
  } else {
    fail++;
    problems.push(`  FAIL  page ${String(data.page).padStart(3, " ")}: last word = "${wordText}"  (${lastWord?.location})`);
  }
}

console.log(`\nResults: ${ok} OK, ${fail} FAILED out of ${ok + fail} pages\n`);
if (problems.length) {
  problems.forEach((p) => console.log(p));
} else {
  console.log("All pages end at a verse conclusion. ✓");
}
