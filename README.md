# 🌱 Trait Trainer

An evidence-based web app that helps people **follow through** (conscientiousness) and **get along better** (agreeableness), by practising small, planned actions week after week. The questionnaire measures all five Big Five traits; new goals focus on these two, and the challenge library still covers extraversion, openness and emotional stability for people who already work on them.

It runs entirely in the browser. There is no account and no server, and all data stays in the user's `localStorage`. The published site counts anonymous usage with [GoatCounter](https://www.goatcounter.com) (screen views and milestone names such as `check-in`; no cookies, never answers or scores; see `src/lib/analytics.ts`), and users can turn this off in Settings. On a phone it can be installed to the home screen and works offline.

## Install on your phone

Trait Trainer is a progressive web app (PWA): one codebase that works in any browser and installs like an app.

- **iPhone (Safari):** open the site, tap **Share**, then **Add to Home Screen**.
- **Android (Chrome):** open the site, tap the **⋮** menu, then **Install app** (or **Add to Home screen**).

Once installed it opens full screen with its own icon. A service worker (`public/sw.js`) caches the app so it works offline, and the fonts are bundled rather than loaded from a font service. Your data stays on the device. Installing on a second device doesn't copy it; use Settings → Move your data (a copy-and-paste transfer code) or Export / Import backup to move it.

**On iPhone, install before you start.** A Home Screen app on iOS keeps its own storage, separate from Safari's, so progress made in Safari doesn't appear in the installed app. The app warns iPhone Safari users about this up front. If you've already started in Safari, copy a transfer code in Settings → Move your data, then paste it when the installed app first opens. The app also asks the browser to keep its storage persistent.

## How it works

The program borrows ingredients from interventions that researchers have studied:

- Hudson & Fraley (2015): two 16-week student studies that randomly assigned a weekly planning exercise.
- Hudson et al. (2019): a 15-week student study of weekly trait challenges, with no control group.
- The PEACH smartphone trial (Stieger et al. 2021): a randomized trial against a 1-month waitlist.

