/* ============================================================
   tools-m9.js — Module 9: System Intelligence & Control (25)
   ============================================================ */
'use strict';

Tools.registerAll([

/* -------- البحث والأوامر الذكية -------- */

{
  id: 'unified-search', module: 'm9', icon: 'fa-magnifying-glass',
  name: 'البحث الموحد', en: 'Unified Search',
  desc: 'بحث واحد فى كل شىء: يوتيوب (فيديوهات وقنوات) + سجلك المحلى (نتائج، توصيات، تجارب).',
  apis: ['yt'],
  fields: [F.text('query', 'كلمة البحث', 'ابحث فى يوتيوب وفى بياناتك المحلية...', true)],
  async run(vals, tool, progress) {
    const q = vals.query.trim().toLowerCase();
    // بحث محلى
    const hist = Store.history().filter(h => (h.title || '').toLowerCase().includes(q) || (h.text || '').toLowerCase().includes(q)).slice(0, 10);
    const ins = Store.insights().filter(i => (i.title || '').toLowerCase().includes(q) || (i.text || '').toLowerCase().includes(q)).slice(0, 10);
    // بحث يوتيوب
    progress('جارِ البحث فى يوتيوب...');
    let vids = [], chans = [];
    try {
      const rv = await YT.search(vals.query, { maxResults: 8 });
      vids = (await YT.videosByIds((rv.items || []).map(i => i.id.videoId).filter(Boolean))).map(YT.summarizeVideo);
      const rc = await YT.request('search', { part: 'snippet', q: vals.query, type: 'channel', maxResults: 5 }, 60);
      chans = rc.items || [];
    } catch (e) { if (e.code === 'NO_YT_KEY') throw e; }
    const html = `
      ${vids.length ? `<div class="card"><h3><i class="fa-brands fa-youtube"></i> فيديوهات يوتيوب (${vids.length})</h3>
        <div class="table-scroll"><table class="data-table"><thead><tr><th>العنوان</th><th>مشاهدات</th><th>النشر</th><th></th></tr></thead><tbody>
        ${vids.map(v => `<tr><td>${UI.esc(v.title)}</td><td>${UI.num(v.views)}</td><td>${v.published}</td><td><a href="https://youtu.be/${v.id}" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i></a></td></tr>`).join('')}
        </tbody></table></div></div>` : ''}
      ${chans.length ? `<div class="card" style="margin-top:16px"><h3><i class="fa-solid fa-tv"></i> قنوات (${chans.length})</h3>
        <ul class="md">${chans.map(c => `<li><a href="https://youtube.com/channel/${c.snippet.channelId}" target="_blank" rel="noopener">${UI.esc(c.snippet.title)}</a> — ${UI.esc((c.snippet.description || '').slice(0, 120))}</li>`).join('')}</ul></div>` : ''}
      ${hist.length ? `<div class="card" style="margin-top:16px"><h3><i class="fa-solid fa-clock-rotate-left"></i> من سجلك (${hist.length})</h3>
        <ul class="md">${hist.map(h => `<li><a href="#/history">${UI.esc(h.title || h.tool)}</a> <small class="sub">(${UI.dateFmt(h.date)})</small></li>`).join('')}</ul></div>` : ''}
      ${ins.length ? `<div class="card" style="margin-top:16px"><h3><i class="fa-solid fa-lightbulb"></i> من توصياتك (${ins.length})</h3>
        <ul class="md">${ins.map(i => `<li>${UI.esc(i.title || i.tool)}: ${UI.esc(i.text.slice(0, 140))}...</li>`).join('')}</ul></div>` : ''}
      ${!vids.length && !chans.length && !hist.length && !ins.length ? '<div class="empty-state"><i class="fa-solid fa-magnifying-glass"></i><p>لا توجد نتائج</p></div>' : ''}`;
    return { html, text: `بحث "${vals.query}": ${vids.length} فيديو، ${chans.length} قناة، ${hist.length} من السجل`, skipInsight: true };
  }
},

{
  id: 'ai-command', module: 'm9', icon: 'fa-terminal',
  name: 'مركز الأوامر الذكي', en: 'AI Command Center',
  desc: 'اكتب أى طلب بلغة طبيعية والنظام يفهمه: يرشح لك الأداة المناسبة وينفذ التحليل مباشرة.',
  apis: ['ai'],
  fields: [F.area('command', 'اكتب أمرك بلغة طبيعية', 'مثال: أريد أفكار فيديوهات عن الطبخ الصحى تناسب قناة صغيرة...', true)],
  async run(vals, tool, progress) {
    progress('جارِ فهم الأمر...');
    const toolsList = Tools.all().filter(t => t.id !== 'ai-command').map(t => `${t.id}: ${t.name} — ${t.desc}`).join('\n');
    const j = await Gemini.generateJSON(
      `المستخدم كتب هذا الأمر: "${vals.command}"
لديك قائمة أدوات المنصة:
${toolsList}

أعد JSON فقط: {"best_tools": [{"id": "معرف الأداة", "reason": "لماذا هى مناسبة"}], "direct_answer": "إن أمكن تنفيذ الطلب مباشرة كاستشارة نصية فأجب هنا إجابة كاملة وعملية، وإلا اتركه فارغاً"}`,
      { system: SYS_PROMPT, tool: tool.id });
    const tools = (j.best_tools || []).map(x => ({ ...x, t: Tools.get(x.id) })).filter(x => x.t);
    const html = `
      ${tools.length ? `<div class="card"><h3><i class="fa-solid fa-wand-magic-sparkles"></i> الأدوات المقترحة لطلبك</h3>
        <div class="grid cols-2" style="margin-top:10px">${tools.map(x => `
          <a class="card tool-card" href="#/tool/${x.t.id}" style="text-decoration:none">
            <div class="t-icon"><i class="fa-solid ${x.t.icon}"></i></div>
            <div><strong>${UI.esc(x.t.name)}</strong><p class="sub">${UI.esc(x.reason)}</p></div>
          </a>`).join('')}</div></div>` : ''}
      ${j.direct_answer ? `<div class="card" style="margin-top:16px"><h3><i class="fa-solid fa-comment-dots"></i> إجابة مباشرة</h3>${UI.md(j.direct_answer)}</div>` : ''}`;
    return { html, text: (j.direct_answer || '') + '\n\nأدوات مقترحة: ' + tools.map(x => x.t.name).join('، ') };
  }
},

/* -------- المراقبة والتنبيهات -------- */

{
  id: 'anomaly-detector', module: 'm9', icon: 'fa-triangle-exclamation',
  name: 'كاشف الشذوذ', en: 'Anomaly Detector',
  desc: 'فحص إحصائى لفيديوهات القناة لاكتشاف الأداء الشاذ (قفزات أو انهيارات) مع تفسير الأسباب.',
  apis: ['yt', 'ai'],
  fields: [F.channel()],
  async run(vals, tool, progress) {
    progress('جارِ تحميل بيانات القناة...');
    const b = await Ctx.channel(vals.channel, 50);
    const vids = b.videoSummaries.filter(v => v.views > 0);
    if (vids.length < 5) throw new Error('عدد الفيديوهات غير كافٍ للتحليل الإحصائى');
    // إحصاء: متوسط + انحراف معيارى على log(views)
    const logs = vids.map(v => Math.log10(v.views + 1));
    const mean = logs.reduce((a, x) => a + x, 0) / logs.length;
    const sd = Math.sqrt(logs.reduce((a, x) => a + (x - mean) ** 2, 0) / logs.length) || 1;
    const scored = vids.map((v, i) => ({ ...v, z: (logs[i] - mean) / sd }));
    const spikes = scored.filter(v => v.z >= 1.5).sort((a, z) => z.z - a.z);
    const drops = scored.filter(v => v.z <= -1.5).sort((a, z) => a.z - z.z);
    progress('جارِ تفسير الشذوذ...');
    let aiHtml = '', aiText = '';
    if (spikes.length || drops.length) {
      aiText = await Gemini.generate(
        `اكتشفنا إحصائياً هذه الفيديوهات الشاذة فى القناة (z-score على log المشاهدات). فسّر أسباب كل شذوذ محتملة وماذا نتعلم منه:
قفزات (أداء أعلى بكثير من المعتاد):
${spikes.map(v => `- "${v.title}" | ${v.views} مشاهدة | z=${v.z.toFixed(1)}${v.isShort ? ' (Short)' : ''}`).join('\n') || 'لا يوجد'}
انهيارات (أداء أقل بكثير):
${drops.map(v => `- "${v.title}" | ${v.views} مشاهدة | z=${v.z.toFixed(1)}`).join('\n') || 'لا يوجد'}
متوسط مشاهدات القناة: ${Math.round(10 ** mean)}` + Ctx.kb(),
        { system: SYS_PROMPT, tool: tool.id });
      aiHtml = UI.md(aiText);
    }
    const row = (v, cls) => `<tr><td>${UI.esc(v.title)}</td><td>${UI.num(v.views)}</td><td><span class="badge ${cls}">z=${v.z.toFixed(1)}</span></td><td>${v.published}</td></tr>`;
    const html = `
      <div class="grid cols-3">
        ${UI.statCard('fa-arrow-trend-up', spikes.length, 'قفزة مكتشفة', 's-green')}
        ${UI.statCard('fa-arrow-trend-down', drops.length, 'انهيار مكتشف', 's-red')}
        ${UI.statCard('fa-chart-simple', UI.num(Math.round(10 ** mean)), 'الوسيط الهندسى للمشاهدات', 's-blue')}
      </div>
      ${spikes.length ? `<div class="card" style="margin-top:16px"><h3 style="color:var(--green)"><i class="fa-solid fa-fire"></i> القفزات</h3><div class="table-scroll"><table class="data-table"><thead><tr><th>الفيديو</th><th>مشاهدات</th><th>الدرجة</th><th>النشر</th></tr></thead><tbody>${spikes.map(v => row(v, 'green')).join('')}</tbody></table></div></div>` : ''}
      ${drops.length ? `<div class="card" style="margin-top:16px"><h3 style="color:var(--red)"><i class="fa-solid fa-arrow-down"></i> الانهيارات</h3><div class="table-scroll"><table class="data-table"><thead><tr><th>الفيديو</th><th>مشاهدات</th><th>الدرجة</th><th>النشر</th></tr></thead><tbody>${drops.map(v => row(v, 'red')).join('')}</tbody></table></div></div>` : ''}
      ${aiHtml ? `<div class="card" style="margin-top:16px"><h3><i class="fa-solid fa-wand-magic-sparkles"></i> التفسير</h3>${aiHtml}</div>` : '<div class="notice blue" style="margin-top:16px"><i class="fa-solid fa-circle-check"></i> لا يوجد شذوذ ملحوظ — الأداء مستقر إحصائياً.</div>'}`;
    return { html, text: aiText || 'لا يوجد شذوذ ملحوظ فى أداء القناة.' };
  }
},

{
  id: 'alert-center', module: 'm9', icon: 'fa-bell',
  name: 'مركز التنبيهات', en: 'Alert Center',
  desc: 'فحص شامل واحد يُصدر كل التنبيهات المهمة: قناتك، منافسوك، وتوصياتك المعلقة — فى تقرير واحد.',
  apis: ['yt', 'ai'],
  fields: [F.channel(), F.competitors()],
  async run(vals, tool, progress) {
    progress('جارِ فحص قناتك...');
    const b = await Ctx.channel(vals.channel, 30);
    let compText = '';
    if ((vals.competitors || Store.settings().competitors || '').trim()) {
      progress('جارِ فحص المنافسين...');
      try { compText = Ctx.competitorsText(await Ctx.competitors(vals.competitors, 8)); } catch {}
    }
    const pendingIns = Store.insights().filter(i => i.status === 'new').length;
    progress('جارِ توليد التنبيهات...');
    const text = await Gemini.generate(
      `اعمل كمركز تنبيهات ذكى. افحص البيانات وأصدر كل التنبيهات المهمة مرتبة:
🔴 عاجل / 🟠 مهم / 🟢 للعلم — لكل تنبيه: العنوان، التفاصيل، الإجراء المقترح.
افحص: وتيرة النشر، فيديوهات تنمو/تموت، تغيرات مفاجئة، تحركات المنافسين.
(لدى المستخدم أيضاً ${pendingIns} توصية معلقة فى مركز التوصيات — ذكّره بها إن كانت كثيرة)

--- قناتى ---
${Ctx.channelText(b, 30)}
${compText ? '--- المنافسون ---' + compText : ''}` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id });
    return { text, html: UI.md(text) };
  }
},

{
  id: 'launch-monitor', module: 'm9', icon: 'fa-rocket',
  name: 'مراقب الإطلاق', en: 'Launch Monitor',
  desc: 'متابعة فيديو جديد بعد نشره: سرعة النمو بين اللقطات، تقييم الانطلاقة، وقرارات الإنقاذ المبكر.',
  apis: ['yt', 'ai'],
  fields: [F.video()],
  async run(vals, tool, progress) {
    progress('جارِ تحميل بيانات الفيديو...');
    Store.cacheClear();
    const v = await Ctx.video(vals.video);
    const s = v.summary;
    const key = 'launch_' + s.id;
    const prev = Store.get(key);
    const now = { t: Date.now(), views: s.views, likes: s.likes, comments: s.comments };
    Store.set(key, now);
    const ageH = Math.max(0.1, (Date.now() - new Date(v.raw.snippet.publishedAt)) / 3600000);
    const vph = Math.round(s.views / ageH);
    let deltaTxt = '';
    if (prev) {
      const mins = Math.max(1, (now.t - prev.t) / 60000);
      const dv = now.views - prev.views;
      deltaTxt = `\nمنذ آخر فحص (قبل ${Math.round(mins)} دقيقة): +${dv} مشاهدة (${Math.round(dv / mins * 60)}/ساعة)، +${now.likes - prev.likes} إعجاب، +${now.comments - prev.comments} تعليق`;
    }
    progress('جارِ تقييم الانطلاقة...');
    const text = await Gemini.generate(
      `قيّم انطلاقة هذا الفيديو (عمره ${ageH.toFixed(1)} ساعة):
${v.text}
سرعة المشاهدة منذ النشر: ${vph}/ساعة${deltaTxt}

قدّم: 1) تقييم الانطلاقة 0-100 مع الحكم (قوية/عادية/ضعيفة)، 2) مقارنة بما هو متوقع لعمر الفيديو، 3) إن كانت ضعيفة: 3 إجراءات إنقاذ فورية (تعديل عنوان/ثمبنيل/ترويج)، 4) إن كانت قوية: كيف نضاعف الزخم، 5) متى الفحص القادم.` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id });
    const html = `
      <div class="grid cols-4">
        ${UI.statCard('fa-eye', UI.num(s.views), 'مشاهدات', 's-blue')}
        ${UI.statCard('fa-gauge-high', UI.num(vph) + '/س', 'سرعة النمو', 's-red')}
        ${UI.statCard('fa-thumbs-up', UI.num(s.likes), 'إعجابات', 's-green')}
        ${UI.statCard('fa-clock', ageH < 48 ? ageH.toFixed(1) + ' ساعة' : Math.round(ageH / 24) + ' يوم', 'عمر الفيديو', 's-orange')}
      </div>
      ${prev ? '' : '<div class="notice blue" style="margin-top:16px"><i class="fa-solid fa-circle-info"></i> أول لقطة لهذا الفيديو — أعد التشغيل لاحقاً لقياس سرعة النمو الفعلية بين اللقطات.</div>'}
      <div class="card" style="margin-top:16px">${UI.md(text)}</div>`;
    return { html, text };
  }
},

