/* ============================================================
   tools-m4-6.js — أدوات الوحدات 4-6
   Module 4: Content Research & Competitor Intelligence (15)
   Module 5: AI Content Planning & Writing (19)
   Module 6: Thumbnail Studio & Shorts Studio (11)
   ============================================================ */
'use strict';

Tools.registerAll([

/* ==================== Module 4 : Research & Competitors ==================== */

{
  id: 'keyword-research', module: 'm4', icon: 'fa-key',
  name: 'بحث الكلمات المفتاحية', en: 'Keyword Research',
  desc: 'اكتشاف كلمات مفتاحية قوية لنيتشك مع تقدير حجم البحث والمنافسة ونية الباحث.',
  apis: ['yt', 'ai'],
  fields: [F.niche(), F.text('seed', 'كلمة أساسية للانطلاق (اختياري)', 'مثال: تعلم بايثون')],
  run: Runners.searchAI((vals, list) =>
    `أنت خبير SEO يوتيوب. اعتماداً على نتائج البحث الفعلية التالية فى نيتش "${vals.niche}"${vals.seed ? ` حول "${vals.seed}"` : ''}:
${list}

قدّم:
1) جدول بـ20 كلمة مفتاحية: الكلمة | تقدير الطلب (عالى/متوسط/منخفض) | المنافسة | نية الباحث | فرصة (0-100)
2) 10 كلمات Long-tail ذهبية منخفضة المنافسة
3) 5 كلمات ترند صاعد
4) استراتيجية استخدام هذه الكلمات فى العناوين والوصف والتاجز`,
    { maxResults: 25, searchParams: v => ({ q: v.seed || v.niche }) })
},

{
  id: 'topic-research', module: 'm4', icon: 'fa-lightbulb',
  name: 'بحث المواضيع', en: 'Topic Research',
  desc: 'اكتشاف مواضيع فيديوهات مطلوبة فى نيتشك بناءً على ما ينجح فعلياً على يوتيوب الآن.',
  apis: ['yt', 'ai'],
  fields: [F.niche(), F.select('goal', 'هدف المحتوى', ['نمو مشاهدات', 'نمو مشتركين', 'بناء سلطة/ثقة', 'تحقيق دخل'], 'نمو مشاهدات')],
  run: Runners.searchAI((vals, list) =>
    `حلل الفيديوهات الرائجة فعلياً فى نيتش "${vals.niche}" (الهدف: ${vals.goal}):
${list}

قدّم:
1) 15 فكرة موضوع قوية مرتبة حسب الفرصة، لكل فكرة: العنوان المقترح + لماذا ستنجح + درجة الفرصة (0-100)
2) 5 زوايا مختلفة لم يغطها أحد بعد (Content Gaps)
3) 3 مواضيع Evergreen و3 مواضيع ترند
4) توصية بأول فيديو يجب تنفيذه ولماذا`,
    { maxResults: 25, searchParams: () => ({ order: 'viewCount', publishedAfter: new Date(Date.now() - 90 * 86400000).toISOString() }) })
},

{
  id: 'niche-analysis', module: 'm4', icon: 'fa-compass',
  name: 'تحليل النيتش', en: 'Niche Analysis',
  desc: 'تحليل شامل لنيتش: حجم السوق، المنافسة، شرائح الجمهور، فرص الدخول، وإمكانية الربح.',
  apis: ['yt', 'ai'],
  fields: [F.niche()],
  async run(vals, tool, progress) {
    progress('جارِ مسح النيتش على يوتيوب...');
    const res = await YT.search(vals.niche, { maxResults: 25, order: 'relevance' });
    const ids = (res.items || []).map(i => i.id.videoId).filter(Boolean);
    const vids = (await YT.videosByIds(ids)).map(YT.summarizeVideo);
    const channels = [...new Set((res.items || []).map(i => i.snippet.channelTitle))];
    progress('جارِ تحليل النيتش بالذكاء الاصطناعي...');
    const text = await Gemini.generate(
      `حلل نيتش "${vals.niche}" على يوتيوب تحليلاً استراتيجياً كاملاً بناءً على هذه العينة الحقيقية:
قنوات نشطة فى النيتش: ${channels.slice(0, 15).join('، ')}
فيديوهات العينة:
${vids.map(v => `- "${v.title}" (${v.views} مشاهدة، ${v.published})`).join('\n')}

قدّم:
1) حجم النيتش وتقدير الطلب (مع درجة 0-100)
2) مستوى المنافسة وتشبّع السوق (درجة 0-100)
3) شرائح الجمهور الرئيسية واهتماماتها
4) الأنواع الفرعية Sub-niches الواعدة (5 على الأقل)
5) إمكانية الربح (CPM متوقع، مصادر دخل)
6) استراتيجية دخول مثالية لقناة جديدة/صغيرة
7) الحكم النهائي: هل تنصح بهذا النيتش؟` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id });
    return { text, html: UI.md(text) };
  }
},

{
  id: 'content-explorer', module: 'm4', icon: 'fa-binoculars',
  name: 'مستكشف المحتوى', en: 'Content Explorer',
  desc: 'بحث متقدم فى يوتيوب بفلاتر (الترتيب، المدة، تاريخ النشر) مع جدول نتائج وتحليل ذكي.',
  apis: ['yt', 'ai'],
  fields: [
    F.text('query', 'كلمة البحث', 'اكتب أى موضوع...', true),
    F.select('order', 'الترتيب', ['الأكثر مشاهدة', 'الأحدث', 'الأكثر صلة', 'الأعلى تقييماً'], 'الأكثر مشاهدة'),
    F.select('when', 'تاريخ النشر', ['أى وقت', 'آخر أسبوع', 'آخر شهر', 'آخر 3 شهور', 'آخر سنة'], 'آخر شهر'),
    F.select('dur', 'المدة', ['الكل', 'قصير (أقل من 4 د)', 'متوسط (4-20 د)', 'طويل (أكثر من 20 د)'], 'الكل')
  ],
  async run(vals, tool, progress) {
    progress('جارِ البحث فى يوتيوب...');
    const orderMap = { 'الأكثر مشاهدة': 'viewCount', 'الأحدث': 'date', 'الأكثر صلة': 'relevance', 'الأعلى تقييماً': 'rating' };
    const daysMap = { 'آخر أسبوع': 7, 'آخر شهر': 30, 'آخر 3 شهور': 90, 'آخر سنة': 365 };
    const durMap = { 'قصير (أقل من 4 د)': 'short', 'متوسط (4-20 د)': 'medium', 'طويل (أكثر من 20 د)': 'long' };
    const params = { maxResults: 25, order: orderMap[vals.order] };
    if (daysMap[vals.when]) params.publishedAfter = new Date(Date.now() - daysMap[vals.when] * 86400000).toISOString();
    if (durMap[vals.dur]) params.videoDuration = durMap[vals.dur];
    const res = await YT.search(vals.query, params);
    const ids = (res.items || []).map(i => i.id.videoId).filter(Boolean);
    const raw = await YT.videosByIds(ids);
    const vids = raw.map(v => ({ ...YT.summarizeVideo(v), channel: v.snippet.channelTitle }));
    if (!vids.length) throw new Error('لا توجد نتائج لهذا البحث');

    progress('جارِ التحليل بالذكاء الاصطناعي...');
    let aiHtml = '', aiText = '';
    try {
      aiText = await Gemini.generate(
        `حلل نتائج البحث عن "${vals.query}" واستخرج: 1) الأنماط المشتركة فى العناوين الناجحة، 2) متوسط الأداء، 3) أهم 3 فرص محتوى واضحة من النتائج.\n\n${vids.map(v => `- "${v.title}" | ${v.channel} | ${v.views} مشاهدة | ${v.published}`).join('\n')}` + Ctx.kb(),
        { system: SYS_PROMPT, tool: tool.id });
      aiHtml = UI.md(aiText);
    } catch (e) { aiHtml = `<p class="sub">${UI.esc(e.message)}</p>`; }

    const html = `
      <div class="card"><h3><i class="fa-solid fa-list"></i> النتائج (${vids.length})</h3>
        <div class="table-scroll"><table class="data-table"><thead><tr><th>العنوان</th><th>القناة</th><th>مشاهدات</th><th>إعجابات</th><th>النشر</th><th>مدة</th></tr></thead><tbody>
        ${vids.map(v => `<tr><td><a href="https://youtube.com/watch?v=${v.id}" target="_blank" rel="noopener">${UI.esc(v.title)}</a></td><td>${UI.esc(v.channel)}</td><td>${UI.num(v.views)}</td><td>${UI.num(v.likes)}</td><td>${v.published}</td><td>${Math.round(v.durationSec / 60)}د</td></tr>`).join('')}
        </tbody></table></div></div>
      <div class="card" style="margin-top:18px"><h3><i class="fa-solid fa-wand-magic-sparkles"></i> التحليل الذكي</h3>${aiHtml}</div>`;
    return { html, text: aiText || `نتائج البحث: ${vals.query}` };
  }
},

{
  id: 'content-gap', module: 'm4', icon: 'fa-puzzle-piece',
  name: 'فجوات المحتوى', en: 'Content Gap Finder',
  desc: 'مقارنة محتواك بمحتوى المنافسين لاكتشاف المواضيع التى يغطونها وأنت لا — والعكس.',
  apis: ['yt', 'ai'],
  fields: [F.channel(), F.competitors()],
  run: Runners.competitorAI((vals, ctx) =>
    `قارن محتوى قناتى بمحتوى المنافسين واكتشف فجوات المحتوى:
${ctx}

قدّم:
1) جدول: مواضيع يغطيها المنافسون بنجاح وأنا لا أغطيها (مع متوسط مشاهداتها عندهم)
2) مواضيع أغطيها أنا وهم لا (نقاط قوتى الفريدة)
3) أهم 10 فجوات مرتبة حسب الفرصة مع عنوان مقترح لكل واحدة
4) خطة سد الفجوات خلال 30 يوم`,
    { withChannel: true })
},

{
  id: 'outlier-finder', module: 'm4', icon: 'fa-bolt',
  name: 'كاشف الفيديوهات الشاذة', en: 'Outlier Finder',
  desc: 'اكتشاف الفيديوهات التى تجاوزت أداء قناتها بأضعاف (Outliers) فى نيتشك — أفكار مثبتة النجاح.',
  apis: ['yt', 'ai'],
  fields: [F.niche(), F.select('window', 'فترة البحث', ['آخر شهر', 'آخر 3 شهور', 'آخر 6 شهور'], 'آخر 3 شهور')],
  async run(vals, tool, progress) {
    progress('جارِ البحث عن فيديوهات النيتش...');
    const days = { 'آخر شهر': 30, 'آخر 3 شهور': 90, 'آخر 6 شهور': 180 }[vals.window];
    const res = await YT.search(vals.niche, { maxResults: 25, order: 'viewCount', publishedAfter: new Date(Date.now() - days * 86400000).toISOString() });
    const ids = (res.items || []).map(i => i.id.videoId).filter(Boolean);
    const raw = await YT.videosByIds(ids);

    progress('جارِ حساب معامل الشذوذ لكل فيديو...');
    const out = [];
    const seen = new Set();
    for (const v of raw.slice(0, 15)) {
      const chId = v.snippet.channelId;
      if (seen.has(chId)) continue;
      seen.add(chId);
      try {
        const ch = await YT.channelInfo(chId);
        const subs = +ch.statistics.subscriberCount || 1;
        const views = +v.statistics.viewCount || 0;
        out.push({ ...YT.summarizeVideo(v), channel: v.snippet.channelTitle, subs, ratio: +(views / subs).toFixed(1) });
      } catch {}
    }
    out.sort((a, z) => z.ratio - a.ratio);
    if (!out.length) throw new Error('لم يتم العثور على نتائج كافية');

    progress('جارِ التحليل بالذكاء الاصطناعي...');
    const text = await Gemini.generate(
      `هذه فيديوهات "شاذة" (Outliers) فى نيتش "${vals.niche}" — نسبة مشاهداتها إلى مشتركى قنواتها عالية جداً:
${out.map(v => `- "${v.title}" | ${UI.num(v.views)} مشاهدة | قناة ${v.channel} (${UI.num(v.subs)} مشترك) | معامل ${v.ratio}x`).join('\n')}

حلل: 1) لماذا انفجر كل فيديو (العنوان/الفكرة/التوقيت)؟ 2) الأنماط المشتركة بينها، 3) كيف أطبق نفس الوصفة — 5 أفكار فيديو مستوحاة بعناوين جاهزة.` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id });

    const html = `
      <div class="card"><h3><i class="fa-solid fa-bolt"></i> الفيديوهات الشاذة</h3>
        <div class="table-scroll"><table class="data-table"><thead><tr><th>العنوان</th><th>القناة</th><th>مشاهدات</th><th>مشتركو القناة</th><th>المعامل</th></tr></thead><tbody>
        ${out.map(v => `<tr><td><a href="https://youtube.com/watch?v=${v.id}" target="_blank" rel="noopener">${UI.esc(v.title)}</a></td><td>${UI.esc(v.channel)}</td><td>${UI.num(v.views)}</td><td>${UI.num(v.subs)}</td><td><span class="badge ${v.ratio >= 5 ? 'green' : v.ratio >= 2 ? 'orange' : 'blue'}">${v.ratio}x</span></td></tr>`).join('')}
        </tbody></table></div></div>
      <div class="card" style="margin-top:18px"><h3><i class="fa-solid fa-wand-magic-sparkles"></i> تحليل أسباب الانتشار</h3>${UI.md(text)}</div>`;
    return { html, text };
  }
},

