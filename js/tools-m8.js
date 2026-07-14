/* ============================================================
   tools-m8.js — Module 8: Automation, Prediction & Advanced AI (28)
   ============================================================ */
'use strict';

Tools.registerAll([

/* -------- الأتمتة والمراقبة -------- */

{
  id: 'competitor-alerts', module: 'm8', icon: 'fa-bell',
  name: 'تنبيهات المنافسين', en: 'Competitor Alerts',
  desc: 'مسح نشاط المنافسين الأخير وتوليد تنبيهات ذكية عن كل تحرك مهم يستحق انتباهك.',
  apis: ['yt', 'ai'],
  fields: [F.competitors()],
  run: Runners.competitorAI((vals, ctx) =>
    `اعمل كنظام تنبيهات ذكى. حلل النشاط الأخير للمنافسين وأصدر تنبيهات:
${ctx}

أخرج التنبيهات مرتبة بالأهمية، كل تنبيه:
🔴/🟠/🟢 [درجة الأهمية] — عنوان التنبيه — التفاصيل — التحرك المقترح منى
أنواع التنبيهات: فيديو منفجر، تغير وتيرة نشر، دخول موضوع جديد، تحول لـShorts، تراجع نشاط... ثم خلاصة: أهم تحرك واحد يجب أن أفعله هذا الأسبوع.`)
},

{
  id: 'competitor-video-tracker', module: 'm8', icon: 'fa-video',
  name: 'متتبع فيديوهات المنافسين', en: 'Competitor Video Tracker',
  desc: 'جدول بأحدث فيديوهات كل المنافسين فى مكان واحد مع كشف الفيديوهات الصاعدة بسرعة.',
  apis: ['yt', 'ai'],
  fields: [F.competitors()],
  async run(vals, tool, progress) {
    progress('جارِ تحميل فيديوهات المنافسين...');
    const comp = await Ctx.competitors(vals.competitors, 10);
    const all = [];
    comp.forEach(c => c.videoSummaries.forEach(v => all.push({ ...v, channel: c.info.snippet.title })));
    all.sort((a, z) => (z.published || '').localeCompare(a.published || ''));
    const hot = all.filter(v => {
      const ageDays = Math.max(1, (Date.now() - new Date(v.published)) / 86400000);
      return v.views / ageDays > 1000;
    }).sort((a, z) => z.views - a.views);

    progress('جارِ التحليل...');
    let aiText = '', aiHtml = '';
    try {
      aiText = await Gemini.generate(
        `هذه أحدث فيديوهات منافسىّ. حدد: 1) الفيديوهات الصاعدة بقوة الآن ولماذا، 2) المواضيع المشتركة التى يهاجمها الجميع، 3) 3 أفكار مضادة أنشرها لأستفيد من الموجة.\n\n${all.slice(0, 30).map(v => `- [${v.published}] "${v.title}" | ${v.channel} | ${v.views} مشاهدة`).join('\n')}` + Ctx.kb(),
        { system: SYS_PROMPT, tool: tool.id });
      aiHtml = UI.md(aiText);
    } catch (e) { aiHtml = `<p class="sub">${UI.esc(e.message)}</p>`; }

    const html = `
      ${hot.length ? `<div class="notice blue"><i class="fa-solid fa-fire"></i> ${hot.length} فيديو صاعد بسرعة عند منافسيك</div>` : ''}
      <div class="card" style="margin-top:18px"><h3><i class="fa-solid fa-video"></i> أحدث فيديوهات المنافسين</h3>
        <div class="table-scroll"><table class="data-table"><thead><tr><th>العنوان</th><th>القناة</th><th>مشاهدات</th><th>النشر</th><th>نوع</th></tr></thead><tbody>
        ${all.slice(0, 40).map(v => `<tr${hot.includes(v) ? ' style="background:rgba(255,153,0,.08)"' : ''}><td><a href="https://youtube.com/watch?v=${v.id}" target="_blank" rel="noopener">${UI.esc(v.title)}</a></td><td>${UI.esc(v.channel)}</td><td>${UI.num(v.views)}</td><td>${v.published}</td><td>${v.isShort ? '<span class="badge purple">Short</span>' : '<span class="badge blue">فيديو</span>'}</td></tr>`).join('')}
        </tbody></table></div></div>
      <div class="card" style="margin-top:18px"><h3><i class="fa-solid fa-wand-magic-sparkles"></i> التحليل</h3>${aiHtml}</div>`;
    return { html, text: aiText || 'متتبع فيديوهات المنافسين' };
  }
},

{
  id: 'collaboration-finder', module: 'm8', icon: 'fa-handshake',
  name: 'كاشف فرص التعاون', en: 'Collaboration Finder',
  desc: 'اكتشاف قنوات مناسبة للتعاون معها (حجم متقارب + جمهور متكامل) مع مسودة رسالة تواصل.',
  apis: ['yt', 'ai'],
  fields: [F.niche(), F.channel()],
  async run(vals, tool, progress) {
    progress('جارِ البحث عن قنوات مرشحة...');
    let mySubs = 0, myTitle = '';
    try {
      const myId = await YT.resolveChannel(vals.channel || Store.settings().channelId);
      const info = await YT.channelInfo(myId);
      mySubs = +info.statistics.subscriberCount || 0;
      myTitle = info.snippet.title;
    } catch {}
    const res = await YT.request('search', { part: 'snippet', q: vals.niche, type: 'channel', maxResults: 20 }, 120);
    const cands = [];
    for (const item of (res.items || [])) {
      try {
        const info = await YT.channelInfo(item.snippet.channelId);
        const subs = +info.statistics.subscriberCount || 0;
        if (myTitle && info.snippet.title === myTitle) continue;
        cands.push({ title: info.snippet.title, id: info.id, subs, videos: +info.statistics.videoCount || 0, desc: (info.snippet.description || '').slice(0, 150) });
      } catch {}
    }
    const fit = mySubs
      ? cands.filter(c => c.subs > mySubs * 0.2 && c.subs < mySubs * 5).concat(cands.filter(c => !(c.subs > mySubs * 0.2 && c.subs < mySubs * 5)))
      : cands;

    progress('جارِ تقييم فرص التعاون...');
    const text = await Gemini.generate(
      `أنا صاحب قناة "${myTitle || 'قناتى'}" (${UI.num(mySubs)} مشترك) فى نيتش "${vals.niche}". قيّم هذه القنوات كفرص تعاون:
${fit.slice(0, 12).map(c => `- ${c.title} | ${UI.num(c.subs)} مشترك | ${c.videos} فيديو | ${c.desc}`).join('\n')}

قدّم: 1) أفضل 5 مرشحين مرتبين (سبب الملاءمة + فكرة تعاون محددة لكل واحد)، 2) صيغ تعاون مقترحة (ضيف/تحدى/فيديو مشترك/ظهور متبادل)، 3) مسودة رسالة تواصل احترافية قصيرة قابلة للتخصيص.` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id });

    const html = `
      <div class="card"><h3><i class="fa-solid fa-handshake"></i> القنوات المرشحة</h3>
        <div class="table-scroll"><table class="data-table"><thead><tr><th>القناة</th><th>مشتركون</th><th>فيديوهات</th></tr></thead><tbody>
        ${fit.slice(0, 12).map(c => `<tr><td><a href="https://youtube.com/channel/${c.id}" target="_blank" rel="noopener">${UI.esc(c.title)}</a></td><td>${UI.num(c.subs)}</td><td>${c.videos}</td></tr>`).join('')}
        </tbody></table></div></div>
      <div class="card" style="margin-top:18px"><h3><i class="fa-solid fa-wand-magic-sparkles"></i> تقييم الفرص ورسالة التواصل</h3>${UI.md(text)}</div>`;
    return { html, text };
  }
},

{
  id: 'scheduled-reports', module: 'm8', icon: 'fa-calendar-day',
  name: 'التقرير الدورى', en: 'Scheduled Report',
  desc: 'تقرير دورى جاهز (أسبوعى/شهرى) يقارن بالفترة السابقة — شغّله بنفس الإعدادات كل فترة.',
  apis: ['yt', 'ai'],
  fields: [F.channel(), F.select('period', 'الدورية', ['أسبوعي', 'شهري'], 'أسبوعي')],
  async run(vals, tool, progress) {
    const days = vals.period === 'أسبوعي' ? 7 : 30;
    progress('جارِ تحميل بيانات القناة...');
    const b = await Ctx.channel(vals.channel, 50);
    const key = 'report_' + b.id + '_' + vals.period;
    const prev = Store.get(key);
    const now = { t: Date.now(), subs: b.summary.subscribers, views: b.summary.totalViews, videoCount: b.summary.videoCount };
    Store.set(key, now);
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const periodVids = b.videoSummaries.filter(v => v.published >= cutoff);

    progress('جارِ كتابة التقرير الدورى...');
    const cmp = prev ? `\nمقارنة بآخر تشغيل للتقرير (${new Date(prev.t).toLocaleDateString('ar-EG')}): مشتركون ${prev.subs}→${now.subs} (${now.subs - prev.subs >= 0 ? '+' : ''}${now.subs - prev.subs}) | مشاهدات كلية ${prev.views}→${now.views} (+${now.views - prev.views}) | فيديوهات ${prev.videoCount}→${now.videoCount}` : '\n(أول تشغيل — لا توجد بيانات مقارنة سابقة. شغّل الأداة دورياً لتفعيل المقارنة التلقائية)';
    const text = await Gemini.generate(
      `اكتب التقرير ال${vals.period} للقناة:
${Ctx.channelText(b)}
${cmp}
فيديوهات الفترة (${periodVids.length}): ${periodVids.map(v => `"${v.title}" ${v.views} مشاهدة`).join(' | ') || 'لا توجد'}

بنية التقرير: 📊 ملخص تنفيذى | 📈 التغيرات الرئيسية | 🏆 أفضل أداء | ⚠️ نقاط الانتباه | ✅ مهام ال${vals.period === 'أسبوعي' ? 'أسبوع' : 'شهر'} القادم (5 مهام محددة).` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id });
    return { text, html: UI.md(text) };
  }
},

