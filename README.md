# Hatym Web App

Production-ready kiosk + phone flow for collective Quran hatym page distribution.

## Stack
- Next.js (App Router, TypeScript)
- Supabase (Postgres + Realtime)
- TailwindCSS
- QR: `qrcode.react`
- Confetti: `react-confetti`

## Supabase setup

1) Create a new Supabase project.

2) Run the SQL schema.
   - Open the SQL editor and run `supabase/schema.sql`.

3) Import `quran_pages` CSV.
   - In Supabase Dashboard → Table Editor → `quran_pages` → **Import data**.
   - CSV must include at least:
     - `page_number` (int 1..604)
     - `mushaf_url` (text)
     - `render_type` (`image` or `json`)
   - For `render_type = image`, `mushaf_url` must be a **full public page image URL** (recommended WebP/PNG on stable CDN or Supabase Storage public URL).
   - For `render_type = json`, `mushaf_url` remains a **full public JSON URL** (e.g. `.../mushaf-json/page-001.json`).

4) Ensure Realtime is enabled for `hatym_pages`.
   - Database → Replication → Add `hatym_pages` to the publication (if not already).

## Environment variables

Create `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

- `SUPABASE_SERVICE_ROLE_KEY` is used **server-side only** to create and seed sessions.

## Run locally

```
npm install
npm run dev
```

- Kiosk entry: `http://localhost:3000/kiosk`
- This auto-creates a session and redirects to `/kiosk/{sessionId}`.
- Phone claim URL: `/s/{sessionId}/claim`
- Reader URL: `/read/{sessionId}/{pageNumber}`

## How it works

- `create_hatym_session()` creates a new session and seeds 604 `hatym_pages` rows.
- `claim_next_page()` assigns the next page atomically with TTL reclaim and anti-hoarding.
- `complete_page()` validates `claim_token` and marks the page completed.
- Kiosk subscribes to `hatym_pages` realtime updates to update the grid instantly.

## Reader flow

- After claiming, users open `/read/{sessionId}/{pageNumber}` inside the app.
- The reader fetches `quran_pages` row (`mushaf_url`, `render_type`) for the page.
- If `render_type` is `image` (or empty), it renders the page image directly.
- If `render_type` is `json`, it fetches JSON and renders the page as RTL Arabic text.
- Completion happens via RPC (`complete_page`) from the reader or the claim page.
