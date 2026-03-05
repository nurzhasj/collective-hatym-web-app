// Downloads all 604 QCF v2 per-page woff2 fonts from quran.com's CDN
// and uploads them to your Supabase Storage bucket.
//
// Run:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/upload-qpc-fonts.mjs
// Or just:
//   node scripts/upload-qpc-fonts.mjs   (reads .env automatically via dotenv if installed,
//                                        or export the vars before running)
//
// Fonts land at: mushaf_font_files/qpcv2/p{N}.woff2

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// ── Load .env manually (no dotenv dependency needed) ──────────────────────────
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dir, "../.env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([^#=]+?)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] ??= m[2];
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const BUCKET = "mushaf_font_files";
const STORAGE_FOLDER = "qpcv2";   // files go to mushaf_font_files/qpcv2/p1.woff2 … p604.woff2
const CDN_BASE = "https://verses.quran.foundation/fonts/quran/hafs/v2/woff2";
const TOTAL = 604;
const CONCURRENCY = 8; // parallel uploads

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function processPage(n) {
  const filename = `p${n}.woff2`;
  const storagePath = `${STORAGE_FOLDER}/${filename}`;
  const url = `${CDN_BASE}/${filename}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buf, {
      contentType: "font/woff2",
      upsert: true,
    });
  if (error) throw new Error(error.message);
}

// ── Main ─────────────────────────────────────────────────────────────────────

let done = 0;
let failed = 0;

const pages = Array.from({ length: TOTAL }, (_, i) => i + 1);

// Process in batches of CONCURRENCY
for (let i = 0; i < pages.length; i += CONCURRENCY) {
  const batch = pages.slice(i, i + CONCURRENCY);
  await Promise.all(
    batch.map((n) =>
      processPage(n)
        .then(() => {
          done++;
          process.stdout.write(`\r  Uploaded ${done}/${TOTAL} …`);
        })
        .catch((e) => {
          failed++;
          console.error(`\n  FAIL p${n}: ${e.message}`);
        })
    )
  );
}

console.log(`\n\nDone. ${done} uploaded, ${failed} failed.`);
if (done === TOTAL) {
  const base = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${STORAGE_FOLDER}`;
  console.log(`\nFont base URL for .env:\nNEXT_PUBLIC_QPC_FONTS_BASE_URL=${base}`);
}