{
  id: 'auto-metadata', module: 'm8', icon: 'fa-wand-magic',
  name: 'ميتاداتا تلقائية', en: 'Auto Metadata',
  desc: 'من فكرة واحدة: عنوان + وصف + وسوم + هاشتاجات + تعليق مثبت — حزمة نشر كاملة بضغطة.',
  apis: ['ai'],
  fields: [F.topic(), F.lang()],
  async run(vals, tool, progress) {
    progress('جارِ توليد حزمة النشر الكاملة...');
    const j = await Gemini.generateJSON(
      `ولّد حزمة نشر يوتيوب كاملة للموضوع التالى باللغة "${vals.lang}". أعد JSON فقط:
{"title": "العنوان الأمثل", "title_alts": ["2 بدائل"], "description": "وصف كامل محسّن SEO مع CTA", "tags": ["15 وسم"], "hashtags": ["5 هاشتاجات"], "pinned_comment": "تعليق مثبت يشعل النقاش", "community_post": "منشور مجتمع للإعلان عن الفيديو", "thumbnail_text": "نص الثمبنيل (3 كلمات)"}

الموضوع: ${vals.topic}` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id, maxTokens: 8192 });
    const block = (title, icon, content) => `
      <div class="card"><h3><i class="fa-solid ${icon}"></i> ${title}</h3>
        <div class="copy-item"><span style="white-space:pre-wrap">${UI.esc(content || '')}</span>
        <button class="btn btn-secondary btn-sm" data-copy><i class="fa-regular fa-copy"></i></button></div></div>`;
    const html = `
      <div class="card"><h3><i class="fa-solid fa-heading"></i> العنوان + البدائل</h3>${UI.copyList([j.title, ...(j.title_alts || [])].filter(Boolean))}</div>
      ${block('الوصف', 'fa-align-right', j.description)}
      <div class="card"><h3><i class="fa-solid fa-tags"></i> الوسوم</h3>
        <div class="copy-item"><span>${UI.esc((j.tags || []).join(', '))}</span><button class="btn btn-primary btn-sm" data-copy><i class="fa-solid fa-copy"></i> نسخ الكل</button></div></div>
      <div class="grid cols-2" style="margin-top:18px">
        <div class="card"><h3><i class="fa-solid fa-hashtag"></i> هاشتاجات</h3>${UI.copyList(j.hashtags || [])}</div>
        <div class="card"><h3><i class="fa-solid fa-font"></i> نص الثمبنيل</h3>${UI.copyList([j.thumbnail_text || ''])}</div>
      </div>
      ${block('التعليق المثبت', 'fa-thumbtack', j.pinned_comment)}
      ${block('منشور المجتمع', 'fa-bullhorn', j.community_post)}`;
    const text = `العنوان: ${j.title}\n\nالوصف:\n${j.description}\n\nالوسوم: ${(j.tags || []).join(', ')}\n\nهاشتاجات: ${(j.hashtags || []).join(' ')}\n\nتعليق مثبت: ${j.pinned_comment}\n\nمنشور مجتمع: ${j.community_post}`;
    return { html, text };
  }
},

