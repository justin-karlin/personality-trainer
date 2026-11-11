# Trait5: project guide

Read this before changing anything. It records what the app is for, the rules it is built
by, and what is deliberately parked.

## What it is for

Trait5 helps people **follow through** and **get along better** by practising small,
planned actions each week for 12 weeks. A person takes a short questionnaire, picks one
goal, chooses about two challenges a week, writes an "if [moment], then I will [small
step]" plan for each, logs each day, and reflects weekly.

It is a practice tool, not therapy and not a diagnosis.

## What matters most right now

**Real users before more features.** The app has had no outside users yet. The next
milestone is 10–20 people using it for 2–4 weeks. Watch whether they return in weeks 2
and 3, log days, and finish a reflection. Until that data exists, prefer fixing what
blocks a tester over building anything new.

## Product rules

- **Little text, big type.** A screen is a title, at most one short sentence, and its
  actions. Body text is 19px and nothing people read is under 17px (`--fs-*` in
  `src/styles.css`; only chart ticks and source lines use 15px). Tap targets are at
  least 44px. Rationale goes behind at most one collapsed "Why?" per screen, or is cut.
- **The person chooses.** The app suggests and explains; it never picks a goal or implies
  an ideal personality.
- **Safety lines stay.** 988, 1-800-799-7233 and findahelpline.com stay wherever they
  appear now, along with the not-therapy note and its checkbox. Shorten, never remove.
- **Data stays on the device.** No accounts, no server. The only thing sent is anonymous
  usage counts (`src/lib/analytics.ts`), with an opt-out in Settings.
- **Say only what the code does.** `public/privacy.html` and the App Privacy table in
  `docs/IOS.md` must match the code. Change them in the same commit as any change to
  what leaves the device.
- **Claims follow the research.** User-facing claims trace to `docs/RESEARCH.md` and
  `src/data/references.ts`. Say "built on research-backed strategies", not
  "evidence-based" or "proven".
- **Personalise from the person's own data.** Questionnaire scores set the start
  (`src/lib/start.ts`); after that their own log leads (`src/lib/personalize.ts`,
  `src/lib/program.ts`).

## How it is built

- React 19, Vite, TypeScript, a hash router. Pages in `src/pages`, components in
  `src/components`, logic in `src/lib` (pure functions with tests next to them), content
  in `src/data`, all CSS in `src/styles.css`.
- **Website:** GitHub Pages, deployed from `main` by `.github/workflows/deploy.yml`. It is
  also an installable offline web app (`public/sw.js`, `public/manifest.webmanifest`).
- **iPhone app:** the same build wrapped with Capacitor (`capacitor.config.ts`, `ios/`).
  Steps for a person to follow are in `docs/IPHONE-SETUP.md`.
- **Storage:** `src/lib/durable.ts`. Plain `localStorage` on the web; on iPhone also
  Capacitor Preferences. **Never rename the `trait-trainer:*` storage keys** or change
  the stored format without a migration: people would lose their data. The same goes for
  the GoatCounter site name and the repository name (links depend on them).
- **Keep it simple.** Prefer deleting to adding. No new subsystem, dependency or setting
  without a need seen in real use.

## Checks and shipping

```
npm test && npx tsc --noEmit && npm run build        # the app (run from the repo root)
cd worker && npm test && npm run typecheck           # the AI worker, only if it changed
```

Work on a branch, open a pull request, wait for the `build` check, then merge. Merging to
`main` publishes the website. For anything visual, look at it at iPhone size (390px wide,
and 320px) before shipping.

The repository is public. Never commit secrets, API keys, personal contact details or
business plans, and never ask anyone to paste a key into a chat.

## Parked on purpose

- **AI coach and weekly review** (`worker/`, `src/lib/ai.ts`). Built and tested but
  switched off: the website and `npm run ios` build with `VITE_COACH_URL` empty. Turning
  it on takes the three changes listed in `worker/README.md`, after one run of the
  `holdout3` model test. Rule already agreed: if the cheapest model misses any week that
  needs support, reviews start on the middle model instead. Don't tune prompts further
  until real people use it.
- **Handwired lab** (`lab/handwired/`). An experiment whose result was "not worth adding
  yet"; its README says why. Leave it alone unless real logs change the picture.
- **Re-tuning the suggestion model.** Its starting numbers are the app's own guesses.
  Refit them only from real logs, never from the simulator (`src/lib/simulate.ts`).