{
  id: 'outlier-shorts', module: 'm4', icon: 'fa-fire',
  name: 'شورتس منفجرة', en: 'Outlier Shorts',
  desc: 'اكتشاف فيديوهات Shorts المنتشرة بقوة فى نيتشك وتحليل وصفة انتشارها.',
  apis: ['yt', 'ai'],
  fields: [F.niche()],
  run: Runners.searchAI((vals, list) =>
    `هذه فيديوهات Shorts رائجة فى نيتش "${vals.niche}":
${list}

حلل: 1) أنماط الهوك (الثوانى الأولى) المتوقعة من العناوين، 2) الصيغ المتكررة الناجحة، 3) المدة المثالية الملاحظة، 4) 10 أفكار Shorts جاهزة (عنوان + هوك + وصف المحتوى) مبنية على هذه الأنماط.`,
    { maxResults: 25, searchParams: v => ({ q: v.niche + ' #shorts', order: 'viewCount', videoDuration: 'short', publishedAfter: new Date(Date.now() - 30 * 86400000).toISOString() }) })
},

{
  id: 'breakout-channels', module: 'm4', icon: 'fa-rocket',
  name: 'القنوات الصاعدة', en: 'Breakout Channels',
  desc: 'اكتشاف القنوات الجديدة سريعة النمو فى نيتشك ودراسة سر صعودها.',
  apis: ['yt', 'ai'],
  fields: [F.niche()],
  async run(vals, tool, progress) {
    progress('جارِ البحث عن قنوات النيتش...');
    const res = await YT.request('search', { part: 'snippet', q: vals.niche, type: 'channel', maxResults: 20 }, 120);
    const chIds = (res.items || []).map(i => i.snippet.channelId);
    progress('جارِ حساب سرعة نمو كل قناة...');
    const chans = [];
    for (let i = 0; i < chIds.length; i += 50) {
      const data = await YT.request('channels', { part: 'snippet,statistics', id: chIds.slice(i, i + 50).join(',') }, 120);
      (data.items || []).forEach(c => {
        const ageDays = Math.max(30, (Date.now() - new Date(c.snippet.publishedAt)) / 86400000);
        const subs = +c.statistics.subscriberCount || 0;
        chans.push({
          title: c.snippet.title, id: c.id, subs,
          views: +c.statistics.viewCount || 0,
          videos: +c.statistics.videoCount || 0,
          created: c.snippet.publishedAt.slice(0, 10),
          ageDays: Math.round(ageDays),
          subsPerDay: +(subs / ageDays).toFixed(1)
        });
      });
    }
    chans.sort((a, z) => z.subsPerDay - a.subsPerDay);
    const top = chans.slice(0, 10);
    if (!top.length) throw new Error('لم يتم العثور على قنوات');

    progress('جارِ تحليل أسرار الصعود...');
    const text = await Gemini.generate(
      `هذه أسرع القنوات نمواً فى نيتش "${vals.niche}" (مرتبة بمعدل مشتركين/يوم منذ الإنشاء):
${top.map(c => `- ${c.title} | ${UI.num(c.subs)} مشترك | ${c.videos} فيديو | عمر ${c.ageDays} يوم | ${c.subsPerDay} مشترك/يوم`).join('\n')}

حلل: 1) ما القاسم المشترك بين القنوات الصاعدة؟ 2) استراتيجيات النمو المتوقعة، 3) دروس عملية يمكننى تطبيقها فوراً (5 على الأقل).` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id });

    const html = `
      <div class="card"><h3><i class="fa-solid fa-rocket"></i> القنوات الصاعدة</h3>
        <div class="table-scroll"><table class="data-table"><thead><tr><th>القناة</th><th>مشتركون</th><th>فيديوهات</th><th>العمر</th><th>مشترك/يوم</th></tr></thead><tbody>
        ${top.map(c => `<tr><td><a href="https://youtube.com/channel/${c.id}" target="_blank" rel="noopener">${UI.esc(c.title)}</a></td><td>${UI.num(c.subs)}</td><td>${c.videos}</td><td>${c.ageDays} يوم</td><td><span class="badge green">${c.subsPerDay}</span></td></tr>`).join('')}
        </tbody></table></div></div>
      <div class="card" style="margin-top:18px"><h3><i class="fa-solid fa-wand-magic-sparkles"></i> تحليل أسرار الصعود</h3>${UI.md(text)}</div>`;
    return { html, text };
  }
},

{
  id: 'competitor-strategy', module: 'm4', icon: 'fa-chess',
  name: 'استراتيجية المنافسين', en: 'Competitor Strategy Analyzer',
  desc: 'تفكيك استراتيجية منافس كاملة: تكرار النشر، أنواع المحتوى، أنماط العناوين، ونقاط الضعف.',
  apis: ['yt', 'ai'],
  fields: [F.competitors()],
  run: Runners.competitorAI((vals, ctx) =>
    `فكّك استراتيجية هذه القنوات المنافسة بالتفصيل:
${ctx}

لكل قناة قدّم:
1) تكرار النشر ونمطه
2) توزيع أنواع المحتوى (طويل/Shorts/مواضيع)
3) أنماط العناوين والصيغ المتكررة
4) ما ينجح لديهم أكثر (أعلى الفيديوهات ولماذا)
5) نقاط الضعف والثغرات القابلة للاستغلال
ثم: خطة تفوق عليهم فى 5 خطوات محددة.`)
},

{
  id: 'competitor-dashboard', module: 'm4', icon: 'fa-table-columns',
  name: 'لوحة المنافسين', en: 'Competitor Dashboard',
  desc: 'مقارنة جنبًا إلى جنب بين قناتك وقنوات المنافسين: أرقام، متوسطات، وتنبيهات ذكية.',
  apis: ['yt', 'ai'],
  fields: [F.channel(), F.competitors()],
  async run(vals, tool, progress) {
    progress('جارِ تحميل بيانات المنافسين...');
    const comp = await Ctx.competitors(vals.competitors, 15);
    let mine = null;
    try {
      progress('جارِ تحميل بيانات قناتك...');
      mine = await Ctx.channel(vals.channel, 15);
    } catch {}

    const rowOf = (title, info, sums, isMine = false) => {
      const avg = sums.length ? Math.round(sums.reduce((a, v) => a + v.views, 0) / sums.length) : 0;
      const eng = sums.length ? (sums.reduce((a, v) => a + (v.views ? (v.likes + v.comments) / v.views : 0), 0) / sums.length * 100).toFixed(2) : 0;
      return `<tr${isMine ? ' style="background:rgba(255,0,51,.06)"' : ''}><td>${isMine ? '⭐ ' : ''}${UI.esc(title)}</td><td>${UI.num(+info.statistics.subscriberCount || 0)}</td><td>${UI.num(+info.statistics.viewCount || 0)}</td><td>${info.statistics.videoCount}</td><td>${UI.num(avg)}</td><td>${eng}%</td></tr>`;
    };
    let rows = '';
    if (mine) rows += rowOf(mine.summary.title, mine.info, mine.videoSummaries, true);
    rows += comp.map(c => rowOf(c.info.snippet.title, c.info, c.videoSummaries)).join('');

    progress('جارِ إنشاء التنبيهات الذكية...');
    let aiText = '', aiHtml = '';
    try {
      aiText = await Gemini.generate(
        `قارن قناتى بالمنافسين وأنشئ تنبيهات ذكية:\n${mine ? '--- قناتى ---\n' + Ctx.channelText(mine, 15) : ''}\n${Ctx.competitorsText(comp)}\n\nقدّم: 1) أين أتفوق وأين أتأخر (جدول)، 2) 3 تنبيهات عاجلة (منافس نشر فيديو ناجح جداً، تغير استراتيجية...)، 3) 3 تحركات مقترحة هذا الأسبوع.` + Ctx.kb(),
        { system: SYS_PROMPT, tool: tool.id });
      aiHtml = UI.md(aiText);
    } catch (e) { aiHtml = `<p class="sub">${UI.esc(e.message)}</p>`; }

    const html = `
      <div class="card"><h3><i class="fa-solid fa-table-columns"></i> المقارنة المباشرة</h3>
        <div class="table-scroll"><table class="data-table"><thead><tr><th>القناة</th><th>مشتركون</th><th>مشاهدات كلية</th><th>فيديوهات</th><th>متوسط مشاهدات حديثة</th><th>تفاعل</th></tr></thead><tbody>${rows}</tbody></table></div></div>
      <div class="card" style="margin-top:18px"><h3><i class="fa-solid fa-bell"></i> التنبيهات الذكية</h3>${aiHtml}</div>`;
    return { html, text: aiText || 'لوحة المنافسين' };
  }
},

