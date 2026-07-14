/* ============================================================
   tools-core.js — سجل الأدوات + جامع البيانات + مصانع التشغيل
   كل أداة تُسجَّل بتعريف موحد ويشغلها المحرك engine.js
   ============================================================ */
'use strict';

/* ---------------- تعريف الوحدات (Modules) ---------------- */
const MODULES = [
  { id: 'm1', name: 'لوحة التحكم والتقارير', en: 'Dashboard & Reports', icon: 'fa-gauge-high' },
  { id: 'm2', name: 'إدارة الفيديوهات', en: 'Video Management', icon: 'fa-clapperboard' },
  { id: 'm3', name: 'التحليلات', en: 'Analytics', icon: 'fa-chart-line' },
  { id: 'm4', name: 'البحث وذكاء المنافسين', en: 'Research & Competitors', icon: 'fa-magnifying-glass-chart' },
  { id: 'm5', name: 'التخطيط والكتابة بالذكاء', en: 'AI Planning & Writing', icon: 'fa-pen-nib' },
  { id: 'm6', name: 'استوديو الثمبنيل والشورتس', en: 'Thumbnail & Shorts Studio', icon: 'fa-image' },
  { id: 'm7', name: 'إدارة المجتمع ومركز SEO', en: 'Community & SEO Center', icon: 'fa-comments' },
  { id: 'm8', name: 'الأتمتة والتنبؤ والذكاء المتقدم', en: 'Automation & Prediction', icon: 'fa-robot' },
  { id: 'm9', name: 'ذكاء النظام والتحكم', en: 'System Intelligence', icon: 'fa-microchip' }
];

/* ---------------- سجل الأدوات ---------------- */
const Tools = (() => {
  const registry = new Map();
  function register(def) {
    if (!def.id || !def.module) throw new Error('تعريف أداة ناقص: ' + JSON.stringify(def.id));
    registry.set(def.id, def);
  }
  function registerAll(list) { list.forEach(register); }
  const get = id => registry.get(id);
  const all = () => [...registry.values()];
  const byModule = m => all().filter(t => t.module === m);
  return { register, registerAll, get, all, byModule };
})();

/* ---------------- النظام الأساسي لتعليمات Gemini ---------------- */
const SYS_PROMPT = `أنت "YouTube AI Studio" — مستشار خبير فى نمو قنوات يوتيوب، تحليل الأداء، SEO، وصناعة المحتوى.
قواعدك:
- أجب دائماً باللغة العربية (يسمح بالمصطلحات التقنية بالإنجليزية).
- استخدم تنسيق Markdown منظم: عناوين، قوائم، جداول عند الحاجة.
- اعتمد على البيانات المعطاة فقط، وإذا كانت البيانات محدودة وضّح ذلك وقدّر بحذر.
- قدّم توصيات عملية محددة قابلة للتنفيذ، مرتبة حسب الأولوية والتأثير.
- عند إعطاء درجات استخدم مقياس 0-100 مع تبرير مختصر.`;