{
  id: 'auto-playlist', module: 'm8', icon: 'fa-list-check',
  name: 'منظم قوائم التشغيل الذكي', en: 'Auto Playlist Organizer',
  desc: 'اقتراح هيكلة قوائم تشغيل مثالية لكل فيديوهاتك: أى فيديو فى أى قائمة وبأى ترتيب.',
  apis: ['yt', 'ai'],
  fields: [F.channel()],
  async run(vals, tool, progress) {
    progress('جارِ تحميل الفيديوهات والقوائم...');
    const b = await Ctx.channel(vals.channel, 50);
    let plText = 'لا توجد قوائم تشغيل عامة';
    try {
      const pls = await YT.playlists(b.id);
      if (pls.length) plText = pls.map(p => `- "${p.snippet.title}" (${p.contentDetails.itemCount} فيديو)`).join('\n');
    } catch {}
    progress('جارِ تصميم الهيكلة المثالية...');
    const text = await Gemini.generate(
      `نظّم قوائم تشغيل قناتى بذكاء:
${Ctx.channelText(b, 50)}

قوائم التشغيل الحالية:
${plText}

قدّم: 1) تقييم القوائم الحالية (تغطية، تسمية، فجوات)، 2) الهيكلة المثالية: قائمة القوائم المقترحة (اسم جذاب محسّن SEO + وصف قصير + أى فيديوهات تنتمى لها بالترتيب الأمثل للمشاهدة المتسلسلة)، 3) قائمة "ابدأ من هنا" للزائر الجديد، 4) فيديوهات يتيمة لا تنتمى لأى قائمة وماذا أفعل بها.` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id });
    return { text, html: UI.md(text) };
  }
},

{
  id: 'auto-community', module: 'm8', icon: 'fa-calendar-week',
  name: 'خطة المجتمع الأسبوعية', en: 'Community Week Plan',
  desc: 'خطة منشورات مجتمع لأسبوع كامل جاهزة للنسخ: منشور لكل يوم بأهداف متنوعة.',
  apis: ['ai'],
  fields: [F.niche(), F.text('video', 'أحدث/أقرب فيديو لك (اختياري)', 'عنوان الفيديو')],
  run: Runners.ai(vals =>
    `اصنع خطة منشورات تبويب المجتمع لأسبوع كامل (7 أيام) لقناة نيتش "${vals.niche}"${vals.video ? ` — أحدث فيديو: "${vals.video}"` : ''}.

لكل يوم: [اليوم] — نوع المنشور (سؤال/استطلاع/كواليس/إعلان/معلومة/تشويق/احتفال) — النص الكامل جاهز للنسخ — أفضل ساعة نشر — الهدف.
اجعل الأسبوع قصة متكاملة: بناء ترقب → ذروة (نشر الفيديو) → استثمار التفاعل.`)
},

{
  id: 'milestone-celebrator', module: 'm8', icon: 'fa-trophy',
  name: 'محتفل الإنجازات', en: 'Milestone Celebrator',
  desc: 'كشف الإنجازات القريبة لقناتك (أرقام مشتركين/مشاهدات) مع محتوى احتفال جاهز لكل إنجاز.',
  apis: ['yt', 'ai'],
  fields: [F.channel()],
  async run(vals, tool, progress) {
    progress('جارِ فحص الإنجازات...');
    const b = await Ctx.channel(vals.channel, 15);
    const subs = b.summary.subscribers, views = b.summary.totalViews;
    const marks = [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000, 5000000, 10000000];
    const nextSub = marks.find(m => m > subs);
    const nextView = [1e4, 1e5, 5e5, 1e6, 5e6, 1e7, 5e7, 1e8].find(m => m > views);
    const passed = marks.filter(m => m <= subs);

    progress('جارِ إعداد محتوى الاحتفال...');
    const text = await Gemini.generate(
      `قناتى "${b.summary.title}" لديها ${subs} مشترك و${views} مشاهدة كلية.
الإنجاز القادم: ${UI.num(nextSub)} مشترك (تبقى ${UI.num(nextSub - subs)}) و${UI.num(nextView)} مشاهدة.
إنجازات تم تجاوزها: ${passed.map(m => UI.num(m)).join('، ') || 'لم تصل لأول علامة بعد'}

قدّم: 1) تقدير زمنى واقعى لبلوغ الإنجاز القادم بمعدل النمو الظاهر، 2) حملة "الوصول للإنجاز": 3 أفكار محتوى تسرّع الوصول، 3) محتوى الاحتفال الجاهز عند التحقق: منشور مجتمع + فكرة فيديو احتفالى + قصة شكر للجمهور، 4) إنجازات صغيرة غير رقمية تستحق الاحتفال أيضاً.` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id });

    const pct = Math.min(100, Math.round(subs / nextSub * 100));
    const html = `
      <div class="grid cols-3">
        ${UI.statCard('fa-users', UI.num(subs), 'مشترك حالياً', 's-red')}
        ${UI.statCard('fa-flag-checkered', UI.num(nextSub), 'الإنجاز القادم', 's-orange')}
        ${UI.statCard('fa-hourglass-half', UI.num(nextSub - subs), 'المتبقي', 's-blue')}
      </div>
      <div class="card" style="margin-top:18px"><h3><i class="fa-solid fa-road"></i> التقدم نحو ${UI.num(nextSub)} مشترك</h3>
        ${UI.bar('نسبة الإنجاز', pct)}</div>
      <div class="card" style="margin-top:18px"><h3><i class="fa-solid fa-trophy"></i> خطة الوصول والاحتفال</h3>${UI.md(text)}</div>`;
    return { html, text };
  }
},

{
  id: 'cross-platform', module: 'm8', icon: 'fa-share-nodes',
  name: 'الترويج متعدد المنصات', en: 'Cross-Platform Promoter',
  desc: 'تحويل فيديو يوتيوب إلى محتوى ترويجى لكل منصة: X، إنستجرام، تيك توك، لينكدإن، وتيليجرام.',
  apis: ['yt', 'ai'],
  fields: [F.video()],
  async run(vals, tool, progress) {
    progress('جارِ تحميل الفيديو...');
    const v = await Ctx.video(vals.video);
    progress('جارِ توليد محتوى المنصات...');
    const j = await Gemini.generateJSON(
      `حوّل هذا الفيديو إلى محتوى ترويجى لكل منصة. أعد JSON فقط:
{"x": "ثريد X من 3 تغريدات (مفصولة بـ---) ينتهى برابط الفيديو",
"instagram": "كابشن إنستجرام Reel/Post مع هاشتاجات",
"tiktok": "كابشن تيك توك + فكرة المقطع الترويجي",
"linkedin": "منشور لينكدإن احترافى بزاوية القيمة المهنية",
"telegram": "رسالة قناة تيليجرام",
"whatsapp": "رسالة قصيرة للمشاركة فى الحالات والجروبات"}

${v.text}` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id, maxTokens: 8192 });
    const block = (title, icon, content, brand = true) => `
      <div class="card"><h3><i class="fa-brands ${icon}"></i> ${title}</h3>
        <div class="copy-item"><span style="white-space:pre-wrap">${UI.esc(content || '')}</span>
        <button class="btn btn-secondary btn-sm" data-copy><i class="fa-regular fa-copy"></i></button></div></div>`;
    const html = `<div class="grid cols-2">
      ${block('X (تويتر)', 'fa-x-twitter', j.x)}
      ${block('إنستجرام', 'fa-instagram', j.instagram)}
      ${block('تيك توك', 'fa-tiktok', j.tiktok)}
      ${block('لينكدإن', 'fa-linkedin', j.linkedin)}
      ${block('تيليجرام', 'fa-telegram', j.telegram)}
      ${block('واتساب', 'fa-whatsapp', j.whatsapp)}
    </div>`;
    const text = `X:\n${j.x}\n\nInstagram:\n${j.instagram}\n\nTikTok:\n${j.tiktok}\n\nLinkedIn:\n${j.linkedin}\n\nTelegram:\n${j.telegram}\n\nWhatsApp:\n${j.whatsapp}`;
    return { html, text };
  }
},

