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

    /* How to play — one row per rule, in the order a new miner needs them */
    'help.move.k': 'MOVE',
    'help.move.v': 'Drag anywhere on the left half: left and right walk. <b>A</b> / <b>D</b> on desktop.',
    'help.mine.k': 'MINE',
    'help.mine.v': 'Hold <b>MINE</b> (<b>J</b>) to swing at the tile the stick points to — down digs the floor, up the ceiling, a <b>diagonal</b> the corner tile. It hits spiders and bats too.',
    'help.dirt.k': 'DIRT & ROCK',
    'help.dirt.v': 'Dirt takes <b>two hits</b>. The first only cracks it, and cracked dirt with nothing under it <b>falls</b> a moment later — onto a spider, or onto you. <b>Rock</b> shrugs off the pick; only dynamite breaks it.',
    'help.jump.k': 'JUMP',
    'help.jump.v': 'Gravity is real, but falls do not hurt. Hold <b>JUMP</b> (<b>Space</b>) for height. Dig <b>steps</b> on the way down, not a pit — you have to climb back out.',
    'help.grip.k': 'GRAPPLE',
    'help.grip.v': 'Falling past a wall? Hold the stick <b>into</b> it and the hook catches. <b>JUMP</b> from there, catch again — that is how a shaft is climbed.',
    'help.boom.k': 'DYNAMITE',
    'help.boom.v': 'Tap 🧨 (<b>F</b>) to drop a stick <b>at your feet</b>, then run. It falls like you do. Clears a 3×3, rock included. Each mine starts with a full satchel; refills after that cost gems.',
    'help.bank.k': 'NO BANKS',
    'help.bank.v': 'Every gem you carry is <b>lost if you die</b>. Only walking back into the <b>surface camp</b> turns it into score — and walking out without the Heartstone ends the campaign.',
    'help.shop.k': 'LANTERNS',
    'help.shop.v': 'Lanterns down the mine are <b>shops, not banks</b>. Upgrades, med packs and dynamite are paid from the gems you carry, so every purchase is score gone. Each lantern <b>lights once</b>.',
    'help.heart.k': 'HEARTSTONE',
    'help.heart.v': 'Taking it <b>wakes the volcano</b>: lava rises and you climb. Carry it out for <b>+{h}</b> and a <b>deeper mine</b> opens. Your upgrades come with you; your gems stay behind as score.',
    'help.clock.k': 'THE CLOCK',
    'help.clock.v': 'Heartstone or not, the mountain erupts on its own after <b>{m} minutes</b> (a little longer in later mines). Watch the HUD and be climbing before it hits zero.',
    'help.dark.k': 'THE DARK',
    'help.dark.v': 'Your lamp is all the light there is. <b>Spiders</b> dig after you and pounce — watch for the wind-up. <b>Bats</b> cannot dig, but they steal your best gem: kill one before it gets away to take it back.',

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

    'meta.title': 'DEEPCUT 深掘',
    'meta.desc': 'DEEPCUT 深掘 —— 专为手机打造的网页挖矿 Roguelite。一路往下挖，把宝石带出去，顺便……吵醒火山。',

    /* HUD */
    'hud.score': '得分',
    'hud.carrying': '身上',
    'hud.surface': '地面',
    'hud.surfaceCamp': '地面营地',
    'hud.deep': '深度 {d} 米',
    'hud.lavaBelow': '岩浆离你 {d} 米',
    'hud.eruption': '火山爆发 {t}',
    'hud.mine': '挖',
    'hud.mineN': '第 {n} 关',
    'hud.jump': '跳',
    'hud.dynamite': '炸药',

    /* Control labels (aria) */
    'aria.mine': '挖掘',
    'aria.dynamite': '放炸药',
    'aria.jump': '跳跃',

    /* Title screen */
    'title.tagline': '挖得深 · 带得走 · 活下来',
    'title.furthestMine': '最远关卡',
    'title.bestHaul': '最佳成绩',
    'title.deepest': '最深到过',
    'title.start': '开挖',
    'title.wipe': '清除存档',

    /* Highscores — a score is what a campaign carried out, less what it spent */
    'score.title': '排行榜',
    'score.empty': '还没成功带出过宝石',
    'score.mineDepth': '第 {n} 关 · {d} 米',
    'score.newBest': '刷新个人最佳！',
    'score.ranked': '历史第 {n} 名',

    /* How to play — one row per rule, in the order a new miner needs them */
    'help.move.k': '移动',
    'help.move.v': '在屏幕左半边随便哪里按住拖动，左右走。电脑上用 <b>A</b> / <b>D</b>。',
    'help.mine.k': '挖掘',
    'help.mine.v': '按住<b>挖</b>（<b>J</b>），摇杆指哪就挖哪：往下挖脚底，往上挖头顶，<b>斜着推</b>就挖斜角那格。蜘蛛和蝙蝠也照打不误。',
    'help.dirt.k': '泥土与岩石',
    'help.dirt.v': '泥土要<b>挖两下</b>：第一下只会挖松，松土底下要是空的，过一会儿就会<b>塌下来</b> —— 砸蜘蛛，也可能砸你自己。<b>岩石</b>镐子挖不动，只能用炸药。',
    'help.jump.k': '跳跃',
    'help.jump.v': '有重力，但摔不疼。按住<b>跳</b>（<b>空格</b>）越久跳得越高。往下挖时记得留<b>台阶</b>，别挖成一口井 —— 待会儿还得爬回来。',
    'help.grip.k': '抓钩',
    'help.grip.v': '贴着墙往下掉时，把摇杆<b>朝墙推</b>，抓钩就能挂住。挂住后<b>起跳</b>，再挂住，再跳 —— 竖井就是这么爬上去的。',
    'help.boom.k': '炸药',
    'help.boom.v': '点 🧨（<b>F</b>）在<b>脚下</b>放一根炸药，然后赶紧跑。炸药会往下掉，炸开周围 3×3，岩石也不例外。每关开局炸药是满的，之后补货要花宝石。',
    'help.bank.k': '不能存',
    'help.bank.v': '身上的宝石<b>死了就全没了</b>。只有走回<b>地面营地</b>才算真正到手 —— 不过没拿到火山之心就回营地，这一局也就结束了。',
    'help.shop.k': '补给站',
    'help.shop.v': '矿里的灯是<b>补给站，不是银行</b>。升级、急救包和炸药都用身上的宝石买，买一样，得分就少一截。每盏灯<b>只能用一次</b>。',
    'help.heart.k': '火山之心',
    'help.heart.v': '一拿到它，<b>火山就醒了</b>：岩浆往上涨，你得往上爬。把它带出去能得 <b>+{h}</b>，还能进入<b>更深的下一关</b>。升级跟着你走，宝石留下算作得分。',
    'help.clock.k': '倒计时',
    'help.clock.v': '不管拿没拿火山之心，<b>{m} 分钟</b>后火山都会自己爆发（后面的关卡时间稍长）。留意顶栏倒计时，归零前就该往上爬了。',
    'help.dark.k': '黑暗',
    'help.dark.v': '头灯是你唯一的光。<b>蜘蛛</b>会挖洞追你、扑上来咬 —— 看到它蓄力就快躲。<b>蝙蝠</b>不会挖洞，但会叼走你最值钱的宝石：趁它没飞远打下来，就能抢回来。',

    /* Shop */
    'shop.supplyLantern': '补给站',
    'shop.back': '回到矿里',
    'shop.max': '已满级',
    'shop.depth': '深度',
    'shop.paysFromCarry': '用身上的宝石付款 —— 花出去的每一颗，都会从最终得分里扣掉',
    'shop.hatRepaired': '安全帽修好了',
    'shop.singleUse': '你一走这盏灯就会熄灭 —— 想清楚再买',

    /* Supplies (bought, never handed out — and only by the full load) */
    'supply.dynamite.name': '补满炸药',
    'supply.dynamite.desc': '把炸药袋装满（{cur}/{max}）',
    'supply.heal.name': '急救包',
    'supply.heal.desc': '生命回满（{cur}/{max}）',

    /* Upgrades */
    'up.health.name': '加固背心',
    'up.health.desc': '生命上限 +1',
    'up.speed.name': '轻便矿靴',
    'up.speed.desc': '移动速度 +11%',
    'up.light.name': '头灯',
    'up.light.desc': '照明范围 +0.6 格',
    'up.dynamite.name': '炸药袋',
    'up.dynamite.desc': '炸药容量 +{n}',
    'up.helmet.name': '安全帽',
    'up.helmet.desc': '多挡一块落土，过一会儿自己恢复',
    'up.jump.name': '弹簧护膝',
    'up.jump.desc': '跳跃高度 +0.5 格',
    'up.blast.name': '大爆破',
    'up.blast.desc': '炸药范围从 3×3 扩大到 5×5 —— 小心把自己要踩的台阶也炸没了',

    /* Run summary */
    'sum.escaped': '成功脱身',
    'sum.died': '你倒下了',
    'sum.complete': '本次探险结束',
    'sum.nextMine': '第 {n} 关在等你',
    'sum.lootLost': '身上 {v} 的宝石全丢了',
    'sum.nothingLost': '身上没带东西，没有损失',
    'sum.escapedKept': '之前关卡带出来的得分都还在',
    'sum.hauledOut': '安全带出',
    'sum.hauledThisMine': '本关带出',
    'sum.score': '得分',
    'sum.mine': '关卡',
    'sum.gems': '宝石',
    'sum.found': '挖到的宝石',
    'sum.heartstones': '火山之心',
    'sum.spent': '补给站花费',
    'sum.lost': '被偷走或死亡丢失',
    'sum.scoreSoFar': '本局总分',
    'sum.finalScore': '最终得分',
    'sum.descend': '进入第 {n} 关',
    'sum.gearCarries': '升级带走 · 宝石留下算分',
    'sum.retire': '见好就收，结束本局',
    'sum.newCampaign': '再来一局',

    /* Pause */
    'pause.title': '暂停',
    'pause.sub': '深度 {d} 米 · 身上 {v}',
    'pause.resume': '继续',
    'pause.sound': '音效：{s}',
    'pause.abandon': '放弃（身上宝石全部丢失）',
    'common.on': '开',
    'common.off': '关',
    'common.metres': '{n} 米',

    /* Toasts & banners */
    'toast.digDown': '往下挖！',
    'toast.mineN': '第 {n} 关 · 往下挖！',
    'toast.noDynamite': '没炸药了',
    'toast.cantPlace': '这里放不了',
    'toast.notEnoughGems': '宝石不够',
    'toast.alreadyFull': '血已经是满的',
    'toast.satchelFull': '炸药袋已经满了',
    'toast.lanternSpent': '这盏灯已经熄了',
    'toast.sound': '音效{s}',
    'toast.heartstoneAtSurface': '火山之心要带回地面才算数',
    'toast.getToSurface': '快回地面！',
    'toast.eruptionWarn': '山体在震动…… {t}',
    'banner.volcano': '火山苏醒了',
    'banner.climbNow': '快往上爬！',
    'banner.timeUp': '火山等不及了',
    'banner.lostInDark': '{v} 丢在了黑暗里',
    'banner.heartstonePaid': '火山之心 +{v}',

    /* Floating world text */
    'fx.hauled': '+{v} 到手',
    'fx.gone': '被叼走了',
    'fx.recovered': '抢回来了',
    'fx.clunk': '哐！',
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
