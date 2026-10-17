# Store launch checklist

Phase 7 paperwork. ✅ = ready in the repo, ☐ = needs you or a running app.

## Ready to paste or upload
- ✅ Listing text, EN + 中文, both stores, all within character limits: `listing.md`
- ✅ App Privacy (Apple) and Data safety (Play) answers: `privacy-and-ratings.md`
- ✅ Age-rating, target-audience, ads, export-compliance answers and App Review notes: same file
- ✅ Privacy policy and support page, EN + 中文: `site/forevermine/` (see `site/README.md`)
- ✅ In-game privacy policy link on the title and profile screens (Apple requires one)
- ✅ Play feature graphic, EN + 中文: `assets/store/`
- ✅ App icon and splash: `assets/` (already generated into `ios/` and `android/`)
- ✅ `app-ads.txt`: already correct on wuxiascrub.github.io

## Your steps
1. ☐ Choose a **support email** and replace `{{CONTACT_EMAIL}}` in both pages.
2. ☐ Copy `site/forevermine/` into the wuxiascrub.github.io repo and check both URLs open.
3. ☐ **App Store Connect:** create the app (name *Forever Mine: Gem Rush*,
   bundle ID `com.hdexpanse.forevermine`, SKU e.g. `forevermine`, primary
   language English). Add a *Chinese (Simplified)* localization and paste the
   中文 text into it.
4. ☐ **Play Console:** create the app (default language en-US, game, free).
   Add a *Chinese (Simplified) – zh-CN* translation.
5. ☐ Fill in App Privacy / Data safety, content ratings, target audience
   (13+), ads and the account-deletion URL from `privacy-and-ratings.md`.
6. ☐ **AdMob:** publish the EU consent message (see `docs/BUILD-mobile.md`).
   After the store listings are live, link them to the AdMob apps.
7. ☐ **Screenshots**, once the app runs on your phone. Shot list in `listing.md`.
8. ☐ Release build: set `CFG.ads.test = false`, `npm run sync`, archive / bundle,
   upload to TestFlight / Play internal testing, then set it back to `true`.

## Sign in with Apple / Google (phase 6)
- ✅ Privacy policy, support page, privacy labels and description updated for it.
- ☐ Its setup steps: `docs/BUILD-mobile.md` → *Save your progress*.
