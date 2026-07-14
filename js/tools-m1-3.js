/* ============================================================
   tools-m1-3.js — أدوات الوحدات 1-3
   Module 1: Dashboard & Reports (10)
   Module 2: Video Management (10)
   Module 3: Analytics (11)
   ============================================================ */
'use strict';

Tools.registerAll([

/* ==================== Module 1 : Dashboard & Reports ==================== */

{
  id: 'channel-dashboard', module: 'm1', icon: 'fa-gauge-high',
  name: 'لوحة القناة', en: 'Channel Dashboard',
  desc: 'نظرة عامة شاملة عن أداء القناة: إحصائيات، رسوم بيانية، أحدث الفيديوهات، أفضل الفيديوهات، وملخص ذكي.',
  apis: ['yt', 'ai'],
  fields: [F.channel()],
  async run(vals, tool, progress) {
    progress('جارِ تحميل بيانات القناة...');
    const b = await Ctx.channel(vals.channel, 50);
    const s = b.summary;
    const vids = b.videoSummaries;
    const top = [...vids].sort((a, z) => z.views - a.views).slice(0, 5);
    const latest = vids.slice(0, 5);
    const avgViews = vids.length ? Math.round(vids.reduce((a, v) => a + v.views, 0) / vids.length) : 0;

    progress('جارِ إنشاء الملخص الذكي...');
    let aiHtml = '', aiText = '';
    try {
      aiText = await Gemini.generate(
        `حلّل أداء هذه القناة وقدّم: 1) ملخص الأداء فى 4 نقاط، 2) أهم 3 مشاكل مكتشفة، 3) أهم 3 أولويات تحسين مرتبة حسب التأثير.\n\n${Ctx.channelText(b)}` + Ctx.kb(),
        { system: SYS_PROMPT, tool: tool.id });
      aiHtml = UI.md(aiText);
    } catch (e) { aiHtml = `<p class="sub">تعذر إنشاء الملخص الذكي: ${UI.esc(e.message)}</p>`; }

    const row = v => `<tr><td>${UI.esc(v.title)}</td><td>${UI.num(v.views)}</td><td>${UI.num(v.likes)}</td><td>${v.published}</td><td>${v.isShort ? '<span class="badge purple">Short</span>' : '<span class="badge blue">فيديو</span>'}</td></tr>`;
    const html = `
      <div class="grid cols-4">
        ${UI.statCard('fa-users', UI.num(s.subscribers), 'مشترك', 's-red')}
        ${UI.statCard('fa-eye', UI.num(s.totalViews), 'إجمالي المشاهدات', 's-blue')}
        ${UI.statCard('fa-clapperboard', UI.num(s.videoCount), 'فيديو', 's-green')}
        ${UI.statCard('fa-chart-line', UI.num(avgViews), 'متوسط مشاهدات آخر ٥٠ فيديو', 's-orange')}
      </div>
      <div class="card" style="margin-top:18px"><h3><i class="fa-solid fa-chart-area"></i> مشاهدات آخر الفيديوهات</h3>
        <div style="height:300px"><canvas id="dash-chart"></canvas></div></div>
      <div class="grid cols-2" style="margin-top:18px">
        <div class="card"><h3><i class="fa-solid fa-trophy"></i> أفضل الفيديوهات</h3>
          <div class="table-scroll"><table class="data-table"><thead><tr><th>العنوان</th><th>مشاهدات</th><th>إعجابات</th><th>النشر</th><th>نوع</th></tr></thead><tbody>${top.map(row).join('')}</tbody></table></div></div>
        <div class="card"><h3><i class="fa-solid fa-clock"></i> أحدث الفيديوهات</h3>
          <div class="table-scroll"><table class="data-table"><thead><tr><th>العنوان</th><th>مشاهدات</th><th>إعجابات</th><th>النشر</th><th>نوع</th></tr></thead><tbody>${latest.map(row).join('')}</tbody></table></div></div>
      </div>
      <div class="card" style="margin-top:18px"><h3><i class="fa-solid fa-wand-magic-sparkles"></i> الملخص الذكي</h3>${aiHtml}</div>`;
    return {
      html, text: aiText || 'لوحة القناة: ' + s.title,
      after() {
        const data = vids.slice(0, 25).reverse();
        UI.chart('dash-chart', {
          type: 'line',
          data: { labels: data.map(v => v.published), datasets: [{ label: 'المشاهدات', data: data.map(v => v.views), borderColor: '#ff0033', backgroundColor: 'rgba(255,0,51,.08)', fill: true, tension: .35 }] },
          options: { maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
      }
    };
  }
},

{
  id: 'performance-reports', module: 'm1', icon: 'fa-file-lines',
  name: 'تقارير الأداء', en: 'Performance Reports',
  desc: 'تقرير احترافى (أسبوعي/شهري/ربع سنوي/سنوي) عن تطور القناة مع ملخص تنفيذى وخطوات عملية، وتصدير PDF.',
  apis: ['yt', 'an', 'ai'],
  fields: [
    F.channel(),
    F.select('period', 'الفترة', ['آخر 7 أيام', 'آخر 30 يوماً', 'آخر 90 يوماً', 'آخر سنة'], 'آخر 30 يوماً')
  ],
  async run(vals, tool, progress) {
    const days = { 'آخر 7 أيام': 7, 'آخر 30 يوماً': 30, 'آخر 90 يوماً': 90, 'آخر سنة': 365 }[vals.period] || 30;
    progress('جارِ تحميل بيانات القناة...');
    const b = await Ctx.channel(vals.channel, 50);
    progress('جارِ جلب Analytics إن أمكن...');
    const an = await Ctx.analyticsText({
      startDate: YTA.daysAgo(days), endDate: YTA.daysAgo(0),
      metrics: 'views,estimatedMinutesWatched,subscribersGained,subscribersLost,likes,comments,shares',
      dimensions: 'day'
    }, `أداء ${vals.period}`);
    progress('جارِ كتابة التقرير...');
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const periodVids = b.videoSummaries.filter(v => v.published >= cutoff);
    const text = await Gemini.generate(
      `اكتب تقرير أداء احترافى للقناة عن "${vals.period}" يتضمن: ملخص تنفيذى، أهم الأرقام (جدول)، أهم التغيرات، الفيديوهات المؤثرة، المشاكل، و5 خطوات عملية للأسبوع القادم.\n\n${Ctx.channelText(b)}\n\nفيديوهات الفترة (${periodVids.length}):\n${periodVids.map(v => `- "${v.title}" ${v.views} مشاهدة`).join('\n') || 'لا توجد'}\n${an}` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id });
    return { text, html: UI.md(text) };
  }
},

{
  id: 'realtime-analytics', module: 'm1', icon: 'fa-tower-broadcast',
  name: 'التحليلات اللحظية', en: 'Real-Time Analytics',
  desc: 'متابعة أداء القناة والفيديوهات لحظة بلحظة عبر لقطات متتالية واكتشاف الفيديوهات التى تنتشر فجأة.',
  apis: ['yt', 'ai'],
  fields: [F.channel()],
  async run(vals, tool, progress) {
    progress('جارِ تحميل اللقطة الحالية...');
    Store.cacheClear(); // بيانات لحظية — تجاوز الكاش
    const b = await Ctx.channel(vals.channel, 25);
    const key = 'rt_' + b.id;
    const prev = Store.get(key);
    const now = { t: Date.now(), subs: b.summary.subscribers, views: b.summary.totalViews, vids: Object.fromEntries(b.videoSummaries.map(v => [v.id, v.views])) };
    Store.set(key, now);

    let deltas = [];
    if (prev) {
      const mins = Math.max(1, (now.t - prev.t) / 60000);
      deltas = b.videoSummaries.map(v => ({ ...v, delta: v.views - (prev.vids[v.id] ?? v.views), perHour: Math.round((v.views - (prev.vids[v.id] ?? v.views)) / mins * 60) }))
        .filter(v => v.delta > 0).sort((a, z) => z.delta - a.delta);
    }
    const dSubs = prev ? now.subs - prev.subs : 0;
    const dViews = prev ? now.views - prev.views : 0;

    let spike = '';
    if (deltas.length) {
      try {
        spike = UI.md(await Gemini.generate(
          `هذه فيديوهات نشطة الآن مع سرعة النمو (مشاهدة/ساعة). حدد هل يوجد فيديو بدأ ينتشر بشكل غير طبيعى وماذا يجب فعله فوراً:\n${deltas.slice(0, 10).map(v => `- "${v.title}": +${v.delta} مشاهدة (${v.perHour}/ساعة) — إجمالى ${v.views}`).join('\n')}`,
          { system: SYS_PROMPT, tool: tool.id }));
      } catch {}
    }
    const html = `
      <div class="grid cols-3">
        ${UI.statCard('fa-users', UI.num(now.subs) + (dSubs ? ` <small style="font-size:.7rem;color:${dSubs > 0 ? 'var(--green)' : 'var(--red)'}">(${dSubs > 0 ? '+' : ''}${dSubs})</small>` : ''), 'المشتركون الآن', 's-red')}
        ${UI.statCard('fa-eye', UI.num(now.views) + (dViews ? ` <small style="font-size:.7rem;color:var(--green)">(+${UI.num(dViews)})</small>` : ''), 'إجمالي المشاهدات', 's-blue')}
        ${UI.statCard('fa-clock', new Date().toLocaleTimeString('ar-EG'), 'آخر تحديث', 's-green')}
      </div>
      ${prev ? '' : '<div class="notice blue" style="margin-top:16px"><i class="fa-solid fa-circle-info"></i> هذه أول لقطة. شغّل الأداة مرة أخرى بعد دقائق لرؤية التغيرات اللحظية.</div>'}
      ${deltas.length ? `<div class="card" style="margin-top:16px"><h3><i class="fa-solid fa-fire"></i> الفيديوهات النشطة منذ آخر لقطة</h3>
        <div class="table-scroll"><table class="data-table"><thead><tr><th>الفيديو</th><th>+مشاهدات</th><th>سرعة/ساعة</th><th>الإجمالى</th></tr></thead>
        <tbody>${deltas.slice(0, 12).map(v => `<tr><td>${UI.esc(v.title)}</td><td style="color:var(--green)">+${UI.num(v.delta)}</td><td>${UI.num(v.perHour)}</td><td>${UI.num(v.views)}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
      ${spike ? `<div class="card" style="margin-top:16px"><h3><i class="fa-solid fa-wand-magic-sparkles"></i> تحليل النشاط</h3>${spike}</div>` : ''}`;
    return { html, text: `Realtime: subs ${now.subs}, views ${now.views}` };
  }
},

{
  id: 'channel-health', module: 'm1', icon: 'fa-heart-pulse',
  name: 'درجة صحة القناة', en: 'Channel Health Score',
  desc: 'تحويل أداء القناة إلى درجة من 100 مع درجات فرعية (SEO، تفاعل، انتظام النشر) وخطة تحسين.',
  apis: ['yt', 'an', 'ai'],
  fields: [F.channel()],
  async run(vals, tool, progress) {
    progress('جارِ تحميل بيانات القناة...');
    const b = await Ctx.channel(vals.channel, 50);
    progress('جارِ حساب الدرجات...');
    const j = await Gemini.generateJSON(
      `قيّم صحة هذه القناة. أعد JSON فقط بالشكل:
{"overall":0-100,"scores":{"seo":0-100,"engagement":0-100,"consistency":0-100,"growth":0-100,"content":0-100},"summary":"فقرة","problems":["..."],"plan":["خطوة عملية 1","..."]}
البيانات:\n${Ctx.channelText(b)}` + Ctx.kb(), { tool: tool.id });
    const sc = j.scores || {};
    const labels = { seo: 'جودة SEO', engagement: 'التفاعل', consistency: 'انتظام النشر', growth: 'النمو', content: 'جودة المحتوى' };
    const html = `
      <div class="card"><div style="display:flex;gap:30px;flex-wrap:wrap;align-items:center">
        ${UI.scoreRing(j.overall ?? 0, 'الدرجة الكلية', 140)}
        <div style="flex:1;min-width:260px">${Object.entries(labels).map(([k, l]) => UI.bar(l, sc[k] ?? 0)).join('')}</div>
      </div></div>
      <div class="card"><h3>الملخص</h3><p>${UI.esc(j.summary || '')}</p>
        <h3 style="margin-top:14px">أهم المشاكل</h3><ul class="md">${(j.problems || []).map(p => `<li>${UI.esc(p)}</li>`).join('')}</ul>
        <h3 style="margin-top:14px">خطة التحسين</h3><ol class="md">${(j.plan || []).map(p => `<li>${UI.esc(p)}</li>`).join('')}</ol></div>`;
    return { html, text: `درجة صحة القناة: ${j.overall}/100\n${j.summary}\nالمشاكل:\n${(j.problems || []).join('\n')}\nالخطة:\n${(j.plan || []).join('\n')}` };
  }
},

{
  id: 'growth-forecast', module: 'm1', icon: 'fa-arrow-trend-up',
  name: 'توقع النمو', en: 'Growth Forecast',
  desc: 'التنبؤ بنمو القناة خلال الأيام والأسابيع القادمة مع مستوى الثقة وسيناريوهات متعددة.',
  apis: ['yt', 'an', 'ai'],
  fields: [F.channel(), F.select('horizon', 'مدى التوقع', ['30 يوماً', '90 يوماً', '180 يوماً'], '30 يوماً')],
  run: Runners.channelAI((v, data) =>
    `اعتماداً على تواريخ نشر الفيديوهات ومشاهداتها، ابنِ توقع نمو للقناة خلال ${v.horizon} يتضمن: جدول توقعات (متشائم/واقعى/متفائل) للمشاهدات والمشتركين، مستوى الثقة ولماذا، العوامل المؤثرة، وأفضل استراتيجية لتحقيق السيناريو المتفائل.\n\n${data}`)
},

{
  id: 'kpi-dashboard', module: 'm1', icon: 'fa-chart-simple',
  name: 'لوحة مؤشرات KPI', en: 'KPI Dashboard',
  desc: 'أهم مؤشرات الأداء الرئيسية (CTR، مشاهدات، وقت مشاهدة، مشتركون، تفاعل) مع تحديد الأكثر احتياجاً للتحسين.',
  apis: ['an', 'yt', 'ai'],
  fields: [F.channel()],
  async run(vals, tool, progress) {
    progress('جارِ تحميل البيانات...');
    const b = await Ctx.channel(vals.channel, 50);
    const an = await Ctx.analyticsText({
      startDate: YTA.daysAgo(28), endDate: YTA.daysAgo(0),
      metrics: 'views,estimatedMinutesWatched,averageViewDuration,subscribersGained,likes,comments'
    }, 'آخر 28 يوماً');
    const vids = b.videoSummaries;
    const t = (f) => vids.reduce((a, v) => a + f(v), 0);
    const engagement = t(v => v.views) ? (((t(v => v.likes) + t(v => v.comments)) / t(v => v.views)) * 100).toFixed(2) : 0;
    progress('جارِ تحليل المؤشرات...');
    const text = await Gemini.generate(
      `هذه مؤشرات KPI للقناة. حدد المؤشر الأكثر احتياجاً للتحسين مع خطة، وقيّم كل مؤشر (ممتاز/جيد/ضعيف) فى جدول، وقارن بالفترة السابقة إن توفرت بيانات:\nمعدل التفاعل: ${engagement}%\nمتوسط مشاهدات الفيديو: ${Math.round(t(v => v.views) / (vids.length || 1))}\n${Ctx.channelText(b, 25)}${an}` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id });
    const html = `
      <div class="grid cols-4">
        ${UI.statCard('fa-eye', UI.num(t(v => v.views)), 'مشاهدات آخر ٥٠ فيديو', 's-blue')}
        ${UI.statCard('fa-thumbs-up', UI.num(t(v => v.likes)), 'إعجابات', 's-green')}
        ${UI.statCard('fa-comments', UI.num(t(v => v.comments)), 'تعليقات', 's-orange')}
        ${UI.statCard('fa-percent', engagement + '%', 'معدل التفاعل', 's-purple')}
      </div>
      <div class="card" style="margin-top:18px">${UI.md(text)}</div>`;
    return { html, text };
  }
},

{
  id: 'ai-coach', module: 'm1', icon: 'fa-user-tie',
  name: 'المدرب الذكي للقناة', en: 'AI Channel Coach',
  desc: 'مساعد محادثة يحلل قناتك بالكامل ويجيب أسئلتك ويقدم خطة تطوير مخصصة وأهدافاً أسبوعية.',
  apis: ['ai', 'yt', 'an'],
  chat: {
    starter: 'أهلاً! أنا مدرب قناتك الذكي 👋 اسألنى عن أى شىء: تقييم الأداء، اقتراح فيديوهات، خطة أسبوعية، شرح الأخطاء... (إذا حفظت معرف قناتك فى الإعدادات سأحللها تلقائياً)',
    system: '\nأنت الآن "مدرب القناة": قدّم نصائح مخصصة، خطط أسبوعية، وأجب بإيجاز عملى.',
    useChannel: true
  }
},

{
  id: 'recommendation-center', module: 'm1', icon: 'fa-list-check',
  name: 'مركز التوصيات', en: 'AI Recommendation Center',
  desc: 'تجميع جميع توصيات أدوات البرنامج فى مكان واحد مع إزالة التكرار وترتيبها حسب الأولوية والتأثير.',
  apis: ['ai'],
  fields: [],
  async run(vals, tool, progress) {
    const ins = Store.insights();
    if (!ins.length) throw new Error('لا توجد توصيات بعد — استخدم أدوات التحليل أولاً وستتجمع نتائجها هنا تلقائياً.');
    progress(`جارِ دمج وترتيب ${Math.min(ins.length, 30)} نتيجة...`);
    const text = await Gemini.generate(
      `هذه نتائج وتوصيات سابقة من أدوات تحليل مختلفة لنفس القناة. ادمجها وأزل التكرار وأنتج "مركز توصيات" مقسماً إلى: 🔴 أولوية عالية / 🟡 متوسطة / 🟢 منخفضة، مع التأثير المتوقع لكل توصية:\n\n${ins.slice(0, 30).map(i => `### من أداة ${i.tool} (${UI.dateFmt(i.date)}):\n${i.text.slice(0, 900)}`).join('\n\n')}` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id });
    return { text, html: UI.md(text) };
  }
},

{
  id: 'history-comparison', module: 'm1', icon: 'fa-scale-balanced',
  name: 'مقارنة الفترات الزمنية', en: 'Historical Performance Comparison',
  desc: 'مقارنة أداء فترتين زمنيتين لفهم التطور الحقيقى للقناة مع تفسير أسباب التحسن أو التراجع.',
  apis: ['yt', 'an', 'ai'],
  fields: [F.channel(), F.select('range', 'المقارنة', ['آخر 30 يوماً مقابل السابقة', 'آخر 90 يوماً مقابل السابقة', 'آخر 7 أيام مقابل السابقة'], 'آخر 30 يوماً مقابل السابقة')],
  async run(vals, tool, progress) {
    const days = vals.range.includes('90') ? 90 : vals.range.includes('7') ? 7 : 30;
    progress('جارِ تحميل بيانات القناة...');
    const b = await Ctx.channel(vals.channel, 50);
    const cut1 = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const cut2 = new Date(Date.now() - 2 * days * 86400000).toISOString().slice(0, 10);
    const p1 = b.videoSummaries.filter(v => v.published >= cut1);
    const p2 = b.videoSummaries.filter(v => v.published >= cut2 && v.published < cut1);
    const an1 = await Ctx.analyticsText({ startDate: YTA.daysAgo(days), endDate: YTA.daysAgo(0), metrics: 'views,estimatedMinutesWatched,subscribersGained' }, 'الفترة الحالية');
    progress('جارِ التحليل والمقارنة...');
    const sum = l => ({ n: l.length, views: l.reduce((a, v) => a + v.views, 0), likes: l.reduce((a, v) => a + v.likes, 0) });
    const s1 = sum(p1), s2 = sum(p2);
    const text = await Gemini.generate(
      `قارن أداء الفترتين وأنشئ تقرير مقارنة بجدول KPI + نسب التغير + تفسير الأسباب + توصيات:
الفترة الحالية (${days} يوم): ${s1.n} فيديو، ${s1.views} مشاهدة، ${s1.likes} إعجاب
${p1.map(v => `- "${v.title}" ${v.views}`).join('\n')}
الفترة السابقة: ${s2.n} فيديو، ${s2.views} مشاهدة، ${s2.likes} إعجاب
${p2.map(v => `- "${v.title}" ${v.views}`).join('\n')}
${an1}` + Ctx.kb(), { system: SYS_PROMPT, tool: tool.id });
    return { text, html: UI.md(text) };
  }
},

{
  id: 'opportunity-finder', module: 'm1', icon: 'fa-gem',
  name: 'مكتشف الفرص', en: 'Opportunity Finder',
  desc: 'اكتشاف أفضل فرص النمو الحالية اعتماداً على بيانات القناة والمنافسين، مرتبة حسب نسبة النجاح المتوقعة.',
  apis: ['yt', 'an', 'ai'],
  fields: [F.channel(), F.competitors()],
  async run(vals, tool, progress) {
    progress('جارِ تحميل بيانات قناتك...');
    const b = await Ctx.channel(vals.channel, 40);
    let compText = '';
    if ((vals.competitors || Store.settings().competitors || '').trim()) {
      progress('جارِ تحميل بيانات المنافسين...');
      try { compText = Ctx.competitorsText(await Ctx.competitors(vals.competitors, 10)); } catch {}
    }
    progress('جارِ اكتشاف الفرص...');
    const text = await Gemini.generate(
      `اكتشف أفضل فرص النمو لهذه القناة. أنتج جدولاً: الفرصة | التأثير المتوقع (عالٍ/متوسط) | الصعوبة | نسبة النجاح المتوقعة % | الإجراء المقترح. ثم اشرح أهم 3 فرص بالتفصيل.\n\n--- قناتى ---\n${Ctx.channelText(b)}\n${compText ? '--- المنافسون ---' + compText : ''}` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id });
    return { text, html: UI.md(text) };
  }
},

/* ==================== Module 2 : Video Management ==================== */

{
  id: 'video-manager', module: 'm2', icon: 'fa-table-list',
  name: 'مدير الفيديوهات', en: 'Video Manager',
  desc: 'إدارة جميع فيديوهات القناة: بحث، فلترة (Shorts/طويل)، فرز، إحصائيات سريعة، واقتراح ما يحتاج تحسيناً.',
  apis: ['yt', 'ai'],
  fields: [F.channel(), F.select('filter', 'الفلتر', ['الكل', 'Shorts فقط', 'فيديوهات طويلة فقط'], 'الكل'), F.select('sort', 'الترتيب', ['الأحدث', 'الأكثر مشاهدة', 'الأقل مشاهدة', 'الأكثر تفاعلاً'], 'الأحدث'), F.text('q', 'بحث فى العناوين (اختيارى)')],
  async run(vals, tool, progress) {
    progress('جارِ تحميل الفيديوهات...');
    const b = await Ctx.channel(vals.channel, 50);
    let vids = [...b.videoSummaries];
    if (vals.filter === 'Shorts فقط') vids = vids.filter(v => v.isShort);
    if (vals.filter === 'فيديوهات طويلة فقط') vids = vids.filter(v => !v.isShort);
    if (vals.q) vids = vids.filter(v => v.title.toLowerCase().includes(vals.q.toLowerCase()));
    if (vals.sort === 'الأكثر مشاهدة') vids.sort((a, z) => z.views - a.views);
    if (vals.sort === 'الأقل مشاهدة') vids.sort((a, z) => a.views - z.views);
    if (vals.sort === 'الأكثر تفاعلاً') vids.sort((a, z) => (z.likes + z.comments) / (z.views || 1) - (a.likes + a.comments) / (a.views || 1));
    progress('جارِ تحديد ما يحتاج تحسيناً...');
    let aiHtml = '';
    try {
      aiHtml = UI.md(await Gemini.generate(
        `من هذه القائمة حدد 5 فيديوهات تحتاج تحسيناً (عنوان ضعيف / أداء أقل من المتوسط) مع سبب مختصر واقتراح سريع لكل منها:\n${vids.slice(0, 40).map(v => `- "${v.title}" | ${v.views} مشاهدة | ${v.likes}👍`).join('\n')}`,
        { system: SYS_PROMPT, tool: tool.id }));
    } catch {}
    const html = `
      <div class="grid cols-3">
        ${UI.statCard('fa-clapperboard', vids.length, 'فيديو معروض', 's-blue')}
        ${UI.statCard('fa-eye', UI.num(vids.reduce((a, v) => a + v.views, 0)), 'مشاهدات', 's-green')}
        ${UI.statCard('fa-bolt', vids.filter(v => v.isShort).length, 'Shorts', 's-purple')}
      </div>
      <div class="card" style="margin-top:16px"><div class="table-scroll"><table class="data-table">
        <thead><tr><th>#</th><th>العنوان</th><th>النشر</th><th>مشاهدات</th><th>إعجابات</th><th>تعليقات</th><th>نوع</th><th></th></tr></thead>
        <tbody>${vids.map((v, i) => `<tr><td>${i + 1}</td><td>${UI.esc(v.title)}</td><td>${v.published}</td><td>${UI.num(v.views)}</td><td>${UI.num(v.likes)}</td><td>${UI.num(v.comments)}</td><td>${v.isShort ? '<span class="badge purple">Short</span>' : '<span class="badge blue">طويل</span>'}</td><td><a href="https://youtu.be/${v.id}" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i></a></td></tr>`).join('')}</tbody>
      </table></div></div>
      ${aiHtml ? `<div class="card" style="margin-top:16px"><h3><i class="fa-solid fa-wand-magic-sparkles"></i> فيديوهات تحتاج تحسيناً</h3>${aiHtml}</div>` : ''}`;
    return { html, text: vids.map(v => `${v.title} | ${v.views}`).join('\n') };
  }
},

{
  id: 'bulk-metadata', module: 'm2', icon: 'fa-pen-to-square',
  name: 'محرر البيانات الجماعى', en: 'Bulk Metadata Editor',
  desc: 'إعادة كتابة عناوين وأوصاف ووسوم عدة فيديوهات دفعة واحدة بالذكاء الاصطناعي (جاهزة للنسخ والتطبيق).',
  apis: ['yt', 'ai'],
  fields: [F.area('videos', 'روابط الفيديوهات (سطر لكل رابط، حتى 5)', 'https://youtu.be/...', true), F.select('goal', 'هدف التحسين', ['زيادة CTR', 'تحسين SEO', 'الاثنان معاً'], 'الاثنان معاً')],
  async run(vals, tool, progress) {
    const links = vals.videos.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 5);
    if (!links.length) throw new Error('أدخل رابط فيديو واحداً على الأقل');
    const out = [];
    for (const [i, link] of links.entries()) {
      progress(`جارِ معالجة الفيديو ${i + 1}/${links.length}...`);
      const v = await Ctx.video(link);
      const text = await Gemini.generate(
        `أعد كتابة البيانات الوصفية لهذا الفيديو بهدف "${vals.goal}". أعطنى: 3 عناوين بديلة، وصف محسّن كامل، و15 وسماً.\n${v.text}` + Ctx.kb(),
        { system: SYS_PROMPT, tool: tool.id });
      out.push(`## 🎬 ${v.summary.title}\n${text}`);
    }
    const full = out.join('\n\n---\n\n');
    return { text: full, html: UI.md(full) };
  }
},

{
  id: 'playlist-manager', module: 'm2', icon: 'fa-layer-group',
  name: 'مدير قوائم التشغيل', en: 'Playlist Manager',
  desc: 'عرض قوائم التشغيل وتحليل تنظيمها واقتراح قوائم جديدة وتوزيع أفضل للفيديوهات حسب الموضوع.',
  apis: ['yt', 'ai'],
  fields: [F.channel()],
  async run(vals, tool, progress) {
    progress('جارِ تحميل القوائم والفيديوهات...');
    const id = await YT.resolveChannel(vals.channel || Store.settings().channelId);
    const [pls, b] = await Promise.all([YT.playlists(id), Ctx.channel(vals.channel, 50)]);
    progress('جارِ تحليل التنظيم...');
    const text = await Gemini.generate(
      `حلّل تنظيم قوائم التشغيل واقترح: قوائم جديدة مطلوبة، إعادة توزيع، وترتيب أفضل يزيد وقت المشاهدة.\n\nالقوائم الحالية:\n${pls.map(p => `- "${p.snippet.title}" (${p.contentDetails.itemCount} فيديو)`).join('\n') || 'لا توجد قوائم'}\n\nالفيديوهات:\n${b.videoSummaries.map(v => `- "${v.title}"`).join('\n')}` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id });
    const html = `
      <div class="card"><h3><i class="fa-solid fa-layer-group"></i> القوائم الحالية (${pls.length})</h3>
        <div class="table-scroll"><table class="data-table"><thead><tr><th>القائمة</th><th>عدد الفيديوهات</th></tr></thead>
        <tbody>${pls.map(p => `<tr><td>${UI.esc(p.snippet.title)}</td><td>${p.contentDetails.itemCount}</td></tr>`).join('') || '<tr><td colspan="2">لا توجد قوائم</td></tr>'}</tbody></table></div></div>
      <div class="card">${UI.md(text)}</div>`;
    return { html, text };
  }
},

{
  id: 'lifecycle-tracker', module: 'm2', icon: 'fa-timeline',
  name: 'متتبع دورة حياة الفيديو', en: 'Video Lifecycle Tracker',
  desc: 'تحديد المرحلة الحالية لكل فيديو (انطلاق/نمو/استقرار/تراجع) وأفضل وقت لتغيير العنوان أو الصورة.',
  apis: ['yt', 'an', 'ai'],
  fields: [F.video()],
  run: Runners.videoAI((v, data) =>
    `حلّل دورة حياة هذا الفيديو (بالنظر إلى عمره ومشاهداته ومعدل التفاعل): حدد مرحلته الحالية (انطلاق/نمو/استقرار/تراجع/ميت)، وارسم خطاً زمنياً تقديرياً، وحدد هل الآن وقت مناسب لتغيير العنوان أو الصورة المصغرة، وما الإجراء الأنسب.\n\n${data}`)
},

{
  id: 'dead-content', module: 'm2', icon: 'fa-battery-empty',
  name: 'مكتشف المحتوى الميت', en: 'Dead Content Finder',
  desc: 'اكتشاف الفيديوهات التى توقفت عن جلب المشاهدات مع اقتراح حلول (تحديث/إعادة نشر) وترتيب حسب الأولوية.',
  apis: ['an', 'ai'],
  fields: [F.channel()],
  run: Runners.channelAI((v, data) =>
    `بالنظر إلى عمر كل فيديو ومشاهداته (متوسط المشاهدات اليومية = المشاهدات ÷ عمر الفيديو بالأيام)، حدد الفيديوهات "الميتة" (أداء يومى شبه معدوم رغم مرور وقت كافٍ). أنتج جدولاً: الفيديو | آخر نشاط تقديرى | الحل المقترح (تحديث ميتاداتا/صورة/إعادة إنتاج/تجاهل) | الأولوية.\n\n${data}`)
},

{
  id: 'evergreen-finder', module: 'm2', icon: 'fa-seedling',
  name: 'مكتشف المحتوى الدائم', en: 'Evergreen Content Finder',
  desc: 'العثور على الفيديوهات التى تستمر فى جلب مشاهدات باستمرار مع اقتراح إنتاج محتوى مشابه.',
  apis: ['an', 'ai'],
  fields: [F.channel()],
  run: Runners.channelAI((v, data) =>
    `حدد الفيديوهات "الدائمة الخضرة" (Evergreen): معدل مشاهدات يومى مستمر وجيد نسبة إلى عمر الفيديو. أنتج جدولاً بها مع متوسط المشاهدات الشهرى التقديرى واتجاه النمو، ثم اقترح 5 أفكار فيديوهات جديدة مشابهة لها فى النمط.\n\n${data}`)
},

{
  id: 'hidden-gems', module: 'm2', icon: 'fa-wand-sparkles',
  name: 'مكتشف الجواهر المخفية', en: 'Hidden Gems Finder',
  desc: 'فيديوهات ذات جودة وتفاعل ممتاز لكنها لم تحصل على انتشار كافٍ — فرص ذهبية لتغيير العنوان/الصورة.',
  apis: ['an', 'ai'],
  fields: [F.channel()],
  run: Runners.channelAI((v, data) =>
    `اكتشف "الجواهر المخفية": فيديوهات معدل تفاعلها (إعجابات+تعليقات ÷ مشاهدات) أعلى بوضوح من متوسط القناة لكن مشاهداتها منخفضة. أنتج جدولاً: الفيديو | معدل التفاعل | Opportunity Score من 100 | التعديل المقترح على العنوان والصورة لزيادة انتشاره.\n\n${data}`)
},

{
  id: 'old-video-optimizer', module: 'm2', icon: 'fa-rotate',
  name: 'محسّن الفيديوهات القديمة', en: 'Old Video Optimizer',
  desc: 'تحليل فيديو قديم وكتابة عنوان ووصف ووسوم جديدة بالكامل لإعادة إحيائه فى البحث والاقتراحات.',
  apis: ['yt', 'an', 'ai'],
  fields: [F.video()],
  run: Runners.videoAI((v, data) =>
    `هذا فيديو قديم يحتاج إحياء. قيّم SEO الحالى (درجة من 100 مع الأسباب)، ثم اكتب بيانات وصفية جديدة كاملة: 3 عناوين بديلة (مع توقع الأفضل)، وصف SEO كامل جاهز للنسخ، 15 وسماً، واقتراح تعديل للصورة المصغرة.\n\n${data}`)
},

{
  id: 'endscreen-optimizer', module: 'm2', icon: 'fa-diagram-project',
  name: 'محسّن شاشات النهاية', en: 'End Screen Optimizer',
  desc: 'اقتراح أفضل الفيديوهات لوضعها فى شاشة النهاية لزيادة انتقال المشاهد إلى فيديو آخر.',
  apis: ['an', 'yt', 'ai'],
  fields: [F.video(), F.channel()],
  async run(vals, tool, progress) {
    progress('جارِ تحميل الفيديو والقناة...');
    const [v, b] = await Promise.all([Ctx.video(vals.video), Ctx.channel(vals.channel, 40)]);
    progress('جارِ اختيار أفضل الفيديوهات...');
    const text = await Gemini.generate(
      `للفيديو التالى، اختر أفضل 3 فيديوهات من القناة لوضعها فى شاشة النهاية (الأكثر احتمالاً للنقر بسبب صلة الموضوع واستمرار رحلة المشاهد)، مع ترتيب واقتراح نص دعوة مناسب لكل اختيار:\n\n--- الفيديو ---\n${v.text}\n\n--- فيديوهات القناة ---\n${b.videoSummaries.map(x => `- "${x.title}" (${x.views} مشاهدة)`).join('\n')}` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id });
    return { text, html: UI.md(text) };
  }
},

{
  id: 'bulk-organizer', module: 'm2', icon: 'fa-folder-tree',
  name: 'منظم الفيديوهات الجماعى', en: 'Bulk Video Organizer',
  desc: 'تصنيف جميع فيديوهات القناة تلقائياً حسب الفئة والسلسلة والنوع لإنشاء مكتبة منظمة.',
  apis: ['yt', 'ai'],
  fields: [F.channel()],
  run: Runners.channelAI((v, data) =>
    `صنّف جميع فيديوهات القناة تلقائياً إلى مجموعات/فئات حسب الموضوع والنوع. أنتج: جدول (المجموعة | عدد الفيديوهات | أمثلة | متوسط الأداء)، ثم هيكل مكتبة مقترح (قوائم تشغيل وسلاسل)، وأى فيديوهات لا تنتمى لأى مجموعة.\n\n${data}`)
},

/* ==================== Module 3 : Analytics ==================== */

{
  id: 'video-performance', module: 'm3', icon: 'fa-chart-column',
  name: 'محلل أداء الفيديو', en: 'Video Performance Analyzer',
  desc: 'تحليل كامل لأداء أى فيديو: كل المؤشرات المهمة مع تفسير ذكي لنقاط القوة والضعف.',
  apis: ['an', 'ai'],
  fields: [F.video()],
  run: Runners.videoAI((v, data) =>
    `حلّل أداء هذا الفيديو تحليلاً كاملاً: درجة أداء عامة من 100، جدول مؤشرات (مشاهدات/تفاعل/معدل مشاهدات يومى مقارنة بعمر الفيديو)، نقاط القوة، نقاط الضعف، ولماذا حقق هذا الأداء، ثم 5 تحسينات مقترحة.\n\n${data}`, { comments: true })
},

{
  id: 'retention-analyzer', module: 'm3', icon: 'fa-hourglass-half',
  name: 'محلل الاحتفاظ بالجمهور', en: 'Audience Retention Analyzer',
  desc: 'تحليل احتفاظ المشاهدين واكتشاف لحظات المغادرة (مع منحنى Analytics إن كان OAuth متصلاً).',
  apis: ['an', 'ai'],
  fields: [F.video(), F.area('script', 'السكريبت أو وصف محتوى الفيديو بالترتيب الزمنى (اختيارى لكن يحسّن الدقة)')],
  async run(vals, tool, progress) {
    progress('جارِ تحميل بيانات الفيديو...');
    const v = await Ctx.video(vals.video);
    progress('جارِ جلب منحنى الاحتفاظ إن أمكن...');
    const an = await Ctx.analyticsText({
      startDate: '2015-01-01', endDate: YTA.daysAgo(0),
      metrics: 'audienceWatchRatio', dimensions: 'elapsedVideoTimeRatio',
      filters: 'video==' + v.summary.id
    }, 'منحنى الاحتفاظ (نسبة المشاهدة مقابل نسبة تقدم الفيديو)');
    progress('جارِ التحليل...');
    const text = await Gemini.generate(
      `حلّل احتفاظ الجمهور لهذا الفيديو: حدد أماكن الانخفاض المتوقعة/الفعلية وأسبابها، قيّم الـHook، طابق أماكن الانخفاض مع السكريبت إن وُجد، واقترح تحسينات للإيقاع والبنية وبداية الفيديو.\n${v.text}\n${vals.script ? '--- السكريبت ---\n' + vals.script.slice(0, 4000) : ''}${an}` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id });
    return { text, html: UI.md(text) };
  }
},

{
  id: 'ctr-analyzer', module: 'm3', icon: 'fa-arrow-pointer',
  name: 'محلل CTR', en: 'CTR Analyzer',
  desc: 'تحليل معدل النقر وربطه بالعنوان والصورة المصغرة مع توصيات لرفعه.',
  apis: ['an', 'yt', 'ai'],
  fields: [F.video(), F.image('الصورة المصغرة (اختيارى — للتحليل البصرى)')],
  async run(vals, tool, progress) {
    progress('جارِ تحميل بيانات الفيديو...');
    const v = await Ctx.video(vals.video);
    const an = await Ctx.analyticsText({
      startDate: '2015-01-01', endDate: YTA.daysAgo(0),
      metrics: 'views,estimatedMinutesWatched', dimensions: 'day',
      filters: 'video==' + v.summary.id
    }, 'أداء الفيديو اليومى');
    progress('جارِ تحليل العنوان والصورة...');
    const opts = { system: SYS_PROMPT, tool: tool.id };
    if (vals._image) { opts.imageBase64 = vals._image.base64; opts.imageMime = vals._image.mime; }
    const text = await Gemini.generate(
      `حلّل عوامل CTR لهذا الفيديو: قيّم العنوان (فضول/وضوح/طول)، ${vals._image ? 'وقيّم الصورة المصغرة المرفقة (ألوان/نص/وجوه/تباين)،' : ''} وقدّر CTR المتوقع مقارنة بمتوسط يوتيوب (2-10%)، ثم اقترح 3 عناوين بديلة وتعديلات محددة للصورة لرفع النقرات.\n${v.text}${an}` + Ctx.kb(), opts);
    return { text, html: UI.md(text) };
  }
},

{
  id: 'engagement-analyzer', module: 'm3', icon: 'fa-heart',
  name: 'محلل التفاعل', en: 'Engagement Analyzer',
  desc: 'تحليل إعجابات وتعليقات ومشاركات الفيديو ومقارنتها بمعدلات القناة مع تحديد الأسباب.',
  apis: ['yt', 'an', 'ai'],
  fields: [F.video()],
  run: Runners.videoAI((v, data) =>
    `حلّل تفاعل الجمهور مع هذا الفيديو: احسب معدل التفاعل (إعجابات+تعليقات ÷ مشاهدات)، قارنه بالمعدل الطبيعى فى يوتيوب (3-6%)، حلّل نبرة التعليقات المرفقة، وحدد أسباب ارتفاع/انخفاض التفاعل مع 5 طرق عملية لزيادته.\n\n${data}`, { comments: true })
},

{
  id: 'watchtime-analyzer', module: 'm3', icon: 'fa-stopwatch',
  name: 'محلل وقت المشاهدة', en: 'Watch Time Analyzer',
  desc: 'تحليل ساعات المشاهدة والفيديوهات الأكثر مساهمة فيها واقتراح محتوى يزيدها.',
  apis: ['an', 'ai'],
  fields: [F.channel()],
  run: Runners.channelAI((v, data) =>
    `حلّل وقت المشاهدة للقناة: قدّر ساعات المشاهدة لكل فيديو (المشاهدات × المدة × نسبة احتفاظ تقديرية حسب طول الفيديو)، رتب أعلى 10 فيديوهات مساهمة فى ساعات المشاهدة فى جدول، وحدد نمط المحتوى الذى يزيد الساعات واقترح 5 أفكار تعتمد عليه.\n\n${data}`,
    { analytics: () => ({ startDate: YTA.daysAgo(90), endDate: YTA.daysAgo(0), metrics: 'estimatedMinutesWatched,views', dimensions: 'day' }), analyticsLabel: 'دقائق المشاهدة يومياً (90 يوم)' })
},

{
  id: 'traffic-analyzer', module: 'm3', icon: 'fa-route',
  name: 'محلل مصادر الزيارات', en: 'Traffic Source Analyzer',
  desc: 'تحليل مصادر المشاهدات (بحث/اقتراحات/خارجى...) وكيفية تحسين كل مصدر — يتطلب اتصال Analytics.',
  apis: ['an', 'ai'],
  fields: [F.channel()],
  async run(vals, tool, progress) {
    progress('جارِ جلب مصادر الزيارات...');
    const rows = await Ctx.analyticsOrNull({
      startDate: YTA.daysAgo(90), endDate: YTA.daysAgo(0),
      metrics: 'views,estimatedMinutesWatched', dimensions: 'insightTrafficSourceType', sort: '-views'
    });
    progress('جارِ التحليل...');
    let dataText, chartRows = null;
    if (rows && rows.length) { dataText = rows.map(r => `${r.insightTrafficSourceType}: ${r.views} مشاهدة`).join('\n'); chartRows = rows; }
    else {
      const b = await Ctx.channel(vals.channel, 30);
      dataText = 'Analytics غير متصل. بيانات عامة فقط:\n' + Ctx.channelText(b, 30);
    }
    const text = await Gemini.generate(
      `حلّل مصادر الزيارات للقناة (آخر 90 يوماً) واشرح كل مصدر وكيفية تحسينه بخطوات عملية، ورتب المصادر حسب الفرصة:\n${dataText}` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id });
    const html = (chartRows ? `<div class="card"><h3>توزيع المصادر</h3><div style="height:300px"><canvas id="traffic-pie"></canvas></div></div>` : '') + `<div class="card">${UI.md(text)}</div>`;
    return {
      html, text,
      after() {
        if (!chartRows) return;
        UI.chart('traffic-pie', {
          type: 'doughnut',
          data: { labels: chartRows.map(r => r.insightTrafficSourceType), datasets: [{ data: chartRows.map(r => r.views), backgroundColor: ['#ff0033', '#4f6df5', '#16a34a', '#ea8a00', '#8b5cf6', '#06b6d4', '#f43f5e', '#84cc16'] }] },
          options: { maintainAspectRatio: false }
        });
      }
    };
  }
},

