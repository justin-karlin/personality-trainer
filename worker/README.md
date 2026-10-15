# Trait Trainer coach (Cloudflare Worker)

A small server for the app's **"Help me write this plan"** button. The user describes a real situation coming up ("tomorrow's 9am meeting with Alex"), and the worker asks Claude for three concrete if-then plans for their goal (follow through, or get along better).

**Why a server?**
- The Claude API key must stay secret, so it can't live in the app.
- The worker receives only the goal, the chosen challenge, the current if-then plan and the situation text. It stores and logs nothing.
- It answers only the app's own site, at most 10 requests a minute per IP address.

**Model and cost:** it uses Claude Opus 5.5 (`claude-opus-5-5`) at low effort, with JSON-schema output so replies are always well-formed. If a safety check declines a request, the API retries on Anthropic's recommended fallback model. Each suggestion costs roughly one US cent (about 600 input tokens and a few hundred output tokens at $4 / $20 per million). To spend less, change `MODEL` in `src/coach.ts` to `claude-haiku-5-5`, which is about 40 times cheaper.

## Deploy (about 10 minutes)

1. **Create accounts.** You need a free [Cloudflare](https://dash.cloudflare.com/sign-up) account and an [Anthropic API key](https://console.anthropic.com/settings/keys). In the Anthropic console, set a monthly spend limit.
2. **Install and log in:**

   ```sh
   cd worker
   npm install
   npx wrangler login
   ```

3. **Add the API key as a secret.** It's stored by Cloudflare and never committed:

   ```sh
   npx wrangler secret put ANTHROPIC_API_KEY
   ```

4. **Deploy:**

   ```sh
   npx wrangler deploy
   ```

   Wrangler prints the worker's address, for example `https://trait-trainer-coach.<you>.workers.dev`.
5. **Point the app at it.** In the GitHub repo, open **Settings → Secrets and variables → Actions → Variables**, add a variable named `COACH_URL` with that address (no trailing slash), then re-run the deploy workflow. The button appears for follow-through and getting-along goals.

If the app moves to another domain, add it to `ALLOWED_ORIGINS` in `wrangler.toml` and redeploy.

## Develop

```sh
npm test            # unit tests (no API calls; Claude is mocked)
npm run typecheck
npx wrangler dev    # local server on :8787 (needs ANTHROPIC_API_KEY in .dev.vars)
```
