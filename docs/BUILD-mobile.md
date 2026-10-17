# Building the iOS and Android apps

The apps are the same game as the web build, wrapped by Capacitor 8.
`ios/` and `android/` are real native projects, committed to the repo. Their
copy of the game is generated, so never edit it. The game is the files at the
repo root (`index.html`, `styles.css`, `src/`, `vendor/`).

```
npm run build    copy the game into www/
npm run sync     build, then copy www/ and plugin code into ios/ and android/
npm run ios      sync, then open the project in Xcode
npm run android  sync, then open the project in Android Studio
```

Run `npm run sync` (or `ios` / `android`) after **every** change to the game,
or the app will still run the old copy.

## One-time setup on the Mac

1. **Node 22 or newer:** `node -v`. If it's older, install the current LTS
   from nodejs.org, or run `brew install node`.
2. **Xcode** from the App Store. Open it once to accept the licence and install
   the iOS platform. No CocoaPods is needed, because the project uses Swift
   Package Manager.
3. **Android Studio** from developer.android.com/studio. On first launch let it
   install the SDK. In *Settings → Languages & Frameworks → Android SDK*, make
   sure **Android 16 (API 36)** is installed.
4. In the repo folder: `npm install`

## iOS

1. Run `npm run ios`. Xcode opens `ios/App/App.xcodeproj`.
2. Select the **App** target → **Signing & Capabilities**:
   - **Team:** HD Expanse LLC
   - **Bundle Identifier:** `com.hdexpanse.forevermine` (already set)
   - Leave *Automatically manage signing* ticked.
3. Plug in your iPhone (or pick a simulator) at the top of the window and press
   **▶ Run**. The first run on a phone asks you to trust the developer
   certificate: *Settings → General → VPN & Device Management*.
4. **Chinese home-screen name (one time).** This makes the icon read 矿世奇财
   on Chinese phones:
   1. *File → New → File… → Strings File*. Name it `InfoPlist.strings` and
      add it to the **App** target.
   2. Select it, then in the right sidebar click **Localize…** and choose
      English.
   3. Open the **App** project (not the target) → **Info → Localizations →
      +** → *Chinese, Simplified*. Tick `InfoPlist.strings` when asked.
   4. In the Chinese copy put `"CFBundleDisplayName" = "矿世奇财";` and in
      the English copy put `"CFBundleDisplayName" = "Forever Mine";`. Also
      add the Chinese tracking-prompt line from *Revive ads* below.
   5. Commit the changes Xcode makes under `ios/`.

To publish: *Product → Archive*, then *Distribute App → App Store Connect* for
TestFlight.

## Android

1. Run `npm run android`. Android Studio opens `android/`. Let the Gradle sync
   finish; the first one downloads a lot.
2. Plug in a phone with USB debugging on (*Developer options*), or create an
   emulator in the *Device Manager*, then press **▶ Run 'app'**.

To publish you need an upload key. Create it once and **back it up**: losing
it means you can't update the app.

1. *Build → Generate Signed App Bundle / APK → Android App Bundle →
   Create new…*
2. Save the `.jks` file **outside the repo**. `.gitignore` blocks `*.jks`
   anyway.
3. Enrol in **Play App Signing** when you create the app in the Play Console.

## What the app does differently from the web build

| | Web preview | App |
|---|---|---|
| Back button | browser history guard (`src/guard.js`) | Android back: closes prompts and panels, offers to leave a live mine, and only exits from the title (`src/native.js`) |
| Leaving mid-mine | "reload or leave this page" prompt | backgrounding pauses the mine |
| Login storage | localStorage | native Preferences, which the OS doesn't clear |
| Orientation | any | portrait only (iPad: portrait, full screen) |
| Status bar | n/a | hidden; HUD respects the notch and home bar |

## Revive ads (AdMob)

The revive is in `src/ads.js`; its tuning is in `CFG.revive` and the ad IDs
are in `CFG.ads` (`src/config.js`). The native app IDs are already in
`AndroidManifest.xml` / `strings.xml` and `ios/App/App/Info.plist`.

**Test ads vs real ads:** `CFG.ads.test` is `true`. Every build you run
yourself shows Google's **test** ads, labelled "Test Ad". Never tap a live ad
of your own: AdMob can ban the account for it. For the build you upload to the
stores only:

1. Set `test: false` in `CFG.ads`.
2. `npm run sync`, then archive / bundle.
3. Set it back to `true` and commit that.

**What players see:**
- On first launch: Google's consent form (EU/UK only), then Apple's tracking
  prompt (iOS only). If they refuse ads altogether, the revive is never
  offered.
- On death, if an ad is loaded and this run hasn't revived yet: **SECOND
  WIND?** with a 6-second countdown. Watching the whole ad revives them where
  they fell. Skipping the ad, NO THANKS, Android back, or the countdown running
  out all mean an ordinary death.

**One-time setup in the AdMob console** (*Privacy & messaging*):
- **European regulations → Create message.** Pick the app, choose your
  languages (English and Chinese), and publish. Without it, the EU consent
  form has nothing to show and EU players get no ads.
- **IDFA explainer** for iOS: optional, but it raises opt-in rates.
- Once the store listings exist, link them under *Apps → App settings*, so
  AdMob can verify `app-ads.txt` on your GitHub user site.

**Chinese tracking prompt (iOS):** use the same `InfoPlist.strings` step as
the Chinese app name, and add to the Chinese copy:
`"NSUserTrackingUsageDescription" = "让你选择观看的复活广告更贴合你的兴趣。不管选哪个，游戏体验都一样。";`

## Icons and splash

The masters are in `assets/` and are drawn in code: a faceted diamond over
the mine strata, with the volcano's glow underneath. Regenerate every native
size after changing them:

```
npx @capacitor/assets@3.0.5 generate --ios --android \
  --iconBackgroundColor '#0a0710' --iconBackgroundColorDark '#0a0710' \
  --splashBackgroundColor '#0a0710' --splashBackgroundColorDark '#0a0710'
```

(The generator isn't a project dependency, because it drags in image
libraries with open security advisories; `npx` fetches it only when you run
it.)

## Troubleshooting

* **`npm install` reports "3 moderate severity vulnerabilities":** they're
  inside the Capacitor command-line tool, in an old `uuid` copy pulled in by
  its Xcode-project helper. That code only runs on your Mac while syncing, on
  our own files, and the flaw needs inputs the tool never passes. The game the
  app ships has none (`npm audit --omit=dev` reports 0). **Don't run
  `npm audit fix --force`:** it downgrades the CLI to 8.4.3, which no longer
  matches the 8.5.2 runtime.

* **The app shows an old version of the game:** you forgot `npm run sync`.
* **The leaderboards say offline:** the phone has no network, or the Supabase
  project is paused (free projects pause after a week without activity).
  Restore it from the Supabase dashboard.
* **Xcode reports "No such module 'Capacitor'":** *File → Packages → Reset
  Package Caches*, then build again.
