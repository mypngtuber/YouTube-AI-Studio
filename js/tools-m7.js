/* ============================================================
   tools-m7.js — Module 7: Community Manager & SEO Center (16)
   ============================================================ */
'use strict';

Tools.registerAll([

{
  id: 'smart-comment-manager', module: 'm7', icon: 'fa-comments',
  name: 'مدير التعليقات الذكي', en: 'Smart Comment Manager',
  desc: 'تصنيف تعليقات أى فيديو تلقائياً: أسئلة، مدح، نقد، سبام، وأفكار محتوى — مع أولويات الرد.',
  apis: ['yt', 'ai'],
  fields: [F.video()],
  run: Runners.commentsAI((vals, ctx) =>
    `صنّف وأدر هذه التعليقات كمدير مجتمع محترف:
${ctx}

قدّم:
1) توزيع التعليقات: أسئلة / مدح / نقد بنّاء / نقد هدام / سبام / أفكار محتوى (نسب مئوية)
2) أهم 5 تعليقات تستحق الرد فوراً (مع سبب الأولوية ومسودة رد لكل واحد)
3) الأسئلة المتكررة التى تستحق فيديو
4) تعليقات يجب تثبيتها أو عمل قلب لها
5) تعليقات يُنصح بإخفائها/تجاهلها`)
},

{
  id: 'sentiment-analyzer', module: 'm7', icon: 'fa-face-smile',
  name: 'محلل المشاعر', en: 'Sentiment Analyzer',
  desc: 'قياس مشاعر الجمهور تجاه فيديو: إيجابى/سلبى/محايد، المواضيع المثيرة للجدل، ومؤشر الرضا.',
  apis: ['yt', 'ai'],
  fields: [F.video()],
  async run(vals, tool, progress) {
    progress('جارِ تحميل التعليقات...');
    const c = await Ctx.comments(vals.video, 80);
    if (!c.list.length) throw new Error('لا توجد تعليقات على هذا الفيديو');
    progress(`جارِ تحليل مشاعر ${c.list.length} تعليق...`);
    const j = await Gemini.generateJSON(
      `حلل مشاعر هذه التعليقات وأعد JSON فقط:
{"positive": نسبة%, "negative": نسبة%, "neutral": نسبة%, "satisfaction": 0-100, "emotions": [{"name": "عاطفة", "pct": نسبة}], "hot_topics": ["مواضيع مثيرة للنقاش"], "praise_points": ["ما يمدحه الجمهور"], "pain_points": ["ما يشتكى منه"], "summary": "خلاصة فى 3 أسطر"}

${c.text}` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id });
    const html = `
      <div class="grid cols-4">
        ${UI.statCard('fa-face-laugh', j.positive + '%', 'إيجابي', 's-green')}
        ${UI.statCard('fa-face-frown', j.negative + '%', 'سلبي', 's-red')}
        ${UI.statCard('fa-face-meh', j.neutral + '%', 'محايد', 's-blue')}
        <div class="card" style="text-align:center">${UI.scoreRing(j.satisfaction, 'مؤشر الرضا', 100)}</div>
      </div>
      <div class="card" style="margin-top:18px"><h3><i class="fa-solid fa-heart-pulse"></i> العواطف السائدة</h3>
        ${(j.emotions || []).map(e => UI.bar(e.name, e.pct)).join('')}</div>
      <div class="grid cols-2" style="margin-top:18px">
        <div class="card"><h3 style="color:var(--green)"><i class="fa-solid fa-thumbs-up"></i> نقاط المدح</h3><ul class="md">${(j.praise_points || []).map(p => `<li>${UI.esc(p)}</li>`).join('')}</ul></div>
        <div class="card"><h3 style="color:var(--red)"><i class="fa-solid fa-triangle-exclamation"></i> نقاط الألم</h3><ul class="md">${(j.pain_points || []).map(p => `<li>${UI.esc(p)}</li>`).join('')}</ul></div>
      </div>
      <div class="card" style="margin-top:18px"><h3><i class="fa-solid fa-fire"></i> مواضيع ساخنة</h3><ul class="md">${(j.hot_topics || []).map(t => `<li>${UI.esc(t)}</li>`).join('')}</ul>
      <p class="sub" style="margin-top:10px">${UI.esc(j.summary || '')}</p></div>`;
    const text = `إيجابى ${j.positive}% | سلبى ${j.negative}% | محايد ${j.neutral}% | رضا ${j.satisfaction}/100\n\nمدح:\n${(j.praise_points || []).map(p => '- ' + p).join('\n')}\n\nألم:\n${(j.pain_points || []).map(p => '- ' + p).join('\n')}\n\n${j.summary}`;
    return { html, text };
  }
},

{
  id: 'smart-reply', module: 'm7', icon: 'fa-reply-all',
  name: 'الرد الذكي', en: 'Smart Reply Generator',
  desc: 'صياغة ردود احترافية على أى تعليق: شكر، سؤال، نقد، أو هجوم — بعدة نبرات جاهزة.',
  apis: ['ai'],
  fields: [
    F.area('comment', 'التعليق المراد الرد عليه', 'الصق التعليق هنا...', true),
    F.select('tone', 'نبرة الرد', ['ودّية دافئة', 'احترافية رسمية', 'مرحة خفيفة', 'دبلوماسية (للنقد)'], 'ودّية دافئة')
  ],
  run: Runners.ai(vals =>
    `اكتب ردوداً على تعليق اليوتيوب التالى بنبرة "${vals.tone}":
"${vals.comment}"

قدّم: 1) تشخيص نوع التعليق ونية كاتبه، 2) 3 ردود مقترحة بأطوال مختلفة (قصير/متوسط/مفصل)، 3) رد "يحوّل الموقف لصالحك" (يشجع التفاعل أو يحول الناقد لمعجب)، 4) ما يجب تجنبه فى الرد على هذا النوع.`)
},

{
  id: 'faq-builder', module: 'm7', icon: 'fa-circle-question',
  name: 'بانى الأسئلة الشائعة', en: 'FAQ Builder',
  desc: 'استخراج الأسئلة المتكررة من تعليقات فيديوهاتك وبناء بنك إجابات + أفكار فيديوهات منها.',
  apis: ['yt', 'ai'],
  fields: [F.video()],
  run: Runners.commentsAI((vals, ctx) =>
    `استخرج الأسئلة الشائعة من هذه التعليقات وابنِ منها FAQ:
${ctx}

قدّم:
1) قائمة الأسئلة المتكررة مرتبة حسب التكرار
2) إجابة نموذجية جاهزة للنسخ لكل سؤال (مختصرة ومفيدة)
3) الأسئلة التى تستحق فيديو كامل (مع عنوان مقترح)
4) سؤال يصلح تثبيته كتعليق مثبت مع إجابته
5) اقتراح فقرة FAQ لوصف الفيديو`)
},

{
  id: 'community-post', module: 'm7', icon: 'fa-bullhorn',
  name: 'منشورات المجتمع', en: 'Community Post Generator',
  desc: 'منشورات تبويب المجتمع الجاهزة: إعلان فيديو، استطلاع، سؤال تفاعلى، كواليس، واحتفال.',
  apis: ['ai'],
  fields: [F.topic('موضوع المنشور أو الفيديو المرتبط'), F.lang()],
  async run(vals, tool, progress) {
    progress('جارِ كتابة المنشورات...');
    const j = await Gemini.generateJSON(
      `اكتب منشورات تبويب المجتمع (Community) ليوتيوب حول "${vals.topic}" باللغة "${vals.lang}". أعد JSON فقط:
{"announce": "منشور إعلان عن فيديو جديد (تشويقى)",
"poll": {"question": "سؤال استطلاع", "options": ["4 خيارات"]},
"question": "منشور سؤال تفاعلى يشعل التعليقات",
"behind": "منشور كواليس شخصى",
"celebrate": "منشور احتفال بإنجاز",
"teaser": "منشور تشويق لمحتوى قادم"}` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id });
    const block = (title, icon, content) => `
      <div class="card"><h3><i class="fa-solid ${icon}"></i> ${title}</h3>
        <div class="copy-item"><span style="white-space:pre-wrap">${UI.esc(content || '')}</span>
        <button class="btn btn-secondary btn-sm" data-copy><i class="fa-regular fa-copy"></i></button></div></div>`;
    const html = `
      <div class="grid cols-2">
        ${block('إعلان فيديو', 'fa-video', j.announce)}
        ${block('سؤال تفاعلي', 'fa-circle-question', j.question)}
        ${block('كواليس', 'fa-camera', j.behind)}
        ${block('احتفال', 'fa-party-horn', j.celebrate)}
        ${block('تشويق', 'fa-hourglass-half', j.teaser)}
        <div class="card"><h3><i class="fa-solid fa-square-poll-vertical"></i> استطلاع</h3>
          <div class="copy-item"><span><strong>${UI.esc(j.poll?.question || '')}</strong><br>${(j.poll?.options || []).map(o => '◻ ' + UI.esc(o)).join('<br>')}</span>
          <button class="btn btn-secondary btn-sm" data-copy><i class="fa-regular fa-copy"></i></button></div></div>
      </div>`;
    const text = `إعلان:\n${j.announce}\n\nاستطلاع: ${j.poll?.question}\n${(j.poll?.options || []).join('\n')}\n\nسؤال:\n${j.question}\n\nكواليس:\n${j.behind}\n\nاحتفال:\n${j.celebrate}\n\nتشويق:\n${j.teaser}`;
    return { html, text };
  }
},

