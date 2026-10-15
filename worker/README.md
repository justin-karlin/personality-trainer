# Trait Trainer coach (Cloudflare Worker)

A small server for the app's two optional AI features:

- **"Help me write this plan"** (`POST /coach`). The user describes a real situation coming up ("tomorrow's 9am meeting with Alex"). The worker asks Claude for three concrete if-then plans for the challenge they picked.
- **"Review my week"** (`POST /review`), on the weekly reflection. The worker reads the week's plans, what was logged each day and the reflection, then proposes at most two changes for next week: a reworded plan, a new target, or dropping a challenge. The app changes nothing unless the user applies a suggestion.

**Why a server?**
- The Claude API key must stay secret, so it can't live in the app.
- The worker receives only what each feature needs: the goal, the chosen challenge and plan, the typed situation, or the week's record and reflection. It never logs or stores that content. Each request logs only its route, which model answered, why smaller ones were skipped, what it cost and the spend breaker's mode.
- It answers only the app's own site, and limits how much each network and the whole app can use per day (see [Limits](#limits-on-spending-and-abuse)). There are no accounts, by design.

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
- for reviews, the reply suggests the person may be in crisis. It goes **straight to the largest model**, skipping the middle one (even when the spend breaker has capped other requests at Haiku; see [Limits](#limits-on-spending-and-abuse)), and the app shows support links. These links are part of the app and don't depend on the AI;
- for reviews, a plan clearly fell short (done on fewer than half its target days, with at least three days logged and five days into the week) but the reply left it unchanged. This rule-based check catches the most common thing a smaller model misses;
- **the model is unavailable**: overloaded, erroring or timing out. Our own rate or spend limit (429) is deliberately *not* a reason to move up, because that would let anyone who floods the cheap model turn it into spending on the expensive one. Each model has its own capacity, so the next one usually works. If every model on the way up is unavailable, smaller ones below the starting tier are tried before giving up. If everything is down, the app says the AI is busy, and planning works without it.

The settings are `COACH_MODEL` / `COACH_MAX_MODEL` and `REVIEW_MODEL` / `REVIEW_MAX_MODEL` in `wrangler.toml`. "Ask for a more thorough review" starts one tier up. On Sonnet and Opus, Anthropic's server-side fallback also retries some refusals; Haiku has none, so its refusals escalate instead. The worker logs which model answered each request and why smaller ones were skipped, never what people wrote, so `npx wrangler tail` shows how often escalation happens.

**Before launch, run the held-out set** (below) on the two candidate ladders, `haiku>opus` and `sonnet>opus`, and start on the cheaper one if it scores about as well. Switching is a one-line change.

## Limits on spending and abuse

The app has no accounts and keeps personal data on the device, so the worker can't limit people, only networks and money. Each limit below is checked before any model is called.

| Limit | What happens | Setting |
|---|---|---|
| **Origin** | Only the app's own site (and the App Store app) gets an answer. Browsers enforce this; scripts can fake it, so the limits below don't rely on it. | `ALLOWED_ORIGINS` |
| **Per minute** | At most 10 AI requests a minute per client network, else 429 "Try again in a minute." | `[[ratelimits]]` in `wrangler.toml` |
| **Per day** | At most 40 AI requests per client network per UTC day, else 429 "Daily limit reached for now. Try again tomorrow." Requests turned away for size or bad input don't count. | `NETWORK_DAILY_CAP` |
| **Request size** | Bodies over 16 KB get 413 before they're read further. The largest real request (a review with six plans) is a few KB. | `MAX_BODY_BYTES` in `src/body.ts` |
| **Reply length** | Each model call may write at most 2000 tokens (was 4000), which bounds the cost of a runaway reply. | `max_tokens` in `src/coach.ts`, `src/review.ts` |
| **Daily spend breaker** | Below half the daily budget, the usual model ladders. From half: **cheap mode**, every request stops at Haiku, except a review whose reply suggests a possible crisis, which may still go to the top model. At the full budget: **closed**, new AI requests get 503 `{ error: "The AI is resting until tomorrow. Planning works without it.", resting: true }` until midnight UTC. | `DAILY_BUDGET_USD` (default `"2"`) |
| **Crisis reserve** | Whether a reply involves a crisis is only known after a model call, so a new request is turned away when the breaker is closed (the app's support links are always there and don't depend on the AI). A crisis reply already under way may still use the top model, until the day's spend reaches budget + reserve. | `CRISIS_RESERVE_USD` (default `"0.5"`) |
| **Monthly** | The Anthropic workspace spend limit, the backstop for everything above. | Anthropic Console |

**A client network** is one IPv4 address, or one IPv6 /64 (phones and home routers rotate addresses within their /64, so counting single IPv6 addresses would be no limit at all). A shared network, such as an office, school or mobile carrier NAT, shares one allowance; 40 a day is generous for one person, who typically asks for a few plans and one review a week.

**Privacy.** The counters store no addresses: only a SHA-256 hash of the network, salted with `NETWORK_SALT` and the date (so a network's rows can't be linked across days), and that day's count. Network rows are deleted at the first request of the next UTC day; spend totals (route, model, dollars, number of calls) are kept one extra day for `/admin/spend`. If `NETWORK_SALT` isn't set, a constant from the code is used; anyone with that constant and a copy of the counters could recover IPv4 addresses by trying all four billion, so set a random salt: `openssl rand -hex 32 | npx wrangler secret put NETWORK_SALT`.

**Where the numbers live.** One SQLite-backed [Durable Object](https://developers.cloudflare.com/durable-objects/) (`Limits`, in `src/limits.ts`) holds the day's spend by route and model and the per-network counts, so every copy of the worker sees the same totals. Each AI request costs one round trip to it before (count the request, read the day's spend) and one after (add the actual cost of every model call, from the token counts the API returns, after the response is sent). A possible crisis in cheap mode takes one more, to check the reserve. **If the object can't be reached, requests run in cheap mode:** the expensive models fail closed, the app keeps working, and the per-minute limit and the monthly workspace limit still apply. The rules themselves are plain functions in `src/spend.ts`, tested without Cloudflare.

The breaker is checked when a request starts, so requests already under way can finish; the day's spend can pass the budget by about one request's worth per request in flight.

**Raising the budget.** Change `DAILY_BUDGET_USD` (and, if you like, `CRISIS_RESERVE_USD`) in `wrangler.toml` and run `npx wrangler deploy`; it takes effect on the next request, including on a day that's already closed. For a quick change without a deploy, edit the variable in the Cloudflare dashboard (Workers → trait-trainer-coach → Settings → Variables), but the next deploy from `wrangler.toml` overwrites it. `DAILY_BUDGET_USD = "0"` turns the AI off. At the defaults ($2 a day plus a $0.50 crisis reserve) the worker can't spend much more than $80 a month, so set the workspace's monthly limit a little above that.

**Seeing the spend.** Each request logs one line like `{"route":"review","mode":"normal","depth":"standard","tier":"haiku","escalations":[],"calls":1,"cost":0.000842}`; watch them with `npx wrangler tail`. For the day's totals, set an admin token (`openssl rand -hex 32 | npx wrangler secret put ADMIN_TOKEN`) and:

```sh
curl -H "Authorization: Bearer $ADMIN_TOKEN" https://trait-trainer-coach.<you>.workers.dev/admin/spend
curl -H "Authorization: Bearer $ADMIN_TOKEN" "https://trait-trainer-coach.<you>.workers.dev/admin/spend?day=2026-10-14"   # yesterday
```

It returns the spend by route and model, the number of networks and requests (no addresses or hashes), the budget and the breaker's mode. Without `ADMIN_TOKEN` the endpoint doesn't exist (404).

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

**After the reply limit change (`max_tokens` 4000 → 2000), run the model test once** and check that escalations for `invalid` haven't gone up: a reply cut off at the limit escalates as `invalid`, the same as malformed JSON. Real replies are a few hundred tokens, so none should be.

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

3. **Add the secrets.** They're stored by Cloudflare and never committed:

   ```sh
   npx wrangler secret put ANTHROPIC_API_KEY
   openssl rand -hex 32 | npx wrangler secret put NETWORK_SALT   # recommended; see Limits
   openssl rand -hex 32 | npx wrangler secret put ADMIN_TOKEN    # optional; enables /admin/spend (keep a copy)
   ```

4. **Check the limits** in `wrangler.toml`: `DAILY_BUDGET_USD` (default $2 a day), `CRISIS_RESERVE_USD` ($0.50) and `NETWORK_DAILY_CAP` (40 requests per network per day). See [Limits](#limits-on-spending-and-abuse).
5. **Deploy:**

   ```sh
   npx wrangler deploy
   ```

   Wrangler prints the worker's address, for example `https://trait-trainer-coach.<you>.workers.dev`. The first deploy also creates the `Limits` Durable Object from the `[[migrations]]` entry in `wrangler.toml` (tag `v1`, a SQLite-backed class). Durable Objects with SQLite storage are available on the free Workers plan. **Upgrading an existing deployment** needs nothing extra: `npx wrangler deploy` applies the migration once. Don't edit or remove the `v1` migration afterwards; a future change to the class (renaming or deleting it) needs a new migration with a new tag.
6. **Point the app at it.** In the GitHub repo, open **Settings → Secrets and variables → Actions → Variables**, add a variable named `COACH_URL` with that address (no trailing slash), then re-run the deploy workflow. The button appears for follow-through and getting-along goals.

If the app moves to another domain, add it to `ALLOWED_ORIGINS` in `wrangler.toml` and redeploy.

## Develop

```sh
npm test            # unit tests (no API calls; Claude and the Durable Object are fakes)
npm run model-test  # compare models on real weeks (needs ANTHROPIC_API_KEY; see above)
npm run typecheck
npx wrangler dev    # local server on :8787 (needs ANTHROPIC_API_KEY in .dev.vars; runs the Durable Object locally)
```

The counters' SQL is tested against Node's built-in SQLite (Node 22.13 or later); on older Node those few tests are skipped and the rest still run.
