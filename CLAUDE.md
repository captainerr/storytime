# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```
npm install       # install devDependencies (wrangler, playwright)
npm run dev        # wrangler dev — local Worker dev server (serves API + static assets)
npm run deploy      # wrangler deploy — deploy to Cloudflare
```

There is no test suite and no lint script configured in this repo — don't assume `npm test`/`npm run lint` exist.

Local dev needs Wrangler bindings for Workers AI and D1 to work (see `wrangler.toml`); these are provided automatically when running under `wrangler dev` against the account that owns the `storytime-library` D1 database. `.dev.vars.example` (→ `.dev.vars`) sets `GROQ_API_KEY`, but note the current code no longer calls Groq at all (see Architecture) — that var is currently unused by `src/index.js`.

## Architecture

This is a single Cloudflare Worker (`src/index.js`) with static assets (`public/`), no build step, no bundler, no frontend framework. Each HTML page is self-contained with an inline `<script>`.

**Request routing** happens entirely in `src/index.js`'s `fetch` handler, based on hostname and path:
- Requests to hostname `timer.aistuffforparents.com` are rewritten to serve `timer.html` from `ASSETS` (a separate countdown-timer app, unrelated to story generation).
- `POST /api/generate-story`, `POST /api/save-story`, `GET /api/stories`, `POST /api/generate-illustration` are handled by dedicated functions in `src/index.js`.
- Everything else falls through to `env.ASSETS.fetch(request)` (static files in `public/`).

**Bindings** (declared in `wrangler.toml`):
- `AI` — Cloudflare Workers AI. Despite the README/`.dev.vars.example` referencing Groq, story text and illustration prompts are generated via `env.AI.run('@cf/meta/llama-4-scout-17b-16e-instruct', ...)` and images via `env.AI.run('@cf/black-forest-labs/flux-1-schnell', ...)` — there is no live Groq integration in the current code.
- `DB` — D1 database `storytime-library`, holds the `stories` table (columns: `id, title, story, silliness, character, theme, moral, length, created_at`). There are no migration files in the repo; the schema exists only in the live D1 database (create/alter it directly via `wrangler d1 execute` if you need to change it).
- `ASSETS` — static file serving from `public/`.

**Story generation flow** (`generateStory` in `src/index.js`): builds a prompt from a fixed system prompt plus randomly/user-selected `character`, `theme`, `silliness` tier (0-4: Calm/Sweet/Playful/Goofy/Wacky), and optional `length` override and `moral`. The model is asked to return `<title>\n===STORY===\n<story>\n===ILLUSTRATION===\n<image prompt>`; the handler parses this with tolerant regexes (models vary formatting) and then generates an illustration image from the extracted image prompt. Image generation is best-effort — a failed image doesn't fail the story response, it's returned as `imageError`.

The option lists (`CHARACTERS`, `THEMES`, `VALID_MORALS`/moral list, silliness tiers) are **duplicated** between `src/index.js` (server-side validation) and the inline scripts in `public/index.html` / `public/library.html` (populate `<select>`s and filters client-side). When changing available options, update both sides.

**Frontend pages** (each is a standalone HTML file with its own inline JS, no shared JS modules):
- `public/index.html` — main story generator: silliness slider, an "advanced options" overlay panel (character/theme/moral/length), typewriter-style story reveal animation, Web Speech API read-aloud, save-to-library, light/dark theme toggle persisted to `localStorage`.
- `public/library.html` — browse/filter saved stories from `GET /api/stories` (character/theme/moral/silliness/length filters + pagination via offset/limit), on-demand illustration generation per card via `POST /api/generate-illustration`.
- `public/timer.html` (and a duplicate copy at `timer/index.html`) — standalone countdown timer app served at `timer.aistuffforparents.com`, unrelated to the story generator; uses Wake Lock API and an audio chime on completion.

**PWA support**: `public/manifest.json` + `public/sw.js`. The service worker is network-first with cache fallback for GET requests, always bypassing `/api/*` and non-GET requests entirely.

## Notes on stale docs

`README.md` describes an earlier Groq-based, single-domain (`storytime.inversehanlon.com`) version of this app. The current `wrangler.toml` Worker is named `lullaby` and routes `lullaby.aistuffforparents.com` (plus the separate `timer.aistuffforparents.com` host), and story/image generation runs on Cloudflare Workers AI, not Groq. Prefer the actual code in `src/index.js` and `wrangler.toml` over the README when they disagree.