{
  id: 'poll-generator', module: 'm7', icon: 'fa-square-poll-vertical',
  name: 'مولد الاستطلاعات', en: 'Poll Generator',
  desc: 'استطلاعات ذكية لتبويب المجتمع تجمع بيانات مفيدة عن جمهورك وتغذى قرارات المحتوى.',
  apis: ['ai'],
  fields: [F.niche(), F.select('goal', 'هدف الاستطلاع', ['اختيار موضوع الفيديو القادم', 'فهم الجمهور', 'قياس رضا', 'زيادة تفاعل', 'اختبار فكرة منتج'], 'اختيار موضوع الفيديو القادم')],
  run: Runners.ai(vals =>
    `صمّم 6 استطلاعات لتبويب مجتمع يوتيوب لقناة فى نيتش "${vals.niche}". الهدف: ${vals.goal}.

لكل استطلاع: السؤال + 2-4 خيارات + ماذا سيخبرنى كل خيار عن جمهورى + كيف أستخدم النتيجة فى قرارات المحتوى.
رتّبها حسب قيمة البيانات التى ستجمعها، واقترح توقيت نشر كل واحد.`)
},

{
  id: 'engagement-prompt', module: 'm7', icon: 'fa-hand-point-up',
  name: 'محفزات التفاعل', en: 'Engagement Prompts',
  desc: 'أسئلة وعبارات تفاعلية تُقال فى الفيديو أو تُكتب فى الوصف لمضاعفة التعليقات.',
  apis: ['ai'],
  fields: [F.topic('موضوع الفيديو')],
  run: Runners.ai(vals =>
    `اكتب محفزات تفاعل لفيديو عن "${vals.topic}":

1) 8 أسئلة تُطرح داخل الفيديو تدفع للتعليق (محددة وسهلة الإجابة — ليست "ما رأيكم؟")
2) 4 عبارات "علّق بكلمة واحدة" (مثل: علّق بـ✅ لو جربتها)
3) 3 تحديات صغيرة للجمهور
4) سؤال مثالى للتعليق المثبت
5) عبارة نهاية الفيديو التى تربط التفاعل بالفيديو القادم
اشرح لماذا يعمل كل نوع نفسياً.`)
},

