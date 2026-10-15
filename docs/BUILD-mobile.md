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
      the English copy put `"CFBundleDisplayName" = "Forever Mine";`
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

## Icons and splash

The masters are in `assets/` and are drawn in code: a faceted diamond over
the mine strata, with the volcano's glow underneath. Regenerate every native
size after changing them:

```
npx capacitor-assets generate --ios --android \
  --iconBackgroundColor '#0a0710' --iconBackgroundColorDark '#0a0710' \
  --splashBackgroundColor '#0a0710' --splashBackgroundColorDark '#0a0710'
```

## Troubleshooting

* **The app shows an old version of the game:** you forgot `npm run sync`.
* **The leaderboards say offline:** the phone has no network, or the Supabase
  project is paused (free projects pause after a week without activity).
  Restore it from the Supabase dashboard.
* **Xcode reports "No such module 'Capacitor'":** *File → Packages → Reset
  Package Caches*, then build again.