{
  id: 'sponsor-pitch', module: 'm8', icon: 'fa-sack-dollar',
  name: 'ملف الرعايات', en: 'Sponsor Pitch Builder',
  desc: 'بناء Media Kit مصغر ورسالة عرض احترافية للرعاة بناءً على أرقام قناتك الفعلية.',
  apis: ['yt', 'ai'],
  fields: [F.channel(), F.text('sponsor', 'نوع الراعى المستهدف (اختياري)', 'مثال: شركات برمجيات، متاجر إلكترونية')],
  run: Runners.channelAI((vals, ctx) =>
    `ابنِ لى ملف رعايات (Media Kit) ورسالة عرض للرعاة${vals.sponsor ? ` المستهدفين: ${vals.sponsor}` : ''} بناءً على أرقام قناتى الفعلية:
${ctx}

قدّم:
1) Media Kit مصغر: نبذة القناة | الأرقام الرئيسية | الجمهور | نقاط البيع الفريدة | صيغ الرعاية المتاحة (ذكر مدمج/فقرة مخصصة/فيديو كامل)
2) تسعير مقترح واقعى لكل صيغة (بالدولار، بناءً على متوسط المشاهدات)
3) رسالة عرض بريدية احترافية قصيرة قابلة للتخصيص
4) قائمة 10 أنواع شركات مناسبة لنيتشى
5) نصائح تفاوض`)
},

/* -------- التنبؤ -------- */

{
  id: 'view-prediction', module: 'm8', icon: 'fa-chart-line',
  name: 'توقع المشاهدات', en: 'View Prediction',
  desc: 'توقع مشاهدات فيديوك القادم بناءً على أداء قناتك التاريخى مع نطاقات ثقة.',
  apis: ['yt', 'ai'],
  fields: [F.channel(), F.topic('موضوع/عنوان الفيديو القادم')],
  run: Runners.channelAI((vals, ctx) =>
    `توقع مشاهدات فيديو قادم عن "${vals.topic}" بناءً على بيانات قناتى:
${ctx}

قدّم: 1) التوقع بثلاثة سيناريوهات (متشائم/واقعى/متفائل) لأول 24 ساعة، أول أسبوع، أول شهر — مع منطق كل رقم من بياناتى، 2) العوامل التى سترجح كل سيناريو، 3) ماذا أفعل لدفع النتيجة نحو السيناريو المتفائل (5 أفعال)، 4) مستوى ثقة التوقع الكلى ولماذا.`)
},

{
  id: 'ctr-prediction', module: 'm8', icon: 'fa-percent',
  name: 'توقع CTR', en: 'CTR Prediction',
  desc: 'توقع معدل النقر لعنوان + وصف ثمبنيل قبل النشر مقارنة بمعايير نيتشك.',
  apis: ['ai'],
  fields: [F.text('title', 'العنوان', '', true), F.area('thumb', 'وصف الثمبنيل المخطط', 'صف ماذا سيظهر فى الصورة...', true), F.niche()],
  run: Runners.ai(vals =>
    `توقع CTR لهذه الحزمة فى نيتش "${vals.niche}":
العنوان: "${vals.title}"
الثمبنيل المخطط: ${vals.thumb}

قدّم: 1) CTR متوقع (نطاق %) مقارنة بمتوسطات يوتيوب المعروفة (2-10%)، 2) تحليل التكامل بين العنوان والثمبنيل (تكرار؟ فجوة فضول؟)، 3) نقاط القوة والضعف فى الحزمة، 4) 3 تعديلات ترفع الـCTR المتوقع مع تقدير أثر كل واحد، 5) نسخة محسّنة كاملة (عنوان + وصف ثمبنيل).`)
},

{
  id: 'retention-prediction', module: 'm8', icon: 'fa-user-clock',
  name: 'توقع الاحتفاظ', en: 'Retention Prediction',
  desc: 'تحليل سكربت/هيكل فيديو قبل التصوير وتوقع منحنى الاحتفاظ ونقاط الخروج المحتملة.',
  apis: ['ai'],
  fields: [F.area('script', 'السكربت أو الهيكل التفصيلي', 'الصق السكربت أو الهيكل...', true)],
  run: Runners.ai(vals =>
    `حلل هذا السكربت/الهيكل وتوقع منحنى الاحتفاظ (Retention):
${vals.script}

قدّم: 1) توقع منحنى الاحتفاظ كجدول (0-15ث، 15-30ث، الدقيقة 1، الربع الأول، المنتصف، النهاية) بنسب متوقعة، 2) نقاط الخروج المحتملة بالتحديد (أى جملة/جزء سيخرج عنده الناس ولماذا)، 3) قوة الهوك (0-100)، 4) إصلاحات دقيقة لكل نقطة خروج، 5) إعادة ترتيب مقترحة إن لزم لرفع الاحتفاظ الكلى.`)
},

{
  id: 'subscriber-prediction', module: 'm8', icon: 'fa-user-plus',
  name: 'توقع المشتركين', en: 'Subscriber Prediction',
  desc: 'توقع نمو مشتركيك خلال 30/90/365 يوم بناءً على مسار قناتك الحالى وسيناريوهات التحسين.',
  apis: ['yt', 'ai'],
  fields: [F.channel()],
  run: Runners.channelAI((vals, ctx, b) => {
    const created = new Date(b.summary.created);
    const ageDays = Math.max(1, Math.round((Date.now() - created) / 86400000));
    return `توقع نمو مشتركى قناتى:
${ctx}
عمر القناة: ${ageDays} يوم → متوسط تاريخى ${(b.summary.subscribers / ageDays).toFixed(2)} مشترك/يوم.

قدّم: 1) توقع عدد المشتركين بعد 30/90/365 يوم بثلاثة سيناريوهات (استمرار الوضع/تحسين معقول/نمو قوى) مع الافتراضات، 2) جدول زمنى للإنجازات القادمة (متى 1K/10K/100K حسب كل سيناريو)، 3) أكبر رافعة نمو واحدة لقناتى تحديداً، 4) درجة ثقة التوقع.`;
  })
},