{
  id: 'superfan-finder', module: 'm7', icon: 'fa-crown',
  name: 'كاشف المعجبين الأوفياء', en: 'Superfan Finder',
  desc: 'تحديد أكثر المتفاعلين ولاءً فى تعليقاتك وخطة تحويلهم إلى سفراء لقناتك.',
  apis: ['yt', 'ai'],
  fields: [F.video()],
  run: Runners.commentsAI((vals, ctx) =>
    `حلل هذه التعليقات لاكتشاف المعجبين الأوفياء (Superfans):
${ctx}

قدّم:
1) قائمة أبرز المتفاعلين إيجابياً (الاسم + لماذا يبدو معجباً وفياً)
2) كيف أكافئهم؟ (رد مميز، قلب، تثبيت، ذكر فى فيديو)
3) خطة "تحويل المعجب لسفير": 5 خطوات عملية
4) مسودات ردود شخصية دافئة لأفضل 3 تعليقات منهم`, 100)
},

{
  id: 'feedback-summarizer', module: 'm7', icon: 'fa-clipboard-list',
  name: 'ملخص آراء الجمهور', en: 'Feedback Summarizer',
  desc: 'تلخيص كل ملاحظات الجمهور من التعليقات فى تقرير: ماذا يريدون أكثر وماذا يزعجهم.',
  apis: ['yt', 'ai'],
  fields: [F.video()],
  run: Runners.commentsAI((vals, ctx) =>
    `لخّص آراء الجمهور من هذه التعليقات فى تقرير Feedback منظم:
${ctx}

قدّم:
1) ملخص تنفيذى (3 أسطر)
2) ماذا يحب الجمهور؟ (مرتب بالتكرار)
3) ماذا يريدون أكثر/يطلبونه؟
4) ماذا يزعجهم أو ينتقدونه؟
5) اقتراحات الجمهور الذكية التى تستحق التنفيذ
6) 3 قرارات محتوى يجب اتخاذها بناءً على هذا الـFeedback`, 100)
},

