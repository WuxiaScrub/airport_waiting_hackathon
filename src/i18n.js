/* ============================================================================
 * i18n — every user-facing string in DEEPCUT lives in this file.
 *
 * RULE FOR FUTURE WORK: never write a display string inline. Add a key to
 * STRINGS.en AND STRINGS.zh below, then read it with loc('some.key'). A key
 * that exists in `en` but not in `zh` falls back to English and warns in the
 * console, so missing translations are loud rather than silent.
 *
 * Static markup in index.html uses data-i18n / data-i18n-aria attributes and is
 * refreshed by I18N.apply(); anything built at runtime calls loc() directly.
 *
 * Placeholders are {named} and substituted from the second argument of loc().
 * Values may contain markup (<b>) — these strings are authored here, never
 * supplied by the player, so they are safe to inject.
 * ========================================================================== */

const STRINGS = {

  /* ------------------------------------------------------------- English */
  en: {
    'lang.switch': 'LANGUAGE: ENGLISH',

    'meta.title': 'DEEPCUT',
    'meta.desc': 'DEEPCUT — a mobile-first browser mining roguelite. Dig deep, bank your gems, wake the volcano.',

    /* HUD */
    'hud.banked': 'BANKED',
    'hud.carrying': 'CARRYING',
    'hud.surface': 'SURFACE',
    'hud.surfaceCamp': 'SURFACE CAMP',
    'hud.deep': '{d} m DEEP',
    'hud.lavaBelow': 'LAVA {d} m BELOW',
    'hud.mine': 'MINE',
    'hud.jump': 'JUMP',
    'hud.dynamite': 'BOMB',

    /* Control labels (aria) */
    'aria.mine': 'Mine',
    'aria.dynamite': 'Place dynamite',
    'aria.jump': 'Jump',

    /* Title screen */
    'title.tagline': 'DIG · BANK · SURVIVE',
    'title.vault': 'VAULT',
    'title.deepest': 'DEEPEST',
    'title.start': 'START DIGGING',
    'title.wipe': 'ERASE SAVE',
    'help.move.k': 'MOVE',
    'help.move.v': 'Drag anywhere on the left half. <b>A</b> / <b>D</b> on desktop.',
    'help.mine.k': 'MINE',
    'help.mine.v': 'Hold <b>MINE</b>. Aim with the stick — push down to dig the floor, up for the ceiling.',
    'help.jump.k': 'JUMP',
    'help.jump.v': 'You fall now. Hold <b>JUMP</b> to clear a ledge. Dig <b>steps</b>, not a pit — a sheer shaft is a one-way trip.',
    'help.boom.k': 'DYNAMITE',
    'help.boom.v': 'Tap 🧨 to drop a stick on the tile you are aiming at. Clears a 3×3 and blasts rock.',
    'help.bank.k': 'BANK IT',
    'help.bank.v': 'Loot you carry is <b>lost if you die</b>. Lanterns bank it and restock you.',
    'help.dark.k': 'DARK',
    'help.dark.v': 'Your lamp is all you have. Something down there wants your gems.',

    /* Shop */
    'shop.supplyLantern': 'SUPPLY LANTERN',
    'shop.surfaceCamp': 'SURFACE CAMP',
    'shop.campOutfitter': 'CAMP OUTFITTER',
    'shop.wealthSecured': 'WEALTH SECURED',
    'shop.gearUp': 'GEAR UP FOR THE NEXT DESCENT',
    'shop.back': 'BACK TO THE MINE',
    'shop.backDown': 'BACK DOWN',
    'shop.newMine': 'NEW MINE',
    'shop.abandonMine': 'ABANDON THIS MINE',
    'shop.max': 'MAX',
    'shop.depth': 'DEPTH',
    'shop.nothingToBank': 'NOTHING TO BANK',
    'shop.secured': '{v} SECURED',
    'shop.healed': '+{n} HP',
    'shop.dynamiteRestocked': 'DYNAMITE RESTOCKED',
    'shop.hatRepaired': 'HARD HAT REPAIRED',

    /* Upgrades */
    'up.health.name': 'Reinforced Vest',
    'up.health.desc': '+1 max heart',
    'up.speed.name': 'Trail Boots',
    'up.speed.desc': '+11% move speed',
    'up.light.name': 'Headlamp',
    'up.light.desc': '+1.3 tiles of light',
    'up.dynamite.name': 'Satchel',
    'up.dynamite.desc': '+2 dynamite',
    'up.helmet.name': 'Hard Hat',
    'up.helmet.desc': '+1 dent — shrugs off a falling dirt block, then re-forms',
    'up.jump.name': 'Spring Knees',
    'up.jump.desc': '+0.5 tiles of jump height',

    /* Run summary */
    'sum.escaped': 'ESCAPED',
    'sum.died': 'YOU DIED',
    'sum.complete': 'RUN COMPLETE',
    'sum.heartstoneYours': 'THE HEARTSTONE IS YOURS',
    'sum.lootLost': '{v} IN UNBANKED LOOT LOST',
    'sum.hauledOut': 'HAULED OUT SAFE',
    'sum.bankedThisRun': 'BANKED THIS RUN',
    'sum.gems': 'GEMS',
    'sum.spend': 'SPEND AT CAMP',

    /* Pause */
    'pause.title': 'PAUSED',
    'pause.sub': '{d} m DEEP · {v} CARRIED',
    'pause.resume': 'RESUME',
    'pause.sound': 'SOUND: {s}',
    'pause.abandon': 'ABANDON RUN (LOSE CARRIED LOOT)',
    'common.on': 'ON',
    'common.off': 'OFF',
    'common.metres': '{n} m',

    /* Toasts & banners */
    'toast.digDown': 'DIG DOWN',
    'toast.noDynamite': 'NO DYNAMITE',
    'toast.cantPlace': 'CAN’T PLACE THERE',
    'toast.notEnoughGold': 'NOT ENOUGH GOLD',
    'toast.sound': 'SOUND {s}',
    'toast.heartstoneAtSurface': 'THE HEARTSTONE ONLY PAYS AT THE SURFACE',
    'toast.getToSurface': 'GET TO THE SURFACE',
    'banner.volcano': 'THE VOLCANO AWAKENS',
    'banner.climbNow': 'CLIMB. NOW.',
    'banner.lostInDark': '{v} LOST IN THE DARK',
    'banner.bounty': '+{v} HEARTSTONE BOUNTY',

    /* Floating world text */
    'fx.banked': '+{v} BANKED',
    'fx.gone': 'GONE',
    'fx.recovered': 'RECOVERED',
    'fx.clunk': 'CLUNK!',
  },

  /* --------------------------------------------------- Simplified Chinese */
  zh: {
    'lang.switch': '语言：简体中文',

    'meta.title': 'DEEPCUT 深切矿脉',
    'meta.desc': 'DEEPCUT 深切矿脉 —— 一款移动优先的浏览器挖矿 roguelite。向下深挖，存好宝石，唤醒火山。',

    /* HUD */
    'hud.banked': '已存入',
    'hud.carrying': '携带中',
    'hud.surface': '地面',
    'hud.surfaceCamp': '地面营地',
    'hud.deep': '深 {d} 米',
    'hud.lavaBelow': '岩浆在下方 {d} 米',
    'hud.mine': '挖掘',
    'hud.jump': '跳跃',
    'hud.dynamite': '炸药',

    /* Control labels (aria) */
    'aria.mine': '挖掘',
    'aria.dynamite': '放置炸药',
    'aria.jump': '跳跃',

    /* Title screen */
    'title.tagline': '挖掘 · 存入 · 求生',
    'title.vault': '金库',
    'title.deepest': '最深纪录',
    'title.start': '开始挖矿',
    'title.wipe': '清除存档',
    'help.move.k': '移动',
    'help.move.v': '在屏幕左半边任意位置拖动。电脑上用 <b>A</b> / <b>D</b>。',
    'help.mine.k': '挖掘',
    'help.mine.v': '按住<b>挖掘</b>。用摇杆瞄准 —— 向下推挖脚下，向上推挖头顶。',
    'help.jump.k': '跳跃',
    'help.jump.v': '你现在会下坠。长按<b>跳跃</b>翻上台阶。要挖成<b>阶梯</b>，别挖成直井 —— 垂直竖井有去无回。',
    'help.boom.k': '炸药',
    'help.boom.v': '点 🧨 在瞄准的格子上放一根。炸出 3×3 范围，连岩石也炸得开。',
    'help.bank.k': '存起来',
    'help.bank.v': '身上携带的战利品<b>一死就没</b>。灯站可以帮你存入并补给。',
    'help.dark.k': '黑暗',
    'help.dark.v': '你只有头灯。下面有东西盯上了你的宝石。',

    /* Shop */
    'shop.supplyLantern': '补给灯站',
    'shop.surfaceCamp': '地面营地',
    'shop.campOutfitter': '营地装备商',
    'shop.wealthSecured': '财富已入库',
    'shop.gearUp': '为下一次下潜备好装备',
    'shop.back': '返回矿洞',
    'shop.backDown': '继续下潜',
    'shop.newMine': '新的矿洞',
    'shop.abandonMine': '放弃这座矿洞',
    'shop.max': '满级',
    'shop.depth': '深度',
    'shop.nothingToBank': '没有可存入的财富',
    'shop.secured': '{v} 已入库',
    'shop.healed': '+{n} 生命',
    'shop.dynamiteRestocked': '炸药已补满',
    'shop.hatRepaired': '安全帽已修复',

    /* Upgrades */
    'up.health.name': '加固背心',
    'up.health.desc': '生命上限 +1',
    'up.speed.name': '矿道靴',
    'up.speed.desc': '移动速度 +11%',
    'up.light.name': '头灯',
    'up.light.desc': '照明范围 +1.3 格',
    'up.dynamite.name': '工具包',
    'up.dynamite.desc': '炸药 +2',
    'up.helmet.name': '安全帽',
    'up.helmet.desc': '+1 次抗击打 —— 替你挡下一块坠落的泥土，随后自行复原',
    'up.jump.name': '弹簧护膝',
    'up.jump.desc': '跳跃高度 +0.5 格',

    /* Run summary */
    'sum.escaped': '成功逃生',
    'sum.died': '你死了',
    'sum.complete': '本次探矿结束',
    'sum.heartstoneYours': '心髓石归你所有',
    'sum.lootLost': '损失了 {v} 未存入的战利品',
    'sum.hauledOut': '平安带回',
    'sum.bankedThisRun': '本次存入',
    'sum.gems': '宝石',
    'sum.spend': '去营地消费',

    /* Pause */
    'pause.title': '已暂停',
    'pause.sub': '深 {d} 米 · 携带 {v}',
    'pause.resume': '继续游戏',
    'pause.sound': '音效：{s}',
    'pause.abandon': '放弃本次探矿（丢失携带的战利品）',
    'common.on': '开',
    'common.off': '关',
    'common.metres': '{n} 米',

    /* Toasts & banners */
    'toast.digDown': '向下挖',
    'toast.noDynamite': '没有炸药了',
    'toast.cantPlace': '这里放不了',
    'toast.notEnoughGold': '金币不足',
    'toast.sound': '音效{s}',
    'toast.heartstoneAtSurface': '心髓石只有回到地面才能兑现',
    'toast.getToSurface': '快回地面',
    'banner.volcano': '火山苏醒了',
    'banner.climbNow': '立刻往上爬。',
    'banner.lostInDark': '{v} 消失在黑暗中',
    'banner.bounty': '+{v} 心髓石赏金',

    /* Floating world text */
    'fx.banked': '+{v} 已存入',
    'fx.gone': '没了',
    'fx.recovered': '已找回',
    'fx.clunk': '咚！',
  },
};