{
  id: 'first-24h', module: 'm9', icon: 'fa-stopwatch',
  name: 'تحليل أول 24 ساعة', en: 'First 24 Hours Analyzer',
  desc: 'قياس أداء فيديوهاتك فى بدايتها: أيها انطلق أسرع؟ وما القاسم المشترك بين الانطلاقات القوية؟',
  apis: ['yt', 'ai'],
  fields: [F.channel()],
  async run(vals, tool, progress) {
    progress('جارِ تحميل بيانات القناة...');
    const b = await Ctx.channel(vals.channel, 50);
    // تقدير سرعة الانطلاق: مشاهدات/عمر بالأيام (مع ترجيح الفيديوهات الحديثة)
    const scored = b.videoSummaries.map(v => {
      const ageDays = Math.max(1, (Date.now() - new Date(v.published)) / 86400000);
      return { ...v, ageDays: Math.round(ageDays), vpd: Math.round(v.views / ageDays) };
    });
    const recent = scored.filter(v => v.ageDays <= 60).sort((a, z) => z.vpd - a.vpd);
    progress('جارِ تحليل أنماط الانطلاق...');
    const text = await Gemini.generate(
      `حلل سرعة انطلاق فيديوهات القناة (مشاهدات/يوم كمؤشر تقريبى لقوة أول 24 ساعة):
${scored.slice(0, 40).map(v => `- "${v.title}" | ${v.vpd}/يوم | عمر ${v.ageDays} يوم | إجمالى ${v.views}${v.isShort ? ' (Short)' : ''}`).join('\n')}

قدّم: 1) أسرع 5 انطلاقات وأبطأ 5، 2) القاسم المشترك بين الانطلاقات القوية (نوع/موضوع/عنوان/توقيت)، 3) checklist من 7 بنود لتقوية أول 24 ساعة للفيديو القادم، 4) هل تعتمد القناة على الاندفاعة الأولى أم النمو الطويل؟` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id });
    const html = `
      ${recent.length ? `<div class="card"><h3><i class="fa-solid fa-bolt"></i> أسرع الفيديوهات الحديثة (آخر 60 يوماً)</h3>
        <div class="table-scroll"><table class="data-table"><thead><tr><th>الفيديو</th><th>مشاهدات/يوم</th><th>العمر</th><th>الإجمالى</th></tr></thead><tbody>
        ${recent.slice(0, 10).map(v => `<tr><td>${UI.esc(v.title)}</td><td>${UI.num(v.vpd)}</td><td>${v.ageDays} يوم</td><td>${UI.num(v.views)}</td></tr>`).join('')}
        </tbody></table></div></div>` : ''}
      <div class="card" style="margin-top:16px">${UI.md(text)}</div>`;
    return { html, text };
  }
},