{
  id: 'livechat-analyzer', module: 'm7', icon: 'fa-tower-cell',
  name: 'محلل البث المباشر', en: 'Live Stream Analyzer',
  desc: 'تحليل أداء بثوثك المباشرة السابقة: الحضور، التفاعل، وأفكار لتحسين البثوث القادمة.',
  apis: ['yt', 'ai'],
  fields: [F.channel()],
  async run(vals, tool, progress) {
    progress('جارِ البحث عن بثوث القناة...');
    const id = await YT.resolveChannel(vals.channel || Store.settings().channelId);
    const res = await YT.request('search', { part: 'snippet', channelId: id, type: 'video', eventType: 'completed', maxResults: 15, order: 'date' }, 60);
    const ids = (res.items || []).map(i => i.id.videoId).filter(Boolean);
    if (!ids.length) throw new Error('لم يتم العثور على بثوث مباشرة مكتملة فى هذه القناة');
    const vids = (await YT.videosByIds(ids)).map(YT.summarizeVideo);

    progress('جارِ تحليل البثوث...');
    const text = await Gemini.generate(
      `حلل أداء البثوث المباشرة السابقة لقناتى:
${vids.map(v => `- "${v.title}" | ${v.views} مشاهدة | ${v.likes} إعجاب | ${v.comments} تعليق | مدة ${Math.round(v.durationSec / 60)} دقيقة | ${v.published}`).join('\n')}

قدّم: 1) تقييم أداء البثوث (الأنجح والأضعف ولماذا)، 2) المدة المثالية الملاحظة، 3) المواضيع الأنجح للبث، 4) 5 تحسينات للبثوث القادمة (عنوان، توقيت، تفاعل، بنية)، 5) أفكار 3 بثوث قادمة بعناوين جاهزة.` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id });
    const html = `
      <div class="card"><h3><i class="fa-solid fa-tower-cell"></i> البثوث السابقة (${vids.length})</h3>
        <div class="table-scroll"><table class="data-table"><thead><tr><th>العنوان</th><th>مشاهدات</th><th>تعليقات</th><th>مدة</th><th>التاريخ</th></tr></thead><tbody>
        ${vids.map(v => `<tr><td>${UI.esc(v.title)}</td><td>${UI.num(v.views)}</td><td>${UI.num(v.comments)}</td><td>${Math.round(v.durationSec / 60)}د</td><td>${v.published}</td></tr>`).join('')}
        </tbody></table></div></div>
      <div class="card" style="margin-top:18px"><h3><i class="fa-solid fa-wand-magic-sparkles"></i> التحليل والتوصيات</h3>${UI.md(text)}</div>`;
    return { html, text };
  }
},

