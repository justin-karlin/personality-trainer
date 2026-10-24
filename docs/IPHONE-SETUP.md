# Trait5 on your iPhone: step by step

A checklist to come back to. Do the parts in order; each one ends with a check.

## Part 1. One-time Mac setup (about an hour, mostly downloading)

1. **Install Xcode.** Open the App Store on the Mac, search **Xcode**, click **Get** (free, about 10 GB).
2. **Open Xcode once.** Accept the licence. If it offers to install **iOS** support, say yes.
3. **Point the tools at Xcode.** In Terminal:
   ```
   sudo xcode-select -s /Applications/Xcode.app
   ```
   It asks for your Mac password. Nothing shows as you type; that's normal.
4. **Check Node.js.** In Terminal, `node -v` should print v22 or v24. If not, install the LTS version from https://nodejs.org.

✅ Check: `xcodebuild -version` prints a version number.

## Part 2. Get the latest app code

```
cd ~/personality-trainer
git checkout main
git pull
npm install
```

✅ Check: no red `ERR!` lines at the end.

## Part 3. Put Trait5 on your iPhone

1. Plug your iPhone into the Mac and unlock it. Tap **Trust** if it asks.
2. In Terminal (still in `~/personality-trainer`):
   ```
   npm run ios
   ```
   This builds the app and opens it in Xcode.
3. In Xcode:
   - In the left sidebar, click **App** (the blue icon at the top).
   - Open the **Signing & Capabilities** tab.
   - Tick **Automatically manage signing**.
   - **Team**: choose your Apple ID. If it isn't listed, choose **Add an Account…** and sign in. A free Apple ID works for your own phone.
   - **Bundle Identifier** should read `io.github.justinkarlin.trait5`. Leave it.
4. At the top of the Xcode window, pick **your iPhone** as the destination, then press **▶ (Run)**.
5. First time only, on the iPhone:
   - If it asks for **Developer Mode**: Settings → Privacy & Security → Developer Mode → On, then restart the phone.
   - If it says the developer isn't trusted: Settings → General → VPN & Device Management → your Apple ID → **Trust**.
   - Press ▶ in Xcode again.

✅ Check: Trait5 opens on the phone. Add a goal, swipe the app away completely, reopen it. The goal should still be there.

After any later code change: `git pull`, then `npm run ios`, then ▶.

## Part 4. TestFlight for your 10–20 testers

Needs the **Apple Developer Program** ($99/year): https://developer.apple.com/programs/enroll/ (approval can take a day or two).

1. In **App Store Connect** (https://appstoreconnect.apple.com): **Apps → + → New App**.
   - Platform iOS, name **Trait5**, bundle ID `io.github.justinkarlin.trait5`, SKU `trait5`.
2. In Xcode, set the destination to **Any iOS Device (arm64)**, then **Product → Archive**.
3. When the Organizer window opens: **Distribute App → App Store Connect → Upload**.
4. Wait for processing (an email arrives, 10–30 minutes). In App Store Connect open **TestFlight**:
   - answer the export-compliance question (the app uses no custom encryption: **No**);
   - add testers under **External Testing** (the first external build gets a short Apple review) or **Internal Testing** for people on your developer account.
5. Testers install the **TestFlight** app from the App Store and accept your invite.

✅ Check: you can install Trait5 through TestFlight on your own phone.

## Part 5. App Store listing (when you're ready to go public)

- **Privacy policy URL:** https://justin-karlin.github.io/personality-trainer/privacy.html
- **Support URL:** https://github.com/justin-karlin/personality-trainer/issues
- **App Privacy answers:** copy the table in [`IOS.md`](IOS.md#privacy-details-app-privacy-in-app-store-connect).
- **Review notes** (so Apple doesn't call it "just a website"): see [`IOS.md`](IOS.md#review-notes).
- **Screenshots:** 6.9" and 6.5" iPhone sizes. Take them in the Simulator (Xcode → choose an iPhone Pro Max simulator → ▶, then ⌘S).

## If something goes wrong

| Problem | Fix |
|---|---|
| `xcode-select: error` or `xcodebuild` not found | Part 1, step 3. |
| `npm run ios` fails with "No such module" or a package error | Run `npm install`, then `npx cap sync ios`, then try again. |
| Xcode: "Signing for App requires a development team" | Part 3, step 3: pick a Team. |
| Xcode: "Failed to register bundle identifier" | The ID is taken by another account: change it in Xcode **and** in `capacitor.config.ts` to something like `com.yourname.trait5`, before your first upload. |
| iPhone not listed in Xcode | Unlock it, re-plug the cable, tap Trust; turn on Developer Mode (Part 3, step 5). |
| App opens but looks old | `git pull`, `npm run ios`, ▶ again. |

Anything else: copy the error text and ask.