{
  id: 'search-performance', module: 'm3', icon: 'fa-magnifying-glass',
  name: 'محلل أداء البحث', en: 'Search Performance Analyzer',
  desc: 'الكلمات التى تجلب زيارات من بحث يوتيوب واقتراح كلمات جديدة ومفقودة.',
  apis: ['an', 'ai'],
  fields: [F.channel()],
  async run(vals, tool, progress) {
    progress('جارِ جلب كلمات البحث...');
    const rows = await Ctx.analyticsOrNull({
      startDate: YTA.daysAgo(90), endDate: YTA.daysAgo(0),
      metrics: 'views', dimensions: 'insightTrafficSourceDetail',
      filters: 'insightTrafficSourceType==YT_SEARCH', sort: '-views', maxResults: 25
    });
    progress('جارِ تحميل القناة والتحليل...');
    const b = await Ctx.channel(vals.channel, 30);
    const kwText = rows?.length ? '--- كلمات البحث الفعلية (Analytics) ---\n' + rows.map(r => `"${r.insightTrafficSourceDetail}": ${r.views} مشاهدة`).join('\n') : Ctx.ANALYTICS_NOTE;
    const text = await Gemini.generate(
      `حلّل أداء القناة فى بحث يوتيوب: رتب الكلمات الجالبة للزيارات، اقترح 10 كلمات جديدة و10 كلمات "مفقودة" كان يجب استهدافها بناءً على محتوى القناة، فى جداول واضحة مع اتجاه كل كلمة.\n${kwText}\n\n${Ctx.channelText(b, 30)}` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id });
    return { text, html: UI.md(text) };
  }
},