{
  id: 'competitor-tags', module: 'm4', icon: 'fa-tags',
  name: 'وسوم المنافسين', en: 'Competitor Tags Extractor',
  desc: 'استخراج الوسوم (Tags) الفعلية من فيديوهات أى قناة منافسة مع تحليل استراتيجيتها.',
  apis: ['yt', 'ai'],
  fields: [F.text('channel', 'قناة المنافس (@handle أو رابط أو ID)', '@channel', true)],
  async run(vals, tool, progress) {
    progress('جارِ تحميل فيديوهات المنافس...');
    const id = await YT.resolveChannel(vals.channel);
    const info = await YT.channelInfo(id);
    const videos = await YT.channelVideos(id, 30);
    const tagCount = {};
    videos.forEach(v => (v.snippet.tags || []).forEach(t => { tagCount[t] = (tagCount[t] || 0) + 1; }));
    const sorted = Object.entries(tagCount).sort((a, z) => z[1] - a[1]);
    if (!sorted.length) throw new Error('هذه القناة لا تستخدم وسوماً ظاهرة فى فيديوهاتها الأخيرة');

    progress('جارِ تحليل استراتيجية الوسوم...');
    const text = await Gemini.generate(
      `هذه وسوم قناة "${info.snippet.title}" مع عدد مرات الاستخدام فى آخر ${videos.length} فيديو:
${sorted.slice(0, 60).map(([t, n]) => `${t} (${n})`).join('، ')}

حلل: 1) استراتيجية الوسوم (عامة/متخصصة/براند)، 2) الكلمات المفتاحية الأساسية التى يستهدفونها، 3) وسوم يجب أن أستخدمها أنا أيضاً، 4) وسوم إضافية أقوى يفوّتونها.` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id });

    const html = `
      <div class="card"><h3><i class="fa-solid fa-tags"></i> وسوم ${UI.esc(info.snippet.title)} (${sorted.length} وسم)</h3>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin:12px 0">
          ${sorted.slice(0, 60).map(([t, n]) => `<span class="badge ${n >= 10 ? 'green' : n >= 5 ? 'orange' : 'blue'}">${UI.esc(t)} ×${n}</span>`).join('')}
        </div>
        ${UI.copyList(sorted.slice(0, 40).map(([t]) => t), 'انسخ الوسوم')}</div>
      <div class="card" style="margin-top:18px"><h3><i class="fa-solid fa-wand-magic-sparkles"></i> تحليل الاستراتيجية</h3>${UI.md(text)}</div>`;
    return { html, text };
  }
},

{
  id: 'trending-radar', module: 'm4', icon: 'fa-satellite-dish',
  name: 'رادار الترندات', en: 'Trending Radar',
  desc: 'رصد الترندات الصاعدة فى نيتشك الآن قبل أن تتشبع، مع تقييم ملاءمتها لقناتك.',
  apis: ['yt', 'ai'],
  fields: [F.niche()],
  run: Runners.searchAI((vals, list) =>
    `هذه أحدث الفيديوهات الرائجة (آخر 14 يوم) فى نيتش "${vals.niche}":
${list}

اعمل كرادار ترندات: 1) استخرج الترندات/المواضيع الصاعدة الآن (مرتبة حسب السرعة)، 2) لكل ترند: درجة الحرارة (0-100) + مرحلة الترند (بداية/ذروة/تشبع) + مدى ملاءمته لقناتى، 3) أفضل 3 ترندات يجب ركوبها هذا الأسبوع مع فكرة فيديو جاهزة لكل واحد، 4) ترند يجب تجنبه ولماذا.`,
    { maxResults: 25, searchParams: () => ({ order: 'viewCount', publishedAfter: new Date(Date.now() - 14 * 86400000).toISOString() }) })
},

{
  id: 'search-intent', module: 'm4', icon: 'fa-magnifying-glass-location',
  name: 'محلل نية البحث', en: 'Search Intent Analyzer',
  desc: 'فهم ماذا يريد الباحث فعلاً عند كتابة كلمة معينة، ونوع المحتوى الذى يشبع هذه النية.',
  apis: ['yt', 'ai'],
  fields: [F.text('query', 'كلمة/عبارة البحث', 'مثال: كيف أبدأ قناة يوتيوب', true)],
  run: Runners.searchAI((vals, list) =>
    `حلل نية البحث وراء "${vals.query}" بناءً على ما يرتّبه يوتيوب فعلياً لهذه الكلمة:
${list}

قدّم:
1) نوع النية الأساسى (تعليمية/ترفيهية/شرائية/استكشافية) مع النسب
2) ماذا يريد الباحث بالضبط؟ (الأسئلة الخفية وراء البحث)
3) صيغة المحتوى المثالية (مدة، أسلوب، بنية) لإشباع هذه النية
4) العنوان والثمبنيل المثاليان لهذه الكلمة
5) كلمات بحث مجاورة بنفس النية`,
    { maxResults: 15 })
},

{
  id: 'niche-leaderboard', module: 'm4', icon: 'fa-ranking-star',
  name: 'ترتيب النيتش', en: 'Niche Leaderboard',
  desc: 'ترتيب أقوى قنوات النيتش بدرجة مركّبة (مشتركون + أداء حديث) ومعرفة موقعك بينهم.',
  apis: ['yt', 'ai'],
  fields: [F.niche(), F.channel()],
  async run(vals, tool, progress) {
    progress('جارِ مسح قنوات النيتش...');
    const res = await YT.request('search', { part: 'snippet', q: vals.niche, type: 'channel', maxResults: 15 }, 120);
    const chIds = (res.items || []).map(i => i.snippet.channelId);
    let myId = null;
    try { myId = await YT.resolveChannel(vals.channel); if (!chIds.includes(myId)) chIds.push(myId); } catch {}

    progress('جارِ حساب الدرجات المركبة...');
    const board = [];
    for (const cid of chIds) {
      try {
        const info = await YT.channelInfo(cid);
        const vids = (await YT.channelVideos(cid, 10)).map(YT.summarizeVideo);
        const avgRecent = vids.length ? vids.reduce((a, v) => a + v.views, 0) / vids.length : 0;
        const subs = +info.statistics.subscriberCount || 0;
        const score = Math.round(Math.log10(subs + 1) * 20 + Math.log10(avgRecent + 1) * 30);
        board.push({ id: cid, title: info.snippet.title, subs, avgRecent: Math.round(avgRecent), score, mine: cid === myId });
      } catch {}
    }
    board.sort((a, z) => z.score - a.score);
    if (!board.length) throw new Error('تعذر بناء الترتيب');

    progress('جارِ التحليل...');
    const myRank = board.findIndex(b => b.mine) + 1;
    const text = await Gemini.generate(
      `هذا ترتيب أقوى قنوات نيتش "${vals.niche}" بدرجة مركبة (حجم + أداء حديث):
${board.map((b, i) => `${i + 1}. ${b.title}${b.mine ? ' (قناتى)' : ''} | ${UI.num(b.subs)} مشترك | متوسط حديث ${UI.num(b.avgRecent)} | درجة ${b.score}`).join('\n')}
${myRank ? `\nقناتى فى المركز ${myRank} من ${board.length}.` : ''}

قدّم: 1) قراءة للمشهد التنافسي، 2) ${myRank ? `ماذا يفصلنى عن المركز ${Math.max(1, myRank - 1)} وكيف أصعد` : 'أين تقع الفرصة لقناة جديدة'}، 3) خطة صعود 90 يوم.` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id });

    const html = `
      <div class="card"><h3><i class="fa-solid fa-ranking-star"></i> ترتيب النيتش</h3>
        <div class="table-scroll"><table class="data-table"><thead><tr><th>#</th><th>القناة</th><th>مشتركون</th><th>متوسط مشاهدات حديثة</th><th>الدرجة</th></tr></thead><tbody>
        ${board.map((b, i) => `<tr${b.mine ? ' style="background:rgba(255,0,51,.06)"' : ''}><td>${i + 1}</td><td>${b.mine ? '⭐ ' : ''}${UI.esc(b.title)}</td><td>${UI.num(b.subs)}</td><td>${UI.num(b.avgRecent)}</td><td><span class="badge ${i < 3 ? 'green' : 'blue'}">${b.score}</span></td></tr>`).join('')}
        </tbody></table></div></div>
      <div class="card" style="margin-top:18px"><h3><i class="fa-solid fa-wand-magic-sparkles"></i> التحليل وخطة الصعود</h3>${UI.md(text)}</div>`;
    return { html, text };
  }
},

{
  id: 'content-standouts', module: 'm4', icon: 'fa-star',
  name: 'المحتوى المتميز', en: 'Content Standouts',
  desc: 'استخراج أفضل ما نُشر فى نيتشك مؤخراً وتحليل عناصر التميز القابلة للتطبيق.',
  apis: ['yt', 'ai'],
  fields: [F.niche()],
  run: Runners.searchAI((vals, list) =>
    `هذا أفضل ما نُشر فى نيتش "${vals.niche}" مؤخراً:
${list}

قدّم "تشريح التميز": 1) لكل فيديو من أعلى 5: ما عنصر التميز الحاسم؟ (فكرة/عنوان/زاوية/توقيت)، 2) قائمة "عناصر التميز" المستخرجة كمبادئ قابلة للتطبيق (Checklist)، 3) طبّق هذه المبادئ: 5 أفكار فيديو لقناتى بكل عنصر تميز موضح.`,
    { maxResults: 20, searchParams: () => ({ order: 'viewCount', publishedAfter: new Date(Date.now() - 30 * 86400000).toISOString() }) })
},

/* ==================== Module 5 : AI Planning & Writing ==================== */

{
  id: 'next-video', module: 'm5', icon: 'fa-forward',
  name: 'فيديوك القادم', en: 'Next Video Recommender',
  desc: 'اقتراح أفضل فيديو تالٍ لقناتك بناءً على بياناتك الفعلية وما نجح سابقاً.',
  apis: ['yt', 'ai'],
  fields: [F.channel()],
  run: Runners.channelAI((vals, ctx) =>
    `بناءً على بيانات قناتى الفعلية، ما أفضل فيديو قادم يجب أن أصنعه؟
${ctx}

قدّم: 1) أفضل 5 أفكار مرتبة حسب احتمالية النجاح (لكل فكرة: العنوان + لماذا الآن + احتمالية النجاح 0-100 + الدليل من بياناتى)، 2) الفكرة رقم 1 بالتفصيل: هوك + نقاط المحتوى + CTA، 3) أفضل يوم/وقت للنشر بناءً على نمط قناتى.`)
},