{
  id: 'seo-audit', module: 'm7', icon: 'fa-stethoscope',
  name: 'فحص SEO للقناة', en: 'Channel SEO Audit',
  desc: 'فحص SEO شامل لقناتك كلها: الوصف، الكلمات، العناوين، الوسوم — مع خطة إصلاح كاملة.',
  apis: ['yt', 'ai'],
  fields: [F.channel()],
  run: Runners.channelAI((vals, ctx, b) =>
    `اعمل فحص SEO شاملاً لقناتى:
${ctx}
وصف القناة الكامل: ${(b.info.snippet.description || 'فارغ!')}
كلمات القناة: ${b.info.brandingSettings?.channel?.keywords || 'غير محددة'}

قدّم:
1) درجة SEO إجمالية للقناة (0-100) مع التبرير
2) فحص وصف القناة وكلماتها (مشاكل + نسخة محسّنة جاهزة للنسخ)
3) أنماط العناوين: أين تضيع فرص الكلمات المفتاحية؟
4) تحليل تغطية الكلمات المفتاحية عبر الفيديوهات
5) خطة إصلاح SEO كاملة مرتبة بالأولوية (10 خطوات)`)
},

{
  id: 'keyword-cluster', module: 'm7', icon: 'fa-circle-nodes',
  name: 'عناقيد الكلمات', en: 'Keyword Clustering',
  desc: 'تنظيم كلماتك المفتاحية فى عناقيد موضوعية وبناء خريطة محتوى تسيطر على كل عنقود.',
  apis: ['ai'],
  fields: [F.keywords()],
  run: Runners.ai(vals =>
    `نظّم هذه الكلمات المفتاحية فى عناقيد (Clusters) موضوعية:
${vals.keywords}

قدّم:
1) العناقيد: كل عنقود باسمه + كلماته + نية البحث الغالبة
2) لكل عنقود: فيديو "العمود الفقرى" (Pillar) + 3 فيديوهات فرعية بعناوين جاهزة
3) خريطة الربط الداخلى: أى فيديو يشير لأى فيديو (بطاقات/شاشات نهاية)
4) ترتيب تنفيذ العناقيد حسب الفرصة
5) كلمات ناقصة يجب إضافتها لكل عنقود`)
},