{
  id: 'device-analyzer', module: 'm3', icon: 'fa-mobile-screen',
  name: 'محلل الأجهزة والمنصات', en: 'Device & Platform Analyzer',
  desc: 'الأجهزة وأنظمة التشغيل المستخدمة لمشاهدة قناتك مع نصائح مونتاج حسب الجهاز الأكثر استخداماً.',
  apis: ['an', 'ai'],
  fields: [F.channel()],
  async run(vals, tool, progress) {
    progress('جارِ جلب بيانات الأجهزة...');
    const rows = await Ctx.analyticsOrNull({
      startDate: YTA.daysAgo(90), endDate: YTA.daysAgo(0),
      metrics: 'views,estimatedMinutesWatched', dimensions: 'deviceType', sort: '-views'
    });
    const os = await Ctx.analyticsOrNull({
      startDate: YTA.daysAgo(90), endDate: YTA.daysAgo(0),
      metrics: 'views', dimensions: 'operatingSystem', sort: '-views'
    });
    progress('جارِ التحليل...');
    const dataText = rows?.length
      ? `الأجهزة:\n${rows.map(r => `${r.deviceType}: ${r.views}`).join('\n')}\nأنظمة التشغيل:\n${(os || []).map(r => `${r.operatingSystem}: ${r.views}`).join('\n')}`
      : Ctx.ANALYTICS_NOTE + '\nافترض التوزيع النموذجى (موبايل 70%+) وقدّم نصائح عامة للنيتش: ' + (Store.settings().niche || 'عام');
    const text = await Gemini.generate(
      `حلّل توزيع الأجهزة والمنصات لمشاهدى القناة وقدّم توصيات مونتاج وتصميم (حجم النص، الثمبنيل، الإيقاع) حسب الجهاز الأغلب، وقارن الأداء بين TV/Mobile/Desktop:\n${dataText}` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id });
    const html = (rows?.length ? `<div class="card"><h3>توزيع الأجهزة</h3><div style="height:280px"><canvas id="dev-pie"></canvas></div></div>` : '') + `<div class="card">${UI.md(text)}</div>`;
    return {
      html, text,
      after() {
        if (!rows?.length) return;
        UI.chart('dev-pie', { type: 'pie', data: { labels: rows.map(r => r.deviceType), datasets: [{ data: rows.map(r => r.views), backgroundColor: ['#4f6df5', '#ff0033', '#16a34a', '#ea8a00'] }] }, options: { maintainAspectRatio: false } });
      }
    };
  }
},

