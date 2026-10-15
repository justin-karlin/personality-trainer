# Trait Trainer coach (Cloudflare Worker)

A small server for the app's two optional AI features:

- **"Help me write this plan"** (`POST /coach`). The user describes a real situation coming up ("tomorrow's 9am meeting with Alex"). The worker asks Claude for three concrete if-then plans for the challenge they picked.
- **"Review my week"** (`POST /review`), on the weekly reflection. The worker reads the week's plans, what was logged each day and the reflection, then proposes at most two changes for next week: a reworded plan, a new target, or dropping a challenge. The app changes nothing unless the user applies a suggestion.

**Why a server?**
- The Claude API key must stay secret, so it can't live in the app.
- The worker receives only what each feature needs: the goal, the chosen challenge and plan, the typed situation, or the week's record and reflection. It never logs that content. For reviews it logs only which model answered and why smaller ones were skipped.
- It answers only the app's own site, at most 10 requests a minute per IP address.

## Models and escalation

Each feature's model is a setting in `wrangler.toml`: `haiku`, `sonnet` or `opus`.

| Model | Price per million tokens (input / output) | About per review |
|---|---|---|
| Claude Haiku 5.5 | $0.10 / $0.50 | 0.1¢ |
| Claude Sonnet 5.5 | $2 / $10 | 2¢ |
| Claude Opus 5.5 | $4 / $20 | 4¢ |

**Both features start on Haiku 5.5, the cheapest model, and move up a tier (to Sonnet, then Opus) only when needed:**
- the model declines the request (a safety-classifier refusal);
- its reply fails the worker's checks, for example a change to a plan that doesn't exist, a reworded plan that isn't an if-then plan, more than two changes, or no usable plans from the coach;
- for reviews, the model flags the week as beyond it (contradictory, emotionally heavy, conflict or safety concerns);
- for reviews, the reply suggests the person may be in crisis. The largest model then writes that reply, and the app shows support links;
- **the model is unavailable**: overloaded, rate-limited, erroring or timing out. Each model has its own capacity, so the next one usually works. If every model on the way up is unavailable, smaller ones below the starting tier are tried before giving up. If everything is down, the app says the AI is busy, and planning works without it.

The settings are `COACH_MODEL` / `COACH_MAX_MODEL` and `REVIEW_MODEL` / `REVIEW_MAX_MODEL` in `wrangler.toml`. "Ask for a more thorough review" starts one tier up. On Sonnet and Opus, Anthropic's server-side fallback also retries some refusals; Haiku has none, so its refusals escalate instead. The worker logs which model answered each request and why smaller ones were skipped, never what people wrote, so `npx wrangler tail` shows how often escalation happens.

**Run the model test before launch** to confirm Haiku is good enough to start on. If it isn't, set the starting model to `sonnet`.

## Model test

`eval/` has 20 realistic weeks (`eval/cases.ts`). They include easy weeks, an empty log, a log that contradicts the reflection, a prompt injection, a Spanish reflection, a boundaries case and a crisis case. The runner sends each week to each model, then:
- **checks each reply** without a judge, for example "changes the skipped plan, leaves the perfect one alone" or "flags support for the crisis case";
- **has Claude Opus 5.5 grade it** pass or fail on six points: grounded, spots the pattern, actionable, same challenge, tone and safety.

```sh
cd worker
export ANTHROPIC_API_KEY=…        # your API key
export ANTHROPIC_WORKSPACE_ID=…   # only if the API says the key "is not scoped to a workspace" (wrkspc_…)
npm run model-test                # shows the plan and an estimated cost; spends nothing
npm run model-test -- --yes       # each model alone, plus the Haiku→Opus ladder, on all 20 weeks
npm run model-test -- --yes --models "haiku>opus,sonnet>opus"   # test escalation ladders
npm run model-test -- --yes --models haiku --cases distress,boundaries --repeat 3
```

It prints a table with pass rates per criterion, the share each model would escalate, cost per review and speed, then lists every failure with the judge's reason. Every reply and grade is saved to `eval/results/` (ignored by git). Pick the cheapest setting whose "all pass" rate you're happy with, especially on `safety` and `grounded`. Then set `REVIEW_MODEL` and `REVIEW_MAX_MODEL` and redeploy. The judge is a model too, so read the failures rather than trusting the percentages alone.

## Deploy (about 10 minutes)

1. **Create accounts.** You need a free [Cloudflare](https://dash.cloudflare.com/sign-up) account and an [Anthropic API key](https://console.anthropic.com/settings/keys). If the API says your key "is not scoped to a workspace", either create the key inside a workspace (Workspaces → your workspace → API keys) or also store the workspace ID: `npx wrangler secret put ANTHROPIC_WORKSPACE_ID` (it starts with `wrkspc_`). Set a monthly spend limit on that workspace.
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
npm run model-test  # compare models on real weeks (needs ANTHROPIC_API_KEY; see above)
npm run typecheck
npx wrangler dev    # local server on :8787 (needs ANTHROPIC_API_KEY in .dev.vars)
```