/* ---------------- جامع البيانات المشترك (Ctx) ---------------- */
const Ctx = (() => {

  /** سياق القناة من قاعدة المعرفة والإعدادات */
  function kb() {
    const s = Store.settings();
    const k = Store.knowledge.get();
    let out = '';
    if (s.niche) out += `\nنيتش القناة: ${s.niche}`;
    if (k.profile) out += `\nملف القناة: ${k.profile}`;
    if (k.audience) out += `\nجمهور القناة: ${k.audience}`;
    if (k.style) out += `\nأسلوب الكتابة: ${k.style}`;
    if (k.rules) out += `\nقواعد المحتوى: ${k.rules}`;
    if (k.patterns) out += `\nأنماط ناجحة سابقاً: ${k.patterns}`;
    return out ? `\n--- معرفة القناة المحفوظة ---${out}\n` : '';
  }

  /** حزمة بيانات القناة: معلومات + آخر الفيديوهات (ملخصة) */
  async function channel(input, maxVideos = 50) {
    const id = await YT.resolveChannel(input || Store.settings().channelId);
    const info = await YT.channelInfo(id);
    const videos = await YT.channelVideos(id, maxVideos);
    return {
      id,
      info,
      videos,
      summary: {
        title: info.snippet.title,
        description: (info.snippet.description || '').slice(0, 300),
        subscribers: +info.statistics.subscriberCount || 0,
        totalViews: +info.statistics.viewCount || 0,
        videoCount: +info.statistics.videoCount || 0,
        created: info.snippet.publishedAt?.slice(0, 10)
      },
      videoSummaries: videos.map(YT.summarizeVideo)
    };
  }

  /** نص مضغوط لبيانات القناة لإرساله إلى Gemini */
  function channelText(b, n = 40) {
    const vids = b.videoSummaries.slice(0, n).map(v =>
      `- [${v.published}] "${v.title}" | مشاهدات:${v.views} | إعجابات:${v.likes} | تعليقات:${v.comments} | مدة:${v.durationSec}ث${v.isShort ? ' (Short)' : ''}`
    ).join('\n');
    return `القناة: ${b.summary.title}
المشتركون: ${b.summary.subscribers} | إجمالي المشاهدات: ${b.summary.totalViews} | عدد الفيديوهات: ${b.summary.videoCount} | تاريخ الإنشاء: ${b.summary.created}
الوصف: ${b.summary.description}

آخر ${Math.min(n, b.videoSummaries.length)} فيديو:
${vids}`;
  }

  /** حزمة فيديو واحد */
  async function video(input) {
    const v = await YT.video(input);
    const s = YT.summarizeVideo(v);
    return {
      raw: v, summary: s,
      text: `الفيديو: "${v.snippet.title}"
تاريخ النشر: ${s.published} | المشاهدات: ${s.views} | الإعجابات: ${s.likes} | التعليقات: ${s.comments} | المدة: ${s.durationSec} ثانية${s.isShort ? ' (Short)' : ''}
الوصف:\n${(v.snippet.description || '').slice(0, 800)}
الوسوم: ${(v.snippet.tags || []).join(', ') || 'لا توجد'}`
    };
  }

  /** تعليقات فيديو كنص */
  async function comments(input, max = 60) {
    const id = YT.parseVideoId(input);
    const list = await YT.videoComments(id, max);
    return {
      list,
      text: list.map(c => `- (${c.likes}👍) ${c.author}: ${c.text.slice(0, 220)}`).join('\n') || 'لا توجد تعليقات'
    };
  }

  /** قنوات المنافسين من الإعدادات أو من إدخال */
  async function competitors(input, maxVideosEach = 12) {
    const raw = (input || Store.settings().competitors || '').split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
    if (!raw.length) throw new Error('أضف قنوات منافسة (فى الحقل أو فى الإعدادات)');
    const out = [];
    for (const r of raw.slice(0, 5)) {
      try {
        const id = await YT.resolveChannel(r);
        const info = await YT.channelInfo(id);
        const videos = await YT.channelVideos(id, maxVideosEach);
        out.push({ id, info, videos, videoSummaries: videos.map(YT.summarizeVideo) });
      } catch (e) { console.warn('منافس تعذر تحميله:', r, e.message); }
    }
    if (!out.length) throw new Error('تعذر تحميل أى قناة منافسة');
    return out;
  }

  function competitorsText(list) {
    return list.map(c => `\n### قناة منافسة: ${c.info.snippet.title}
مشتركون: ${c.info.statistics.subscriberCount} | مشاهدات كلية: ${c.info.statistics.viewCount} | فيديوهات: ${c.info.statistics.videoCount}
أحدث الفيديوهات:
${c.videoSummaries.map(v => `- [${v.published}] "${v.title}" (${v.views} مشاهدة${v.isShort ? '، Short' : ''})`).join('\n')}`).join('\n');
  }

  /** محاولة جلب Analytics (OAuth) — ترجع null بدلاً من رمي خطأ */
  async function analyticsOrNull(params) {
    try {
      const data = await YTA.query(params);
      return YTA.rows(data);
    } catch (e) {
      if (e.message === 'NO_OAUTH') return null;
      console.warn('Analytics غير متاح:', e.message);
      return null;
    }
  }

  /** ملاحظة قياسية عند غياب Analytics */
  const ANALYTICS_NOTE = `\n(ملاحظة: بيانات YouTube Analytics الخاصة غير متصلة — التحليل يعتمد على البيانات العامة فقط. اذكر ذلك فى بداية الرد وقدّر بحذر.)`;

  /** نص Analytics أو الملاحظة البديلة */
  async function analyticsText(params, label) {
    const rows = await analyticsOrNull(params);
    if (!rows || !rows.length) return ANALYTICS_NOTE;
    return `\n--- ${label} (YouTube Analytics) ---\n` +
      rows.slice(0, 120).map(r => JSON.stringify(r)).join('\n');
  }

  return { kb, channel, channelText, video, comments, competitors, competitorsText, analyticsOrNull, analyticsText, ANALYTICS_NOTE };
})();

