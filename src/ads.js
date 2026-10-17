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
  status: 'off',           // last thing that happened, shown on the pause panel in test builds
  _loading: null,
  _pending: null,          // { rewarded, resolve } while an ad is on screen
  _retry: 0,
  _retryDelay: 15000,

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

  /** Record what happened, for the console and the test-build status line. */
  note(status) {
    this.status = status;
    console.log('[ads] ' + status);
  },

  async init() {
    if (!Native.app || !this.plugin || !this.unitId()) return;
    const ad = this.plugin;
    const msg = (e) => (e && (e.message || e.errorMessage)) || String(e);
    this.note('starting');

    try {
      await ad.initialize({ initializeForTesting: CFG.ads.test });
    } catch (e) {
      this.note('init failed: ' + msg(e));
      return;
    }

    // EU/UK consent (Google UMP), using the message set up in AdMob →
    // Privacy & messaging. A failure here is NOT fatal: it is what happens
    // when no message has been published yet, and outside the EU/UK there is
    // nothing to consent to anyway. Only an explicit "no" stops ads.
    let consent = null;
    try {
      consent = await ad.requestConsentInfo();
      if (consent.isConsentFormAvailable && consent.status === 'REQUIRED') {
        consent = await ad.showConsentForm();
      }
    } catch (e) {
      console.warn('[ads] consent check failed (is the EU message published in AdMob?):', msg(e));
    }

    // iOS App Tracking Transparency. Asked once; Android answers 'authorized'.
    try {
      const att = await ad.trackingAuthorizationStatus();
      if (att.status === 'notDetermined') await ad.requestTrackingAuthorization();
    } catch (e) {
      console.warn('[ads] tracking prompt failed:', msg(e));
    }

    if (consent && consent.canRequestAds === false) {
      this.note('off (no consent)');
      return;
    }

    ad.addListener('onRewardedVideoAdReward', () => { if (this._pending) this._pending.rewarded = true; });
    ad.addListener('onRewardedVideoAdDismissed', () => this.settle());
    ad.addListener('onRewardedVideoAdFailedToShow', () => this.settle());
    this.ready = true;
    this.preload();
  },

  /** Load the next ad in the background. Cheap to call often. */
  preload() {
    if (!this.ready || this.loaded || this._loading) return;
    clearTimeout(this._retry);
    this.note('loading');
    this._loading = Promise.resolve(this.plugin.prepareRewardVideoAd({ adId: this.unitId(), isTesting: CFG.ads.test }))
      .then(() => {
        this.loaded = true;
        this._retryDelay = 15000;
        this.note('ready');
      })
      .catch((e) => {
        // No fill, no network, SDK still warming up: try again later, backing
        // off, so an ad is usually on hand by the time the miner dies.
        this.note('load failed: ' + ((e && e.message) || e) + ' (retrying)');
        this._retry = setTimeout(() => this.preload(), this._retryDelay);
        this._retryDelay = Math.min(this._retryDelay * 2, 5 * 60 * 1000);
      })
      .finally(() => { this._loading = null; });
  },

  /** Is there an ad on hand right now? The revive is only offered if so. */
  available() { return this.ready && this.loaded; },

  /** Play the ad. Resolves true only if the reward was earned. */
  show() {
    if (!this.available()) return Promise.resolve(false);
    this.loaded = false;                    // an ad is good for one showing
    this.note('showing');
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