{
  id: 'upload-consistency', module: 'm9', icon: 'fa-calendar-check',
  name: 'مقياس انتظام النشر', en: 'Upload Consistency Score',
  desc: 'قياس انتظامك فى النشر رقمياً: الفجوات، الوتيرة، درجة الانتظام من 100، وخطة جدولة واقعية.',
  apis: ['yt', 'ai'],
  fields: [F.channel()],
  async run(vals, tool, progress) {
    progress('جارِ تحميل تواريخ النشر...');
    const b = await Ctx.channel(vals.channel, 50);
    const dates = b.videoSummaries.map(v => new Date(v.published)).sort((a, z) => a - z);
    if (dates.length < 3) throw new Error('عدد الفيديوهات غير كافٍ');
    const gaps = [];
    for (let i = 1; i < dates.length; i++) gaps.push((dates[i] - dates[i - 1]) / 86400000);
    const avgGap = gaps.reduce((a, x) => a + x, 0) / gaps.length;
    const sdGap = Math.sqrt(gaps.reduce((a, x) => a + (x - avgGap) ** 2, 0) / gaps.length);
    const maxGap = Math.max(...gaps);
    const cv = avgGap ? sdGap / avgGap : 1; // معامل الاختلاف
    const score = Math.max(0, Math.min(100, Math.round(100 - cv * 55 - Math.min(25, maxGap / 7 * 3))));
    const daysSinceLast = Math.round((Date.now() - dates[dates.length - 1]) / 86400000);
    progress('جارِ إعداد خطة الانتظام...');
    const text = await Gemini.generate(
      `درجة انتظام النشر المحسوبة: ${score}/100.
متوسط الفجوة بين الفيديوهات: ${avgGap.toFixed(1)} يوم | أطول فجوة: ${Math.round(maxGap)} يوم | آخر نشر: قبل ${daysSinceLast} يوم | معامل التذبذب: ${cv.toFixed(2)}
آخر 20 فجوة (بالأيام): ${gaps.slice(-20).map(g => g.toFixed(0)).join('، ')}

قدّم: 1) تفسير الدرجة وأثر عدم الانتظام على القناة، 2) الوتيرة الواقعية المقترحة لهذه القناة، 3) نظام عملى للالتزام (تجميع تصوير، مخزون حلقات...)، 4) هدف انتظام لـ30 يوماً قادمة.` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id });
    const html = `
      <div class="grid cols-4">
        <div class="card" style="text-align:center">${UI.scoreRing(score, 'درجة الانتظام')}</div>
        ${UI.statCard('fa-calendar-day', avgGap.toFixed(1) + ' يوم', 'متوسط الفجوة', 's-blue')}
        ${UI.statCard('fa-hourglass-half', Math.round(maxGap) + ' يوم', 'أطول فجوة', 's-orange')}
        ${UI.statCard('fa-clock', daysSinceLast + ' يوم', 'منذ آخر نشر', daysSinceLast > avgGap * 1.5 ? 's-red' : 's-green')}
      </div>
      <div class="card" style="margin-top:16px">${UI.md(text)}</div>`;
    return { html, text: `درجة الانتظام: ${score}/100\n` + text };
  }
},

{
  id: 'video-length', module: 'm9', icon: 'fa-ruler-horizontal',
  name: 'محلل مدة الفيديو المثالية', en: 'Optimal Video Length',
  desc: 'اكتشاف المدة التى تحقق أفضل أداء فى قناتك: تجميع الفيديوهات حسب المدة ومقارنة النتائج.',
  apis: ['yt', 'ai'],
  fields: [F.channel()],
  async run(vals, tool, progress) {
    progress('جارِ تحليل مدد الفيديوهات...');
    const b = await Ctx.channel(vals.channel, 50);
    const buckets = [
      { name: 'Shorts (≤62ث)', min: 0, max: 62 },
      { name: '1-5 دقائق', min: 63, max: 300 },
      { name: '5-10 دقائق', min: 301, max: 600 },
      { name: '10-20 دقيقة', min: 601, max: 1200 },
      { name: '+20 دقيقة', min: 1201, max: 1e9 }
    ].map(bu => {
      const vids = b.videoSummaries.filter(v => v.durationSec >= bu.min && v.durationSec <= bu.max);
      const avg = vids.length ? Math.round(vids.reduce((a, v) => a + v.views, 0) / vids.length) : 0;
      const eng = vids.reduce((a, v) => a + v.views, 0) ? (vids.reduce((a, v) => a + v.likes + v.comments, 0) / vids.reduce((a, v) => a + v.views, 0) * 100) : 0;
      return { ...bu, count: vids.length, avg, eng: +eng.toFixed(2) };
    }).filter(bu => bu.count > 0);
    progress('جارِ استخلاص التوصية...');
    const text = await Gemini.generate(
      `حلل علاقة مدة الفيديو بالأداء فى هذه القناة:
${buckets.map(bu => `- ${bu.name}: ${bu.count} فيديو | متوسط ${bu.avg} مشاهدة | تفاعل ${bu.eng}%`).join('\n')}

قدّم: 1) المدة الذهبية لهذه القناة ولماذا، 2) هل الأطول = أفضل هنا أم العكس؟، 3) توصية مدد مختلفة حسب نوع المحتوى، 4) تحذير من أخطاء المدة (حشو/بتر).` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id });
    const maxAvg = Math.max(...buckets.map(bu => bu.avg), 1);
    const html = `
      <div class="card"><h3><i class="fa-solid fa-ruler-horizontal"></i> متوسط المشاهدات حسب المدة</h3>
        ${buckets.map(bu => UI.bar(`${bu.name} (${bu.count} فيديو)`, bu.avg / maxAvg * 100)).join('')}
        <p class="sub" style="margin-top:8px">القيم نسبية لأفضل فئة (${UI.num(maxAvg)} مشاهدة فى المتوسط)</p></div>
      <div class="card" style="margin-top:16px">${UI.md(text)}</div>`;
    return { html, text };
  }
},

{
  id: 'content-mix', module: 'm9', icon: 'fa-chart-pie',
  name: 'محلل مزيج المحتوى', en: 'Content Mix Analyzer',
  desc: 'تصنيف محتوى قناتك إلى فئات وقياس توازن المزيج: ماذا تنشر كثيراً وماذا يستحق زيادة؟',
  apis: ['yt', 'ai'],
  fields: [F.channel()],
  async run(vals, tool, progress) {
    progress('جارِ تحميل بيانات القناة...');
    const b = await Ctx.channel(vals.channel, 50);
    progress('جارِ تصنيف المحتوى...');
    const j = await Gemini.generateJSON(
      `صنّف فيديوهات القناة إلى 4-6 فئات محتوى وأعد JSON فقط:
{"categories": [{"name": "اسم الفئة", "count": عدد, "share_pct": نسبة%, "avg_views": متوسط مشاهدات, "verdict": "زد/حافظ/قلل", "why": "سبب"}], "balance_score": 0-100, "missing": ["فئات ناقصة تستحق الإضافة"], "recommendation": "توصية المزيج المثالى بنسب"}

${Ctx.channelText(b, 45)}` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id });
    const cats = j.categories || [];
    const colors = ['#ff0033', '#2f7cf6', '#22a55e', '#f59e0b', '#8b5cf6', '#0ea5e9'];
    const html = `
      <div class="grid cols-2">
        <div class="card"><h3><i class="fa-solid fa-chart-pie"></i> توزيع المزيج</h3>
          <div style="height:280px"><canvas id="mix-chart"></canvas></div></div>
        <div class="card" style="text-align:center;display:flex;flex-direction:column;justify-content:center">${UI.scoreRing(j.balance_score ?? 0, 'توازن المزيج', 130)}</div>
      </div>
      <div class="card" style="margin-top:16px"><div class="table-scroll"><table class="data-table">
        <thead><tr><th>الفئة</th><th>عدد</th><th>النسبة</th><th>متوسط مشاهدات</th><th>الحكم</th><th>السبب</th></tr></thead><tbody>
        ${cats.map(c => `<tr><td>${UI.esc(c.name)}</td><td>${c.count}</td><td>${c.share_pct}%</td><td>${UI.num(c.avg_views)}</td><td><span class="badge ${c.verdict === 'زد' ? 'green' : c.verdict === 'قلل' ? 'red' : 'blue'}">${UI.esc(c.verdict)}</span></td><td>${UI.esc(c.why || '')}</td></tr>`).join('')}
      </tbody></table></div></div>
      ${(j.missing || []).length ? `<div class="card" style="margin-top:16px"><h3><i class="fa-solid fa-puzzle-piece"></i> فئات ناقصة</h3><ul class="md">${j.missing.map(m => `<li>${UI.esc(m)}</li>`).join('')}</ul></div>` : ''}
      <div class="card" style="margin-top:16px"><h3><i class="fa-solid fa-scale-balanced"></i> المزيج المثالى المقترح</h3><p>${UI.esc(j.recommendation || '')}</p></div>`;
    return {
      html,
      text: `توازن المزيج: ${j.balance_score}/100\n${cats.map(c => `${c.name}: ${c.share_pct}% (${c.verdict})`).join('\n')}\n\n${j.recommendation || ''}`,
      after() {
        UI.chart('mix-chart', {
          type: 'doughnut',
          data: { labels: cats.map(c => c.name), datasets: [{ data: cats.map(c => c.share_pct), backgroundColor: colors.slice(0, cats.length) }] },
          options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
        });
      }
    };
  }
},