{
  id: 'revenue-prediction', module: 'm8', icon: 'fa-money-bill-trend-up',
  name: 'توقع الأرباح', en: 'Revenue Prediction',
  desc: 'تقدير أرباح AdSense المتوقعة لقناتك حسب النيتش والجمهور + مصادر دخل إضافية.',
  apis: ['yt', 'an', 'ai'],
  fields: [F.channel()],
  async run(vals, tool, progress) {
    progress('جارِ تحميل بيانات القناة...');
    const b = await Ctx.channel(vals.channel, 40);
    progress('جارِ جلب بيانات الأرباح إن أمكن...');
    const an = await Ctx.analyticsText({ startDate: YTA.daysAgo(90), endDate: YTA.daysAgo(0), metrics: 'estimatedRevenue,estimatedAdRevenue,monetizedPlaybacks,playbackBasedCpm', dimensions: 'month' }, 'الأرباح الفعلية آخر 90 يوم');
    progress('جارِ حساب التقديرات...');
    const monthlyViews = Math.round(b.videoSummaries.slice(0, 12).reduce((a, v) => a + v.views, 0) / 3);
    const text = await Gemini.generate(
      `قدّر أرباح قناتى:
${Ctx.channelText(b, 25)}
تقدير المشاهدات الشهرية الحالية: ~${monthlyViews}
${an}

قدّم: 1) نطاق RPM/CPM المتوقع لنيتش القناة وجمهورها (بالدولار)، 2) تقدير الأرباح الشهرية الحالية (نطاق واقعى) والمتوقعة بعد 6/12 شهر بثلاثة سيناريوهات، 3) جدول: مصادر دخل إضافية مناسبة لقناتى (رعايات/عمولة/منتجات/عضويات) مع تقدير كل مصدر، 4) خطة مضاعفة الدخل فى 6 شهور، 5) إخلاء مسؤولية عن دقة التقديرات.` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id });
    return { text, html: UI.md(text) };
  }
},

{
  id: 'viral-probability', module: 'm8', icon: 'fa-dice',
  name: 'احتمالية الفيرال', en: 'Viral Probability',
  desc: 'فحص فيديو منشور حديثاً: هل يملك مؤشرات مبكرة للانتشار الفيروسى؟ وكيف تدعمه الآن؟',
  apis: ['yt', 'ai'],
  fields: [F.video()],
  async run(vals, tool, progress) {
    progress('جارِ تحميل بيانات الفيديو...');
    const v = await Ctx.video(vals.video);
    const s = v.summary;
    const ageHours = Math.max(1, (Date.now() - new Date(v.raw.snippet.publishedAt)) / 3600000);
    const vph = Math.round(s.views / ageHours);
    const engRate = s.views ? ((s.likes + s.comments) / s.views * 100).toFixed(2) : 0;

    progress('جارِ تحليل مؤشرات الانتشار...');
    const j = await Gemini.generateJSON(
      `حلل مؤشرات الانتشار المبكرة لهذا الفيديو وأعد JSON فقط:
{"viral_probability": 0-100, "signals_positive": ["إشارات إيجابية"], "signals_negative": ["إشارات سلبية"], "stage": "المرحلة (إقلاع/تسارع/استقرار/تباطؤ)", "boost_actions": ["5 أفعال الآن لدعم الانتشار"], "expected_peak": "توقع موعد وحجم الذروة", "verdict": "الحكم"}

${v.text}
عمر الفيديو: ${Math.round(ageHours)} ساعة | سرعة المشاهدات: ${vph}/ساعة | معدل التفاعل: ${engRate}%` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id });
    const html = `
      <div class="grid cols-3">
        ${UI.statCard('fa-gauge-high', vph + '/س', 'سرعة المشاهدات', 's-red')}
        ${UI.statCard('fa-heart', engRate + '%', 'معدل التفاعل', 's-purple')}
        ${UI.statCard('fa-flag', UI.esc(j.stage || '-'), 'المرحلة', 's-blue')}
      </div>
      <div class="card" style="margin-top:18px;text-align:center">${UI.scoreRing(j.viral_probability, 'احتمالية الانتشار', 150)}
        <p class="sub" style="margin-top:8px">${UI.esc(j.verdict || '')} — ${UI.esc(j.expected_peak || '')}</p></div>
      <div class="grid cols-2" style="margin-top:18px">
        <div class="card"><h3 style="color:var(--green)"><i class="fa-solid fa-arrow-trend-up"></i> إشارات إيجابية</h3><ul class="md">${(j.signals_positive || []).map(x => `<li>${UI.esc(x)}</li>`).join('')}</ul></div>
        <div class="card"><h3 style="color:var(--red)"><i class="fa-solid fa-arrow-trend-down"></i> إشارات سلبية</h3><ul class="md">${(j.signals_negative || []).map(x => `<li>${UI.esc(x)}</li>`).join('')}</ul></div>
      </div>
      <div class="card" style="margin-top:18px"><h3><i class="fa-solid fa-rocket"></i> ادعم الانتشار الآن</h3><ol class="md">${(j.boost_actions || []).map(x => `<li>${UI.esc(x)}</li>`).join('')}</ol></div>`;
    const text = `احتمالية الفيرال: ${j.viral_probability}/100 | المرحلة: ${j.stage}\nسرعة: ${vph}/ساعة | تفاعل: ${engRate}%\n${j.verdict}\nأفعال:\n${(j.boost_actions || []).map(x => '- ' + x).join('\n')}`;
    return { html, text };
  }
},

{
  id: 'thumbnail-impact', module: 'm8', icon: 'fa-bullseye',
  name: 'أثر تغيير الثمبنيل', en: 'Thumbnail Impact Estimator',
  desc: 'هل يستحق فيديوك القديم ثمبنيل جديداً؟ تقدير الأثر المتوقع لتغييره وأولوية التغيير.',
  apis: ['yt', 'ai'],
  fields: [F.video(), F.image('الثمبنيل الجديد المقترح (اختياري)')],
  async run(vals, tool, progress) {
    progress('جارِ تحميل الفيديو...');
    const v = await Ctx.video(vals.video);
    progress('جارِ تقدير الأثر...');
    const opts = { system: SYS_PROMPT, tool: tool.id };
    if (vals._image) { opts.imageBase64 = vals._image.base64; opts.imageMime = vals._image.mime; }
    const text = await Gemini.generate(
      `قيّم جدوى تغيير ثمبنيل هذا الفيديو${vals._image ? ' (الصورة المرفقة هى الثمبنيل الجديد المقترح)' : ''}:
${v.text}

قدّم: 1) هل الفيديو مرشح جيد لتغيير الثمبنيل؟ (المعايير: عمره، أداؤه النسبى، موضوعه Evergreen أم لا) بقرار واضح، 2) الأثر المتوقع بالنسب (سيناريوهات)، ${vals._image ? '3) تقييم الثمبنيل الجديد المرفق: هل هو فعلاً أفضل؟ درجة ومقارنة،' : '3) وصف الثمبنيل الجديد الأمثل لهذا الفيديو بالتفصيل،'} 4) التوقيت الأمثل للتغيير وكيفية قياس النتيجة بعده، 5) أولوية هذا التغيير وسط مهام القناة (عالية/متوسطة/منخفضة).` + Ctx.kb(), opts);
    return { text, html: UI.md(text) };
  }
},