/* ---------------- مصانع تشغيل جاهزة (Runners) ---------------- */
const Runners = (() => {

  /** أداة ذكاء اصطناعي نصية بسيطة: prompt من قيم النموذج مباشرة */
  function ai(promptFn, opts = {}) {
    return async (vals, tool) => {
      const prompt = promptFn(vals) + Ctx.kb();
      const text = await Gemini.generate(prompt, { system: SYS_PROMPT, tool: tool.id, temperature: opts.temperature });
      return { text, html: UI.md(text) };
    };
  }

  /** أداة تجمع بيانات القناة ثم تحلل بالذكاء الاصطناعي */
  function channelAI(promptFn, opts = {}) {
    return async (vals, tool, progress) => {
      progress('جارِ تحميل بيانات القناة...');
      const b = await Ctx.channel(vals.channel, opts.maxVideos || 50);
      let extra = '';
      if (opts.analytics) {
        progress('جارِ جلب بيانات Analytics...');
        extra = await Ctx.analyticsText(opts.analytics(vals), opts.analyticsLabel || 'Analytics');
      }
      progress('جارِ التحليل بالذكاء الاصطناعي...');
      const prompt = promptFn(vals, Ctx.channelText(b, opts.textVideos || 40) + extra, b) + Ctx.kb();
      const text = await Gemini.generate(prompt, { system: SYS_PROMPT, tool: tool.id });
      return { text, html: UI.md(text), data: b };
    };
  }

  /** أداة تحلل فيديو واحد */
  function videoAI(promptFn, opts = {}) {
    return async (vals, tool, progress) => {
      progress('جارِ تحميل بيانات الفيديو...');
      const v = await Ctx.video(vals.video);
      let extra = '';
      if (opts.comments) {
        progress('جارِ تحميل التعليقات...');
        try { extra = '\n--- عينة التعليقات ---\n' + (await Ctx.comments(vals.video, 50)).text; } catch {}
      }
      progress('جارِ التحليل بالذكاء الاصطناعي...');
      const prompt = promptFn(vals, v.text + extra, v) + Ctx.kb();
      const text = await Gemini.generate(prompt, { system: SYS_PROMPT, tool: tool.id });
      return { text, html: UI.md(text), data: v };
    };
  }

  /** أداة تحلل تعليقات فيديو */
  function commentsAI(promptFn, max = 80) {
    return async (vals, tool, progress) => {
      progress('جارِ تحميل التعليقات...');
      const c = await Ctx.comments(vals.video, max);
      if (!c.list.length) throw new Error('لا توجد تعليقات على هذا الفيديو');
      progress(`جارِ تحليل ${c.list.length} تعليق...`);
      const prompt = promptFn(vals, c.text, c) + Ctx.kb();
      const text = await Gemini.generate(prompt, { system: SYS_PROMPT, tool: tool.id });
      return { text, html: UI.md(text) };
    };
  }

  /** أداة تحلل منافسين */
  function competitorAI(promptFn, opts = {}) {
    return async (vals, tool, progress) => {
      progress('جارِ تحميل بيانات المنافسين...');
      const comp = await Ctx.competitors(vals.competitors, opts.maxVideos || 12);
      let mine = '';
      if (opts.withChannel) {
        try {
          progress('جارِ تحميل بيانات قناتك...');
          const b = await Ctx.channel(vals.channel, 25);
          mine = '\n--- قناتك ---\n' + Ctx.channelText(b, 25);
        } catch {}
      }
      progress('جارِ التحليل بالذكاء الاصطناعي...');
      const prompt = promptFn(vals, Ctx.competitorsText(comp) + mine, comp) + Ctx.kb();
      const text = await Gemini.generate(prompt, { system: SYS_PROMPT, tool: tool.id });
      return { text, html: UI.md(text) };
    };
  }

  /** أداة تحلل صورة (ثمبنيل) */
  function imageAI(promptFn, opts = {}) {
    return async (vals, tool, progress) => {
      if (!vals._image) throw new Error('ارفع صورة أولاً');
      progress('جارِ تحليل الصورة بالذكاء الاصطناعي...');
      const prompt = promptFn(vals) + Ctx.kb();
      const text = await Gemini.generate(prompt, {
        system: SYS_PROMPT, tool: tool.id,
        imageBase64: vals._image.base64, imageMime: vals._image.mime,
        imageBase64_2: vals._image2?.base64, imageMime2: vals._image2?.mime
      });
      return { text, html: UI.md(text) };
    };
  }

  /** أداة بحث فى يوتيوب ثم تحليل */
  function searchAI(promptFn, opts = {}) {
    return async (vals, tool, progress) => {
      progress('جارِ البحث فى يوتيوب...');
      const q = vals.query || vals.niche || vals.keywords;
      const res = await YT.search(q, Object.assign({ maxResults: opts.maxResults || 20 }, opts.searchParams?.(vals) || {}));
      const ids = (res.items || []).map(i => i.id.videoId).filter(Boolean);
      const vids = await YT.videosByIds(ids);
      const sums = vids.map(YT.summarizeVideo);
      const listText = sums.map(v => `- [${v.published}] "${v.title}" | قناة | مشاهدات:${v.views} | تفاعل:${v.likes}👍/${v.comments}💬 | مدة:${v.durationSec}ث`).join('\n');
      progress('جارِ التحليل بالذكاء الاصطناعي...');
      const prompt = promptFn(vals, listText, sums) + Ctx.kb();
      const text = await Gemini.generate(prompt, { system: SYS_PROMPT, tool: tool.id });
      return { text, html: UI.md(text) };
    };
  }

  return { ai, channelAI, videoAI, commentsAI, competitorAI, imageAI, searchAI };
})();