/* -------- الأهداف والتخطيط -------- */

{
  id: 'goal-tracker', module: 'm9', icon: 'fa-bullseye',
  name: 'متتبع الأهداف', en: 'Goal Tracker',
  desc: 'تحديد أهداف رقمية (مشتركون/مشاهدات) وتتبع التقدم الفعلى نحوها مع تقدير موعد التحقق.',
  apis: ['yt'],
  fields: [
    F.channel(),
    F.select('action', 'ماذا تريد؟', ['عرض تقدم أهدافى', 'إضافة هدف جديد', 'حذف كل الأهداف'], 'عرض تقدم أهدافى'),
    F.select('metric', 'نوع الهدف (عند الإضافة)', ['مشتركون', 'إجمالي مشاهدات', 'عدد فيديوهات'], 'مشتركون'),
    F.text('target', 'الرقم المستهدف (عند الإضافة)', 'مثال: 100000'),
    F.text('deadline', 'الموعد المستهدف (اختيارى)', 'مثال: 2026-12-31')
  ],
  async run(vals, tool, progress) {
    if (vals.action === 'حذف كل الأهداف') {
      Store.goals.all().forEach(g => Store.goals.remove(g.id));
      return { text: 'تم حذف كل الأهداف', html: '<div class="notice blue"><i class="fa-solid fa-circle-check"></i> تم حذف كل الأهداف.</div>', skipInsight: true };
    }
    progress('جارِ تحميل أرقام القناة...');
    const b = await Ctx.channel(vals.channel, 5);
    const current = { 'مشتركون': b.summary.subscribers, 'إجمالي مشاهدات': b.summary.totalViews, 'عدد فيديوهات': b.summary.videoCount };
    if (vals.action === 'إضافة هدف جديد') {
      const target = parseInt((vals.target || '').replace(/[^\d]/g, ''), 10);
      if (!target) throw new Error('أدخل رقماً مستهدفاً صحيحاً');
      Store.goals.add({ metric: vals.metric, target, start: current[vals.metric], deadline: (vals.deadline || '').trim(), channel: b.id });
      UI.toast('تم حفظ الهدف ✓', 'success');
    }
    const goals = Store.goals.all();
    if (!goals.length) return { text: 'لا توجد أهداف', html: '<div class="empty-state"><i class="fa-solid fa-bullseye"></i><p>لا توجد أهداف بعد. اختر "إضافة هدف جديد" وحدد رقمك المستهدف.</p></div>', skipInsight: true };
    const cards = goals.map(g => {
      const cur = current[g.metric] ?? 0;
      const start = g.start ?? 0;
      const pct = g.target > start ? Math.max(0, Math.min(100, ((cur - start) / (g.target - start)) * 100)) : 100;
      // تقدير الموعد: معدل النمو منذ إنشاء الهدف
      const daysSince = Math.max(1, (Date.now() - g.date) / 86400000);
      const rate = (cur - start) / daysSince;
      const remaining = g.target - cur;
      const eta = rate > 0 && remaining > 0 ? Math.ceil(remaining / rate) : null;
      return `<div class="card">
        <h3><i class="fa-solid fa-bullseye"></i> ${UI.esc(g.metric)}: ${UI.num(g.target)}</h3>
        ${UI.bar(`التقدم — حالياً ${UI.num(cur)}`, pct)}
        <p class="sub">بدأت من ${UI.num(start)} فى ${UI.dateFmt(g.date)}${g.deadline ? ` | الموعد: ${UI.esc(g.deadline)}` : ''}
        ${eta ? ` | بالمعدل الحالى ستصل بعد ~${eta > 365 ? Math.round(eta / 365) + ' سنة' : eta + ' يوم'}` : remaining <= 0 ? ' | 🎉 تحقق الهدف!' : ' | المعدل الحالى غير كافٍ للتقدير'}</p>
        </div>`;
    }).join('');
    return { html: `<div class="grid cols-2">${cards}</div>`, text: goals.map(g => `${g.metric} → ${g.target} (حالياً ${current[g.metric]})`).join('\n'), skipInsight: true };
  }
},

{
  id: 'weekly-planner', module: 'm9', icon: 'fa-calendar-week',
  name: 'المخطط الأسبوعي الذكي', en: 'Smart Weekly Planner',
  desc: 'خطة عمل أسبوعية كاملة مبنية على وضع قناتك الحالى: ماذا تنشر، متى، وما مهام التحسين.',
  apis: ['yt', 'ai'],
  fields: [F.channel(), F.text('hours', 'كم ساعة متاحة أسبوعياً للقناة؟', 'مثال: 10', true)],
  run: Runners.channelAI((vals, ctx) =>
    `ابنِ لى خطة أسبوع كامل لقناتى. الوقت المتاح: ${vals.hours} ساعة أسبوعياً.
${ctx}

قدّم جدولاً يوماً بيوم (السبت→الجمعة): المهمة | المدة | النوع (تصوير/مونتاج/نشر/تفاعل/تحليل) | الأولوية.
ثم: 1) ما الفيديو الذى يجب نشره هذا الأسبوع (فكرة محددة بعنوان)، 2) أفضل يوم/ساعة للنشر بناءً على نمط القناة، 3) مهمة تحسين واحدة لفيديو قديم، 4) هدف رقمى واحد للأسبوع.`)
},

/* -------- المعرفة والذاكرة -------- */

{
  id: 'knowledge-base', module: 'm9', icon: 'fa-brain',
  name: 'قاعدة معرفة القناة', en: 'Channel Knowledge Base',
  desc: 'ذاكرة النظام الدائمة عن قناتك: الملف التعريفى، الجمهور، الأسلوب، القواعد — تُحقن تلقائياً فى كل الأدوات.',
  apis: [],
  fields: [
    F.area('profile', 'ملف القناة (من أنت وماذا تقدم)', 'مثال: قناة تعليم برمجة للمبتدئين بالعربى، أسلوب مبسط وعملى...'),
    F.area('audience', 'وصف الجمهور', 'مثال: شباب 18-30، مبتدئون فى البرمجة، يفضلون التطبيق العملى...'),
    F.area('style', 'أسلوب الكتابة والنبرة', 'مثال: عامية مصرية خفيفة، جمل قصيرة، بدون تكلف...'),
    F.area('rules', 'قواعد وخطوط حمراء', 'مثال: لا سياسة، لا مبالغة فى العناوين، دائماً مصادر...')
  ],
  async run(vals) {
    const k = Store.knowledge.get();
    ['profile', 'audience', 'style', 'rules'].forEach(f => { k[f] = (vals[f] || '').trim(); });
    Store.knowledge.save(k);
    const filled = ['profile', 'audience', 'style', 'rules'].filter(f => k[f]).length;
    const html = `
      <div class="notice blue"><i class="fa-solid fa-circle-check"></i> تم حفظ قاعدة المعرفة (${filled}/4 حقول) — ستُستخدم تلقائياً فى كل أدوات الذكاء الاصطناعي.</div>
      <div class="card" style="margin-top:16px"><h3><i class="fa-solid fa-brain"></i> المعرفة المحفوظة الآن</h3>
        <ul class="md">
          <li><strong>ملف القناة:</strong> ${UI.esc(k.profile || '— فارغ')}</li>
          <li><strong>الجمهور:</strong> ${UI.esc(k.audience || '— فارغ')}</li>
          <li><strong>الأسلوب:</strong> ${UI.esc(k.style || '— فارغ')}</li>
          <li><strong>القواعد:</strong> ${UI.esc(k.rules || '— فارغ')}</li>
          <li><strong>الأنماط الرابحة (تُحفظ آلياً من أداة "الأنماط الرابحة"):</strong> ${UI.esc(k.patterns || '— فارغ')}</li>
        </ul></div>`;
    return { html, text: 'تم حفظ قاعدة المعرفة', skipInsight: true };
  }
},