{
  id: 'content-success', module: 'm8', icon: 'fa-square-check',
  name: 'متنبئ نجاح المحتوى', en: 'Content Success Predictor',
  desc: 'تقييم شامل لحزمة فيديو كاملة قبل النشر (فكرة + عنوان + ثمبنيل + توقيت) بدرجة نجاح مركبة.',
  apis: ['ai'],
  fields: [
    F.topic('فكرة الفيديو'),
    F.text('title', 'العنوان المخطط', '', true),
    F.area('thumb', 'وصف الثمبنيل المخطط', '', true),
    F.text('timing', 'موعد النشر المخطط', 'مثال: الجمعة 8 مساءً'),
    F.niche()
  ],
  async run(vals, tool, progress) {
    progress('جارِ تقييم حزمة النشر...');
    const j = await Gemini.generateJSON(
      `قيّم حزمة النشر الكاملة هذه فى نيتش "${vals.niche}" وأعد JSON فقط:
{"overall": 0-100, "idea_score": 0-100, "title_score": 0-100, "thumbnail_score": 0-100, "timing_score": 0-100, "weakest_link": "أضعف حلقة", "fixes": ["إصلاحات مرتبة بالأثر"], "green_light": true/false, "verdict": "الحكم النهائي"}

الفكرة: ${vals.topic}
العنوان: ${vals.title}
الثمبنيل: ${vals.thumb}
التوقيت: ${vals.timing || 'غير محدد'}` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id });
    const html = `
      <div class="card" style="text-align:center">${UI.scoreRing(j.overall, 'درجة النجاح المتوقعة', 150)}
        <p style="margin-top:10px">${j.green_light ? '<span class="badge green">✅ إشارة خضراء — انشر</span>' : '<span class="badge red">⛔ أصلح أولاً ثم انشر</span>'}</p>
        <p class="sub">${UI.esc(j.verdict || '')}</p></div>
      <div class="card" style="margin-top:18px"><h3><i class="fa-solid fa-chart-simple"></i> درجات العناصر</h3>
        ${UI.bar('الفكرة', j.idea_score)}${UI.bar('العنوان', j.title_score)}${UI.bar('الثمبنيل', j.thumbnail_score)}${UI.bar('التوقيت', j.timing_score)}</div>
      <div class="notice" style="margin-top:18px"><i class="fa-solid fa-link-slash"></i> أضعف حلقة: <strong>${UI.esc(j.weakest_link || '')}</strong></div>
      <div class="card" style="margin-top:18px"><h3><i class="fa-solid fa-screwdriver-wrench"></i> الإصلاحات</h3><ol class="md">${(j.fixes || []).map(f => `<li>${UI.esc(f)}</li>`).join('')}</ol></div>`;
    const text = `النجاح المتوقع: ${j.overall}/100 ${j.green_light ? '(إشارة خضراء)' : '(يحتاج إصلاح)'}\nفكرة ${j.idea_score} | عنوان ${j.title_score} | ثمبنيل ${j.thumbnail_score} | توقيت ${j.timing_score}\nأضعف حلقة: ${j.weakest_link}\n${j.verdict}`;
    return { html, text };
  }
},

/* -------- الذكاء المتقدم -------- */

{
  id: 'content-dna', module: 'm8', icon: 'fa-dna',
  name: 'الحمض النووى لقناتك', en: 'Content DNA',
  desc: 'استخراج "الشفرة الوراثية" لنجاح قناتك: العناصر المشتركة فى كل فيديوهاتك الناجحة.',
  apis: ['yt', 'ai'],
  fields: [F.channel()],
  run: Runners.channelAI((vals, ctx, b) => {
    const sorted = [...b.videoSummaries].sort((a, z) => z.views - a.views);
    const top = sorted.slice(0, 10), bottom = sorted.slice(-10);
    return `استخرج "الحمض النووى" لنجاح قناتى — قارن أنجح 10 فيديوهات بأضعف 10:

الأنجح:
${top.map(v => `- "${v.title}" | ${v.views} مشاهدة | ${v.durationSec}ث${v.isShort ? ' Short' : ''}`).join('\n')}

الأضعف:
${bottom.map(v => `- "${v.title}" | ${v.views} مشاهدة | ${v.durationSec}ث${v.isShort ? ' Short' : ''}`).join('\n')}

قدّم: 1) "جينات النجاح": العناصر المشتركة فى الأنجح فقط (مواضيع، صيغ عناوين، مدة، نوع)، 2) "جينات الفشل": ما يشترك فيه الأضعف، 3) وصفة الـDNA: قالب الفيديو المثالى لقناتى (Checklist قبل كل نشر)، 4) 5 أفكار فيديو مطابقة للـDNA بعناوين جاهزة، 5) تحذير: متى أكسر القالب عمداً؟`;
  }, { maxVideos: 50 })
},

{
  id: 'topic-fatigue', module: 'm8', icon: 'fa-battery-quarter',
  name: 'إرهاق المواضيع', en: 'Topic Fatigue Detector',
  desc: 'كشف المواضيع التى استهلكتها قناتك وبدأ الجمهور يملّها، ومتى تعود إليها.',
  apis: ['yt', 'ai'],
  fields: [F.channel()],
  run: Runners.channelAI((vals, ctx) =>
    `افحص "إرهاق المواضيع" فى قناتى — هل أكرر مواضيع فقدت بريقها؟
${ctx}

حلل تسلسل الفيديوهات زمنياً واكتشف: 1) مواضيع/صيغ متكررة يتراجع أداؤها مع كل تكرار (بالأرقام)، 2) مواضيع ما زالت تتحمل المزيد، 3) درجة "التنوع الصحى" لقناتى (0-100)، 4) لكل موضوع مرهق: فترة الراحة المقترحة + زاوية تجديد تعيد إحياءه، 5) خطة تنويع للشهر القادم توازن بين المألوف والجديد.`, { maxVideos: 50 })
},

{
  id: 'content-bucket', module: 'm8', icon: 'fa-boxes-stacked',
  name: 'سلال المحتوى', en: 'Content Buckets',
  desc: 'تقسيم محتوى قناتك إلى سلال استراتيجية (نمو/ثقة/تفاعل/ربح) وقياس توازن كل سلة.',
  apis: ['yt', 'ai'],
  fields: [F.channel()],
  run: Runners.channelAI((vals, ctx) =>
    `قسّم محتوى قناتى إلى "سلال محتوى" استراتيجية:
${ctx}

السلال: 🚀 نمو (يجذب جمهوراً جديداً) | 🤝 ثقة (يعمّق العلاقة) | 💬 تفاعل (يشعل مجتمعاً) | 💰 ربح (يحوّل لدخل)

قدّم: 1) تصنيف فيديوهاتى الأخيرة على السلال (جدول)، 2) نسب التوزيع الحالية مقابل النسب المثالية لمرحلة قناتى، 3) السلة المهملة وأثر إهمالها، 4) 3 أفكار فيديو لكل سلة ناقصة، 5) قاعدة توزيع شهرية بسيطة ألتزم بها.`)
},

