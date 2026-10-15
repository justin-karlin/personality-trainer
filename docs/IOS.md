# Publishing the iPhone app

The App Store app is this same web app inside a native shell ([Capacitor](https://capacitorjs.com)). The Xcode project is in `ios/`, and its settings are in `capacitor.config.ts`.

Compared with the website, the app:
- **Reminds people daily through iPhone notifications** set on the phone itself. The follow-through kit's "Remind me daily" button replaces the calendar file.
- **Keeps its data inside the app.** People who used the website first can bring their data across with Settings → Move your data (a transfer code).
- **Shares rating links that point to the public website,** so friends can open them without the app.
- **Counts the same anonymous usage** (GoatCounter), with the same opt-out in Settings.

## What you need

- An **Apple Developer Program** membership ($99/year): https://developer.apple.com/programs/enroll/
- A **Mac with Xcode** (free from the Mac App Store), plus Node.js 22 or later.

## First build on your iPhone

```sh
git clone https://github.com/justin-karlin/personality-trainer.git
cd personality-trainer
npm install
npm run ios        # builds the web app, copies it into ios/, and opens Xcode
```

In Xcode:
1. Select the **App** target → **Signing & Capabilities**. Tick **Automatically manage signing**, and choose your team.
2. The **Bundle Identifier** is `io.github.justinkarlin.traittrainer`. It becomes permanent once you upload a build. To use your own domain, for example `com.yourname.traittrainer`, change it here *and* in `capacitor.config.ts` first.
3. Plug in your iPhone, select it as the run destination, and press **Run** (▶).

After any change to the web app, run `npm run ios` again; it rebuilds and syncs.

## Upload to TestFlight and the App Store

1. In [App Store Connect](https://appstoreconnect.apple.com), go to **Apps → + → New App**. Choose iOS, the name "Trait Trainer", your bundle ID, and an SKU such as `trait-trainer`.
2. In Xcode, choose **Product → Archive**, then **Distribute App → App Store Connect → Upload**.
3. Once processing finishes, the build appears under **TestFlight**. Install it with the TestFlight app and test it.
4. Fill in the store listing: description, keywords, screenshots (6.9" and 6.5" iPhone), a support URL and a privacy policy URL. Then submit for review.

### Privacy details ("App Privacy" in App Store Connect)

| Data | Collected? | Notes |
|---|---|---|
| Questionnaire answers, goals, plans, check-ins | **No** | Stored only on the device. |
| Usage data (product interaction) | **Yes, not linked to identity, not used for tracking** | Anonymous GoatCounter counts of screens and milestones. Users can turn it off in Settings. |
| Other user content | **Only if the AI coach is enabled** | The situation text a user types into "Help me write this plan", with the chosen challenge and their current plan, is sent to the coach server and to Anthropic to generate suggestions. It isn't stored by Trait Trainer and isn't linked to identity. |

You also need a privacy policy at a public URL that says the same things.

### Review notes

Apple can reject apps that are "just a website" (guideline 4.2). In the review notes, point out what this app does natively and offline:
- daily local notifications
- an offline questionnaire and a 12-week plan with on-device progress charts
- friend ratings

Mention that no account is needed and that all personal data stays on the device.