{
  id: 'demographics', module: 'm3', icon: 'fa-earth-africa',
  name: 'محلل ديموغرافيا الجمهور', en: 'Audience Demographics Analyzer',
  desc: 'العمر والجنس والدول واللغات + بناء شخصية (Persona) تمثل جمهورك مع نصائح أسلوب المحتوى.',
  apis: ['an', 'ai'],
  fields: [F.channel()],
  async run(vals, tool, progress) {
    progress('جارِ جلب البيانات الديموغرافية...');
    const age = await Ctx.analyticsOrNull({ startDate: YTA.daysAgo(365), endDate: YTA.daysAgo(0), metrics: 'viewerPercentage', dimensions: 'ageGroup,gender' });
    const geo = await Ctx.analyticsOrNull({ startDate: YTA.daysAgo(90), endDate: YTA.daysAgo(0), metrics: 'views', dimensions: 'country', sort: '-views', maxResults: 15 });
    progress('جارِ بناء Persona الجمهور...');
    const b = await Ctx.channel(vals.channel, 25);
    const demo = (age?.length || geo?.length)
      ? `العمر/الجنس:\n${(age || []).map(r => `${r.ageGroup} ${r.gender}: ${r.viewerPercentage}%`).join('\n')}\nالدول:\n${(geo || []).map(r => `${r.country}: ${r.views}`).join('\n')}`
      : Ctx.ANALYTICS_NOTE + '\nاستنتج الديموغرافيا المحتملة من نوع المحتوى.';
    const text = await Gemini.generate(
      `حلّل جمهور هذه القناة وابنِ "Persona" كاملة: الاسم الافتراضى، العمر، الاهتمامات، متى يشاهد، ماذا يريد، وكيف يجب أن يكون أسلوب المحتوى والعناوين ليناسبه. ثم جدول بالتوزيع الديموغرافى.\n${demo}\n\n${Ctx.channelText(b, 25)}` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id });
    return { text, html: UI.md(text) };
  }
},