{
  id: 'viewer-journey', module: 'm8', icon: 'fa-route',
  name: 'رحلة المشاهد', en: 'Viewer Journey Mapper',
  desc: 'رسم خريطة رحلة المشاهد فى قناتك: من أول فيديو يكتشفك إلى مشترك وفى — وأين تنكسر الرحلة.',
  apis: ['yt', 'ai'],
  fields: [F.channel()],
  run: Runners.channelAI((vals, ctx) =>
    `ارسم خريطة "رحلة المشاهد" فى قناتى:
${ctx}

قدّم: 1) فيديوهات "الاكتشاف" (أبواب الدخول الأرجح لقناتى) ولماذا، 2) المسار المثالى: اكتشاف → مشاهدة ثانية → اشتراك → متابع وفى — بأى فيديوهات يمر كل انتقال، 3) أين تنكسر الرحلة عندى؟ (فجوات الربط، غياب فيديو تالٍ منطقى)، 4) خطة إصلاح الرحلة: بطاقات/شاشات نهاية/قوائم/سلاسل محددة بالاسم، 5) فيديو "أهلاً بك فى القناة" المقترح للزائر الجديد.`)
},

{
  id: 'cannibalization', module: 'm8', icon: 'fa-object-ungroup',
  name: 'تنافس فيديوهاتك', en: 'Cannibalization Detector',
  desc: 'كشف فيديوهاتك التى تتنافس على نفس الكلمة/الموضوع فتضعف بعضها فى البحث.',
  apis: ['yt', 'ai'],
  fields: [F.channel()],
  run: Runners.channelAI((vals, ctx) =>
    `افحص "التهام الذات" (Cannibalization) فى قناتى — فيديوهات تتنافس على نفس الموضوع/الكلمة:
${ctx}

قدّم: 1) مجموعات الفيديوهات المتداخلة (كل مجموعة: الفيديوهات + الكلمة المتنازع عليها + من يجب أن يفوز)، 2) أثر التداخل على ترتيب البحث، 3) خطة الحل لكل مجموعة: أيهم يبقى "الرئيسى"، وكيف نعدّل الباقين (تخصيص زاوية/تعديل عنوان/ربط داخلى)، 4) قاعدة لتجنب التداخل فى الفيديوهات القادمة.`, { maxVideos: 50 })
},

{
  id: 'video-refresh', module: 'm8', icon: 'fa-arrows-rotate',
  name: 'إنعاش الفيديوهات', en: 'Video Refresh Planner',
  desc: 'تحديد فيديوهاتك القديمة التى تستحق "إعادة إحياء" (ريميك/تحديث/ثمبنيل جديد) بأولوية.',
  apis: ['yt', 'ai'],
  fields: [F.channel()],
  run: Runners.channelAI((vals, ctx) =>
    `خطط "إنعاش" فيديوهاتى القديمة:
${ctx}

قدّم جدول إنعاش: الفيديو | نوع الإنعاش المقترح (ريميك كامل/جزء 2/تحديث معلومات/ثمبنيل وعنوان جديدان/إعادة ترويج) | السبب | الأثر المتوقع | الأولوية (0-100).
ثم: 1) أفضل 3 مرشحين للريميك الكامل ولماذا سيتفوق الريميك على الأصل، 2) قاعدة: متى نلمس الفيديو القديم ومتى نتركه، 3) خطة إنعاش شهرية (فيديو واحد شهرياً).`, { maxVideos: 50 })
},

{
  id: 'experiment-tracker', module: 'm8', icon: 'fa-flask',
  name: 'متتبع التجارب', en: 'Experiment Tracker',
  desc: 'إدارة تجارب قناتك: سجّل تجربة (فرضية + مقياس)، تابعها، وحلل نتائجها بالذكاء الاصطناعي.',
  apis: ['ai'],
  fields: [
    F.select('action', 'ماذا تريد؟', ['عرض تجاربى', 'إضافة تجربة جديدة', 'تحليل نتيجة تجربة'], 'عرض تجاربى'),
    F.area('details', 'تفاصيل التجربة / النتيجة (عند الإضافة أو التحليل)', 'مثال: فرضية — نشر الساعة 6م يرفع المشاهدات. المقياس: مشاهدات أول 24 ساعة...')
  ],
  async run(vals, tool, progress) {
    const exps = Store.experiments.all();
    if (vals.action === 'إضافة تجربة جديدة') {
      if (!vals.details?.trim()) throw new Error('اكتب تفاصيل التجربة أولاً');
      progress('جارِ هيكلة التجربة...');
      const j = await Gemini.generateJSON(
        `هيكل هذه التجربة كتجربة علمية وأعد JSON فقط:
{"name": "اسم مختصر", "hypothesis": "الفرضية", "metric": "مقياس النجاح", "duration": "المدة المقترحة", "success_criteria": "متى نعتبرها ناجحة"}
التجربة: ${vals.details}`,
        { system: SYS_PROMPT, tool: tool.id });
      Store.experiments.add({ ...j, status: 'جارية', notes: vals.details });
      return { text: `تم تسجيل التجربة: ${j.name}`, html: `<div class="notice blue"><i class="fa-solid fa-circle-check"></i> تم تسجيل التجربة</div><div class="card" style="margin-top:14px"><h3>${UI.esc(j.name)}</h3><ul class="md"><li><strong>الفرضية:</strong> ${UI.esc(j.hypothesis)}</li><li><strong>المقياس:</strong> ${UI.esc(j.metric)}</li><li><strong>المدة:</strong> ${UI.esc(j.duration)}</li><li><strong>معيار النجاح:</strong> ${UI.esc(j.success_criteria)}</li></ul></div>` };
    }
    if (vals.action === 'تحليل نتيجة تجربة') {
      if (!vals.details?.trim()) throw new Error('اكتب نتيجة التجربة أولاً');
      progress('جارِ تحليل النتيجة...');
      const text = await Gemini.generate(
        `حلل نتيجة هذه التجربة${exps.length ? ` (تجاربى المسجلة: ${exps.map(e => e.name).join('، ')})` : ''}:
${vals.details}

قدّم: 1) الحكم: نجحت/فشلت/غير حاسمة ولماذا، 2) هل العينة كافية للاستنتاج؟، 3) القرار العملى المترتب، 4) التجربة التالية المنطقية.` + Ctx.kb(),
        { system: SYS_PROMPT, tool: tool.id });
      return { text, html: UI.md(text) };
    }
    // عرض التجارب
    if (!exps.length) return { text: 'لا توجد تجارب مسجلة', html: `<div class="empty-state"><i class="fa-solid fa-flask"></i><p>لا توجد تجارب مسجلة بعد. اختر "إضافة تجربة جديدة" وابدأ التجريب المنهجي.</p></div>` };
    const html = `<div class="card"><h3><i class="fa-solid fa-flask"></i> تجاربى (${exps.length})</h3>
      <div class="table-scroll"><table class="data-table"><thead><tr><th>التجربة</th><th>الفرضية</th><th>المقياس</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody>
      ${exps.map(e => `<tr><td>${UI.esc(e.name || '-')}</td><td>${UI.esc(e.hypothesis || '-')}</td><td>${UI.esc(e.metric || '-')}</td><td><span class="badge blue">${UI.esc(e.status || '-')}</span></td><td>${UI.dateFmt(e.date)}</td></tr>`).join('')}
      </tbody></table></div></div>`;
    return { html, text: exps.map(e => `${e.name}: ${e.hypothesis} [${e.status}]`).join('\n'), skipInsight: true };
  }
},