/* ---------------- حقول إدخال جاهزة (اختصارات) ---------------- */
const F = {
  channel: (req = false) => ({ k: 'channel', label: 'معرف القناة أو @handle أو الرابط', type: 'text', ph: 'يُملأ تلقائياً من الإعدادات إن وُجد', required: req, fromSettings: 'channelId' }),
  video: () => ({ k: 'video', label: 'رابط الفيديو أو معرفه', type: 'text', ph: 'https://youtube.com/watch?v=...', required: true }),
  topic: (label = 'موضوع / فكرة الفيديو') => ({ k: 'topic', label, type: 'textarea', ph: 'اكتب الفكرة بالتفصيل...', required: true }),
  niche: () => ({ k: 'niche', label: 'النيتش / مجال المحتوى', type: 'text', ph: 'مثال: تعليم البرمجة، الطبخ، الألعاب...', required: true, fromSettings: 'niche' }),
  keywords: () => ({ k: 'keywords', label: 'الكلمات المفتاحية (سطر لكل كلمة)', type: 'textarea', ph: 'كلمة 1\nكلمة 2', required: true }),
  competitors: () => ({ k: 'competitors', label: 'قنوات المنافسين (سطر لكل قناة)', type: 'textarea', ph: '@channel1\n@channel2', fromSettings: 'competitors' }),
  lang: () => ({ k: 'lang', label: 'لغة الناتج', type: 'select', opts: ['العربية', 'English', 'Français', 'Español', 'Deutsch', 'Türkçe'], def: 'العربية' }),
  image: (label = 'الصورة المصغرة') => ({ k: '_image', label, type: 'image' }),
  select: (k, label, opts, def) => ({ k, label, type: 'select', opts, def: def ?? opts[0] }),
  text: (k, label, ph = '', req = false) => ({ k, label, type: 'text', ph, required: req }),
  area: (k, label, ph = '', req = false) => ({ k, label, type: 'textarea', ph, required: req })
};