const I18N = {
  lang: 'en',
  key: 'deepcut.lang.v1',
  listeners: [],

  /** Saved choice wins; otherwise follow the browser. */
  init() {
    let saved = null;
    try { saved = localStorage.getItem(this.key); } catch (e) { /* private mode */ }
    if (saved && STRINGS[saved]) this.lang = saved;
    else this.lang = (navigator.language || 'en').toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en';
    this.apply();
  },

  /** Cycle to the next available language. */
  cycle() {
    const o = Object.keys(STRINGS);
    this.set(o[(o.indexOf(this.lang) + 1) % o.length]);
  },

  set(lang) {
    if (!STRINGS[lang] || lang === this.lang) return;
    this.lang = lang;
    try { localStorage.setItem(this.key, lang); } catch (e) { /* private mode */ }
    this.apply();
    for (const fn of this.listeners) fn(lang);
  },

  onChange(fn) { this.listeners.push(fn); },

  t(key, params) {
    let s = STRINGS[this.lang][key];
    if (s === undefined) {
      s = STRINGS.en[key];
      if (s === undefined) return key;         // never throw at the player
      console.warn('[i18n] missing "' + key + '" for "' + this.lang + '"');
    }
    if (!params) return s;
    return s.replace(/\{(\w+)\}/g, (m, k) => (params[k] === undefined ? m : params[k]));
  },

  /** Push the current language into <html lang>, the tab title and static HTML. */
  apply() {
    document.documentElement.lang = this.lang === 'zh' ? 'zh-Hans' : 'en';
    document.title = this.t('meta.title');
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', this.t('meta.desc'));
    // CJK reads badly with the wide Latin letter-spacing used across the HUD.
    document.body.classList.toggle('lang-cjk', this.lang === 'zh');

    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = this.t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
      el.setAttribute('aria-label', this.t(el.dataset.i18nAria));
    });
  },
};

/**
 * Shorthand used everywhere else in the codebase. Deliberately not named `t`:
 * `t` is already a local variable name for tiles, touches and timers all over
 * this project, and a global of that name would be shadowed at random.
 */
const loc = (key, params) => I18N.t(key, params);