{
  id: 'viral-predictor', module: 'm5', icon: 'fa-wand-sparkles',
  name: 'متنبئ الانتشار', en: 'Viral Idea Predictor',
  desc: 'تقييم فكرة فيديو قبل إنتاجها: احتمالية الانتشار، نقاط القوة والضعف، وتحسينات ترفع فرصها.',
  apis: ['ai'],
  fields: [F.topic('فكرة الفيديو المراد تقييمها'), F.niche()],
  async run(vals, tool, progress) {
    progress('جارِ تقييم الفكرة...');
    const j = await Gemini.generateJSON(
      `قيّم فكرة الفيديو التالية فى نيتش "${vals.niche}" وأعد JSON فقط بالبنية:
{"viral_score": 0-100, "strengths": ["..."], "weaknesses": ["..."], "improvements": ["..."], "better_angles": ["3 زوايا أقوى لنفس الفكرة"], "best_title": "أفضل عنوان", "verdict": "حكم نهائى فى سطرين"}

الفكرة: ${vals.topic}` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id });
    const text = `درجة الانتشار: ${j.viral_score}/100\n\nنقاط القوة:\n${(j.strengths || []).map(s => '- ' + s).join('\n')}\n\nنقاط الضعف:\n${(j.weaknesses || []).map(s => '- ' + s).join('\n')}\n\nتحسينات:\n${(j.improvements || []).map(s => '- ' + s).join('\n')}\n\nزوايا أقوى:\n${(j.better_angles || []).map(s => '- ' + s).join('\n')}\n\nأفضل عنوان: ${j.best_title}\n\nالحكم: ${j.verdict}`;
    const html = `
      <div class="card" style="text-align:center">${UI.scoreRing(j.viral_score, 'احتمالية الانتشار', 150)}<p class="sub" style="margin-top:10px">${UI.esc(j.verdict || '')}</p></div>
      <div class="grid cols-2" style="margin-top:18px">
        <div class="card"><h3 style="color:var(--green)"><i class="fa-solid fa-circle-check"></i> نقاط القوة</h3><ul class="md">${(j.strengths || []).map(s => `<li>${UI.esc(s)}</li>`).join('')}</ul></div>
        <div class="card"><h3 style="color:var(--red)"><i class="fa-solid fa-circle-xmark"></i> نقاط الضعف</h3><ul class="md">${(j.weaknesses || []).map(s => `<li>${UI.esc(s)}</li>`).join('')}</ul></div>
      </div>
      <div class="card" style="margin-top:18px"><h3><i class="fa-solid fa-arrow-trend-up"></i> تحسينات ترفع الفرصة</h3><ul class="md">${(j.improvements || []).map(s => `<li>${UI.esc(s)}</li>`).join('')}</ul></div>
      <div class="card" style="margin-top:18px"><h3><i class="fa-solid fa-shuffle"></i> زوايا أقوى</h3>${UI.copyList(j.better_angles || [])}</div>
      <div class="card" style="margin-top:18px"><h3><i class="fa-solid fa-heading"></i> أفضل عنوان</h3>${UI.copyList([j.best_title || ''])}</div>`;
    return { html, text };
  }
},

{
  id: 'content-calendar', module: 'm5', icon: 'fa-calendar-days',
  name: 'تقويم المحتوى', en: 'Content Calendar Generator',
  desc: 'إنشاء تقويم نشر شهرى كامل: أفكار + عناوين + نوع المحتوى + أيام النشر.',
  apis: ['ai'],
  fields: [
    F.niche(),
    F.select('freq', 'عدد الفيديوهات أسبوعياً', ['1', '2', '3', '4', '5+شورتس يومية'], '2'),
    F.select('mix', 'مزيج المحتوى', ['فيديوهات طويلة فقط', 'طويلة + Shorts', 'Shorts فقط'], 'طويلة + Shorts')
  ],
  run: Runners.ai(vals =>
    `أنشئ تقويم محتوى لشهر كامل (4 أسابيع) لقناة فى نيتش "${vals.niche}"، بمعدل ${vals.freq} فيديو أسبوعياً، مزيج: ${vals.mix}.

أخرج جدولاً: الأسبوع | اليوم | نوع المحتوى | العنوان المقترح | الهدف (مشاهدات/مشتركين/تفاعل) | ملاحظة إنتاج.
ثم أضف: 1) منطق ترتيب المواضيع (لماذا هذا التسلسل)، 2) فيديو "الرهان الكبير" للشهر، 3) نصائح التزام بالجدول.`)
},

{
  id: 'series-planner', module: 'm5', icon: 'fa-layer-group',
  name: 'مخطط السلاسل', en: 'Series Planner',
  desc: 'تصميم سلسلة فيديوهات مترابطة تبنى عادة مشاهدة وتزيد وقت المشاهدة الكلى.',
  apis: ['ai'],
  fields: [F.topic('موضوع السلسلة'), F.select('count', 'عدد الحلقات', ['5', '8', '10', '12'], '8')],
  run: Runners.ai(vals =>
    `صمّم سلسلة يوتيوب من ${vals.count} حلقات حول: "${vals.topic}".

قدّم: 1) اسم السلسلة وهويتها (3 اقتراحات)، 2) جدول الحلقات: رقم | عنوان جذاب | محتوى الحلقة | الخطاف للحلقة التالية، 3) استراتيجية الربط بين الحلقات (بطاقات، شاشات نهاية، قوائم تشغيل)، 4) حلقة "نقطة الدخول" الأفضل للمشاهد الجديد، 5) خطة الترويج للسلسلة.`)
},

{
  id: 'upload-planner', module: 'm5', icon: 'fa-calendar-check',
  name: 'مخطط النشر', en: 'Upload Schedule Planner',
  desc: 'بناء جدول نشر واقعى ومستدام بناءً على وقتك وطاقتك الإنتاجية وبيانات قناتك.',
  apis: ['yt', 'ai'],
  fields: [
    F.channel(),
    F.select('hours', 'ساعات متاحة أسبوعياً للإنتاج', ['أقل من 5', '5-10', '10-20', 'أكثر من 20'], '5-10'),
    F.text('constraints', 'قيود إضافية (اختياري)', 'مثال: لا أستطيع التصوير أيام الأسبوع')
  ],
  run: Runners.channelAI((vals, ctx) =>
    `صمّم لى جدول نشر مستدام. وقتى المتاح: ${vals.hours} ساعة أسبوعياً. ${vals.constraints ? 'قيود: ' + vals.constraints : ''}

بيانات قناتى:
${ctx}

قدّم: 1) تحليل نمط نشرى الحالى (الانتظام، الفجوات)، 2) الجدول الأمثل الواقعى (أيام + أوقات + نوع محتوى)، 3) سير عمل إنتاج أسبوعى بالساعات (تخطيط/تصوير/مونتاج/نشر)، 4) خطة طوارئ للأسابيع المزدحمة (محتوى احتياطي).`)
},

{
  id: 'best-time', module: 'm5', icon: 'fa-clock',
  name: 'أفضل وقت للنشر', en: 'Best Time to Post',
  desc: 'تحديد أفضل أيام وساعات النشر لقناتك بناءً على أداء فيديوهاتك السابقة وجمهورك.',
  apis: ['yt', 'an', 'ai'],
  fields: [F.channel()],
  async run(vals, tool, progress) {
    progress('جارِ تحميل بيانات القناة...');
    const b = await Ctx.channel(vals.channel, 50);
    const withTime = b.videos.map(v => {
      const d = new Date(v.snippet.publishedAt);
      return { title: v.snippet.title, views: +(v.statistics?.viewCount || 0), day: d.getDay(), hour: d.getHours() };
    });
    const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const byDay = {};
    withTime.forEach(v => { (byDay[v.day] = byDay[v.day] || []).push(v.views); });
    const dayStats = Object.entries(byDay).map(([d, arr]) => ({ day: days[d], count: arr.length, avg: Math.round(arr.reduce((a, x) => a + x, 0) / arr.length) })).sort((a, z) => z.avg - a.avg);

    progress('جارِ جلب Analytics إن أمكن...');
    const an = await Ctx.analyticsText({ startDate: YTA.daysAgo(90), endDate: YTA.daysAgo(0), metrics: 'views', dimensions: 'day' }, 'المشاهدات اليومية');

    progress('جارِ التحليل...');
    const text = await Gemini.generate(
      `حدد أفضل أوقات النشر لقناتى بناءً على الأداء الفعلى حسب يوم النشر:
${dayStats.map(d => `- ${d.day}: ${d.count} فيديو بمتوسط ${UI.num(d.avg)} مشاهدة`).join('\n')}
توزيع ساعات النشر السابقة: ${withTime.map(v => v.hour).join('، ')}
${an}

قدّم: 1) أفضل 3 أيام وأفضل ساعة لكل يوم (مع مستوى الثقة)، 2) تفسير النمط، 3) جدول أسبوعى مقترح، 4) تحذير من الاستنتاجات الضعيفة إن كانت العينة صغيرة.` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id });

    const html = `
      <div class="card"><h3><i class="fa-solid fa-calendar-week"></i> الأداء حسب يوم النشر</h3>
        ${dayStats.map(d => UI.bar(`${d.day} (${d.count} فيديو)`, d.avg, dayStats[0].avg, 'var(--accent)')).join('')}</div>
      <div class="card" style="margin-top:18px"><h3><i class="fa-solid fa-wand-magic-sparkles"></i> التوصية</h3>${UI.md(text)}</div>`;
    return { html, text };
  }
},

{
  id: 'plan-30', module: 'm5', icon: 'fa-flag-checkered',
  name: 'خطة 30 يوم', en: '30-Day Growth Plan',
  desc: 'خطة نمو تفصيلية لمدة شهر: أهداف رقمية، محتوى يومى/أسبوعى، ومؤشرات متابعة.',
  apis: ['yt', 'ai'],
  fields: [F.channel(), F.text('goal', 'هدفك الرئيسي للشهر', 'مثال: الوصول لـ1000 مشترك', true)],
  run: Runners.channelAI((vals, ctx) =>
    `اصنع خطة نمو 30 يوم لقناتى. الهدف: "${vals.goal}".

بيانات القناة:
${ctx}

قدّم: 1) تقييم واقعية الهدف وتعديله إن لزم، 2) خطة أسبوع بأسبوع (محتوى + مهام + هدف رقمى)، 3) جدول KPIs للمتابعة الأسبوعية، 4) أكبر 3 مخاطر تهدد الخطة وكيفية تفاديها، 5) روتين يومى مختصر (15 دقيقة إدارة قناة).`)
},

