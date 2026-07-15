# Storytime

A super simple webapp with one button: **Generate Story**. Click it and Groq
writes an original 3-5 minute bedtime story for children, shown as plain text.

Built as a Cloudflare Worker with static assets: `public/index.html` is the
whole UI, and `src/index.js` handles `POST /api/generate-story` server-side
so the Groq API key never touches the browser (everything else falls through
to the static assets).

## Local development

1. Install dependencies:
   ```
   npm install
   ```
2. Copy `.dev.vars.example` to `.dev.vars` and fill in your real Groq API key:
   ```
   cp .dev.vars.example .dev.vars
   ```
3. Run the dev server:
   ```
   npm run dev
   ```
4. Open the printed local URL and click **Generate Story**.

## Deploying to Cloudflare

1. Push this repo to GitHub, then in the Cloudflare dashboard go to
   **Workers & Pages → Create application → Import a repository** and select
   this repo (or run `npm run deploy` to deploy directly with Wrangler).
2. In the project's **Settings → Variables and Secrets**, add a secret named
   `GROQ_API_KEY` with your Groq API key.
3. (Optional) Set `GROQ_MODEL` to override the default model
   (`llama-3.3-70b-versatile`).
4. Under **Settings → Domains & Routes**, add the custom domain
   `storytime.inversehanlon.com` (a DNS record is added automatically if
   `inversehanlon.com`'s DNS is managed on Cloudflare).
