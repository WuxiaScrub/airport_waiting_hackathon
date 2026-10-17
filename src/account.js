/* ============================================================================
 * Account — "save your progress": link the anonymous account to Sign in with
 * Apple (iOS) or Google (Android), so a name, medals and run history survive
 * a new or lost phone. App only; the browser never offers it.
 *
 * Linking keeps the SAME account: the anonymous user gains an Apple/Google
 * identity and nothing moves. On a fresh install the same button restores an
 * old profile — linking then fails with `identity_already_exists`, and the
 * player may switch this device over to the profile that owns that identity.
 *
 * Tokens: a random nonce is generated per attempt. Apple and Google get its
 * SHA-256 (it ends up inside their signed ID token); Supabase gets the raw
 * value and checks the two match, so a stolen token can't be replayed.
 *
 * Every method resolves { ok, ... } or { ok: false, error } and never throws:
 *   error: 'cancelled' | 'already_linked' | 'offline' | 'failed'
 * ========================================================================== */

const Account = {
  _ready: null,              // SocialLogin.initialize(), once

  get plugin() { return Native.plugins.SocialLogin; },

  /** The sign-in this device offers, or null. */
  provider() {
    if (!Native.app || !this.plugin || !Online.enabled) return null;
    if (Native.platform === 'ios') return 'apple';
    if (Native.platform === 'android' && CFG.signin.googleWebClientId) return 'google';
    return null;
  },

  init() {
    if (!this._ready) {
      const opts = Native.platform === 'ios'
        ? { apple: { redirectUrl: '' } }
        : { google: { webClientId: CFG.signin.googleWebClientId, mode: 'online' } };
      this._ready = Promise.resolve(this.plugin.initialize(opts)).catch((e) => {
        this._ready = null;
        throw e;
      });
    }
    return this._ready;
  },

  /** { provider, email } for a linked account, or null while anonymous. */
  async linked() {
    if (!Online.enabled) return null;
    try {
      const { data } = await Online.client.auth.getSession();
      const user = data && data.session && data.session.user;
      const id = user && (user.identities || []).find(i => i.provider === 'apple' || i.provider === 'google');
      if (!id) return null;
      return { provider: id.provider, email: (id.identity_data && id.identity_data.email) || user.email || '' };
    } catch (e) {
      return null;
    }
  },

  async nonce() {
    const raw = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
    const hashed = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    return { raw, hashed };
  },

  /** Ask Apple / Google for an ID token. */
  async token(provider) {
    await this.init();
    const n = await this.nonce();
    const options = provider === 'apple' ? { scopes: ['email'], nonce: n.hashed } : { nonce: n.hashed };
    const res = await this.plugin.login({ provider, options });
    const idToken = res && res.result && res.result.idToken;
    if (!idToken) throw new Error('no id token');
    return { provider, token: idToken, nonce: n.raw };
  },

  /**
   * Link this device's account to Apple / Google. If that identity already
   * belongs to another profile, resolves { error: 'already_linked', cred } —
   * pass `cred` to switchTo() if the player chooses to move over.
   */
  async link() {
    const provider = this.provider();
    if (!provider) return { ok: false, error: 'failed' };
    if (!Online.online()) return { ok: false, error: 'offline' };
    if (!(await Online.ensureSession())) return { ok: false, error: 'offline' };

    let cred;
    try {
      cred = await this.token(provider);
    } catch (e) {
      const m = String((e && (e.message || e.code)) || e).toLowerCase();
      console.warn('[account] sign-in sheet:', m);
      return { ok: false, error: /cancel/.test(m) ? 'cancelled' : 'failed' };
    }

    const { error } = await Online.client.auth.linkIdentity(cred);
    if (!error) {
      Online.forgetCache();
      return { ok: true, provider };
    }
    const code = error.code || error.message || '';
    console.warn('[account] link:', code);
    if (/identity_already_exists|already/i.test(code)) return { ok: false, error: 'already_linked', cred };
    return { ok: false, error: /fetch|network/i.test(code) ? 'offline' : 'failed' };
  },

  /**
   * Move this device to the profile that owns `cred`'s identity. The
   * anonymous profile it leaves behind keeps its uploaded runs; runs still
   * waiting in the outbox upload to the new profile.
   */
  async switchTo(cred) {
    let res = await Online.client.auth.signInWithIdToken(cred);
    if (res.error) {
      // ID tokens are short-lived; ask once more rather than failing.
      try { res = await Online.client.auth.signInWithIdToken(await this.token(cred.provider)); }
      catch (e) { return { ok: false, error: 'failed' }; }
    }
    if (res.error) {
      console.warn('[account] switch:', res.error.message);
      return { ok: false, error: 'failed' };
    }
    Online.forgetCache();
    Online.flush();
    return { ok: true };
  },
};