{
  id: 'winning-patterns', module: 'm8', icon: 'fa-medal',
  name: 'الأنماط الرابحة', en: 'Winning Patterns Library',
  desc: 'استخراج الأنماط الرابحة من قناتك ومن نيتشك وحفظها فى قاعدة معرفة القناة تلقائياً.',
  apis: ['yt', 'ai'],
  fields: [F.channel(), F.niche()],
  async run(vals, tool, progress) {
    progress('جارِ تحميل بيانات القناة...');
    const b = await Ctx.channel(vals.channel, 50);
    progress('جارِ البحث فى النيتش...');
    let nicheText = '';
    try {
      const res = await YT.search(vals.niche, { maxResults: 15, order: 'viewCount', publishedAfter: new Date(Date.now() - 60 * 86400000).toISOString() });
      const vids = (await YT.videosByIds((res.items || []).map(i => i.id.videoId).filter(Boolean))).map(YT.summarizeVideo);
      nicheText = vids.map(v => `- "${v.title}" (${v.views})`).join('\n');
    } catch {}
    progress('جارِ استخراج الأنماط الرابحة...');
    const j = await Gemini.generateJSON(
      `استخرج الأنماط الرابحة وأعد JSON فقط:
{"my_patterns": ["5-8 أنماط رابحة من قناتى (محددة وقابلة للتطبيق)"], "niche_patterns": ["5 أنماط رابحة فى النيتش"], "combined_playbook": ["7 قواعد اللعب النهائية"], "anti_patterns": ["3 أنماط خاسرة أتجنبها"]}

قناتى:
${Ctx.channelText(b, 40)}

النيتش الرائج:
${nicheText || 'غير متاح'}` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id });
    // حفظ فى قاعدة المعرفة
    const k = Store.knowledge.get();
    k.patterns = (j.combined_playbook || []).join(' | ');
    Store.knowledge.save(k);
    const list = (arr, cls = '') => `<ul class="md">${(arr || []).map(x => `<li${cls}>${UI.esc(x)}</li>`).join('')}</ul>`;
    const html = `
      <div class="notice blue"><i class="fa-solid fa-floppy-disk"></i> تم حفظ "قواعد اللعب" فى قاعدة معرفة القناة — ستستخدمها كل الأدوات تلقائياً.</div>
      <div class="grid cols-2" style="margin-top:18px">
        <div class="card"><h3><i class="fa-solid fa-medal"></i> أنماطى الرابحة</h3>${list(j.my_patterns)}</div>
        <div class="card"><h3><i class="fa-solid fa-globe"></i> أنماط النيتش</h3>${list(j.niche_patterns)}</div>
      </div>
      <div class="card" style="margin-top:18px"><h3><i class="fa-solid fa-book"></i> قواعد اللعب (محفوظة)</h3>${list(j.combined_playbook)}</div>
      <div class="card" style="margin-top:18px"><h3 style="color:var(--red)"><i class="fa-solid fa-ban"></i> أنماط خاسرة تجنبها</h3>${list(j.anti_patterns)}</div>`;
    const text = `أنماطى:\n${(j.my_patterns || []).map(x => '- ' + x).join('\n')}\n\nقواعد اللعب:\n${(j.combined_playbook || []).map(x => '- ' + x).join('\n')}\n\nتجنب:\n${(j.anti_patterns || []).map(x => '- ' + x).join('\n')}`;
    return { html, text };
  }
},

{
  id: 'strategy-generator', module: 'm8', icon: 'fa-chess-king',
  name: 'مولد الاستراتيجية الكبرى', en: 'Master Strategy Generator',
  desc: 'استراتيجية قناة شاملة من الصفر: التموضع، الجمهور، أعمدة المحتوى، النمو، والدخل.',
  apis: ['yt', 'ai'],
  fields: [F.channel(), F.text('vision', 'رؤيتك/طموحك للقناة', 'مثال: أكبر قناة عربية فى مجالى خلال 3 سنوات', true)],
  run: Runners.channelAI((vals, ctx) =>
    `اصنع الاستراتيجية الكبرى لقناتى. الرؤية: "${vals.vision}".
${ctx}

قدّم استراتيجية شاملة:
1) **التموضع**: جملة تموضع فريدة + ما يميزنى عن كل المنافسين
2) **الجمهور المستهدف**: شخصية المشاهد المثالى بالتفصيل
3) **أعمدة المحتوى**: 3-4 أعمدة بنسب توزيع
4) **محرك النمو**: القناة الأساسية للاكتشاف (بحث/اقتراحات/Shorts) وخطة السيطرة عليها
5) **نموذج الدخل**: مراحل تطور الدخل
6) **خارطة الطريق**: 4 أرباع سنوية بأهداف كل ربع
7) **مؤشرات القيادة**: 5 KPIs أتابعها شهرياً
8) **أكبر 3 مخاطر** وخطط التخفيف`)
},

{
  id: 'growth-simulator', module: 'm8', icon: 'fa-arrow-trend-up',
  name: 'محاكى النمو', en: 'Growth Simulator',
  desc: 'محاكاة "ماذا لو": ماذا يحدث لقناتك لو غيّرت التكرار/الجودة/النوع؟ سيناريوهات رقمية.',
  apis: ['yt', 'ai'],
  fields: [F.channel(), F.select('scenario', 'السيناريو المراد محاكاته', ['مضاعفة وتيرة النشر', 'التحول لـShorts بكثافة', 'رفع الجودة وتقليل الكمية', 'إضافة بث مباشر أسبوعي', 'كل السيناريوهات معاً'], 'كل السيناريوهات معاً')],
  run: Runners.channelAI((vals, ctx) =>
    `شغّل محاكاة نمو لقناتى — السيناريو: "${vals.scenario}":
${ctx}

لكل سيناريو مطلوب قدّم:
1) التوقع الرقمى بعد 3/6/12 شهر (مشتركون + متوسط مشاهدات) مع الافتراضات
2) التكلفة (وقت/جهد/مال) والمخاطر
3) نقطة التعادل: متى يظهر أثر التغيير؟
4) العائد على الجهد (ROI) بدرجة 0-100
ثم: جدول مقارنة نهائى بين السيناريوهات + توصيتك بالسيناريو الأمثل لوضعى الحالى ولماذا.`)
}

]);
