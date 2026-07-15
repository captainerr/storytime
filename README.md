# Storytime

A super simple webapp with one button: **Generate Story**. Click it and Groq
writes an original 3-5 minute bedtime story for children, shown as plain text.

Built as a static page plus a single Cloudflare Pages Function so the Groq
API key never touches the browser.

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

## Deploying to Cloudflare Pages

1. Push this repo to GitHub and connect it to a new Cloudflare Pages project
   (or run `npm run deploy` to deploy directly with Wrangler).
2. In the Pages project settings, add an environment variable/secret named
   `GROQ_API_KEY` with your Groq API key.
3. (Optional) Set `GROQ_MODEL` to override the default model
   (`llama-3.3-70b-versatile`).
4. Under **Custom domains**, add `storytime.inversehanlon.com` and point the
   corresponding DNS record at the Pages project (a CNAME is added
   automatically if `inversehanlon.com`'s DNS is managed on Cloudflare).
