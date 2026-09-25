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
    'meta.desc': 'DEEPCUT — a mobile-first browser mining roguelite. Dig deep, carry your gems out, wake the volcano.',

    /* HUD */
    'hud.score': 'SCORE',
    'hud.carrying': 'CARRYING',
    'hud.surface': 'SURFACE',
    'hud.surfaceCamp': 'SURFACE CAMP',
    'hud.deep': '{d} m DEEP',
    'hud.lavaBelow': 'LAVA {d} m BELOW',
    'hud.eruption': 'ERUPTION {t}',
    'hud.mine': 'MINE',
    'hud.mineN': 'MINE {n}',
    'hud.jump': 'JUMP',
    'hud.dynamite': 'BOMB',

    /* Control labels (aria) */
    'aria.mine': 'Mine',
    'aria.dynamite': 'Place dynamite',
    'aria.jump': 'Jump',

    /* Title screen */
    'title.tagline': 'DIG · HAUL · SURVIVE',
    'title.furthestMine': 'FURTHEST MINE',
    'title.bestHaul': 'BEST HAUL',
    'title.deepest': 'DEEPEST',
    'title.start': 'START DIGGING',
    'title.wipe': 'ERASE SAVE',

    /* Highscores — a score is what a campaign carried out, less what it spent */
    'score.title': 'TOP HAULS',
    'score.empty': 'NOTHING HAULED OUT YET',
    'score.mineDepth': 'MINE {n} · {d} m',
    'score.newBest': 'NEW PERSONAL BEST HAUL',
    'score.ranked': 'RANKED #{n} ALL TIME',

    'help.move.k': 'MOVE',
    'help.move.v': 'Drag anywhere on the left half. <b>A</b> / <b>D</b> on desktop.',
    'help.mine.k': 'MINE',
    'help.mine.v': 'Hold <b>MINE</b>. Aim with the stick — down digs the floor, up the ceiling, and a <b>diagonal</b> cuts the corner tile.',
    'help.jump.k': 'JUMP',
    'help.jump.v': 'You fall now. Hold <b>JUMP</b> to clear a ledge. Dig <b>steps</b>, not a pit.',
    'help.grip.k': 'GRAPPLE',
    'help.grip.v': 'Falling past a wall? Hold the stick <b>into</b> it and the hook catches. <b>JUMP</b> from there, catch again — that is how a shaft is climbed.',
    'help.boom.k': 'DYNAMITE',
    'help.boom.v': 'Tap 🧨 to drop a stick <b>at your feet</b>, then run. It falls like you do. Clears a 3×3 and blasts rock.',
    'help.bank.k': 'NO BANKS',
    'help.bank.v': 'Every gem you carry is <b>lost if you die</b>. Lanterns are <b>shops, not banks</b>: they are paid from your gems, and a gem spent is score gone. Only the <b>surface camp</b> keeps what you carry.',
    'help.heart.k': 'HEARTSTONE',
    'help.heart.v': 'Carry it out for <b>+{h}</b> and a <b>deeper mine</b> opens. Your upgrades come with you; your gems do not. Walk out without it and the campaign ends.',
    'help.clock.k': 'THE CLOCK',
    'help.clock.v': 'The mountain erupts on its own after <b>{m} minutes</b>, Heartstone or not. Watch the HUD and be climbing before it hits zero.',
    'help.dark.k': 'DARK',
    'help.dark.v': 'Your lamp is all you have. Something down there wants your gems.',

    /* Shop */
    'shop.supplyLantern': 'SUPPLY LANTERN',
    'shop.back': 'BACK TO THE MINE',
    'shop.max': 'MAX',
    'shop.depth': 'DEPTH',
    'shop.paysFromCarry': 'PAID FROM THE GEMS YOU CARRY — EVERY GEM SPENT IS SCORE LOST',
    'shop.hatRepaired': 'HARD HAT REPAIRED',
    'shop.singleUse': 'THIS LANTERN BURNS OUT WHEN YOU LEAVE — ONE VISIT ONLY',

    /* Supplies (bought, never handed out — and only by the full load) */
    'supply.dynamite.name': 'Dynamite Reload',
    'supply.dynamite.desc': 'Fill the satchel to the brim  ({cur}/{max})',
    'supply.heal.name': 'Med Pack',
    'supply.heal.desc': 'Patch up to full health  ({cur}/{max})',

    /* Upgrades */
    'up.health.name': 'Reinforced Vest',
    'up.health.desc': '+1 max heart',
    'up.speed.name': 'Trail Boots',
    'up.speed.desc': '+11% move speed',
    'up.light.name': 'Headlamp',
    'up.light.desc': '+0.6 tiles of light',
    'up.dynamite.name': 'Satchel',
    'up.dynamite.desc': '+{n} dynamite',
    'up.helmet.name': 'Hard Hat',
    'up.helmet.desc': '+1 dent — shrugs off a falling dirt block, then re-forms',
    'up.jump.name': 'Spring Knees',
    'up.jump.desc': '+0.5 tiles of jump height',
    'up.blast.name': 'Big Bang',
    'up.blast.desc': 'Dynamite clears a 5×5 instead of a 3×3 — ledges you meant to climb included',

    /* Run summary */
    'sum.escaped': 'ESCAPED',
    'sum.died': 'YOU DIED',
    'sum.complete': 'RUN COMPLETE',
    'sum.nextMine': 'MINE {n} AWAITS',
    'sum.lootLost': '{v} IN CARRIED LOOT LOST',
    'sum.nothingLost': 'NOTHING IN YOUR POCKETS',
    'sum.escapedKept': 'SCORE FROM THE MINES YOU ESCAPED IS KEPT',
    'sum.hauledOut': 'HAULED OUT SAFE',
    'sum.hauledThisMine': 'HAULED FROM THIS MINE',
    'sum.score': 'SCORE',
    'sum.mine': 'MINE',
    'sum.gems': 'GEMS',
    'sum.found': 'GEMS FOUND',
    'sum.heartstones': 'HEARTSTONES',
    'sum.spent': 'SPENT AT LANTERNS',
    'sum.lost': 'LOST TO BATS & DEATH',
    'sum.scoreSoFar': 'CAMPAIGN SCORE',
    'sum.finalScore': 'FINAL SCORE',
    'sum.descend': 'DESCEND INTO MINE {n}',
    'sum.gearCarries': 'YOUR UPGRADES COME WITH YOU · YOUR GEMS DO NOT',
    'sum.retire': 'END THE CAMPAIGN HERE',
    'sum.newCampaign': 'NEW CAMPAIGN',

    /* Pause */
    'pause.title': 'PAUSED',
    'pause.sub': '{d} m DEEP · {v} CARRIED',
    'pause.resume': 'RESUME',
    'pause.sound': 'SOUND: {s}',
    'pause.abandon': 'ABANDON (LOSE CARRIED LOOT)',
    'common.on': 'ON',
    'common.off': 'OFF',
    'common.metres': '{n} m',

    /* Toasts & banners */
    'toast.digDown': 'DIG DOWN',
    'toast.mineN': 'MINE {n} · DIG DOWN',
    'toast.noDynamite': 'NO DYNAMITE',
    'toast.cantPlace': 'CAN’T PLACE THERE',
    'toast.notEnoughGems': 'NOT ENOUGH GEMS',
    'toast.alreadyFull': 'ALREADY AT FULL HEALTH',
    'toast.satchelFull': 'SATCHEL IS FULL',
    'toast.lanternSpent': 'THIS LANTERN IS BURNT OUT',
    'toast.sound': 'SOUND {s}',
    'toast.heartstoneAtSurface': 'THE HEARTSTONE ONLY PAYS AT THE SURFACE',
    'toast.getToSurface': 'GET TO THE SURFACE',
    'toast.eruptionWarn': 'THE MOUNTAIN IS STIRRING · {t}',
    'banner.volcano': 'THE VOLCANO AWAKENS',
    'banner.climbNow': 'CLIMB. NOW.',
    'banner.timeUp': 'THE MOUNTAIN WAITED LONG ENOUGH',
    'banner.lostInDark': '{v} LOST IN THE DARK',
    'banner.heartstonePaid': '+{v} HEARTSTONE',

    /* Floating world text */
    'fx.hauled': '+{v} HAULED OUT',
    'fx.gone': 'GONE',
    'fx.recovered': 'RECOVERED',
    'fx.clunk': 'CLUNK!',
  },

  /* --------------------------------------------------- Simplified Chinese */
  zh: {
    'lang.switch': '语言：简体中文',

    'meta.title': 'DEEPCUT 深切矿脉',
    'meta.desc': 'DEEPCUT 深切矿脉 —— 一款移动优先的浏览器挖矿 roguelite。向下深挖，把宝石带出矿洞，唤醒火山。',

    /* HUD */
    'hud.score': '得分',
    'hud.carrying': '携带中',
    'hud.surface': '地面',
    'hud.surfaceCamp': '地面营地',
    'hud.deep': '深 {d} 米',
    'hud.lavaBelow': '岩浆在下方 {d} 米',
    'hud.eruption': '爆发倒计时 {t}',
    'hud.mine': '挖掘',
    'hud.mineN': '第 {n} 座矿',
    'hud.jump': '跳跃',
    'hud.dynamite': '炸药',

    /* Control labels (aria) */
    'aria.mine': '挖掘',
    'aria.dynamite': '放置炸药',
    'aria.jump': '跳跃',

    /* Title screen */
    'title.tagline': '挖掘 · 带出 · 求生',
    'title.furthestMine': '最远矿洞',
    'title.bestHaul': '最高收获',
    'title.deepest': '最深纪录',
    'title.start': '开始挖矿',
    'title.wipe': '清除存档',

    /* Highscores — a score is what a campaign carried out, less what it spent */
    'score.title': '收获排行榜',
    'score.empty': '还没有带出过任何宝石',
    'score.mineDepth': '第 {n} 座矿 · {d} 米',
    'score.newBest': '个人最高收获纪录',
    'score.ranked': '历史排名第 {n}',

    'help.move.k': '移动',
    'help.move.v': '在屏幕左半边任意位置拖动。电脑上用 <b>A</b> / <b>D</b>。',
    'help.mine.k': '挖掘',
    'help.mine.v': '按住<b>挖掘</b>。用摇杆瞄准 —— 向下推挖脚下，向上推挖头顶，推<b>斜向</b>可以挖对角的那一格。',
    'help.jump.k': '跳跃',
    'help.jump.v': '你现在会下坠。长按<b>跳跃</b>翻上台阶。要挖成<b>阶梯</b>，别挖成深坑。',
    'help.grip.k': '抓钩',
    'help.grip.v': '从墙边坠落时，把摇杆<b>推向</b>墙面，抓钩就会咬住。再按<b>跳跃</b>，然后重新抓住 —— 竖井就是这样爬上去的。',
    'help.boom.k': '炸药',
    'help.boom.v': '点 🧨 把一根炸药丢在<b>脚下</b>，然后快跑。它和你一样会往下掉。炸出 3×3 范围，连岩石也炸得开。',
    'help.bank.k': '没有银行',
    'help.bank.v': '身上携带的宝石<b>一死就没</b>。灯站<b>只是商店，不能存钱</b>：购物用的是你身上的宝石，花掉一颗就少一分。只有回到<b>地面营地</b>，带着的宝石才算数。',
    'help.heart.k': '心髓石',
    'help.heart.v': '把它带出矿洞可得 <b>+{h}</b>，并解锁<b>更深的矿洞</b>。升级会跟着你，宝石不会。没拿到它就离开，本轮征程结束。',
    'help.clock.k': '倒计时',
    'help.clock.v': '不管有没有拿到心髓石，<b>{m} 分钟</b>后火山都会自己爆发。盯紧顶栏的倒计时，归零前就要开始往上爬。',
    'help.dark.k': '黑暗',
    'help.dark.v': '你只有头灯。下面有东西盯上了你的宝石。',

    /* Shop */
    'shop.supplyLantern': '补给灯站',
    'shop.back': '返回矿洞',
    'shop.max': '满级',
    'shop.depth': '深度',
    'shop.paysFromCarry': '用你身上的宝石付款 —— 花掉的每一颗都是失去的分数',
    'shop.hatRepaired': '安全帽已修复',
    'shop.singleUse': '这盏灯在你离开后就会熄灭 —— 只能用一次',

    /* Supplies (bought, never handed out — and only by the full load) */
    'supply.dynamite.name': '炸药补给',
    'supply.dynamite.desc': '一次把工具包装满（{cur}/{max}）',
    'supply.heal.name': '急救包',
    'supply.heal.desc': '生命恢复至上限（{cur}/{max}）',

    /* Upgrades */
    'up.health.name': '加固背心',
    'up.health.desc': '生命上限 +1',
    'up.speed.name': '矿道靴',
    'up.speed.desc': '移动速度 +11%',
    'up.light.name': '头灯',
    'up.light.desc': '照明范围 +0.6 格',
    'up.dynamite.name': '工具包',
    'up.dynamite.desc': '炸药 +{n}',
    'up.helmet.name': '安全帽',
    'up.helmet.desc': '+1 次抗击打 —— 替你挡下一块坠落的泥土，随后自行复原',
    'up.jump.name': '弹簧护膝',
    'up.jump.desc': '跳跃高度 +0.5 格',
    'up.blast.name': '大爆破',
    'up.blast.desc': '炸药的范围从 3×3 扩大到 5×5 —— 连你打算爬回去的台阶也一起炸掉',

    /* Run summary */
    'sum.escaped': '成功逃生',
    'sum.died': '你死了',
    'sum.complete': '本次探矿结束',
    'sum.nextMine': '第 {n} 座矿在等着你',
    'sum.lootLost': '损失了身上携带的 {v}',
    'sum.nothingLost': '身上没有携带任何东西',
    'sum.escapedKept': '已逃出的矿洞得分会保留',
    'sum.hauledOut': '平安带回',
    'sum.hauledThisMine': '本矿带出',
    'sum.score': '得分',
    'sum.mine': '矿洞',
    'sum.gems': '宝石',
    'sum.found': '找到的宝石',
    'sum.heartstones': '心髓石',
    'sum.spent': '灯站消费',
    'sum.lost': '被蝙蝠偷走或死亡损失',
    'sum.scoreSoFar': '本轮征程得分',
    'sum.finalScore': '最终得分',
    'sum.descend': '进入第 {n} 座矿',
    'sum.gearCarries': '升级会跟着你 · 宝石不会',
    'sum.retire': '在此结束征程',
    'sum.newCampaign': '新的征程',

    /* Pause */
    'pause.title': '已暂停',
    'pause.sub': '深 {d} 米 · 携带 {v}',
    'pause.resume': '继续游戏',
    'pause.sound': '音效：{s}',
    'pause.abandon': '放弃（丢失携带的战利品）',
    'common.on': '开',
    'common.off': '关',
    'common.metres': '{n} 米',

    /* Toasts & banners */
    'toast.digDown': '向下挖',
    'toast.mineN': '第 {n} 座矿 · 向下挖',
    'toast.noDynamite': '没有炸药了',
    'toast.cantPlace': '这里放不了',
    'toast.notEnoughGems': '宝石不够',
    'toast.alreadyFull': '生命值已满',
    'toast.satchelFull': '工具包已装满',
    'toast.lanternSpent': '这盏灯已经熄灭了',
    'toast.sound': '音效{s}',
    'toast.heartstoneAtSurface': '心髓石只有回到地面才能兑现',
    'toast.getToSurface': '快回地面',
    'toast.eruptionWarn': '山体开始躁动 · {t}',
    'banner.volcano': '火山苏醒了',
    'banner.climbNow': '立刻往上爬。',
    'banner.timeUp': '这座山已经等得够久了',
    'banner.lostInDark': '{v} 消失在黑暗中',
    'banner.heartstonePaid': '+{v} 心髓石',

    /* Floating world text */
    'fx.hauled': '+{v} 已带出',
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