{
  id: 'metadata-optimizer', module: 'm7', icon: 'fa-sliders',
  name: 'محسّن الميتاداتا الشامل', en: 'Metadata Optimizer',
  desc: 'تحسين ميتاداتا فيديو كاملة دفعة واحدة: عنوان + وصف + وسوم محسّنة وجاهزة للنسخ.',
  apis: ['yt', 'ai'],
  fields: [F.video(), F.text('keyword', 'الكلمة المفتاحية المستهدفة (اختياري)', '')],
  async run(vals, tool, progress) {
    progress('جارِ تحميل الفيديو...');
    const v = await Ctx.video(vals.video);
    progress('جارِ تحسين الميتاداتا...');
    const j = await Gemini.generateJSON(
      `حسّن ميتاداتا هذا الفيديو بالكامل${vals.keyword ? ` مستهدفاً كلمة "${vals.keyword}"` : ''}. أعد JSON فقط:
{"title": "العنوان المحسّن", "title_alt": "عنوان بديل", "description": "الوصف الكامل المحسّن (200+ كلمة، أول سطرين حاسمان، مع CTA وهاشتاجات)", "tags": ["15-20 وسم محسّن"], "improvements": ["ملخص ما تم تحسينه ولماذا"]}

الميتاداتا الحالية:
${v.text}` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id, maxTokens: 8192 });
    const html = `
      <div class="card"><h3><i class="fa-solid fa-heading"></i> العنوان المحسّن</h3>${UI.copyList([j.title || '', j.title_alt || ''])}</div>
      <div class="card" style="margin-top:18px"><h3><i class="fa-solid fa-align-right"></i> الوصف المحسّن</h3>
        <div class="copy-item"><span style="white-space:pre-wrap">${UI.esc(j.description || '')}</span>
        <button class="btn btn-secondary btn-sm" data-copy><i class="fa-regular fa-copy"></i></button></div></div>
      <div class="card" style="margin-top:18px"><h3><i class="fa-solid fa-tags"></i> الوسوم المحسّنة</h3>
        <div class="copy-item"><span>${UI.esc((j.tags || []).join(', '))}</span><button class="btn btn-primary btn-sm" data-copy><i class="fa-solid fa-copy"></i> نسخ الكل</button></div></div>
      <div class="card" style="margin-top:18px"><h3><i class="fa-solid fa-list-check"></i> ما تم تحسينه</h3><ul class="md">${(j.improvements || []).map(i => `<li>${UI.esc(i)}</li>`).join('')}</ul></div>`;
    const text = `العنوان: ${j.title}\nبديل: ${j.title_alt}\n\nالوصف:\n${j.description}\n\nالوسوم: ${(j.tags || []).join(', ')}`;
    return { html, text };
  }
},

{
  id: 'ranking-tracker', module: 'm7', icon: 'fa-arrow-up-9-1',
  name: 'متتبع الترتيب', en: 'Ranking Tracker',
  desc: 'فحص ترتيب فيديوهاتك فى نتائج بحث يوتيوب لكلمة معينة، ومن يتفوق عليك ولماذا.',
  apis: ['yt', 'ai'],
  fields: [F.text('keyword', 'الكلمة المفتاحية', 'مثال: شرح بايثون', true), F.channel()],
  async run(vals, tool, progress) {
    progress('جارِ فحص نتائج البحث...');
    const myId = await YT.resolveChannel(vals.channel || Store.settings().channelId);
    const res = await YT.search(vals.keyword, { maxResults: 25 });
    const items = res.items || [];
    const positions = items.map((i, idx) => ({
      rank: idx + 1, title: i.snippet.title, channel: i.snippet.channelTitle,
      mine: i.snippet.channelId === myId, videoId: i.id.videoId
    }));
    const myPositions = positions.filter(p => p.mine);

    progress('جارِ تحليل المنافسة على الكلمة...');
    const text = await Gemini.generate(
      `فحصت ترتيب نتائج بحث يوتيوب لكلمة "${vals.keyword}". ${myPositions.length ? `فيديوهاتى تظهر فى المراكز: ${myPositions.map(p => p.rank).join('، ')}` : 'قناتى لا تظهر فى أول 25 نتيجة!'}

النتائج:
${positions.slice(0, 20).map(p => `${p.rank}. "${p.title}" — ${p.channel}${p.mine ? ' ⭐(قناتى)' : ''}`).join('\n')}

قدّم: 1) تحليل من يسيطر على الكلمة وأنماط عناوينهم، 2) لماذا يتفوقون؟، 3) خطة الوصول للمراكز الخمسة الأولى (محتوى + ميتاداتا)، 4) كلمات مجاورة أسهل يمكن السيطرة عليها أولاً.` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id });

    const html = `
      ${myPositions.length
        ? `<div class="notice blue"><i class="fa-solid fa-circle-info"></i> فيديوهاتك تظهر فى المراكز: ${myPositions.map(p => `<strong>#${p.rank}</strong>`).join('، ')}</div>`
        : `<div class="notice"><i class="fa-solid fa-triangle-exclamation"></i> قناتك لا تظهر فى أول 25 نتيجة لهذه الكلمة</div>`}
      <div class="card" style="margin-top:18px"><h3><i class="fa-solid fa-list-ol"></i> نتائج "${UI.esc(vals.keyword)}"</h3>
        <div class="table-scroll"><table class="data-table"><thead><tr><th>#</th><th>العنوان</th><th>القناة</th></tr></thead><tbody>
        ${positions.slice(0, 20).map(p => `<tr${p.mine ? ' style="background:rgba(255,0,51,.06)"' : ''}><td>${p.rank}</td><td><a href="https://youtube.com/watch?v=${p.videoId}" target="_blank" rel="noopener">${UI.esc(p.title)}</a></td><td>${p.mine ? '⭐ ' : ''}${UI.esc(p.channel)}</td></tr>`).join('')}
        </tbody></table></div></div>
      <div class="card" style="margin-top:18px"><h3><i class="fa-solid fa-wand-magic-sparkles"></i> خطة الصعود</h3>${UI.md(text)}</div>`;
    return { html, text };
  }
},