{
  id: 'insight-history', module: 'm9', icon: 'fa-lightbulb',
  name: 'سجل التوصيات', en: 'Insight History',
  desc: 'كل توصيات الذكاء الاصطناعي المحفوظة تلقائياً من كل الأدوات — راجعها وحدّث حالتها (نفذت/تجاهلت).',
  apis: [],
  fields: [F.select('filter', 'عرض', ['الكل', 'جديدة فقط', 'منفذة', 'متجاهلة'], 'الكل')],
  async run(vals) {
    let ins = Store.insights();
    const map = { 'جديدة فقط': 'new', 'منفذة': 'done', 'متجاهلة': 'ignored' };
    if (map[vals.filter]) ins = ins.filter(i => i.status === map[vals.filter]);
    if (!ins.length) return { text: 'لا توجد توصيات', html: '<div class="empty-state"><i class="fa-solid fa-lightbulb"></i><p>لا توجد توصيات محفوظة بعد — استخدم أدوات التحليل وستتجمع نتائجها هنا.</p></div>', skipInsight: true };
    const badge = s => s === 'done' ? '<span class="badge green">منفذة</span>' : s === 'ignored' ? '<span class="badge orange">متجاهلة</span>' : '<span class="badge blue">جديدة</span>';
    const wrapId = 'ins_' + Math.random().toString(36).slice(2, 8);
    setTimeout(() => {
      const wrap = document.getElementById(wrapId);
      if (!wrap) return;
      wrap.addEventListener('click', e => {
        const btn = e.target.closest('[data-ins-status]');
        if (!btn) return;
        Store.updateInsight(btn.dataset.insId, { status: btn.dataset.insStatus });
        UI.toast('تم التحديث ✓', 'success', 1500);
        const item = btn.closest('.card');
        const b = item?.querySelector('.ins-badge');
        if (b) b.innerHTML = badge(btn.dataset.insStatus);
      });
    }, 0);
    const html = `<div id="${wrapId}">
      ${ins.slice(0, 50).map(i => `
        <div class="card" style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center">
            <h3 style="margin:0"><i class="fa-solid fa-lightbulb"></i> ${UI.esc(i.title || i.tool)} <small class="sub">(${UI.dateFmt(i.date)})</small></h3>
            <span class="ins-badge">${badge(i.status)}</span>
          </div>
          <p class="sub" style="margin-top:8px">${UI.esc(i.text.slice(0, 400))}${i.text.length > 400 ? '...' : ''}</p>
          <div class="actions-bar">
            <button class="btn btn-secondary btn-sm" data-ins-id="${i.id}" data-ins-status="done"><i class="fa-solid fa-check"></i> نفذتها</button>
            <button class="btn btn-secondary btn-sm" data-ins-id="${i.id}" data-ins-status="ignored"><i class="fa-solid fa-ban"></i> تجاهل</button>
            <button class="btn btn-secondary btn-sm" data-ins-id="${i.id}" data-ins-status="new"><i class="fa-solid fa-rotate-left"></i> جديدة</button>
          </div>
        </div>`).join('')}</div>`;
    return { html, text: ins.slice(0, 50).map(i => `[${i.status}] ${i.title || i.tool}: ${i.text.slice(0, 100)}`).join('\n'), skipInsight: true };
  }
},

{
  id: 'recommendation-tracker', module: 'm9', icon: 'fa-clipboard-check',
  name: 'متتبع أثر التوصيات', en: 'Recommendation Impact Tracker',
  desc: 'هل نصائح الذكاء الاصطناعي تعمل فعلاً؟ يقارن أداء قناتك قبل وبعد تنفيذ التوصيات المعلّمة "منفذة".',
  apis: ['yt', 'ai'],
  fields: [F.channel()],
  async run(vals, tool, progress) {
    const done = Store.insights().filter(i => i.status === 'done');
    if (!done.length) throw new Error('لا توجد توصيات معلّمة "منفذة" بعد — علّم توصياتك المنفذة من أداة "سجل التوصيات" أولاً.');
    progress('جارِ تحميل بيانات القناة...');
    const b = await Ctx.channel(vals.channel, 50);
    progress('جارِ قياس الأثر...');
    const text = await Gemini.generate(
      `المستخدم نفذ هذه التوصيات (مع تواريخ التنفيذ التقريبية):
${done.slice(0, 15).map(i => `- [${UI.dateFmt(i.date)}] من ${i.tool}: ${i.text.slice(0, 250)}`).join('\n')}

بيانات القناة الحالية (بتواريخ النشر والمشاهدات):
${Ctx.channelText(b, 45)}

حلل: 1) قارن أداء الفيديوهات قبل وبعد تواريخ التوصيات المنفذة، 2) أى توصية يبدو أنها أحدثت أثراً فعلياً؟ (كن صادقاً — قد لا يظهر أثر)، 3) درجة "فعالية الاستشارة" 0-100 بتبرير، 4) ماذا ينفذ بعد ذلك من التوصيات المتبقية؟` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id });
    return { text, html: UI.md(text) };
  }
},

{
  id: 'confidence-manager', module: 'm9', icon: 'fa-shield-halved',
  name: 'مدير الثقة والتحقق', en: 'Confidence Manager',
  desc: 'تقييم موثوقية أى تحليل أو توصية: ما مدى كفاية البيانات؟ وما احتمال الخطأ؟ ومتى تثق بالنتيجة؟',
  apis: ['ai'],
  fields: [F.area('claim', 'الصق التحليل أو التوصية المراد تقييمها', 'الصق نتيجة أى أداة أو استنتاج تريد التحقق من موثوقيته...', true), F.text('context', 'سياق إضافى (حجم القناة، عمر البيانات...)', 'مثال: قناة 5000 مشترك، البيانات من آخر 30 يوماً')],
  async run(vals, tool, progress) {
    progress('جارِ تقييم الموثوقية...');
    const j = await Gemini.generateJSON(
      `قيّم موثوقية هذا التحليل/التوصية كمُراجع علمى متشكك. أعد JSON فقط:
{"confidence": 0-100, "verdict": "موثوق/موثوق جزئياً/غير موثوق", "data_sufficiency": 0-100, "biases": ["انحيازات محتملة فى الاستنتاج"], "weak_points": ["نقاط الضعف المنطقية"], "validation_steps": ["كيف تتحقق قبل التنفيذ"], "safe_action": "الإجراء الآمن المقترح"}

التحليل: ${vals.claim}
السياق: ${vals.context || 'غير محدد'}`,
      { system: SYS_PROMPT, tool: tool.id });
    const html = `
      <div class="grid cols-3">
        <div class="card" style="text-align:center">${UI.scoreRing(j.confidence ?? 0, 'درجة الثقة')}</div>
        <div class="card" style="text-align:center">${UI.scoreRing(j.data_sufficiency ?? 0, 'كفاية البيانات')}</div>
        ${UI.statCard('fa-gavel', UI.esc(j.verdict || '-'), 'الحكم', (j.confidence ?? 0) >= 70 ? 's-green' : (j.confidence ?? 0) >= 45 ? 's-orange' : 's-red')}
      </div>
      <div class="grid cols-2" style="margin-top:16px">
        <div class="card"><h3 style="color:var(--orange)"><i class="fa-solid fa-eye-low-vision"></i> انحيازات محتملة</h3><ul class="md">${(j.biases || []).map(x => `<li>${UI.esc(x)}</li>`).join('')}</ul></div>
        <div class="card"><h3 style="color:var(--red)"><i class="fa-solid fa-bug"></i> نقاط ضعف</h3><ul class="md">${(j.weak_points || []).map(x => `<li>${UI.esc(x)}</li>`).join('')}</ul></div>
      </div>
      <div class="card" style="margin-top:16px"><h3><i class="fa-solid fa-list-check"></i> خطوات التحقق قبل التنفيذ</h3><ol class="md">${(j.validation_steps || []).map(x => `<li>${UI.esc(x)}</li>`).join('')}</ol>
        <div class="notice blue" style="margin-top:10px"><i class="fa-solid fa-shield-halved"></i> الإجراء الآمن: ${UI.esc(j.safe_action || '')}</div></div>`;
    return { html, text: `الثقة: ${j.confidence}/100 (${j.verdict})\nنقاط ضعف:\n${(j.weak_points || []).map(x => '- ' + x).join('\n')}\nالإجراء الآمن: ${j.safe_action}` };
  }
},

{
  id: 'data-quality', module: 'm9', icon: 'fa-database',
  name: 'فاحص جودة البيانات', en: 'Data Quality Checker',
  desc: 'فحص اكتمال وجودة بيانات النظام: الإعدادات، المفاتيح، قاعدة المعرفة، والبيانات المفقودة التى تُضعف التحليلات.',
  apis: [],
  fields: [],
  async run() {
    const s = Store.settings();
    const k = Store.knowledge.get();
    const checks = [
      { name: 'مفتاح Gemini API', ok: !!s.geminiKey, why: 'كل أدوات الذكاء الاصطناعي معطلة بدونه', fix: 'أضفه من الإعدادات' },
      { name: 'مفتاح YouTube Data API', ok: !!s.ytKey, why: 'كل أدوات جلب بيانات يوتيوب معطلة بدونه', fix: 'أضفه من الإعدادات' },
      { name: 'OAuth Client ID (اختيارى)', ok: !!s.oauthClientId, why: 'بدونه لا تعمل بيانات Analytics الخاصة (CTR، وقت المشاهدة، الإيرادات)', fix: 'أنشئ OAuth Client من Google Cloud Console' },
      { name: 'معرف قناتك', ok: !!s.channelId, why: 'ستضطر لكتابته يدوياً فى كل أداة', fix: 'احفظه فى الإعدادات' },
      { name: 'النيتش', ok: !!s.niche, why: 'تحليلات أدق عندما يعرف النظام مجالك', fix: 'أضفه فى الإعدادات' },
      { name: 'قنوات المنافسين', ok: !!s.competitors, why: 'أدوات المنافسين ستطلبها كل مرة', fix: 'أضفها فى الإعدادات' },
      { name: 'ملف القناة (قاعدة المعرفة)', ok: !!k.profile, why: 'يحسّن تخصيص كل النتائج', fix: 'أداة "قاعدة معرفة القناة"' },
      { name: 'وصف الجمهور', ok: !!k.audience, why: 'يحسّن ملاءمة الأفكار والعناوين', fix: 'أداة "قاعدة معرفة القناة"' },
      { name: 'أسلوب الكتابة', ok: !!k.style, why: 'يجعل النصوص المولدة بنبرة قناتك', fix: 'أداة "قاعدة معرفة القناة"' },
      { name: 'الأنماط الرابحة', ok: !!k.patterns, why: 'توجه كل الاقتراحات نحو ما ينجح فعلاً', fix: 'أداة "الأنماط الرابحة" (m8)' }
    ];
    const okCount = checks.filter(c => c.ok).length;
    const score = Math.round(okCount / checks.length * 100);
    const html = `
      <div class="grid cols-3">
        <div class="card" style="text-align:center">${UI.scoreRing(score, 'اكتمال البيانات')}</div>
        ${UI.statCard('fa-circle-check', okCount, 'عناصر مكتملة', 's-green')}
        ${UI.statCard('fa-circle-xmark', checks.length - okCount, 'عناصر ناقصة', checks.length - okCount ? 's-red' : 's-green')}
      </div>
      <div class="card" style="margin-top:16px"><div class="table-scroll"><table class="data-table">
        <thead><tr><th>العنصر</th><th>الحالة</th><th>الأثر</th><th>الحل</th></tr></thead><tbody>
        ${checks.map(c => `<tr><td>${UI.esc(c.name)}</td><td>${c.ok ? '<span class="badge green">✓ موجود</span>' : '<span class="badge red">✗ ناقص</span>'}</td><td>${UI.esc(c.why)}</td><td>${UI.esc(c.fix)}</td></tr>`).join('')}
      </tbody></table></div></div>`;
    return { html, text: `اكتمال البيانات: ${score}%\n${checks.map(c => `${c.ok ? '✓' : '✗'} ${c.name}`).join('\n')}`, skipInsight: true };
  }
},