{
  id: 'plan-90', module: 'm5', icon: 'fa-mountain',
  name: 'استراتيجية 90 يوم', en: '90-Day Strategy',
  desc: 'استراتيجية ربع سنوية شاملة: مراحل، معالم، تطوير محتوى، وقياس تقدم.',
  apis: ['yt', 'ai'],
  fields: [F.channel(), F.text('goal', 'هدف الـ90 يوم', 'مثال: مضاعفة متوسط المشاهدات', true)],
  run: Runners.channelAI((vals, ctx) =>
    `اصنع استراتيجية 90 يوم لقناتى. الهدف: "${vals.goal}".

بيانات القناة:
${ctx}

قدّم: 1) تشخيص نقطة البداية (أين نقف)، 2) 3 مراحل × 30 يوم (لكل مرحلة: التركيز، المحتوى، الأهداف الرقمية، المعالم Milestones)، 3) استراتيجية المحتوى المتطورة (كيف يتغير المحتوى عبر المراحل)، 4) نقاط المراجعة والقرارات (متى نغير المسار)، 5) لوحة KPIs ربع سنوية.`)
},

{
  id: 'title-generator', module: 'm5', icon: 'fa-heading',
  name: 'مولد العناوين', en: 'Title Generator',
  desc: '60 عنواناً فى 6 أنماط: SEO، CTR عالى، فيرال، فضول، Shorts، وفيديو طويل — كلها قابلة للنسخ.',
  apis: ['ai'],
  fields: [F.topic(), F.lang()],
  async run(vals, tool, progress) {
    progress('جارِ توليد 60 عنواناً...');
    const j = await Gemini.generateJSON(
      `ولّد عناوين يوتيوب للموضوع التالى باللغة "${vals.lang}". أعد JSON فقط:
{"seo": ["10 عناوين محسّنة لمحركات البحث بكلمات مفتاحية واضحة"],
"ctr": ["10 عناوين بمعدل نقر عالى (أرقام، أقواس، وعود محددة)"],
"viral": ["10 عناوين بأسلوب فيرال جرىء"],
"curiosity": ["10 عناوين فجوة فضول قوية"],
"shorts": ["10 عناوين قصيرة جداً لـShorts"],
"longform": ["10 عناوين للفيديوهات الطويلة العميقة"]}

الموضوع: ${vals.topic}` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id, maxTokens: 8192 });
    const groups = [
      ['seo', 'عناوين SEO', 'fa-magnifying-glass'], ['ctr', 'عناوين CTR عالى', 'fa-arrow-pointer'],
      ['viral', 'عناوين فيرال', 'fa-fire'], ['curiosity', 'عناوين فضول', 'fa-circle-question'],
      ['shorts', 'عناوين Shorts', 'fa-mobile-screen'], ['longform', 'عناوين طويلة', 'fa-film']
    ];
    const html = `<div class="grid cols-2">${groups.map(([k, label, icon]) =>
      `<div class="card"><h3><i class="fa-solid ${icon}"></i> ${label}</h3>${UI.copyList(j[k] || [])}</div>`).join('')}</div>`;
    const text = groups.map(([k, label]) => `## ${label}\n${(j[k] || []).map(t => '- ' + t).join('\n')}`).join('\n\n');
    return { html, text };
  }
},

{
  id: 'title-optimizer', module: 'm5', icon: 'fa-arrow-up-wide-short',
  name: 'محسّن العناوين', en: 'Title Optimizer',
  desc: 'تحليل عنوانك الحالى (درجة + مشاكل) وتقديم 10 بدائل أقوى مرتبة.',
  apis: ['ai'],
  fields: [F.text('title', 'العنوان الحالي', 'الصق عنوانك...', true), F.text('topic', 'موضوع الفيديو (اختياري)', '')],
  async run(vals, tool, progress) {
    progress('جارِ تحليل العنوان...');
    const j = await Gemini.generateJSON(
      `حلل عنوان اليوتيوب التالى وأعد JSON فقط:
{"score": 0-100, "problems": ["المشاكل"], "good": ["الإيجابيات"], "alternatives": [{"title": "بديل", "why": "لماذا أقوى", "score": 0-100}]}
(10 بدائل مرتبة تنازلياً حسب القوة)

العنوان: "${vals.title}"${vals.topic ? `\nالموضوع: ${vals.topic}` : ''}` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id });
    const html = `
      <div class="card" style="text-align:center">${UI.scoreRing(j.score, 'درجة العنوان الحالي', 140)}</div>
      <div class="grid cols-2" style="margin-top:18px">
        <div class="card"><h3 style="color:var(--red)"><i class="fa-solid fa-triangle-exclamation"></i> المشاكل</h3><ul class="md">${(j.problems || []).map(p => `<li>${UI.esc(p)}</li>`).join('')}</ul></div>
        <div class="card"><h3 style="color:var(--green)"><i class="fa-solid fa-thumbs-up"></i> الإيجابيات</h3><ul class="md">${(j.good || []).map(p => `<li>${UI.esc(p)}</li>`).join('')}</ul></div>
      </div>
      <div class="card" style="margin-top:18px"><h3><i class="fa-solid fa-wand-magic-sparkles"></i> البدائل الأقوى</h3>
        ${(j.alternatives || []).map(a => `
          <div class="copy-item"><div><strong>${UI.esc(a.title)}</strong> <span class="badge ${a.score >= 80 ? 'green' : a.score >= 60 ? 'orange' : 'blue'}">${a.score}</span><br><small class="sub">${UI.esc(a.why || '')}</small></div>
          <button class="btn btn-secondary btn-sm" data-copy><i class="fa-regular fa-copy"></i></button></div>`).join('')}</div>`;
    const text = `درجة العنوان: ${j.score}/100\nالمشاكل:\n${(j.problems || []).map(p => '- ' + p).join('\n')}\n\nالبدائل:\n${(j.alternatives || []).map(a => `- ${a.title} (${a.score})`).join('\n')}`;
    return { html, text };
  }
},

{
  id: 'description-generator', module: 'm5', icon: 'fa-align-right',
  name: 'مولد الوصف', en: 'Description Generator',
  desc: 'أوصاف كاملة بأنماط متعددة: SEO طويل، مختصر، احترافى، قصصى + Timestamps وهاشتاجات.',
  apis: ['ai'],
  fields: [F.topic(), F.text('keywords', 'كلمات مفتاحية (اختياري)', 'كلمة1، كلمة2'), F.lang()],
  async run(vals, tool, progress) {
    progress('جارِ كتابة الأوصاف...');
    const j = await Gemini.generateJSON(
      `اكتب أوصاف يوتيوب للموضوع التالى باللغة "${vals.lang}"${vals.keywords ? ` مستهدفاً: ${vals.keywords}` : ''}. أعد JSON فقط:
{"seo": "وصف SEO كامل 200+ كلمة بالكلمات المفتاحية موزعة طبيعياً",
"long": "وصف طويل غنى بالتفاصيل والقيمة",
"short": "وصف مختصر 3 أسطر",
"professional": "وصف رسمى احترافى",
"story": "وصف قصصى مشوق",
"cta": "فقرة CTA قوية (اشتراك + تفعيل جرس + روابط)",
"timestamps": "قالب Timestamps جاهز (00:00 مقدمة...)",
"hashtags": ["15 هاشتاج مناسب"]}

الموضوع: ${vals.topic}` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id, maxTokens: 8192 });
    const block = (title, icon, content) => `
      <div class="card"><h3><i class="fa-solid ${icon}"></i> ${title}</h3>
        <div class="copy-item"><span style="white-space:pre-wrap">${UI.esc(content || '')}</span>
        <button class="btn btn-secondary btn-sm" data-copy><i class="fa-regular fa-copy"></i></button></div></div>`;
    const html = `
      <div class="grid cols-2">
        ${block('وصف SEO', 'fa-magnifying-glass', j.seo)}
        ${block('وصف طويل', 'fa-align-right', j.long)}
        ${block('وصف مختصر', 'fa-minus', j.short)}
        ${block('وصف احترافي', 'fa-briefcase', j.professional)}
        ${block('وصف قصصي', 'fa-book-open', j.story)}
        ${block('فقرة CTA', 'fa-bullhorn', j.cta)}
      </div>
      ${block('Timestamps', 'fa-clock', j.timestamps)}
      <div class="card" style="margin-top:18px"><h3><i class="fa-solid fa-hashtag"></i> هاشتاجات</h3>${UI.copyList(j.hashtags || [])}</div>`;
    const text = `## SEO\n${j.seo}\n\n## طويل\n${j.long}\n\n## مختصر\n${j.short}\n\n## CTA\n${j.cta}\n\n## Timestamps\n${j.timestamps}\n\n## هاشتاجات\n${(j.hashtags || []).join(' ')}`;
    return { html, text };
  }
},

{
  id: 'tags-generator', module: 'm5', icon: 'fa-tags',
  name: 'مولد الوسوم', en: 'Tags Generator',
  desc: 'وسوم مقسمة: أساسية، Long-tail، واسعة، براند، وترند — مع زر نسخ الكل جاهز للصق.',
  apis: ['ai'],
  fields: [F.topic(), F.text('brand', 'اسم قناتك (اختياري)', '')],
  async run(vals, tool, progress) {
    progress('جارِ توليد الوسوم...');
    const j = await Gemini.generateJSON(
      `ولّد وسوم (Tags) يوتيوب للموضوع التالى. أعد JSON فقط:
{"primary": ["8 وسوم أساسية مطابقة"], "longtail": ["10 وسوم long-tail"], "broad": ["6 وسوم واسعة"], "brand": ["4 وسوم براند${vals.brand ? ' لقناة ' + vals.brand : ''}"], "trending": ["6 وسوم ترند ذات صلة"]}
الموضوع: ${vals.topic}` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id });
    const all = [...(j.primary || []), ...(j.longtail || []), ...(j.broad || []), ...(j.brand || []), ...(j.trending || [])];
    const groups = [['primary', 'أساسية', 'green'], ['longtail', 'Long-tail', 'blue'], ['broad', 'واسعة', 'orange'], ['brand', 'براند', 'purple'], ['trending', 'ترند', 'red']];
    const html = `
      <div class="card"><h3><i class="fa-solid fa-tags"></i> كل الوسوم (${all.length}) — ${all.join(', ').length} حرف</h3>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin:12px 0">
          ${groups.map(([k, , color]) => (j[k] || []).map(t => `<span class="badge ${color}">${UI.esc(t)}</span>`).join('')).join('')}
        </div>
        <div class="copy-item"><span>${UI.esc(all.join(', '))}</span><button class="btn btn-primary btn-sm" data-copy><i class="fa-solid fa-copy"></i> نسخ الكل</button></div>
      </div>
      <div class="grid cols-2" style="margin-top:18px">
        ${groups.map(([k, label]) => `<div class="card"><h3>${label}</h3>${UI.copyList(j[k] || [])}</div>`).join('')}
      </div>`;
    return { html, text: all.join(', ') };
  }
},

