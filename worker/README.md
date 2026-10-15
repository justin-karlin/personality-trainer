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
- for reviews, the reply suggests the person may be in crisis. It goes **straight to the largest model**, skipping the middle one, and the app shows support links. These links are part of the app and don't depend on the AI;
- for reviews, a plan clearly fell short (done on fewer than half its target days, with at least three days logged and five days into the week) but the reply left it unchanged. This rule-based check catches the most common thing a smaller model misses;
- **the model is unavailable**: overloaded, erroring or timing out. Our own rate or spend limit (429) is deliberately *not* a reason to move up, because that would let anyone who floods the cheap model turn it into spending on the expensive one. Each model has its own capacity, so the next one usually works. If every model on the way up is unavailable, smaller ones below the starting tier are tried before giving up. If everything is down, the app says the AI is busy, and planning works without it.

The settings are `COACH_MODEL` / `COACH_MAX_MODEL` and `REVIEW_MODEL` / `REVIEW_MAX_MODEL` in `wrangler.toml`. "Ask for a more thorough review" starts one tier up. On Sonnet and Opus, Anthropic's server-side fallback also retries some refusals; Haiku has none, so its refusals escalate instead. The worker logs which model answered each request and why smaller ones were skipped, never what people wrote, so `npx wrangler tail` shows how often escalation happens.

**Before launch, run the held-out set** (below) on the two candidate ladders, `haiku>opus` and `sonnet>opus`, and start on the cheaper one if it scores about as well. Switching is a one-line change.

## Model test

The model test sends realistic weeks to each model and grades the replies. There are two sets of cases, so the prompt isn't fitted to the test:

- **Dev set** (`eval/cases.ts`, 20 weeks): used while improving the prompt. Read its failures freely.
- **Held-out sets:** written independently, without sight of the prompt or the dev cases, then audited so their expectations are ones careful coaches would all agree on.
  - `eval/holdout.ts` (37 weeks) has already been used once to find general fixes, so treat it as a second dev set now.
  - `eval/holdout2.ts` (29 weeks, by fresh authors) is reserved for the final pre-launch decision (`--set holdout2`). Don't change the prompt in response to its individual failures, or it stops measuring anything.

Each reply gets checks that need no judge, for example "changes the skipped plan" or "flags support for the crisis case". **Two judges**, Claude Opus 5.5 and Sonnet 5.5, then grade it pass or fail on six points: grounded, spots the pattern, actionable, same challenge, tone and safety. By default Opus decides and Sonnet is a second opinion. The report shows how often they agree and lists their disagreements for a human to look at. `--judge-rule all` makes every judge's pass required instead. "All pass" comes with a 95% interval, so a difference of a case or two reads as the noise it is.

```sh
cd worker
export ANTHROPIC_API_KEY=…        # your API key
export ANTHROPIC_WORKSPACE_ID=…   # only if the API says the key "is not scoped to a workspace" (wrkspc_…)
npm run model-test                                    # shows the plan and an estimated cost; spends nothing
npm run model-test -- --yes                           # dev set: each model alone, plus Haiku→Opus
npm run model-test -- --yes --set holdout2 --models "haiku>opus,sonnet>opus" --repeat 2  # the decision run
npm run model-test -- --yes --set holdout --blind 15  # also write a blind sample for you to grade
npm run model-test:agreement -- eval/results/<stamp>-blind.csv   # how well the judges agree with you
```

Options: `--models` (single models, or ladders like `haiku>opus`), `--set dev|holdout|holdout2|all`, `--repeat N`, `--cases id1,id2`, `--judges opus,sonnet`, `--judge-rule primary|all`, `--no-judge`, `--blind N`. It prints a table and lists every failure with the judges' reasons. Every reply and grade is saved to `eval/results/`, which git ignores.

**Grade a blind sample yourself at least once.** The judges are models too. If they disagree with you often, fix the judge instructions in `eval/run.ts`, not the reviewer prompt. Real usage will tell you more than any test: once the review is live, watch how often people apply its suggestions.

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