{
  id: 'ab-title', module: 'm7', icon: 'fa-scale-balanced',
  name: 'اختبار A/B للعناوين', en: 'A/B Title Tester',
  desc: 'مقارنة عنوانين وجهاً لوجه: من يفوز، بأى نسبة ثقة، ولأى جمهور — قبل النشر.',
  apis: ['ai'],
  fields: [F.text('a', 'العنوان A', '', true), F.text('b', 'العنوان B', '', true), F.niche()],
  async run(vals, tool, progress) {
    progress('جارِ محاكاة اختبار A/B...');
    const j = await Gemini.generateJSON(
      `قارن عنوانى يوتيوب فى نيتش "${vals.niche}" كاختبار A/B وأعد JSON فقط:
{"winner": "A أو B", "confidence": 0-100, "score_a": 0-100, "score_b": 0-100,
"analysis_a": {"pros": ["..."], "cons": ["..."]},
"analysis_b": {"pros": ["..."], "cons": ["..."]},
"audience_split": "أى جمهور يفضل A وأى جمهور يفضل B",
"hybrid": "عنوان هجين يدمج أفضل ما فى الاثنين",
"verdict": "الحكم النهائى وسببه"}

العنوان A: "${vals.a}"
العنوان B: "${vals.b}"` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id });
    const winA = j.winner === 'A';
    const side = (label, score, an, isWin) => `
      <div class="card" style="${isWin ? 'border:2px solid var(--green)' : ''}">
        <h3>${isWin ? '🏆 ' : ''}العنوان ${label} <span class="badge ${isWin ? 'green' : 'blue'}">${score}/100</span></h3>
        <p><strong>${UI.esc(label === 'A' ? vals.a : vals.b)}</strong></p>
        <p style="color:var(--green)">✔ ${(an?.pros || []).map(UI.esc).join('<br>✔ ')}</p>
        <p style="color:var(--red)">✘ ${(an?.cons || []).map(UI.esc).join('<br>✘ ')}</p>
      </div>`;
    const html = `
      <div class="card" style="text-align:center">${UI.scoreRing(j.confidence, `الفائز: ${j.winner} — مستوى الثقة`, 140)}
        <p class="sub" style="margin-top:8px">${UI.esc(j.verdict || '')}</p></div>
      <div class="grid cols-2" style="margin-top:18px">
        ${side('A', j.score_a, j.analysis_a, winA)}
        ${side('B', j.score_b, j.analysis_b, !winA)}
      </div>
      <div class="card" style="margin-top:18px"><h3><i class="fa-solid fa-users"></i> انقسام الجمهور</h3><p>${UI.esc(j.audience_split || '')}</p></div>
      <div class="card" style="margin-top:18px"><h3><i class="fa-solid fa-dna"></i> العنوان الهجين</h3>${UI.copyList([j.hybrid || ''])}</div>`;
    const text = `الفائز: ${j.winner} (ثقة ${j.confidence}%)\nA: ${j.score_a} | B: ${j.score_b}\n${j.verdict}\nهجين: ${j.hybrid}`;
    return { html, text };
  }
},