{
  id: 'chapter-generator', module: 'm5', icon: 'fa-list-ol',
  name: 'مولد الفصول', en: 'Chapter Generator',
  desc: 'تحويل سكربت أو ملخص فيديو إلى فصول (Chapters) بتوقيتات جاهزة للوصف.',
  apis: ['ai'],
  fields: [
    F.area('script', 'السكربت أو ملخص محتوى الفيديو', 'الصق السكربت أو اكتب نقاط الفيديو...', true),
    F.text('duration', 'مدة الفيديو التقريبية بالدقائق', '10', true)
  ],
  run: Runners.ai(vals =>
    `حوّل محتوى الفيديو التالى إلى فصول (Chapters) يوتيوب لفيديو مدته ~${vals.duration} دقيقة.

قواعد: ابدأ بـ00:00، وزّع التوقيتات منطقياً حسب وزن كل جزء، أسماء فصول جذابة قصيرة تحتوى كلمات مفتاحية.

أخرج: 1) قائمة الفصول جاهزة للصق فى الوصف (سطر لكل فصل: التوقيت ثم الاسم)، 2) نسخة إنجليزية إن كان المحتوى يحتمل جمهوراً ثنائى اللغة، 3) نصيحة: أى فصل يصلح أن يكون "لحظة الذروة" للترويج.

المحتوى:
${vals.script}`)
},

{
  id: 'seo-checker', module: 'm5', icon: 'fa-list-check',
  name: 'فاحص SEO', en: 'Video SEO Checker',
  desc: 'فحص SEO شامل لأى فيديو: درجات العنوان والوصف والوسوم مع خطة إصلاح وعنوان محسّن.',
  apis: ['yt', 'ai'],
  fields: [F.video()],
  async run(vals, tool, progress) {
    progress('جارِ تحميل بيانات الفيديو...');
    const v = await Ctx.video(vals.video);
    progress('جارِ فحص الـSEO...');
    const j = await Gemini.generateJSON(
      `افحص SEO هذا الفيديو وأعد JSON فقط:
{"overall": 0-100, "title_score": 0-100, "desc_score": 0-100, "tags_score": 0-100, "problems": ["..."], "fixes": ["إصلاحات مرتبة بالأولوية"], "improved_title": "عنوان محسّن", "improved_desc_intro": "أول 3 أسطر محسّنة للوصف", "suggested_tags": ["10 وسوم مقترحة"]}

${v.text}` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id });
    const html = `
      <div class="grid cols-4">
        <div class="card" style="text-align:center">${UI.scoreRing(j.overall, 'الدرجة الكلية', 110)}</div>
        <div class="card" style="text-align:center">${UI.scoreRing(j.title_score, 'العنوان', 110)}</div>
        <div class="card" style="text-align:center">${UI.scoreRing(j.desc_score, 'الوصف', 110)}</div>
        <div class="card" style="text-align:center">${UI.scoreRing(j.tags_score, 'الوسوم', 110)}</div>
      </div>
      <div class="grid cols-2" style="margin-top:18px">
        <div class="card"><h3 style="color:var(--red)"><i class="fa-solid fa-bug"></i> المشاكل</h3><ul class="md">${(j.problems || []).map(p => `<li>${UI.esc(p)}</li>`).join('')}</ul></div>
        <div class="card"><h3 style="color:var(--green)"><i class="fa-solid fa-screwdriver-wrench"></i> خطة الإصلاح</h3><ol class="md">${(j.fixes || []).map(p => `<li>${UI.esc(p)}</li>`).join('')}</ol></div>
      </div>
      <div class="card" style="margin-top:18px"><h3><i class="fa-solid fa-heading"></i> العنوان المحسّن</h3>${UI.copyList([j.improved_title || ''])}</div>
      <div class="card" style="margin-top:18px"><h3><i class="fa-solid fa-align-right"></i> مقدمة الوصف المحسّنة</h3>${UI.copyList([j.improved_desc_intro || ''])}</div>
      <div class="card" style="margin-top:18px"><h3><i class="fa-solid fa-tags"></i> وسوم مقترحة</h3>${UI.copyList(j.suggested_tags || [])}</div>`;
    const text = `SEO: ${j.overall}/100 (عنوان ${j.title_score}، وصف ${j.desc_score}، وسوم ${j.tags_score})\nالمشاكل:\n${(j.problems || []).map(p => '- ' + p).join('\n')}\nالإصلاحات:\n${(j.fixes || []).map(p => '- ' + p).join('\n')}\nعنوان محسّن: ${j.improved_title}`;
    return { html, text };
  }
},

{
  id: 'metadata-translator', module: 'm5', icon: 'fa-language',
  name: 'مترجم الميتاداتا', en: 'Metadata Translator',
  desc: 'ترجمة احترافية للعنوان والوصف والوسوم لعدة لغات مع الحفاظ على قوة الـSEO.',
  apis: ['ai'],
  fields: [
    F.text('title', 'العنوان', '', true),
    F.area('desc', 'الوصف (اختياري)', ''),
    F.text('tags', 'الوسوم (اختياري)', 'وسم1، وسم2'),
    F.select('langs', 'اللغات المستهدفة', ['English', 'English + Français', 'English + Español', 'English + Français + Español + Deutsch', 'التركية + الأوردو + الإندونيسية'], 'English')
  ],
  run: Runners.ai(vals =>
    `ترجم ميتاداتا الفيديو التالية إلى: ${vals.langs}. الترجمة يجب أن تكون "توطيناً" (Localization) لا ترجمة حرفية — حافظ على جاذبية العنوان وقوة SEO فى كل لغة.

العنوان: ${vals.title}
${vals.desc ? 'الوصف:\n' + vals.desc : ''}
${vals.tags ? 'الوسوم: ' + vals.tags : ''}

لكل لغة أخرج: العنوان المترجم (مع بديل ثانٍ) + الوصف + الوسوم، وملاحظة ثقافية إن وجدت.`)
},

{
  id: 'hook-generator', module: 'm5', icon: 'fa-anchor',
  name: 'مولد الهوكس', en: 'Hook Generator',
  desc: 'خطافات افتتاحية (أول 15 ثانية) بأنماط نفسية مختلفة مرتبة حسب قوة التأثير العاطفي.',
  apis: ['ai'],
  fields: [F.topic(), F.select('style', 'نوع الفيديو', ['فيديو طويل', 'Short'], 'فيديو طويل')],
  async run(vals, tool, progress) {
    progress('جارِ توليد الهوكس...');
    const j = await Gemini.generateJSON(
      `اكتب 12 هوك افتتاحى (${vals.style === 'Short' ? 'أول 3 ثوانى لـShort' : 'أول 15 ثانية لفيديو طويل'}) للموضوع التالى. أعد JSON فقط:
{"hooks": [{"text": "نص الهوك حرفياً كما سيُقال", "type": "نوعه (صدمة/سؤال/قصة/إحصائية/تحدى/وعد...)", "emotional_score": 0-100}]}
الموضوع: ${vals.topic}` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id });
    const hooks = (j.hooks || []).sort((a, z) => z.emotional_score - a.emotional_score);
    const html = `<div class="card"><h3><i class="fa-solid fa-anchor"></i> الهوكس مرتبة حسب قوة التأثير</h3>
      ${hooks.map(h => `
        <div class="copy-item"><div><strong>${UI.esc(h.text)}</strong><br>
        <small class="sub"><span class="badge blue">${UI.esc(h.type)}</span> <span class="badge ${h.emotional_score >= 80 ? 'green' : 'orange'}">تأثير ${h.emotional_score}</span></small></div>
        <button class="btn btn-secondary btn-sm" data-copy><i class="fa-regular fa-copy"></i></button></div>`).join('')}</div>`;
    return { html, text: hooks.map(h => `[${h.type} | ${h.emotional_score}] ${h.text}`).join('\n') };
  }
},

{
  id: 'cta-generator', module: 'm5', icon: 'fa-bullhorn',
  name: 'مولد CTA', en: 'CTA Generator',
  desc: 'نداءات فعل (Call-to-Action) متنوعة: اشتراك، لايك، تعليق، مشاهدة التالى، بيع — طبيعية غير مزعجة.',
  apis: ['ai'],
  fields: [F.topic('موضوع الفيديو'), F.lang()],
  async run(vals, tool, progress) {
    progress('جارِ كتابة نداءات الفعل...');
    const j = await Gemini.generateJSON(
      `اكتب نداءات فعل (CTA) طبيعية وغير مزعجة لفيديو عن "${vals.topic}" باللغة "${vals.lang}". أعد JSON فقط:
{"subscribe": ["4 CTA اشتراك مبتكرة"], "like": ["3 CTA لايك"], "comment": ["4 CTA تعليق بأسئلة محددة تشعل النقاش"], "watch_next": ["3 CTA لمشاهدة فيديو تالٍ"], "share": ["2 CTA مشاركة"], "sell": ["3 CTA بيع/تحويل ناعمة (كورس/منتج/رابط)"]}` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id });
    const groups = [['subscribe', 'اشتراك', 'fa-user-plus'], ['like', 'إعجاب', 'fa-thumbs-up'], ['comment', 'تعليق', 'fa-comment'], ['watch_next', 'شاهد التالي', 'fa-forward'], ['share', 'مشاركة', 'fa-share'], ['sell', 'تحويل/بيع', 'fa-cart-shopping']];
    const html = `<div class="grid cols-2">${groups.map(([k, label, icon]) =>
      `<div class="card"><h3><i class="fa-solid ${icon}"></i> ${label}</h3>${UI.copyList(j[k] || [])}</div>`).join('')}</div>`;
    const text = groups.map(([k, label]) => `## ${label}\n${(j[k] || []).map(c => '- ' + c).join('\n')}`).join('\n\n');
    return { html, text };
  }
},

{
  id: 'outline-generator', module: 'm5', icon: 'fa-sitemap',
  name: 'مولد الهيكل', en: 'Outline Generator',
  desc: 'هيكل فيديو كامل ومنظم: هوك، مقدمة، أقسام بمنحنى تشويق، ذروة، وخاتمة بـCTA.',
  apis: ['ai'],
  fields: [F.topic(), F.select('length', 'المدة المستهدفة', ['5 دقائق', '10 دقائق', '15 دقيقة', '20+ دقيقة'], '10 دقائق')],
  run: Runners.ai(vals =>
    `صمّم هيكل (Outline) فيديو يوتيوب مدته ${vals.length} عن: "${vals.topic}".

أخرج:
1) الهوك (أول 15 ثانية) — 3 اقتراحات
2) المقدمة (وعد الفيديو + لماذا يكمل المشاهد)
3) الأقسام بالتوقيتات التقريبية — لكل قسم: العنوان + النقاط + "خطاف الاستمرار" لمنع الخروج
4) لحظة الذروة (أين نضع أقوى معلومة ولماذا)
5) الخاتمة + CTA + جسر لفيديو تالٍ
6) ملاحظات إيقاع: أين نسرّع وأين نبطئ`)
},