{
  id: 'returning-viewers', module: 'm3', icon: 'fa-rotate-left',
  name: 'محلل المشاهدين العائدين', en: 'Returning Viewers Analyzer',
  desc: 'قياس ولاء الجمهور: نسبة العائدين مقابل الجدد وطرق زيادة عودة المشاهدين.',
  apis: ['an', 'ai'],
  fields: [F.channel()],
  run: Runners.channelAI((v, data) =>
    `حلّل ولاء جمهور القناة: قدّر نسبة المشاهدين العائدين مقابل الجدد (من نمط الأداء والتعليقات والاشتراكات)، احسب "درجة ولاء" من 100 مع التبرير، واقترح 7 طرق عملية لزيادة عودة المشاهدين (سلاسل، مواعيد ثابتة، مجتمع...).\n\n${data}`,
    { analytics: () => ({ startDate: YTA.daysAgo(90), endDate: YTA.daysAgo(0), metrics: 'views', dimensions: 'subscribedStatus' }), analyticsLabel: 'مشاهدات المشتركين مقابل غير المشتركين' })
},

{
  id: 'subscriber-growth', module: 'm3', icon: 'fa-user-plus',
  name: 'محلل نمو المشتركين', en: 'Subscriber Growth Analyzer',
  desc: 'ربط نمو المشتركين بالفيديوهات المنشورة وتحديد المحتوى الأكثر جذباً للاشتراكات.',
  apis: ['an', 'yt', 'ai'],
  fields: [F.channel()],
  run: Runners.channelAI((v, data) =>
    `حلّل نمو المشتركين: اربط الزيادات المحتملة بالفيديوهات المنشورة (الفيديوهات الأعلى مشاهدة عادة الأكثر جذباً)، حدد أنواع المحتوى الأكثر جذباً للمشتركين فى جدول، وحلّل أسباب أى فقدان محتمل، واقترح استراتيجية محتوى لتسريع الاشتراكات.\n\n${data}`,
    { analytics: () => ({ startDate: YTA.daysAgo(90), endDate: YTA.daysAgo(0), metrics: 'subscribersGained,subscribersLost', dimensions: 'day' }), analyticsLabel: 'المشتركون المكتسبون/المفقودون يومياً' })
}

]);