{
  id: 'metadata-quality', module: 'm7', icon: 'fa-certificate',
  name: 'جودة ميتاداتا القناة', en: 'Metadata Quality Monitor',
  desc: 'فحص جودة ميتاداتا كل فيديوهاتك الأخيرة دفعة واحدة وكشف الفيديوهات المهملة.',
  apis: ['yt', 'ai'],
  fields: [F.channel()],
  async run(vals, tool, progress) {
    progress('جارِ فحص فيديوهات القناة...');
    const b = await Ctx.channel(vals.channel, 30);
    const checks = b.videos.map(v => {
      const descLen = (v.snippet.description || '').length;
      const tagCount = (v.snippet.tags || []).length;
      const titleLen = v.snippet.title.length;
      let score = 0;
      score += titleLen >= 20 && titleLen <= 70 ? 35 : 15;
      score += descLen >= 200 ? 35 : descLen >= 50 ? 20 : 5;
      score += tagCount >= 10 ? 30 : tagCount >= 5 ? 20 : tagCount >= 1 ? 10 : 0;
      return { title: v.snippet.title, titleLen, descLen, tagCount, score, views: +(v.statistics?.viewCount || 0) };
    }).sort((a, z) => a.score - z.score);
    const avg = Math.round(checks.reduce((a, c) => a + c.score, 0) / checks.length);

    progress('جارِ التحليل...');
    const text = await Gemini.generate(
      `فحصت جودة ميتاداتا آخر ${checks.length} فيديو فى قناتى (درجة من 100 حسب طول العنوان والوصف وعدد الوسوم). المتوسط: ${avg}.
الأسوأ:
${checks.slice(0, 10).map(c => `- "${c.title}" | درجة ${c.score} | وصف ${c.descLen} حرف | ${c.tagCount} وسم`).join('\n')}

قدّم: 1) تشخيص عام لانضباط الميتاداتا فى قناتى، 2) أهم 5 فيديوهات يجب إصلاح ميتاداتاها فوراً (خاصة ذات المشاهدات الجيدة)، 3) قالب ميتاداتا قياسى (Checklist) ألتزم به فى كل فيديو قادم.` + Ctx.kb(),
      { system: SYS_PROMPT, tool: tool.id });

    const html = `
      <div class="card" style="text-align:center">${UI.scoreRing(avg, 'متوسط جودة الميتاداتا', 140)}</div>
      <div class="card" style="margin-top:18px"><h3><i class="fa-solid fa-list"></i> الفيديوهات مرتبة من الأسوأ ميتاداتا</h3>
        <div class="table-scroll"><table class="data-table"><thead><tr><th>العنوان</th><th>الدرجة</th><th>طول الوصف</th><th>وسوم</th><th>مشاهدات</th></tr></thead><tbody>
        ${checks.map(c => `<tr><td>${UI.esc(c.title)}</td><td><span class="badge ${c.score >= 75 ? 'green' : c.score >= 50 ? 'orange' : 'red'}">${c.score}</span></td><td>${c.descLen}</td><td>${c.tagCount}</td><td>${UI.num(c.views)}</td></tr>`).join('')}
        </tbody></table></div></div>
      <div class="card" style="margin-top:18px"><h3><i class="fa-solid fa-wand-magic-sparkles"></i> خطة الإصلاح</h3>${UI.md(text)}</div>`;
    return { html, text };
  }
}

]);