{
  id: 'script-generator', module: 'm5', icon: 'fa-scroll',
  name: 'مولد السكربت', en: 'Script Generator',
  desc: 'كتابة سكربت كامل كلمة بكلمة بأسلوبك: هوك، محتوى، انتقالات، وCTA — جاهز للتصوير.',
  apis: ['ai'],
  fields: [
    F.topic(),
    F.select('length', 'المدة', ['3 دقائق', '5 دقائق', '8 دقائق', '12 دقيقة'], '5 دقائق'),
    F.select('tone', 'النبرة', ['حماسية طاقة عالية', 'هادئة تعليمية', 'قصصية مشوقة', 'كوميدية خفيفة', 'رسمية موثوقة'], 'حماسية طاقة عالية'),
    F.lang()
  ],
  run: Runners.ai(vals =>
    `اكتب سكربت يوتيوب كاملاً كلمة بكلمة (جاهز للقراءة أمام الكاميرا) عن: "${vals.topic}".
المدة: ${vals.length} | النبرة: ${vals.tone} | اللغة: ${vals.lang}

المطلوب:
- هوك قوى فى أول 15 ثانية
- انتقالات سلسة بين الأجزاء مع "خطافات استمرار"
- إشارات إخراجية بين قوسين [لقطة قريبة]، [يظهر على الشاشة]...
- CTA طبيعى فى المنتصف وآخر قوى فى النهاية
- عدد كلمات مناسب للمدة (~140 كلمة/دقيقة)`, { temperature: 0.85 })
},

/* ==================== Module 6 : Thumbnail & Shorts Studio ==================== */

{
  id: 'thumbnail-analyzer', module: 'm6', icon: 'fa-image',
  name: 'محلل الثمبنيل', en: 'Thumbnail Analyzer',
  desc: 'تحليل بصرى عميق لأى ثمبنيل: التكوين، الألوان، النص، الوجوه، ونقاط الجذب والتشتيت.',
  apis: ['ai'],
  fields: [F.image(), F.text('title', 'عنوان الفيديو (اختياري لتقييم التطابق)', '')],
  run: Runners.imageAI(vals =>
    `حلل هذه الصورة المصغرة (Thumbnail) ليوتيوب تحليلاً احترافياً:
1) ماذا تعرض الصورة؟ (وصف سريع)
2) التكوين البصري: توزيع العناصر، نقطة التركيز، قاعدة الأثلاث
3) الألوان: التباين، التناغم، بروزها وسط فيد يوتيوب
4) النص إن وجد: القراءة على الموبايل، الحجم، التنافس مع العنوان
5) الوجوه/التعبيرات: قوة العاطفة
6) نقاط الجذب ونقاط التشتيت
7) درجة إجمالية 0-100 + أهم 3 تحسينات مرتبة بالأثر${vals.title ? `\n8) مدى تطابقها مع العنوان: "${vals.title}"` : ''}`)
},

{
  id: 'thumbnail-score', module: 'm6', icon: 'fa-gauge',
  name: 'درجة الثمبنيل', en: 'Thumbnail Scorer',
  desc: 'تقييم رقمى شامل: تباين، وضوح نص، وجه/عاطفة، تكوين، ألوان، وموبايل — بحلقات درجات.',
  apis: ['ai'],
  fields: [F.image()],
  async run(vals, tool, progress) {
    if (!vals._image) throw new Error('ارفع صورة أولاً');
    progress('جارِ تقييم الثمبنيل...');
    const j = await Gemini.generateJSON(
      `قيّم هذه الصورة المصغرة ليوتيوب وأعد JSON فقط:
{"overall": 0-100, "contrast": 0-100, "readability": 0-100, "face": 0-100, "composition": 0-100, "color": 0-100, "mobile": 0-100, "top_fixes": ["3 إصلاحات بالأولوية"], "verdict": "حكم فى سطرين"}
(face = قوة الوجه/العاطفة أو البديل البصرى إن لم يوجد وجه، mobile = الوضوح على شاشة صغيرة)`,
      { system: SYS_PROMPT, tool: tool.id, imageBase64: vals._image.base64, imageMime: vals._image.mime });
    const html = `
      <div class="card" style="text-align:center">${UI.scoreRing(j.overall, 'الدرجة الكلية', 150)}<p class="sub" style="margin-top:8px">${UI.esc(j.verdict || '')}</p></div>
      <div class="card" style="margin-top:18px"><h3><i class="fa-solid fa-chart-simple"></i> التفاصيل</h3>
        ${UI.bar('التباين', j.contrast)}${UI.bar('وضوح النص', j.readability)}${UI.bar('الوجه/العاطفة', j.face)}
        ${UI.bar('التكوين', j.composition)}${UI.bar('الألوان', j.color)}${UI.bar('الوضوح على الموبايل', j.mobile)}</div>
      <div class="card" style="margin-top:18px"><h3><i class="fa-solid fa-screwdriver-wrench"></i> أهم الإصلاحات</h3>
        <ol class="md">${(j.top_fixes || []).map(f => `<li>${UI.esc(f)}</li>`).join('')}</ol></div>`;
    const text = `درجة الثمبنيل: ${j.overall}/100\nتباين ${j.contrast} | نص ${j.readability} | وجه ${j.face} | تكوين ${j.composition} | ألوان ${j.color} | موبايل ${j.mobile}\nإصلاحات:\n${(j.top_fixes || []).map(f => '- ' + f).join('\n')}\n${j.verdict}`;
    return { html, text };
  }
},

{
  id: 'thumbnail-ideas', module: 'm6', icon: 'fa-palette',
  name: 'أفكار ثمبنيل', en: 'Thumbnail Ideas',
  desc: 'أفكار ثمبنيل تفصيلية جاهزة للتنفيذ: التكوين، الألوان، النص، وتعبير الوجه لكل فكرة.',
  apis: ['ai'],
  fields: [F.topic('موضوع/عنوان الفيديو')],
  run: Runners.ai(vals =>
    `اقترح 8 أفكار ثمبنيل لفيديو عن: "${vals.topic}".

لكل فكرة قدّم بطاقة تنفيذ كاملة:
- **الفكرة**: وصف اللقطة فى جملة
- **التكوين**: أين يقف العنصر الرئيسي، الخلفية، العمق
- **الألوان**: اللوحة الأساسية + لون البروز
- **النص**: الكلمات (3 كلمات كحد أقصى) + مكانها + لونها
- **الوجه/العاطفة**: التعبير المطلوب (أو البديل البصرى)
- **درجة CTR المتوقعة**: 0-100 مع سبب
رتّبها من الأقوى للأضعف، وحدد أى فكرة تصلح لاختبار A/B ضد أى فكرة.`)
},

{
  id: 'thumbnail-ctr-predictor', module: 'm6', icon: 'fa-arrow-pointer',
  name: 'متنبئ CTR الثمبنيل', en: 'Thumbnail CTR Predictor',
  desc: 'توقع معدل النقر لثمبنيل + عنوان معاً كما سيظهران فى صفحة يوتيوب الرئيسية.',
  apis: ['ai'],
  fields: [F.image(), F.text('title', 'عنوان الفيديو', '', true), F.niche()],
  run: Runners.imageAI(vals =>
    `تخيل هذه الصورة المصغرة بجانب العنوان "${vals.title}" فى صفحة يوتيوب الرئيسية وسط منافسة نيتش "${vals.niche}".

قدّم:
1) توقع CTR كنسبة تقريبية (مع نطاق: متشائم/واقعى/متفائل) وسبب كل رقم
2) اختبار "نصف الثانية": ماذا يلتقط المخ فى أول 500ms من الصورة؟
3) التنافس بين نص الصورة والعنوان: تكرار أم تكامل؟
4) لمن ستظهر جذابة ولمن لا (شرائح الجمهور)
5) 3 تعديلات محددة ترفع الـCTR المتوقع مع تقدير أثر كل تعديل`)
},

{
  id: 'thumbnail-style', module: 'm6', icon: 'fa-clone',
  name: 'مقارنة أسلوب الثمبنيل', en: 'Thumbnail Style Compare',
  desc: 'مقارنة ثمبنيلك بثمبنيل منافس ناجح: من يكسب النقرة ولماذا، وكيف تسرق نقاط قوته.',
  apis: ['ai'],
  fields: [
    { k: '_image', label: 'ثمبنيلك', type: 'image' },
    { k: '_image2', label: 'ثمبنيل المنافس', type: 'image' }
  ],
  run: Runners.imageAI(() =>
    `الصورة الأولى ثمبنيلى والثانية ثمبنيل منافس ناجح. قارن بينهما كأن كليهما يظهران جنباً إلى جنب فى نتائج البحث:

1) من يكسب النقرة ولماذا؟ (حكم صريح)
2) جدول مقارنة: التباين | النص | الوجه/العاطفة | التكوين | الألوان | التميز — درجة لكل طرف
3) ما الذى يفعله المنافس صحيحاً ويمكننى "سرقته" أخلاقياً؟
4) ما نقطة قوتى التى يجب أن أضخمها؟
5) وصفة الثمبنيل القادم: ادمج أفضل ما فى الاثنين`)
},

{
  id: 'thumbnail-prompt', module: 'm6', icon: 'fa-robot',
  name: 'برومبت توليد الثمبنيل', en: 'Thumbnail AI Prompt',
  desc: 'برومبت احترافى جاهز لأدوات توليد الصور (Midjourney/DALL-E/Ideogram) لإنتاج ثمبنيلك.',
  apis: ['ai'],
  fields: [F.topic('موضوع/عنوان الفيديو'), F.select('style', 'الأسلوب', ['واقعى سينمائي', 'كرتونى نابض', 'تقنى مستقبلي', 'بسيط نظيف Minimal', 'درامى داكن'], 'واقعى سينمائي')],
  async run(vals, tool, progress) {
    progress('جارِ صياغة البرومبت...');
    const j = await Gemini.generateJSON(
      `اكتب برومبت توليد صور احترافى لثمبنيل يوتيوب عن "${vals.topic}" بأسلوب "${vals.style}". أعد JSON فقط:
{"prompt": "البرومبت الكامل بالإنجليزية (تفصيلى: subject, composition, lighting, colors, 16:9, no text)",
"negative": "negative prompt بالإنجليزية",
"text_overlay": "النص العربى/الإنجليزى المقترح إضافته فوق الصورة بعد التوليد (3 كلمات كحد أقصى)",
"variations": ["2 برومبت بديلين بزوايا مختلفة بالإنجليزية"],
"tips": ["3 نصائح لتحسين النتيجة فى أداة التوليد"]}` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id });
    const ltr = (label, content) => `
      <div class="card"><h3>${label}</h3>
        <div class="copy-item"><span dir="ltr" style="text-align:left;white-space:pre-wrap;font-family:monospace;font-size:.85rem">${UI.esc(content || '')}</span>
        <button class="btn btn-secondary btn-sm" data-copy><i class="fa-regular fa-copy"></i></button></div></div>`;
    const html = `
      ${ltr('<i class="fa-solid fa-wand-magic-sparkles"></i> البرومبت الرئيسي', j.prompt)}
      ${ltr('<i class="fa-solid fa-ban"></i> Negative Prompt', j.negative)}
      <div class="card"><h3><i class="fa-solid fa-font"></i> نص الثمبنيل المقترح</h3>${UI.copyList([j.text_overlay || ''])}</div>
      ${(j.variations || []).map((v, i) => ltr(`<i class="fa-solid fa-shuffle"></i> بديل ${i + 1}`, v)).join('')}
      <div class="card"><h3><i class="fa-solid fa-lightbulb"></i> نصائح</h3><ul class="md">${(j.tips || []).map(t => `<li>${UI.esc(t)}</li>`).join('')}</ul></div>`;
    const text = `PROMPT:\n${j.prompt}\n\nNEGATIVE:\n${j.negative}\n\nTEXT: ${j.text_overlay}\n\nVARIATIONS:\n${(j.variations || []).join('\n\n')}`;
    return { html, text };
  }
},