/* -------- إدارة النظام -------- */

{
  id: 'quota-monitor', module: 'm9', icon: 'fa-gauge',
  name: 'مراقب استهلاك API', en: 'API Quota Monitor',
  desc: 'متابعة استهلاكك اليومى من طلبات YouTube وGemini، وأكثر الأدوات استهلاكاً، ونصائح توفير الكوتا.',
  apis: [],
  fields: [],
  async run() {
    const q = Store.quota();
    const tools = Object.entries(q.tools || {}).sort((a, z) => z[1] - a[1]).slice(0, 15);
    const maxT = Math.max(...tools.map(t => t[1]), 1);
    const html = `
      <div class="grid cols-3">
        ${UI.statCard('fa-brands fa-youtube', q.yt || 0, 'طلبات YouTube API اليوم', 's-red')}
        ${UI.statCard('fa-wand-magic-sparkles', q.gemini || 0, 'طلبات Gemini اليوم', 's-purple')}
        ${UI.statCard('fa-calendar-day', q.day, 'اليوم', 's-blue')}
      </div>
      ${tools.length ? `<div class="card" style="margin-top:16px"><h3><i class="fa-solid fa-ranking-star"></i> الأكثر استهلاكاً اليوم</h3>
        ${tools.map(([name, n]) => UI.bar(name, n / maxT * 100)).join('')}</div>` : '<div class="empty-state" style="margin-top:16px"><i class="fa-solid fa-gauge"></i><p>لا يوجد استهلاك مسجل اليوم</p></div>'}
      <div class="card" style="margin-top:16px"><h3><i class="fa-solid fa-piggy-bank"></i> نصائح توفير الكوتا</h3>
        <ul class="md">
          <li>كوتا YouTube Data API المجانية = 10,000 وحدة/يوم — طلبات البحث (search) تكلف 100 وحدة، بينما جلب التفاصيل يكلف 1.</li>
          <li>النظام يستخدم كاشاً ذكياً تلقائياً (10-60 دقيقة) لتقليل الطلبات المكررة — لا تمسح الكاش بلا داعٍ.</li>
          <li>قلل أدوات "البحث فى النيتش" المتكررة فى نفس اليوم، ووسّع استخدام أدوات القناة (أرخص بكثير).</li>
          <li>Gemini المجانى له حدود دقيقة/يوم حسب النموذج — النظام يتنقل بين النماذج تلقائياً عند الضغط.</li>
        </ul></div>`;
    return { html, text: `اليوم ${q.day}: YouTube ${q.yt || 0} طلب، Gemini ${q.gemini || 0} طلب`, skipInsight: true };
  }
},

{
  id: 'cache-manager', module: 'm9', icon: 'fa-hard-drive',
  name: 'مدير الكاش', en: 'Cache Manager',
  desc: 'عرض حجم الكاش المحلى (البيانات المؤقتة) ومسحه للحصول على بيانات طازجة من يوتيوب.',
  apis: [],
  fields: [],
  async run() {
    const st = Store.cacheStats();
    const btnId = 'cc_' + Math.random().toString(36).slice(2, 8);
    const html = `
      <div class="grid cols-2">
        ${UI.statCard('fa-box-archive', st.count, 'عنصر مخزّن مؤقتاً', 's-blue')}
        ${UI.statCard('fa-weight-hanging', st.kb + ' KB', 'الحجم التقريبى', 's-orange')}
      </div>
      <div class="card" style="margin-top:16px">
        <h3><i class="fa-solid fa-hard-drive"></i> ما هو الكاش؟</h3>
        <p class="sub">يحفظ النظام استجابات يوتيوب مؤقتاً (10-60 دقيقة) لتسريع الأدوات وتوفير الكوتا. امسحه فقط إن أردت أرقاماً لحظية طازجة.</p>
        <div class="actions-bar"><button class="btn btn-danger" id="${btnId}"><i class="fa-solid fa-trash"></i> مسح الكاش الآن</button></div>
      </div>`;
    return {
      html, text: `الكاش: ${st.count} عنصر (${st.kb} KB)`, skipInsight: true,
      after() {
        document.getElementById(btnId)?.addEventListener('click', () => {
          Store.cacheClear();
          UI.toast('تم مسح الكاش ✓', 'success');
          document.location.hash = '#/tool/cache-manager';
        });
      }
    };
  }
},

{
  id: 'rule-builder', module: 'm9', icon: 'fa-scroll',
  name: 'بانى قواعد المحتوى', en: 'Content Rule Builder',
  desc: 'تحويل مبادئك إلى قواعد صارمة يلتزم بها الذكاء الاصطناعي فى كل أداة، مع صياغة احترافية آلية.',
  apis: ['ai'],
  fields: [
    F.select('action', 'ماذا تريد؟', ['عرض قواعدى', 'إضافة قاعدة جديدة', 'حذف كل القواعد'], 'عرض قواعدى'),
    F.area('rule', 'القاعدة الجديدة (عند الإضافة)', 'مثال: ممنوع العناوين المبالغ فيها التى لا يطابقها المحتوى')
  ],
  async run(vals, tool, progress) {
    if (vals.action === 'حذف كل القواعد') {
      Store.rules.all().forEach(r => Store.rules.remove(r.id));
      const k = Store.knowledge.get(); k.rules = ''; Store.knowledge.save(k);
      return { text: 'تم حذف كل القواعد', html: '<div class="notice blue"><i class="fa-solid fa-circle-check"></i> تم حذف كل القواعد.</div>', skipInsight: true };
    }
    if (vals.action === 'إضافة قاعدة جديدة') {
      if (!vals.rule?.trim()) throw new Error('اكتب نص القاعدة أولاً');
      progress('جارِ صياغة القاعدة...');
      const j = await Gemini.generateJSON(
        `حوّل هذه القاعدة إلى صياغة احترافية موجزة قابلة للحقن فى تعليمات AI، وأعد JSON فقط:
{"rule": "الصياغة النهائية بجملة واحدة واضحة", "category": "عناوين/محتوى/أسلوب/أخلاقيات/أخرى"}
القاعدة الخام: ${vals.rule}`,
        { system: SYS_PROMPT, tool: tool.id });
      Store.rules.add({ text: j.rule || vals.rule.trim(), category: j.category || 'أخرى' });
      // تحديث قاعدة المعرفة لتُحقن تلقائياً
      const k = Store.knowledge.get();
      k.rules = Store.rules.all().map(r => r.text).join(' | ');
      Store.knowledge.save(k);
      UI.toast('تم حفظ القاعدة وربطها بكل الأدوات ✓', 'success');
    }
    const rules = Store.rules.all();
    if (!rules.length) return { text: 'لا توجد قواعد', html: '<div class="empty-state"><i class="fa-solid fa-scroll"></i><p>لا توجد قواعد بعد. أضف أول قاعدة وسيلتزم بها الذكاء الاصطناعي فى كل الأدوات.</p></div>', skipInsight: true };
    const html = `
      <div class="notice blue"><i class="fa-solid fa-link"></i> هذه القواعد تُحقن تلقائياً فى تعليمات كل أدوات الذكاء الاصطناعي.</div>
      <div class="card" style="margin-top:16px"><h3><i class="fa-solid fa-scroll"></i> قواعدى (${rules.length})</h3>
        <div class="table-scroll"><table class="data-table"><thead><tr><th>القاعدة</th><th>التصنيف</th><th>أضيفت</th></tr></thead><tbody>
        ${rules.map(r => `<tr><td>${UI.esc(r.text)}</td><td><span class="badge purple">${UI.esc(r.category)}</span></td><td>${UI.dateFmt(r.date)}</td></tr>`).join('')}
        </tbody></table></div></div>`;
    return { html, text: rules.map(r => `[${r.category}] ${r.text}`).join('\n'), skipInsight: true };
  }
},