The common ingredients are self-chosen trait goals, concrete weekly actions (with if-then plans in Hudson & Fraley's second study and in PEACH), progress tracking and repeated measurement. The exact combination below has not been tested, and some details are the app's own (the main ones are noted in the steps).

1. **Measure.** Take the public-domain IPIP 50-item Big Five questionnaire. Percentiles are rough, based on about 19.7k online respondents. An optional PHQ-4 well-being screen points people to professional help when that's warranted.
2. **Choose one goal and commit.** The app starts with one trait (PEACH also used one) and adds a short 1–5 commitment check. In a preregistered study of 956 people, commitment was the only predictor linked to change on every measure, including observer ratings (Olaru et al. 2026). A lukewarm score prompts the user to pick a goal they care about more, or a narrower one. A second trait unlocks at the consolidation step. The app lists the traits in a fixed order and never assigns or ranks a goal. In two student studies, doing emotional-stability challenges went with self-rated growth only for people who had chosen that goal themselves, while conscientiousness challenges went with growth either way (Hudson 2021).
   - **Follow-through goals start from one real problem:** a task or commitment the user keeps putting off, in their words, plus a sign they'd see if it were getting better. Today and the planner show both.
   - **The stepwise path** shown on Today: choose and commit → small, sure steps (weeks 1–3) → build habits (weeks 4–8) → consolidate and re-check (weeks 9–12, optional second trait) → maintain. Shorter programs shrink each step. Each goal follows its own path from the day it was set, so a switched or added trait starts with small steps. Steps 1–3 target things that predicted change in studies (commitment, completing small concrete plans, enjoyable repeated practice, habits over quick fixes; see `docs/RESEARCH.md` §2), and step 5 follows the long-term follow-ups. One trait at a time matches PEACH and Hudson (2021), though no study compared it with several at once. The consolidation step and the order are the app's own and untested: we found no study that tested an order across traits.
3. **Weekly challenges.** There are 74 concrete challenges across 33 techniques. Each technique carries an evidence rating (strong / moderate / emerging) and says *what outcome* the evidence is for. The rating is for the general technique, which was often tested as one part of a larger program; no study has tested these exact exercises or this app.
   - Every challenge requires an **if-then plan** (implementation intention), written with a two-part form ("If or when…", "…then I will") or freely, with an optional 30-second mental rehearsal.
   - **Barrier-matched suggestions** for follow-through: the user picks what usually gets in the way (unclear first step, too big, distraction, perfectionism, discomfort, forgetting, or something else). The planner shows a small matched response and marks the challenges that fit. These pairings are CBT-informed suggestions; procrastination treatments were tested as whole programs (Rozental et al. 2018), not piece by piece.
   - Users rate their confidence. Below 7/10, the app nudges them to shrink the challenge. The 7/10 cut-off is the app's own. In Hudson et al. (2019), among people who completed the same number of challenges, those who had accepted more (and so left more unfinished) tended to grow less than their peers (except for openness). This finding is correlational.
4. **Adaptive difficulty.**
   - The app starts every goal at Easy. After a week at 80% or more of targets that you didn't dislike, it suggests Medium; below 50%, it suggests an easier level and fewer challenges. It never moves you to Stretch on its own: Stretch challenges stay available to pick. The cut-offs are the app's own. Hudson et al.'s (2019) study website suggested slightly harder challenges after successes, but the authors say this was not tested, and on average harder challenges did not predict more change. In PEACH data, easier plans went with more goal-consistent days (Olaru et al. 2026). Suggesting fewer challenges after a weak week is the app's own inference from the accepted-versus-completed finding above.
   - Challenges you completed and enjoyed are suggested again, and disliked ones sink. In PEACH data, people who completed more if-then plans and rated them as more pleasant reported slightly more trait change, though observer ratings did not show this (Olaru et al. 2026, correlational).
5. **Follow-through kit.** No study has tested building conscientiousness first to reduce dropout (see `docs/RESEARCH.md` §3), so the app lends structure instead: a daily calendar reminder (.ics download), a ready-made message asking someone to check in, and an if-then plan for missed days. It opens by default for people lower in conscientiousness during the first steps, and a "welcome back" tip appears after two or more missed days (the top nudge in a gym megastudy rewarded returning after a miss; Milkman et al. 2021).
6. **Daily log and check-in.** Your goals and your own reasons for them stay on the Today page, with a badge counting the days you did each goal's planned actions this week. Each planned action has one record: tap the big tick when you did it, or log what happened instead (tried part of it, had the chance and skipped it, or no chance came up). A day with no entry stays blank rather than counting as a miss. Separately, the 20-second check-in rates how you acted today in the goal direction (1–7) and logs your mood. Sustained low mood triggers support resources. Weeks logged before outcomes were recorded keep their old meaning (days a challenge was practised) and aren't converted.
   - **Progress** keeps four kinds of number apart: what you did (action records, with how many days have any record), daily check-ins (self-ratings, with how many days were rated), questionnaire scores (the app's only personality measure) and friend ratings.
7. **Weekly reflection.** Shows each plan's record for the week, including days with no entry and any changes to the plan's wording, asks whether each plan was worth keeping (as is, with changes, or dropped) and what the main barrier was, then asks what went well and which strengths you used, then turns obstacles into new if-then plans (WOOP).
   - Plans the user keeps are filled in on next week's plan, and the "do differently" answer can replace a chosen plan's wording. Repeating a useful action is encouraged; nothing forces new or harder challenges.
8. **Re-measure every 4 weeks** over a 12-week program, with progress charts. The 12-week path is a suggested schedule that counts time, not improvement: it can be paused, stretched by a week, or restarted from the start of the current step. This schedule is the app's own: PEACH's main trait measurements were before, right after and 3 months after the program. Once every goal has finished its path (week 12 for a single goal), the app switches to maintenance: one favourite challenge per goal and a retake about every 3 months. In PEACH's one-year follow-up, extraversion and conscientiousness gains held without growing and neuroticism kept falling, among the roughly 10% who answered (Stieger et al. 2024).

The **Toolkit** page lists every technique with its evidence and citations. The **Science** page opens with a swipeable deck of cards, one key finding per card with a chart of the study's own numbers and its source, followed by the full evidence and its honest caveats. For the full literature review, see [`docs/RESEARCH.md`](docs/RESEARCH.md). The app itself hasn't been tested yet; [`docs/EVALUATION.md`](docs/EVALUATION.md) sets out how to test it.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit + content-integrity tests (vitest)
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build
```

The build is fully static, with relative asset paths and hash routing. Host `dist/` anywhere: GitHub Pages, Netlify, S3, or any file server.

### Deploying to GitHub Pages

`.github/workflows/deploy.yml` tests, builds and deploys on every push to `main`. To turn it on, open **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**. On a private repository, GitHub Pages requires a paid GitHub plan.

## Design

The look combines two explored directions: "Steady" (a cool off-white ground, pine accent and sage tints, Manrope headings and Figtree body) and "Momentum" (chunky buttons with a darker bottom edge, a streak badge and the path drawn as a winding trail of steps). Colours are CSS custom properties at the top of `src/styles.css`, with a dark palette; every text and background pair meets WCAG AA. On phones a bottom tab bar holds the five sections (Today, Plan, Progress, Learn, Settings); on wider screens they sit in the header.

## Project structure

```
src/
  data/          content: questionnaire, norms, traits, techniques, challenges, references
  lib/           pure logic: scoring, program/adaptation rules, coach tips, dates, storage
  pages/         one component per screen (Welcome, Assess, Results, Goals, Today, Plan, …)
  components/    shared UI (trait bars, SVG charts, evidence pills, citations)
docs/RESEARCH.md literature review behind the design
```

Content lives in plain TypeScript data files. To add a challenge, append it to `src/data/challenges.ts`. The tests check that it points at an existing technique for its trait, has an `If …, then …` example, and cites only references that exist.

## Important limitations

- **Not therapy.** The app is a self-improvement tool. It shows crisis resources (988 in the US, findahelpline.com) and recommends professional care when screening suggests it.
- **Effect size, in context.** Pooled across 7 studies, targeted traits changed by d ≈ 0.22 in programs averaging about 10 weeks (range 2–16; before-after, within program groups; Haehner et al. 2024): by a rough cross-study comparison about five times natural change over the same period, and probably below therapy (d ≈ 0.37, mostly clinical samples). The best-controlled app trial (CHILL, active control) found a self-reported d ≈ −0.24 for neuroticism, similar to therapy in non-clinical samples; peer ratings showed weaker change, only at follow-up (Wright et al. 2026). People who did the work changed more (a predicted 0.4 SD over 4 months for emotional-stability students who completed many challenges; Hudson 2021). Most outcomes are self-reported. Pooled across traits, observers in PEACH saw increases about two-thirds as large but not decreases, and in a light-touch program a waitlist improved nearly as much (Krämer et al. 2025), so expectation or selection can inflate self-reports, though in a student study, expectation alone gave no self-rated change (Hudson 2021).
- **Untested combination.** Trait Trainer combines ingredients from studied interventions with some design choices of its own, and the app itself has not been evaluated in a trial.

## iPhone app (App Store)

The same app is wrapped with Capacitor for the App Store, with daily reminders as phone notifications. The Xcode project is in `ios/`; see [`docs/IOS.md`](docs/IOS.md) for building on a Mac, TestFlight, and the App Store privacy answers.

## Personalised suggestions

The planner ranks challenges from each person's own log with a small Bayesian model and Thompson sampling (`src/lib/personalize.ts`). It runs on the device and sends nothing anywhere.

- **What the model tracks:** for each challenge, how likely the person is to do it on a day the moment comes up.
- **Starting guess:** easier challenges are expected to go better, and challenges that fit the person's main barrier slightly better still.
- **Updates from the log:** "done" counts for the challenge, "skipped" against it, and "tried part of it" as half of each. "No chance came up" and unlogged days are ignored. Experience with other challenges of the same technique counts a little.
- **Ranking:** Thompson sampling draws a plausible success rate for each challenge and ranks by the draws. Proven challenges rise, ones they keep skipping sink, and untried ones still get a turn. Draws are seeded by week, so the list doesn't reshuffle while someone is planning.
- **Repeating what works:** the challenge that has worked best (done on at least 60% of 3+ logged days, and not disliked) stays on top.
- **Targets and reasons:** suggested targets are about one day more than the person has been managing. Each card says why it's suggested, from their own record.

The starting guesses are the app's own, not research estimates. `src/lib/simulate.ts` compares this model with the old fixed rules on simulated people, whose behaviour is also an assumption. Over 12 weeks the model got about 14% more practice done and 75% versus 66% of weekly targets met; over the first 4 weeks, about 7% more practice. Read that as evidence that the model learns as designed, not as a prediction for real users.

## AI coach and weekly review (optional)

On the Plan page, **Help me write this plan** turns a real situation the user describes ("tomorrow's 9am meeting with Alex") into three if-then plans for the challenge they picked, written by Claude through a small Cloudflare Worker that keeps the API key private (`worker/`). Only the goal, the chosen challenge, the current plan and the typed situation are sent, the user is told so at that point, and nothing is stored. Suggestions are always ways to do the chosen challenge, never a different exercise, and replace the plan's wording only when the user picks one; the earlier wording is kept. Asking the coach doesn't log anything as done. The button only appears when the site is built with `COACH_URL` set; see [`worker/README.md`](worker/README.md) to deploy it.

On the weekly reflection, **Review my week** sends that week's plans, what was logged each day and the reflection to the same worker. Claude proposes at most two changes for next week: a reworded if-then plan for the same challenge, a new target, or dropping a challenge. Each change comes with a one-line reason, and the user applies it or ignores it. Applied changes only pre-fill next week's plan. Both AI features start on the cheapest Claude model (Haiku 5.5) and escalate to Sonnet, then Opus, only when needed: the model refuses, gives an invalid reply, flags the request as beyond it, the person may be in crisis, or the model is overloaded or down. `worker/README.md` explains the model settings and the model test (`npm run model-test`) that compares Haiku, Sonnet and Opus on 20 realistic weeks.

## Friend ratings

Progress → **How others see you** creates a link to send to someone who sees you often. They rate you on observer versions of the IPIP conscientiousness and agreeableness items (`src/data/observer.ts`), plus how much you've changed in the past couple of months, in their own browser with nothing stored there. Their answers come back as a reply link that adds the rating to your data, so no server is needed. It's optional and the rest of the app doesn't depend on it. You give each person a private label, so a later rating from the same person is compared with their first (their baseline). A single rating is shown as a snapshot, never as change, and their recalled "change over two months" is labelled as an impression, not a measurement. Your own score is shown separately. Expect observers to see less change than you do: in PEACH they did, perhaps because self-ratings can be pushed up by hopes and expectations, or because long-time friends update their view slowly (Stieger et al. 2021).

## Possible next steps

- **Web push reminders** for the website (the iPhone app already uses local notifications; the website offers a calendar file).
- **Accounts & sync** across devices.
- **Facet-level goals**, e.g. "organization" rather than all of conscientiousness. In PEACH, self-reported change concentrated in a few facets (sociability, organization, productiveness), and a two-week openness program changed the targeted facet without moving broad openness (Olaru et al. 2024; Stieger et al. 2020).
- **Change direction:** let people work on less as well as more of a trait (e.g. "more assertive, less people-pleasing"), keeping increased neuroticism excluded. Reviews argue that no trait level is ideal in every context (Haehner et al. 2026; Asselmann et al. 2026).
- **Rate enjoyment at check-off** instead of only in the weekly reflection. PEACH asked about pleasantness the same evening (Olaru et al. 2026).
- **A baseline week** of daily ratings before challenges start, so daily progress is compared with your usual days rather than with the day you felt motivated enough to sign up (Krämer et al. 2025; Olaru et al. 2026).
- **Worry log:** quick daily counts of worry episodes and minutes for emotional-stability goals. In worry-postponement trials, logging alone also reduced worry (Dippel et al. 2024).
