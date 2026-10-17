/* ============================================================================
 * Ads — the one rewarded ad the game shows: a revive, offered once per run
 * when the miner dies. Native app only; in a browser nothing here does
 * anything and the revive is simply never offered.
 *
 * Rules (see CLAUDE.md, Revive Ads):
 *   · AdMob REWARDED units only. No interstitials, no banners.
 *   · The revive is granted only if the ad reports a reward — a skipped,
 *     failed or unavailable ad ends the run as a normal death.
 *   · CFG.ads.test serves Google's test ads. Real ads only in store builds.
 *
 * Flow: init() once at launch (consent → tracking prompt → SDK), then
 * preload() at the start of every run so an ad is ready the moment it is
 * needed. show() resolves to true only when the player earned the reward,
 * and only after the ad has closed, so the game resumes on its own screen.
 * ========================================================================== */

const Ads = {
  ready: false,            // SDK up and allowed to request ads
  loaded: false,           // a rewarded ad is loaded and can be shown now
  _loading: null,
  _pending: null,          // { rewarded, resolve } while an ad is on screen

  // Google's public test units — safe to tap, never earn money.
  testUnits: {
    android: 'ca-app-pub-3940256099942544/5224354917',
    ios: 'ca-app-pub-3940256099942544/1712485313',
  },

  get plugin() { return Native.plugins.AdMob; },

  unitId() {
    const p = Native.platform;
    return CFG.ads.test ? this.testUnits[p] : (CFG.ads[p] && CFG.ads[p].rewarded);
  },

  async init() {
    if (!Native.app || !this.plugin || !this.unitId()) return;
    const ad = this.plugin;
    try {
      await ad.initialize({ initializeForTesting: CFG.ads.test });

      // EU/UK consent (Google UMP), using the message set up in AdMob →
      // Privacy & messaging. Elsewhere this returns without showing anything.
      let consent = await ad.requestConsentInfo();
      if (consent.isConsentFormAvailable && consent.status === 'REQUIRED') {
        consent = await ad.showConsentForm();
      }

      // iOS App Tracking Transparency. Asked once; Android answers 'authorized'.
      const att = await ad.trackingAuthorizationStatus();
      if (att.status === 'notDetermined') await ad.requestTrackingAuthorization();

      if (consent.canRequestAds === false) return;   // the player said no to ads
      this.ready = true;
    } catch (e) {
      console.warn('[ads] init failed:', e && e.message);
      return;
    }

    ad.addListener('onRewardedVideoAdReward', () => { if (this._pending) this._pending.rewarded = true; });
    ad.addListener('onRewardedVideoAdDismissed', () => this.settle());
    ad.addListener('onRewardedVideoAdFailedToShow', () => this.settle());
    this.preload();
  },

  /** Load the next ad in the background. Cheap to call often. */
  preload() {
    if (!this.ready || this.loaded || this._loading) return;
    this._loading = Promise.resolve(this.plugin.prepareRewardVideoAd({ adId: this.unitId(), isTesting: CFG.ads.test }))
      .then(() => { this.loaded = true; })
      .catch((e) => { console.warn('[ads] load failed:', e && e.message); })
      .finally(() => { this._loading = null; });
  },

  /** Is there an ad on hand right now? The revive is only offered if so. */
  available() { return this.ready && this.loaded; },

  /** Play the ad. Resolves true only if the reward was earned. */
  show() {
    if (!this.available()) return Promise.resolve(false);
    this.loaded = false;                    // an ad is good for one showing
    return new Promise((resolve) => {
      this._pending = { rewarded: false, resolve };
      Promise.resolve(this.plugin.showRewardVideoAd()).catch(() => this.settle());
    });
  },

  /** The ad closed (or never opened): report whether it paid out. */
  settle() {
    const p = this._pending;
    if (!p) return;
    this._pending = null;
    p.resolve(p.rewarded);
  },
};
