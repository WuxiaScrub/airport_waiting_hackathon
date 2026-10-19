# Privacy labels, content ratings and review notes

Answers for the questionnaires in App Store Connect and the Google Play
Console, worked out from what the game actually sends:
- **Supabase:** account ID, miner name, run results.
- **Google AdMob:** the rewarded revive.

The AdMob rows follow Google's own disclosure guides. Re-check them before you
submit, because Google updates these:
- iOS: https://developers.google.com/admob/ios/privacy/data-disclosure
- Android: https://developers.google.com/admob/android/privacy/play-data-disclosure

> Includes Sign in with Apple / Google (phase 6): **Email Address** is
> collected only from players who choose "Save your progress".
---

## Apple: App Privacy ("nutrition label")

*App Store Connect → App → App Privacy → Get Started → "Yes, we collect data".*

| Data type | Collected by | Linked to user? | Used for tracking? | Purposes |
|---|---|---|---|---|
| **Identifiers → User ID** | Us (Supabase account ID) | Yes | No | App Functionality |
| **User Content → Gameplay Content** | Us (scores, runs, medals) | Yes | No | App Functionality |
| **User Content → Other User Content** | Us (miner name) | Yes | No | App Functionality |
| **Contact Info → Email Address** | Us (only if the player links Sign in with Apple) | Yes | No | App Functionality |
| **Identifiers → Device ID** | AdMob (IDFA, only if tracking allowed) | No | **Yes** | Third-Party Advertising, Analytics |
| **Location → Coarse Location** | AdMob (from IP address) | No | No | Third-Party Advertising, Analytics |
| **Usage Data → Product Interaction** | AdMob | No | No | Third-Party Advertising, Analytics |
| **Usage Data → Advertising Data** | AdMob | No | No | Third-Party Advertising, Analytics |
| **Diagnostics → Crash Data, Performance Data, Other Diagnostic Data** | AdMob | No | No | Third-Party Advertising, Analytics |

Everything else is **not collected**: other contact info, health, financial,
precise location, contacts, browsing/search history, purchases, sensitive
info, photos, audio and messages.

Because Device ID is used for tracking, the app shows Apple's tracking prompt.
The text is already in `Info.plist`, with the Chinese version described in
`docs/BUILD-mobile.md`.

---

## Google Play: Data safety

*Play Console → App content → Data safety.*

- **Does your app collect or share any of the required user data types?** Yes
- **Is all of the user data collected by your app encrypted in transit?** Yes (HTTPS everywhere)
- **Do you provide a way for users to request that their data is deleted?** Yes, in the game (Profile → Delete account) and at the deletion URL

| Category → type | Collected | Shared | Optional? | Purposes |
|---|---|---|---|---|
| **Personal info → User IDs** (account ID) | Yes | No | Required | App functionality, Account management |
| **Personal info → Email address** (only if the player links Sign in with Google) | Yes | No | Optional | App functionality, Account management |
| **App activity → Other user-generated content** (miner name) | Yes | No | Optional (only if a name is chosen) | App functionality |
| **App activity → Other actions** (run results, medals) | Yes | No | Required | App functionality, Fraud prevention / security |
| **App activity → App interactions** | Yes (AdMob) | Yes (Google) | Required | Advertising or marketing, Analytics, Fraud prevention |
| **Location → Approximate location** (from IP) | Yes (AdMob) | Yes (Google) | Required | Advertising or marketing, Analytics, Fraud prevention |
| **App info and performance → Crash logs, Diagnostics** | Yes (AdMob) | Yes (Google) | Required | Analytics, Fraud prevention |
| **Device or other IDs** (advertising ID) | Yes (AdMob) | Yes (Google) | Required | Advertising or marketing, Analytics, Fraud prevention |

Data processed by Supabase on our behalf counts as **collected, not shared**:
Google treats service providers that way.

**Account deletion URL** (Play asks for this separately, under *App content →
Data deletion*):
`https://wuxiascrub.github.io/forevermine/privacy.html#delete`

---

## Age / content ratings

### Apple (age rating questionnaire)

| Question | Answer |
|---|---|
| Cartoon or Fantasy Violence | **Infrequent/Mild**: a pickaxe against cartoon cave bugs and bats, no blood |
| Realistic Violence, Sexual content, Nudity, Profanity, Horror/Fear, Alcohol/Tobacco/Drugs, Medical, Mature/Suggestive | None |
| Simulated Gambling / Contests | None. The daily medals are a skill leaderboard with no entry fee and no prizes. |
| Unrestricted Web Access | No |
| Messaging or chat | No |
| User-generated content | Yes, if asked: miner names are visible on public leaderboards. Moderated by a blocklist plus manual removal. |
| Advertising | Yes: optional rewarded ads |

Expected result: **9+**.

### Google Play (IARC questionnaire)

- **Category:** Game.
- **Violence:** yes, fantasy or cartoon violence against non-human creatures, no blood or gore.
- **Fear, sexuality, language, controlled substances, crude humour, gambling:** no.
- **Users can interact or exchange content:** no chat or messaging. Players see each other's **names and scores only**. If asked, answer "shares user-chosen names publicly".
- **Shares user location with other users:** no. **Digital purchases:** no.

Expected result: **PEGI 7 / ESRB Everyone 10+**, or close to it.

### Target audience (Play → App content → Target audience)

Choose **13+ only** (13–15, 16–17, 18+). Including under-13s puts the game
under Google's Families policy, which requires child-directed ad settings and
a different AdMob configuration. Apple has no separate setting: the age rating
covers it.

---

## Other declarations

| Where | Answer |
|---|---|
| Apple: Export compliance | Uses only standard encryption (HTTPS). `ITSAppUsesNonExemptEncryption = NO` is already in `Info.plist`, so Apple won't ask on each upload. |
| Apple: Content rights | Does not contain third-party content. All art and sound are generated in code. |
| Play: Ads | **Yes, contains ads.** |
| Play: App access | **All functionality is available without special access.** No login is needed. |
| Play: Government app / Financial features / Health / News | No |
| Play: Advertising ID | **Yes, uses advertising ID**, for advertising and analytics (AdMob). The plugin adds the `AD_ID` permission automatically. |

## App Review notes (paste into "Notes" for Apple's reviewer)

```
No sign-in is required. The game creates an anonymous account automatically
the first time it goes online; leaderboards, the profile and the daily mine
work without any credentials. Sign in with Apple is optional, under
Profile → Save your progress, and only links that anonymous account.

Ads: the only ad is an optional rewarded video offered once per run when the
player dies ("Second wind? Watch ad · Revive" / "No thanks"). To see it, start
Endless or Daily Mine and let a cave bug or the lava kill you.

Account deletion: Profile → Delete account (two-step confirmation). It deletes
the server account and all its data immediately.

Privacy policy: https://wuxiascrub.github.io/forevermine/privacy.html
```
