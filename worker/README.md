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
- for reviews, the reply suggests the person may be in crisis. It goes **straight to the largest model**, skipping the middle one (even when the spend breaker has capped other requests at Haiku; see [Limits](#limits-on-spending-and-abuse)), and the app shows support links. These links are part of the app and don't depend on the AI. If the largest model then fails in any way (cut off, refused, overloaded, rate-limited), the smaller model's reply is returned rather than an error, also when a spare model below the starting tier answered after the larger ones were down. A reply that flags support but fails the worker's checks is kept the same way, as a support reply without its changes. So a support flag, once a model has given one, is never lost (a reply cut off at the length limit can't be read, so it gives none);
- for reviews, a plan clearly fell short but the reply left it unchanged: five days into the week, done on fewer than half its target days, and either done on fewer than half the days it had the chance (at least three such days) or no chance on at least three days (the cue rarely comes up). Unlogged days are missing data and count for neither. This rule-based check catches the most common thing a smaller model misses. It only asks a bigger model for a second opinion: the largest model may still leave the plan alone, for example after an unusual week the person expects to pass;
- **the model is unavailable**: overloaded, erroring or timing out. Our own rate or spend limit (429) is deliberately *not* a reason to move up, because that would let anyone who floods the cheap model turn it into spending on the expensive one. Each model has its own capacity, so the next one usually works. If every model on the way up is unavailable, smaller ones below the starting tier are tried before giving up. If everything is down, the app says the AI is busy, and planning works without it.

The settings are `COACH_MODEL` / `COACH_MAX_MODEL` and `REVIEW_MODEL` / `REVIEW_MAX_MODEL` in `wrangler.toml`. "Ask for a more thorough review" starts one tier up. On Sonnet and Opus, Anthropic's server-side fallback also retries some refusals; Haiku has none, so its refusals escalate instead. A fallback is billed per attempt (a model that declines part-way is billed too, and the fallback model at its own price, e.g. Opus 5 at $5 / $25), so the worker prices each attempt in `usage.iterations` by the model that ran it, and an unknown model at twice the highest current rate. The worker logs which model answered each request and why smaller ones were skipped, never what people wrote, so `npx wrangler tail` shows how often escalation happens.

**Before launch, run the held-out set** (below) on the two candidate ladders, `haiku>opus` and `sonnet>opus`, and start on the cheaper one if it scores about as well. Switching is a one-line change.

## Limits on spending and abuse

The app has no accounts and keeps personal data on the device, so the worker can't limit people, only networks and money. Each limit below is checked before any model is called.

| Limit | What happens | Setting |
|---|---|---|
| **Origin** | Only the app's own site (and the App Store app) gets an answer. Browsers enforce this; scripts can fake it, so the limits below don't rely on it. | `ALLOWED_ORIGINS` |
| **Per minute** | At most 10 AI requests a minute per client network, else 429 "Try again in a minute." | `[[ratelimits]]` in `wrangler.toml` |
| **Per day, per network** | At most 40 AI requests and $0.20 (a tenth of the daily budget) per client network per UTC day, else 429 "Daily limit reached for now. Try again tomorrow." Requests in flight count toward the dollars at their worst case: while they take up the rest of them, further requests from that network run on Haiku alone (as in cheap mode, below) until they finish, so concurrent requests can take a network past $0.20 by at most one request's worst case, plus Haiku calls. Requests turned away for size, bad input, a closed breaker or a cap don't count, and neither do requests no model answered (every model unavailable). | `NETWORK_DAILY_CAP` (default `"40"`), `NETWORK_DAILY_USD` |
| **Per day, per prefix and provider** | An IPv6 /48 (65,536 /64s, handed out free by tunnel brokers) may use 5× a network's requests and a quarter of the budget; one ASN (`request.cf.asn`) half the budget. Their dollars count requests in flight the same way. So no single routed prefix or provider can rest the AI for everyone. | derived from the two above (`capsFor` in `src/spend.ts`) |
| **Request size** | Bodies over 16 KB get 413 "That's more text than the AI can take. Shorten …" before they're read further. The largest real request (a review with six plans) is a few KB. | `MAX_BODY_BYTES` in `src/body.ts` |
| **Reply length** | Each model call may write at most 2000 tokens (was 4000), which bounds the cost of a runaway reply. Thinking counts toward this (Haiku 5.5 and Opus 5.5 think by default), and a reply cut off at the limit escalates as `invalid`. | `MAX_OUTPUT_TOKENS` in `src/models.ts` |
| **Daily spend breaker** | Below half the daily budget, the usual model ladders. From half: **cheap mode**, every request stops at Haiku, except reviews that may involve a crisis (below); "Ask for a more thorough review" answers "A more thorough review isn't available right now. Try again tomorrow." without counting. At the full budget: **closed**, new AI requests get 503 `{ error: "The AI is resting until tomorrow. Planning works without it.", resting: true }` until midnight UTC. | `DAILY_BUDGET_USD` (default `"2"`) |
| **Crisis reserve** | Whether a reply involves a crisis is only known after a model call, so a new request is turned away when the breaker is closed (the app's support links are always there and don't depend on the AI). In cheap mode, a review whose Haiku reply flags support, asks for a more capable reviewer, or that Haiku refuses may still go to the top model, if its worst case fits in budget + reserve (checked and reserved in one step, so concurrent crisis calls can't all slip through), the network has used fewer than 3 such calls today, and its dollars (and its /48's and ASN's), counting requests in flight, are under their caps. So does a Haiku reply that flags support but fails the worker's checks. Otherwise, or if that call fails, Haiku's reply stands: one that flags support is returned (without its changes, if they failed the checks), and a refusal stays an error. The app shows every AI error with the same support lines as a support reply (988, the US domestic violence hotline, findahelpline.com). | `CRISIS_RESERVE_USD` (default `"0.5"`), `NETWORK_DAILY_CRISIS` (default `"3"`) |
| **Monthly** | The Anthropic workspace spend limit, the backstop for everything above. | Anthropic Console |

**A client network** is one IPv4 address, or one IPv6 /64 (phones and home routers rotate addresses within their /64, so counting single IPv6 addresses would be no limit at all). Everyone behind one shared address shares its allowance: an office, a school or campus Wi-Fi, a mobile carrier's NAT (CGNAT), and probably iCloud Private Relay users, whose traffic leaves through shared addresses. 40 requests a day is generous for one person (a few plans and one review a week), but a class of 30 on one campus address would hit it, and the message reads as a personal limit. The dollar cap is the real protection (40 Haiku requests cost about a cent), so if the app is used in such places, raise `NETWORK_DAILY_CAP` to 200–300 and keep `NETWORK_DAILY_USD` as it is.

**Privacy.** The counters store no addresses: only a SHA-256 hash of the network (and of its /48 and ASN), salted with `NETWORK_SALT` and the date (so rows can't be linked across days), and that day's request count, dollars and crisis calls. Key rows are deleted at the first request of the next UTC day; spend totals (route, model, dollars, number of calls) are kept one extra day for `/admin/spend`. If `NETWORK_SALT` isn't set, a constant from the code is used; anyone with that constant and a copy of the counters could recover IPv4 addresses by trying all four billion, so set a random salt: `openssl rand -hex 32 | npx wrangler secret put NETWORK_SALT`.

**Where the numbers live.** One SQLite-backed [Durable Object](https://developers.cloudflare.com/durable-objects/) (`Limits`, in `src/limits.ts`) holds the day's spend by route and model, the reservations of requests in flight, and the per-key counts, so every copy of the worker sees the same totals. Each AI request costs one round trip to it before and one after:

- **Before:** decide the breaker's mode on spend **plus reservations**, check the caller's caps, count the request and **reserve its worst case** (every tier on its ladder writing 2000 tokens, plus a full fallback attempt on Sonnet and Opus, with one input token per byte of the prompt: about $0.25 for a review on the full ladder and $0.002 on Haiku alone). Requests in flight therefore can't overshoot: normal mode ends once spend plus reservations reach half the budget, and the day closes once they reach all of it.
- **After** (once the response is sent): replace the reservation with the actual cost of every model call. A call that timed out or lost its connection may still have been answered and billed, so it counts as its tier's worst case once per attempt (twice, since the SDK retries once). The whole request runs under `waitUntil`, so a client that leaves mid-request doesn't stop it from being recorded. A reservation that's never settled anyway (the worker died, Cloudflare stopped the request, or the record call kept failing) expires after 10 minutes and counts **in full**, shown as model `unsettled` in `/admin/spend`. Each request's record carries its id, even when the first round trip seemed to fail (it may have reached the object and reserved before timing out), and each id is counted once, so recording is idempotent: a retry or a late record can't count twice.
- A possible crisis in cheap mode takes one more, to check and reserve the crisis call.

**If the object can't be reached** (or the `LIMITS` binding is missing, which logs `{"alert":"limits-binding-missing"}` once per worker instance; `[env.*]` sections in `wrangler.toml` don't inherit the binding), each worker instance falls back to its own memory: requests run in cheap mode (or stay closed, if that instance last saw the day closed), each network and IPv6 /48 is held to its daily request cap per instance, each instance spends at most a tenth of the daily budget (counted at each request's worst case on Haiku) and then answers 503 "The AI is busy right now…", and **no crisis calls** go to the top model (Haiku's reply, which flags support, stands). Record calls are retried once, and those with model calls are then kept to send with the next one. This is looser than the shared counters (Cloudflare runs many instances), so the monthly workspace limit is the backstop during an outage. Networks already over their cap, and a day whose spend has reached the budget, are remembered per instance and turned away without a round trip (a raised budget asks the object again), so a flood on a closed day doesn't reach it. The rules themselves are plain functions in `src/spend.ts`, tested without Cloudflare.

**Raising the budget.** Change `DAILY_BUDGET_USD` (and, if you like, `CRISIS_RESERVE_USD`) in `wrangler.toml` and run `npx wrangler deploy`; it takes effect on the next request, including on a day that's already closed. For a quick change without a deploy, edit the variable in the Cloudflare dashboard (Workers → trait-trainer-coach → Settings → Variables), but the next deploy from `wrangler.toml` overwrites it. `DAILY_BUDGET_USD = "0"` turns the AI off, checked before the counters, so it holds while they're unreachable too. The per-network dollar caps follow the budget unless `NETWORK_DAILY_USD` is set. While the counters work, a day's spend stays within the budget plus the crisis reserve ($2.50 at the defaults, about $78 a month). Reservations count one input token per byte of the prompt, which no text exceeds, so spend can only go past that by a call that timed out (counted at twice its worst case, more than was reserved for it), by a server-side fallback to a model the worker has no price for, or while the object is unreachable (above). So set the workspace's monthly limit a little above $78; that limit, not the worker, is the hard ceiling.

**Seeing the spend.** Each request logs one line like `{"route":"review","mode":"normal","depth":"standard","tier":"haiku","escalations":[],"calls":1,"cost":0.000842,"outputTokens":[412],"cutoffs":0}`; failed requests log `failed` with the last tier tried and every escalation. Watch them with `npx wrangler tail`. For the day's totals, set an admin token (`openssl rand -hex 32 | npx wrangler secret put ADMIN_TOKEN`) and:

```sh
curl -H "Authorization: Bearer $ADMIN_TOKEN" https://trait-trainer-coach.<you>.workers.dev/admin/spend
curl -H "Authorization: Bearer $ADMIN_TOKEN" "https://trait-trainer-coach.<you>.workers.dev/admin/spend?day=2026-10-14"   # yesterday
```

It returns the spend by route and model, the reservations in flight (`pending`), the number of client networks and requests (no addresses or hashes), the budget and the breaker's mode. Without `ADMIN_TOKEN` the endpoint doesn't exist (404).

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

**After the reply limit change (`max_tokens` 4000 → 2000), run the model test once** and check its `max out tokens` and `cut off` columns: a reply cut off at the limit escalates as `invalid`, the same as malformed JSON. The visible JSON is a few hundred tokens, but thinking counts toward the limit too (Haiku 5.5 thinks adaptively and Opus 5.5 always does), so look at the largest count, not the typical one. The model test only covers reviews, so after deploying also watch `cutoffs` and `invalid` escalations for **both** routes in `npx wrangler tail` (the `/coach` route has the same 2000 cap). If cut-offs show up, raise `MAX_OUTPUT_TOKENS` in `src/models.ts`; the reservations follow it.

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

4. **Check the limits** in `wrangler.toml`: `DAILY_BUDGET_USD` (default $2 a day), `CRISIS_RESERVE_USD` ($0.50), `NETWORK_DAILY_CAP` (40 requests per network per day), and optionally `NETWORK_DAILY_USD` (default a tenth of the budget) and `NETWORK_DAILY_CRISIS` (3). See [Limits](#limits-on-spending-and-abuse).
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