{
  id: 'shorts-finder', module: 'm6', icon: 'fa-scissors',
  name: 'مستخرج الشورتس', en: 'Shorts Finder',
  desc: 'تحليل فيديوهاتك الطويلة واقتراح أفضل المقاطع القابلة للتحويل إلى Shorts ناجحة.',
  apis: ['yt', 'ai'],
  fields: [F.video()],
  run: Runners.videoAI((vals, ctx) =>
    `هذا فيديو طويل من قناتى. اقترح كيف أستخرج منه Shorts ناجحة:
${ctx}

بناءً على العنوان والوصف والفصول إن وجدت:
1) 6 أفكار مقاطع Shorts محتملة من هذا الفيديو — لكل مقطع: الفكرة + لماذا ستنجح كـShort + عنوان الشورت + الهوك النصى لأول 3 ثوانى
2) ترتيبها حسب احتمالية الانتشار
3) استراتيجية الربط: كيف يقود كل Short المشاهد للفيديو الكامل
4) جدول نشر الـShorts المستخرجة (التوزيع الزمنى الأمثل)`,
    { comments: true })
},

{
  id: 'shorts-generator', module: 'm6', icon: 'fa-mobile-screen-button',
  name: 'مولد أفكار شورتس', en: 'Shorts Idea Generator',
  desc: 'توليد أفكار Shorts أصلية لنيتشك: هوك + محتوى + نهاية مفتوحة تدفع لإعادة المشاهدة.',
  apis: ['ai'],
  fields: [F.niche(), F.select('count', 'عدد الأفكار', ['10', '15', '20'], '10')],
  run: Runners.ai(vals =>
    `ولّد ${vals.count} فكرة Shorts أصلية فى نيتش "${vals.niche}".

لكل فكرة:
- **العنوان** (قصير صادم)
- **الهوك** (أول 3 ثوانى — حرفياً ما يُقال/يظهر)
- **المحتوى** (15-45 ثانية — ملخص سريع)
- **النهاية** (Loop أو سؤال أو مفاجأة تدفع لإعادة المشاهدة)
- **نوع الفكرة**: (معلومة صادمة/قبل وبعد/تحدى/خطأ شائع/قصة سريعة...)
نوّع الأنواع، ورتّبها من الأقوى، وحدد أفضل 3 للبدء بها.`)
},

{
  id: 'shorts-opportunity', module: 'm6', icon: 'fa-door-open',
  name: 'فرص الشورتس', en: 'Shorts Opportunity Analyzer',
  desc: 'تحليل مدى استغلال قناتك لـShorts مقارنة بإمكانيات نيتشك، مع خطة استغلال الفجوة.',
  apis: ['yt', 'ai'],
  fields: [F.channel()],
  run: Runners.channelAI((vals, ctx, b) => {
    const shorts = b.videoSummaries.filter(v => v.isShort);
    const longs = b.videoSummaries.filter(v => !v.isShort);
    const avgS = shorts.length ? Math.round(shorts.reduce((a, v) => a + v.views, 0) / shorts.length) : 0;
    const avgL = longs.length ? Math.round(longs.reduce((a, v) => a + v.views, 0) / longs.length) : 0;
    return `حلل فرصة قناتى فى Shorts:
${ctx}

إحصائيات محسوبة: ${shorts.length} Short (متوسط ${avgS} مشاهدة) مقابل ${longs.length} فيديو طويل (متوسط ${avgL} مشاهدة).

قدّم: 1) تشخيص وضع Shorts الحالى (مهملة/واعدة/ناجحة)، 2) مقارنة أداء Shorts بالفيديوهات الطويلة، 3) حجم الفرصة الضائعة بالتقدير، 4) استراتيجية Shorts كاملة لقناتى: التكرار، الأنواع، الربط بالمحتوى الطويل، 5) أهداف 30 يوم قابلة للقياس.`;
  })
},

{
  id: 'shorts-performance', module: 'm6', icon: 'fa-chart-column',
  name: 'أداء الشورتس', en: 'Shorts Performance',
  desc: 'تحليل أداء كل Shorts قناتك: الأفضل والأسوأ، الأنماط الناجحة، وقواعد شورتس قناتك الخاصة.',
  apis: ['yt', 'ai'],
  fields: [F.channel()],
  async run(vals, tool, progress) {
    progress('جارِ تحميل بيانات القناة...');
    const b = await Ctx.channel(vals.channel, 50);
    const shorts = b.videoSummaries.filter(v => v.isShort);
    if (!shorts.length) throw new Error('لا توجد فيديوهات Shorts فى آخر 50 فيديو بالقناة');
    const sorted = [...shorts].sort((a, z) => z.views - a.views);

    progress('جارِ تحليل الأنماط...');
    const text = await Gemini.generate(
      `حلل أداء Shorts قناتى (${shorts.length} Short):
${sorted.map(v => `- "${v.title}" | ${v.views} مشاهدة | ${v.likes} إعجاب | ${v.durationSec}ث | ${v.published}`).join('\n')}

قدّم: 1) أفضل 3 وأسوأ 3 مع تفسير الفرق، 2) الأنماط الناجحة (مواضيع، مدة، صيغ عناوين)، 3) "قواعد شورتس قناتى" — 5 قواعد مستخرجة من بياناتى الفعلية، 4) 5 أفكار Shorts قادمة مبنية على أنجح أنماطى.` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id });

    const html = `
      <div class="grid cols-3">
        ${UI.statCard('fa-mobile-screen', shorts.length, 'عدد الـShorts', 's-purple')}
        ${UI.statCard('fa-eye', UI.num(Math.round(shorts.reduce((a, v) => a + v.views, 0) / shorts.length)), 'متوسط المشاهدات', 's-blue')}
        ${UI.statCard('fa-trophy', UI.num(sorted[0].views), 'أعلى Short', 's-green')}
      </div>
      <div class="card" style="margin-top:18px"><h3><i class="fa-solid fa-list"></i> كل الـShorts</h3>
        <div class="table-scroll"><table class="data-table"><thead><tr><th>العنوان</th><th>مشاهدات</th><th>إعجابات</th><th>مدة</th><th>النشر</th></tr></thead><tbody>
        ${sorted.map(v => `<tr><td>${UI.esc(v.title)}</td><td>${UI.num(v.views)}</td><td>${UI.num(v.likes)}</td><td>${v.durationSec}ث</td><td>${v.published}</td></tr>`).join('')}
        </tbody></table></div></div>
      <div class="card" style="margin-top:18px"><h3><i class="fa-solid fa-wand-magic-sparkles"></i> تحليل الأنماط</h3>${UI.md(text)}</div>`;
    return { html, text };
  }
},

{
  id: 'shorts-script', module: 'm6', icon: 'fa-file-pen',
  name: 'سكربت شورتس', en: 'Shorts Script Writer',
  desc: 'سكربت Short كامل بالثوانى: هوك 3 ثوانٍ، محتوى مكثف، نهاية Loop، وعنوان وهاشتاجات.',
  apis: ['ai'],
  fields: [F.topic('فكرة الشورت'), F.select('dur', 'المدة', ['15 ثانية', '30 ثانية', '45 ثانية', '60 ثانية'], '30 ثانية'), F.lang()],
  async run(vals, tool, progress) {
    progress('جارِ كتابة السكربت...');
    const j = await Gemini.generateJSON(
      `اكتب سكربت Short مدته ${vals.dur} عن "${vals.topic}" باللغة "${vals.lang}". أعد JSON فقط:
{"hook": "أول 3 ثوانى حرفياً (كلام + وصف اللقطة)",
"script": "السكربت الكامل بتقسيم زمنى: [0-3ث] ... [3-10ث] ... مع إشارات بصرية",
"loop_ending": "النهاية التى تصنع Loop أو تدفع لإعادة المشاهدة",
"title": "عنوان الشورت",
"hashtags": ["5 هاشتاجات"],
"onscreen_text": ["النصوص التى تظهر على الشاشة بالترتيب"]}` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id, temperature: 0.85 });
    const html = `
      <div class="card"><h3><i class="fa-solid fa-anchor"></i> الهوك (أول 3 ثوانٍ)</h3>${UI.copyList([j.hook || ''])}</div>
      <div class="card" style="margin-top:18px"><h3><i class="fa-solid fa-scroll"></i> السكربت الكامل</h3>
        <div class="copy-item"><span style="white-space:pre-wrap">${UI.esc(j.script || '')}</span>
        <button class="btn btn-secondary btn-sm" data-copy><i class="fa-regular fa-copy"></i></button></div></div>
      <div class="grid cols-2" style="margin-top:18px">
        <div class="card"><h3><i class="fa-solid fa-rotate"></i> نهاية الـLoop</h3>${UI.copyList([j.loop_ending || ''])}</div>
        <div class="card"><h3><i class="fa-solid fa-heading"></i> العنوان</h3>${UI.copyList([j.title || ''])}</div>
      </div>
      <div class="grid cols-2" style="margin-top:18px">
        <div class="card"><h3><i class="fa-solid fa-hashtag"></i> هاشتاجات</h3>${UI.copyList(j.hashtags || [])}</div>
        <div class="card"><h3><i class="fa-solid fa-font"></i> نصوص الشاشة</h3>${UI.copyList(j.onscreen_text || [])}</div>
      </div>`;
    const text = `الهوك: ${j.hook}\n\nالسكربت:\n${j.script}\n\nالنهاية: ${j.loop_ending}\n\nالعنوان: ${j.title}\nهاشتاجات: ${(j.hashtags || []).join(' ')}`;
    return { html, text };
  }
}

]);
