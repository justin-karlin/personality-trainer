# 🌱 Trait Trainer

An evidence-based web app that helps people deliberately grow their personality traits: become more **conscientious**, **agreeable**, **extraverted** and **open**, and **less neurotic** (more emotionally stable).

It runs entirely in the browser. There is no account and no server, and all data stays in the user's `localStorage`.

## How it works

The program copies the structure of the interventions that have actually been tested (Hudson & Fraley 2015; Hudson et al. 2019; the PEACH trial, Stieger et al. 2021):

1. **Measure.** Take the public-domain IPIP 50-item Big Five questionnaire. Percentiles are rough, based on about 19.7k online respondents. An optional PHQ-4 well-being screen points people to professional help when that's warranted.
2. **Choose 1–2 goals.** Write why each one matters and what you'll do differently. Goals must be self-chosen: for emotional stability, only self-chosen goals worked (Hudson 2021).
3. **Weekly challenges.** There are 71 concrete challenges across 31 techniques. Each carries an evidence rating (strong / moderate / emerging) and says *what outcome* the evidence is for.
   - Every challenge requires an **if-then plan** (implementation intention).
   - Users rate their confidence. Below 7/10, the app nudges them to shrink the challenge, because accepting challenges and then failing them can backfire (Hudson et al. 2019).
4. **Adaptive difficulty.**
   - After a week at 80% or more of targets, the app suggests harder challenges. Below 50%, it suggests easier and fewer ones.
   - Completed and enjoyed challenges are suggested again (habit building; enjoyment predicts change). Disliked ones sink.
5. **Daily check-in.** Check off challenges, give a 1–7 rating of how you acted today in the goal direction, and log your mood. Sustained low mood triggers support resources.
6. **Weekly reflection.** Starts from strengths, then turns obstacles into new if-then plans (WOOP).
7. **Re-measure every 4 weeks** over a 12-week program, with progress charts.

The **Toolkit** page lists every technique with its evidence and citations. The **Science** page explains the research and its honest caveats. For the full literature review, see [`docs/RESEARCH.md`](docs/RESEARCH.md).

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
- **Modest effects.** Personality-change programs have a small average effect (d ≈ 0.22), and some self-reported change may come from expectations (Krämer et al. 2025). The app says so openly.
- **Untested combination.** Trait Trainer combines tested ingredients, but the app itself has not been evaluated in a trial.

## Possible next steps

- **Reminders:** a PWA with notifications, or calendar (.ics) export of if-then plans.
- **Friend/observer ratings:** let someone who knows you rate you, which is the best check on self-report bias.
- **Conversational coach:** a chatbot like PEACH, for example powered by Claude. It would need a small backend to keep the API key private.
- **Accounts & sync** across devices.
- **Facet-level goals**, e.g. "organization" rather than all of conscientiousness.