{
  id: 'approval-queue', module: 'm9', icon: 'fa-clipboard-list',
  name: 'قائمة انتظار الموافقات', en: 'Approval Queue',
  desc: 'احفظ مسودات (عناوين/أوصاف/أفكار) فى قائمة مراجعة، ووافق أو ارفض قبل الاستخدام الفعلى.',
  apis: [],
  fields: [
    F.select('action', 'ماذا تريد؟', ['عرض القائمة', 'إضافة عنصر للمراجعة'], 'عرض القائمة'),
    F.select('type', 'نوع العنصر (عند الإضافة)', ['عنوان', 'وصف', 'فكرة فيديو', 'ثمبنيل (وصف)', 'أخرى'], 'عنوان'),
    F.area('content', 'المحتوى (عند الإضافة)', 'الصق العنوان/الوصف/الفكرة هنا...')
  ],
  async run(vals) {
    if (vals.action === 'إضافة عنصر للمراجعة') {
      if (!vals.content?.trim()) throw new Error('اكتب المحتوى أولاً');
      Store.approvals.add({ type: vals.type, content: vals.content.trim(), status: 'pending' });
      UI.toast('أضيف لقائمة المراجعة ✓', 'success');
    }
    const items = Store.approvals.all();
    if (!items.length) return { text: 'القائمة فارغة', html: '<div class="empty-state"><i class="fa-solid fa-clipboard-list"></i><p>قائمة الموافقات فارغة. أضف مسودات لمراجعتها قبل النشر.</p></div>', skipInsight: true };
    const badge = s => s === 'approved' ? '<span class="badge green">موافَق</span>' : s === 'rejected' ? '<span class="badge red">مرفوض</span>' : '<span class="badge orange">قيد المراجعة</span>';
    const wrapId = 'apq_' + Math.random().toString(36).slice(2, 8);
    setTimeout(() => {
      const wrap = document.getElementById(wrapId);
      if (!wrap) return;
      wrap.addEventListener('click', e => {
        const btn = e.target.closest('[data-ap-status]');
        if (btn) {
          Store.approvals.update(btn.dataset.apId, { status: btn.dataset.apStatus });
          UI.toast('تم التحديث ✓', 'success', 1500);
          const b = btn.closest('.card')?.querySelector('.ap-badge');
          if (b) b.innerHTML = badge(btn.dataset.apStatus);
          return;
        }
        const del = e.target.closest('[data-ap-del]');
        if (del) {
          Store.approvals.remove(del.dataset.apDel);
          del.closest('.card')?.remove();
          UI.toast('تم الحذف', 'info', 1500);
        }
      });
    }, 0);
    const html = `<div id="${wrapId}">
      ${items.map(it => `
        <div class="card" style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center">
            <h3 style="margin:0"><span class="badge blue">${UI.esc(it.type)}</span> <small class="sub">${UI.dateFmt(it.date)}</small></h3>
            <span class="ap-badge">${badge(it.status)}</span>
          </div>
          <p style="margin-top:8px">${UI.esc(it.content)}</p>
          <div class="actions-bar">
            <button class="btn btn-secondary btn-sm" data-ap-id="${it.id}" data-ap-status="approved"><i class="fa-solid fa-check"></i> موافقة</button>
            <button class="btn btn-secondary btn-sm" data-ap-id="${it.id}" data-ap-status="rejected"><i class="fa-solid fa-xmark"></i> رفض</button>
            <button class="btn btn-danger btn-sm" data-ap-del="${it.id}"><i class="fa-solid fa-trash"></i> حذف</button>
          </div>
        </div>`).join('')}</div>`;
    return { html, text: items.map(it => `[${it.status}] ${it.type}: ${it.content.slice(0, 80)}`).join('\n'), skipInsight: true };
  }
},

{
  id: 'audit-log', module: 'm9', icon: 'fa-file-shield',
  name: 'سجل النشاط', en: 'Audit Log',
  desc: 'سجل زمنى كامل لكل عملية نفذها النظام: أى أداة، متى، ونجحت أم فشلت — شفافية كاملة.',
  apis: [],
  fields: [F.select('filter', 'عرض', ['الكل', 'الناجحة فقط', 'الفاشلة فقط'], 'الكل')],
  async run(vals) {
    let log = Store.audit();
    if (vals.filter === 'الناجحة فقط') log = log.filter(l => l.status === 'ok');
    if (vals.filter === 'الفاشلة فقط') log = log.filter(l => l.status !== 'ok');
    if (!log.length) return { text: 'السجل فارغ', html: '<div class="empty-state"><i class="fa-solid fa-file-shield"></i><p>لا يوجد نشاط مسجل بعد.</p></div>', skipInsight: true };
    const ok = Store.audit().filter(l => l.status === 'ok').length;
    const fail = Store.audit().length - ok;
    const html = `
      <div class="grid cols-3">
        ${UI.statCard('fa-list', Store.audit().length, 'إجمالي العمليات', 's-blue')}
        ${UI.statCard('fa-circle-check', ok, 'ناجحة', 's-green')}
        ${UI.statCard('fa-circle-xmark', fail, 'فاشلة', fail ? 's-red' : 's-green')}
      </div>
      <div class="card" style="margin-top:16px"><div class="table-scroll"><table class="data-table">
        <thead><tr><th>الوقت</th><th>الأداة</th><th>العملية</th><th>الحالة</th></tr></thead><tbody>
        ${log.slice(0, 100).map(l => `<tr><td>${new Date(l.date).toLocaleString('ar-EG')}</td><td>${UI.esc(l.tool)}</td><td>${UI.esc(l.action)}</td><td>${l.status === 'ok' ? '<span class="badge green">نجحت</span>' : `<span class="badge red">${UI.esc(l.status)}</span>`}</td></tr>`).join('')}
      </tbody></table></div></div>`;
    return { html, text: log.slice(0, 100).map(l => `[${new Date(l.date).toLocaleString('ar-EG')}] ${l.tool} — ${l.action} (${l.status})`).join('\n'), skipInsight: true };
  }
},

/* -------- مساحات العمل الذكية -------- */

{
  id: 'ai-workspace', module: 'm9', icon: 'fa-layer-group',
  name: 'مساحة عمل الفيديو الشاملة', en: 'All-in-One Video Workspace',
  desc: 'من فكرة واحدة: عنوان + وصف + وسوم + هوك + مخطط + فكرة ثمبنيل + Short مرافق — حزمة كاملة بضغطة.',
  apis: ['ai'],
  fields: [F.topic('فكرة الفيديو'), F.niche(), F.lang()],
  async run(vals, tool, progress) {
    progress('جارِ إنتاج الحزمة الكاملة...');
    const j = await Gemini.generateJSON(
      `أنتج حزمة نشر كاملة لفيديو يوتيوب باللغة "${vals.lang}" وأعد JSON فقط:
{"titles": ["3 عناوين قوية"], "description": "وصف كامل 150+ كلمة بالهاشتاجات", "tags": ["15-20 وسماً"], "hook": "هوك أول 15 ثانية (نص حرفى)", "outline": ["مخطط الفيديو 6-10 نقاط"], "thumbnail_idea": "وصف ثمبنيل مفصل (العناصر، النص، الألوان)", "thumbnail_text": "النص على الثمبنيل (3 كلمات كحد أقصى)", "short_idea": "فكرة Short مرافق يروج للفيديو", "pinned_comment": "تعليق مثبت يشجع التفاعل", "community_post": "بوست مجتمع للترويج"}

الفكرة: ${vals.topic}
النيتش: ${vals.niche}` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id });
    const html = `
      ${UI.copyList(j.titles || [], '🏷️ العناوين')}
      <div class="card" style="margin-top:16px"><h3><i class="fa-solid fa-align-right"></i> الوصف</h3><p style="white-space:pre-wrap">${UI.esc(j.description || '')}</p>
        <div class="actions-bar"><button class="btn btn-secondary btn-sm" data-copy-text="${UI.esc(j.description || '')}" onclick="UI.copy(this.dataset.copyText)"><i class="fa-regular fa-copy"></i> نسخ الوصف</button></div></div>
      <div class="card" style="margin-top:16px"><h3><i class="fa-solid fa-tags"></i> الوسوم</h3><p>${(j.tags || []).map(t => `<span class="badge blue" style="margin:2px">${UI.esc(t)}</span>`).join(' ')}</p>
        <div class="actions-bar"><button class="btn btn-secondary btn-sm" data-copy-text="${UI.esc((j.tags || []).join(', '))}" onclick="UI.copy(this.dataset.copyText)"><i class="fa-regular fa-copy"></i> نسخ الوسوم</button></div></div>
      <div class="grid cols-2" style="margin-top:16px">
        <div class="card"><h3><i class="fa-solid fa-bolt"></i> الهوك (أول 15 ثانية)</h3><p>${UI.esc(j.hook || '')}</p></div>
        <div class="card"><h3><i class="fa-solid fa-image"></i> الثمبنيل</h3><p>${UI.esc(j.thumbnail_idea || '')}</p><p><strong>النص:</strong> <span class="badge red">${UI.esc(j.thumbnail_text || '')}</span></p></div>
      </div>
      <div class="card" style="margin-top:16px"><h3><i class="fa-solid fa-list-ol"></i> مخطط الفيديو</h3><ol class="md">${(j.outline || []).map(x => `<li>${UI.esc(x)}</li>`).join('')}</ol></div>
      <div class="grid cols-3" style="margin-top:16px">
        <div class="card"><h3><i class="fa-solid fa-bolt-lightning"></i> Short مرافق</h3><p class="sub">${UI.esc(j.short_idea || '')}</p></div>
        <div class="card"><h3><i class="fa-solid fa-thumbtack"></i> تعليق مثبت</h3><p class="sub">${UI.esc(j.pinned_comment || '')}</p></div>
        <div class="card"><h3><i class="fa-solid fa-users"></i> بوست مجتمع</h3><p class="sub">${UI.esc(j.community_post || '')}</p></div>
      </div>`;
    const text = `العناوين:\n${(j.titles || []).map(t => '- ' + t).join('\n')}\n\nالوصف:\n${j.description}\n\nالوسوم: ${(j.tags || []).join(', ')}\n\nالهوك: ${j.hook}\n\nالمخطط:\n${(j.outline || []).map((x, i) => (i + 1) + '. ' + x).join('\n')}\n\nالثمبنيل: ${j.thumbnail_idea} — النص: ${j.thumbnail_text}\n\nShort: ${j.short_idea}\n\nتعليق مثبت: ${j.pinned_comment}\n\nبوست: ${j.community_post}`;
    return { html, text };
  }
},

