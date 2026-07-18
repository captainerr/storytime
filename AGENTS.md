# AGENTS.md

See `CLAUDE.md` for the full architecture overview (routing, bindings, story-generation flow, duplicated option lists, stale-docs notes). Read it before making changes.

## Cursor Cloud specific instructions

Standard commands live in `package.json` (`npm run dev` = `wrangler dev`, `npm run deploy`). There is no test or lint script. The update script only runs `npm install`.

- `npm run dev` starts a local Miniflare server (default `http://localhost:8787`). Static assets (`public/`) and the `DB` D1 database are simulated locally; the `AI` binding always connects to the **real** Cloudflare Workers AI (there is no local emulation).
- Because of that, `POST /api/generate-story` and `POST /api/generate-illustration` fail with `Workers AI error: Error: Not logged in.` unless the VM has Cloudflare credentials. To exercise the AI story/illustration features, set `CLOUDFLARE_API_TOKEN` (a token with Workers AI access) and `CLOUDFLARE_ACCOUNT_ID` in the environment before `wrangler dev` (interactive `wrangler login` won't work headless). Note this incurs real account usage charges.
- The static site and the D1-backed library work fully offline: static assets serve, `/api/save-story` and `/api/stories` work against the local SQLite.
- The **local** D1 database starts empty — the `stories` schema only exists in the live remote DB, not in the repo (no migration files). Before `/api/save-story`, `/api/stories`, or `library.html` work locally, create the table once (persisted under `.wrangler/state`, which is gitignored):
  ```
  npx wrangler d1 execute storytime-library --local --command "CREATE TABLE IF NOT EXISTS stories (id TEXT PRIMARY KEY, title TEXT NOT NULL, story TEXT NOT NULL, silliness INTEGER, character TEXT, theme TEXT, moral TEXT, length INTEGER, created_at INTEGER);"
  ```
- Clean URLs: `library.html` is served at `/library` (a 307 redirect) and `index.html` at `/`. The timer / landing / brand-domain routing keys off `url.hostname`, so those alternate pages only render when the request host matches (see `CLAUDE.md`); on `localhost` you always get the main story app.
- The paid AI endpoints (`/api/generate-story`, `/api/generate-illustration`) are per-IP rate limited (25/hour each) via a `rate_limits` D1 table. Like `stories`, that table lives only in D1 (no repo migrations) and must be created out-of-band — locally with `--local`, and in prod with `--remote`. Rate limiting **fails open**: if the table is missing (or D1 errors), requests are allowed and simply not limited, so deploying the code before creating the table is safe. To exercise limits locally, create it once:
  ```
  npx wrangler d1 execute storytime-library --local --command "CREATE TABLE IF NOT EXISTS rate_limits (id INTEGER PRIMARY KEY AUTOINCREMENT, ip TEXT NOT NULL, bucket TEXT NOT NULL, created_at INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup ON rate_limits (ip, bucket, created_at); CREATE INDEX IF NOT EXISTS idx_rate_limits_cleanup ON rate_limits (created_at);"
  ```
  In local dev there's no real client IP, so requests bucket under a fallback key (`X-Forwarded-For` or `unknown`); pass a `CF-Connecting-IP` header to simulate distinct callers.