{
  id: 'channel-audit', module: 'm9', icon: 'fa-stethoscope',
  name: 'الفحص الشامل للقناة', en: 'Full Channel Audit',
  desc: 'أعمق فحص فى المنصة: هوية، محتوى، SEO، نمو، جمهور، Shorts — تقرير استشارى متكامل بدرجات.',
  apis: ['yt', 'an', 'ai'],
  fields: [F.channel()],
  async run(vals, tool, progress) {
    progress('جارِ تحميل بيانات القناة كاملة...');
    const b = await Ctx.channel(vals.channel, 50);
    progress('جارِ جلب Analytics إن أمكن...');
    const an = await Ctx.analyticsText({
      startDate: YTA.daysAgo(90), endDate: YTA.daysAgo(0),
      metrics: 'views,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost'
    }, 'آخر 90 يوماً');
    progress('جارِ إجراء الفحص الشامل (قد يستغرق دقيقة)...');
    const j = await Gemini.generateJSON(
      `أجرِ فحصاً استشارياً شاملاً لهذه القناة وأعد JSON فقط:
{"overall": 0-100, "sections": [{"name": "الهوية والتموضع", "score": 0-100, "found": "ما وجدته", "fix": "أهم إصلاح"}, {"name": "استراتيجية المحتوى", ...}, {"name": "العناوين والـSEO", ...}, {"name": "وتيرة النشر والانتظام", ...}, {"name": "التفاعل والجمهور", ...}, {"name": "الـShorts", ...}, {"name": "مسار النمو", ...}], "top_strengths": ["3 نقاط قوة"], "top_risks": ["3 مخاطر"], "priority_plan": ["7 خطوات مرتبة بالأولوية للـ90 يوماً القادمة"], "executive_summary": "ملخص تنفيذى 4 أسطر"}

بيانات القناة:
${Ctx.channelText(b, 50)}
${an}` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id, maxTokens: 8192 });
    const secs = j.sections || [];
    const html = `
      <div class="grid cols-2">
        <div class="card" style="text-align:center;display:flex;flex-direction:column;justify-content:center">${UI.scoreRing(j.overall ?? 0, 'الدرجة الكلية', 150)}</div>
        <div class="card"><h3><i class="fa-solid fa-file-lines"></i> الملخص التنفيذى</h3><p>${UI.esc(j.executive_summary || '')}</p></div>
      </div>
      <div class="card" style="margin-top:16px"><h3><i class="fa-solid fa-list-check"></i> درجات الأقسام</h3>
        ${secs.map(s => UI.bar(s.name, s.score ?? 0)).join('')}</div>
      <div class="card" style="margin-top:16px"><div class="table-scroll"><table class="data-table">
        <thead><tr><th>القسم</th><th>الدرجة</th><th>ما وجدناه</th><th>أهم إصلاح</th></tr></thead><tbody>
        ${secs.map(s => `<tr><td>${UI.esc(s.name)}</td><td><span class="badge ${(s.score ?? 0) >= 70 ? 'green' : (s.score ?? 0) >= 45 ? 'orange' : 'red'}">${s.score}</span></td><td>${UI.esc(s.found || '')}</td><td>${UI.esc(s.fix || '')}</td></tr>`).join('')}
      </tbody></table></div></div>
      <div class="grid cols-2" style="margin-top:16px">
        <div class="card"><h3 style="color:var(--green)"><i class="fa-solid fa-shield"></i> نقاط القوة</h3><ul class="md">${(j.top_strengths || []).map(x => `<li>${UI.esc(x)}</li>`).join('')}</ul></div>
        <div class="card"><h3 style="color:var(--red)"><i class="fa-solid fa-triangle-exclamation"></i> المخاطر</h3><ul class="md">${(j.top_risks || []).map(x => `<li>${UI.esc(x)}</li>`).join('')}</ul></div>
      </div>
      <div class="card" style="margin-top:16px"><h3><i class="fa-solid fa-road"></i> خطة الأولويات (90 يوماً)</h3><ol class="md">${(j.priority_plan || []).map(x => `<li>${UI.esc(x)}</li>`).join('')}</ol></div>`;
    const text = `الفحص الشامل: ${j.overall}/100\n\n${j.executive_summary}\n\nالأقسام:\n${secs.map(s => `- ${s.name}: ${s.score}/100 — ${s.fix}`).join('\n')}\n\nالخطة:\n${(j.priority_plan || []).map((x, i) => (i + 1) + '. ' + x).join('\n')}`;
    return { html, text };
  }
},

{
  id: 'daily-briefing', module: 'm9', icon: 'fa-mug-hot',
  name: 'الإحاطة اليومية', en: 'Daily Briefing',
  desc: 'ملخص صباحى ذكى: وضع قناتك اليوم، ماذا تغير، أهم مهمة واحدة، وتوصية جاهزة للتنفيذ.',
  apis: ['yt', 'ai'],
  fields: [F.channel()],
  async run(vals, tool, progress) {
    progress('جارِ تجهيز إحاطة اليوم...');
    Store.cacheClear();
    const b = await Ctx.channel(vals.channel, 25);
    const key = 'brief_' + b.id;
    const prev = Store.get(key);
    const now = { t: Date.now(), subs: b.summary.subscribers, views: b.summary.totalViews, vids: b.summary.videoCount };
    Store.set(key, now);
    let diffText = 'أول إحاطة — لا توجد بيانات مقارنة سابقة.';
    if (prev) {
      const days = ((now.t - prev.t) / 86400000).toFixed(1);
      diffText = `منذ آخر إحاطة (قبل ${days} يوم): مشتركون ${now.subs - prev.subs >= 0 ? '+' : ''}${now.subs - prev.subs} | مشاهدات +${now.views - prev.views} | فيديوهات جديدة: ${now.vids - prev.vids}`;
    }
    const pendingIns = Store.insights().filter(i => i.status === 'new').slice(0, 5);
    const goals = Store.goals.all().slice(0, 3);
    const text = await Gemini.generate(
      `اكتب "الإحاطة اليومية" لصاحب القناة بأسلوب مباشر وودود (مثل مساعد شخصى):
${Ctx.channelText(b, 20)}

التغير منذ آخر إحاطة: ${diffText}
${goals.length ? `أهدافه الحالية: ${goals.map(g => `${g.metric} → ${g.target}`).join('، ')}` : ''}
${pendingIns.length ? `توصيات معلقة لم ينفذها: ${pendingIns.map(i => i.title || i.tool).join('، ')}` : ''}

الشكل المطلوب:
☀️ **صباح الخير!** — سطر عن حالة القناة العامة
📊 **الأرقام اليوم** — أهم 3 أرقام مع التغير
🔥 **ما يستحق انتباهك** — أهم ملاحظة واحدة من البيانات
✅ **مهمة اليوم** — مهمة واحدة محددة قابلة للإنجاز اليوم
💡 **فكرة اليوم** — فكرة فيديو واحدة جاهزة بعنوان مقترح` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id });
    return { text, html: UI.md(text) };
  }
},

{
  id: 'ai-copilot', module: 'm9', icon: 'fa-robot',
  name: 'المساعد الشخصي Copilot', en: 'AI Copilot',
  desc: 'محادثة حرة مع مساعد يعرف قناتك وقاعدة معرفتك وسجل توصياتك — اسأل أى شىء ونفذ معه خطوة بخطوة.',
  apis: ['ai', 'yt'],
  chat: {
    starter: 'أهلاً بك! أنا Copilot مساعدك الشخصى 🤖 أعرف قاعدة معرفة قناتك وسجل توصياتك. اسألنى أى شىء: استراتيجية، أفكار، مراجعة قرار، أو حتى "ماذا أفعل اليوم؟"',
    system: '\nأنت الآن "Copilot" المساعد الشخصى: أجب بإيجاز عملى، اقترح الخطوة التالية دائماً، واستخدم معرفة القناة المحفوظة فى كل إجابة.',
    useChannel: true
  }
}

]);
