/* ============================================================
   engine.js — محرك تشغيل الأدوات
   يبنى صفحة الأداة من تعريفها، يجمع المدخلات، يشغّل run()،
   يعرض النتيجة، يحفظ السجل والتوصيات، ويدير وضع المحادثة (chat)
   ============================================================ */
'use strict';

const Engine = (() => {

  /* ---------- بناء صفحة أداة ---------- */
  function renderTool(toolId) {
    const tool = Tools.get(toolId);
    const content = document.getElementById('content');
    if (!tool) {
      content.innerHTML = '<div class="empty-state"><i class="fa-solid fa-circle-question"></i><p>الأداة غير موجودة</p></div>';
      return;
    }
    const mod = MODULES.find(m => m.id === tool.module);

    // وضع المحادثة
    if (tool.chat) { renderChatTool(tool, mod); return; }

    const s = Store.settings();
    const fieldsHtml = (tool.fields || []).map(f => fieldHtml(f, s)).join('');
    content.innerHTML = `
      <section class="tool-page">
        <header class="tool-header">
          <div class="t-icon big"><i class="fa-solid ${tool.icon}"></i></div>
          <div>
            <h1>${UI.esc(tool.name)} <small class="sub">${UI.esc(tool.en || '')}</small></h1>
            <p class="sub">${UI.esc(tool.desc)}</p>
            <div class="badges">${apiBadges(tool.apis)}</div>
          </div>
        </header>
        ${keysNotice(tool)}
        <form id="tool-form" class="card tool-form" novalidate>
          ${fieldsHtml || '<p class="sub">هذه الأداة لا تحتاج مدخلات — اضغط تشغيل مباشرة.</p>'}
          <div class="actions-bar">
            <button type="submit" class="btn btn-primary" id="run-btn"><i class="fa-solid fa-play"></i> تشغيل الأداة</button>
          </div>
        </form>
        <div id="tool-progress" hidden></div>
        <div id="tool-result"></div>
      </section>`;

    bindImageFields(tool);
    document.getElementById('tool-form').addEventListener('submit', e => {
      e.preventDefault();
      runTool(tool);
    });
  }

  /* ---------- HTML حقل إدخال ---------- */
  function fieldHtml(f, settings) {
    const preset = f.fromSettings && settings[f.fromSettings] ? settings[f.fromSettings] : (f.def ?? '');
    const req = f.required ? ' <span style="color:var(--red)">*</span>' : '';
    const base = `data-field="${f.k}"`;
    if (f.type === 'select') {
      return `<label class="field"><span>${UI.esc(f.label)}${req}</span>
        <select ${base}>${(f.opts || []).map(o => `<option${o === preset ? ' selected' : ''}>${UI.esc(o)}</option>`).join('')}</select></label>`;
    }
    if (f.type === 'textarea') {
      return `<label class="field"><span>${UI.esc(f.label)}${req}</span>
        <textarea ${base} rows="3" placeholder="${UI.esc(f.ph || '')}">${UI.esc(preset)}</textarea></label>`;
    }
    if (f.type === 'image') {
      return `<div class="field"><span>${UI.esc(f.label)}${req}</span>
        <div class="dropzone" data-image-field="${f.k}"><i class="fa-solid fa-cloud-arrow-up"></i><p>اضغط أو اسحب صورة هنا (حتى 8MB)</p></div></div>`;
    }
    return `<label class="field"><span>${UI.esc(f.label)}${req}</span>
      <input type="text" ${base} value="${UI.esc(preset)}" placeholder="${UI.esc(f.ph || '')}"></label>`;
  }

  /* ---------- ربط حقول الصور ---------- */
  const imageValues = {};
  function bindImageFields(tool) {
    Object.keys(imageValues).forEach(k => delete imageValues[k]);
    document.querySelectorAll('[data-image-field]').forEach(zone => {
      UI.bindDropzone(zone, img => { imageValues[zone.dataset.imageField] = img; });
    });
  }

  /* ---------- شارات API ---------- */
  function apiBadges(apis = []) {
    const map = {
      yt: '<span class="badge red"><i class="fa-brands fa-youtube"></i> YouTube API</span>',
      ai: '<span class="badge purple"><i class="fa-solid fa-wand-magic-sparkles"></i> Gemini AI</span>',
      an: '<span class="badge blue"><i class="fa-solid fa-chart-line"></i> Analytics (اختيارى)</span>'
    };
    return apis.map(a => map[a] || '').join(' ');
  }

  /* ---------- تنبيه المفاتيح الناقصة ---------- */
  function keysNotice(tool) {
    const s = Store.settings();
    const missing = [];
    if ((tool.apis || []).includes('ai') && !s.geminiKey) missing.push('مفتاح Gemini API');
    if ((tool.apis || []).includes('yt') && !s.ytKey) missing.push('مفتاح YouTube Data API');
    if (!missing.length) return '';
    return `<div class="notice orange"><i class="fa-solid fa-key"></i> هذه الأداة تحتاج: <strong>${missing.join(' + ')}</strong> — <a href="#/settings">أضفه من الإعدادات</a></div>`;
  }

  /* ---------- جمع قيم النموذج ---------- */
  function collectValues(tool) {
    const vals = {};
    document.querySelectorAll('#tool-form [data-field]').forEach(el => {
      vals[el.dataset.field] = el.value.trim();
    });
    Object.assign(vals, imageValues);
    // تحقق من الحقول المطلوبة
    for (const f of (tool.fields || [])) {
      if (f.required && f.type !== 'image' && !vals[f.k]) {
        throw new Error(`حقل "${f.label}" مطلوب`);
      }
      if (f.required && f.type === 'image' && !vals[f.k]) {
        throw new Error('ارفع الصورة المطلوبة أولاً');
      }
    }
    return vals;
  }

  /* ---------- تشغيل أداة ---------- */
  async function runTool(tool) {
    const btn = document.getElementById('run-btn');
    const progEl = document.getElementById('tool-progress');
    const resEl = document.getElementById('tool-result');
    let vals;
    try { vals = collectValues(tool); }
    catch (e) { UI.toast(e.message, 'warning'); return; }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جارِ التشغيل...';
    progEl.hidden = false;
    resEl.innerHTML = '';
    const progress = msg => { progEl.innerHTML = UI.inlineLoader(msg); };
    progress('جارِ البدء...');

    try {
      const out = await tool.run(vals, tool, progress);
      progEl.hidden = true;

      // عرض النتيجة + شريط تصدير
      const exportBar = out.text ? UI.exportBar(() => tool.name, () => out.text) : '';
      resEl.innerHTML = `<div class="result-wrap">${out.html || UI.md(out.text || '')}${exportBar}</div>`;
      if (typeof out.after === 'function') { try { out.after(); } catch (e) { console.warn(e); } }

      // حفظ فى السجل + التوصيات + سجل النشاط
      if (out.text) {
        Store.addHistory({ tool: tool.id, title: tool.name, text: out.text.slice(0, 6000) });
        if (!out.skipInsight) Store.addInsight(tool.name, tool.name, out.text);
      }
      Store.addAudit(tool.name, 'تشغيل الأداة', 'ok');
      UI.toast('اكتمل التحليل ✓', 'success');
      resEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      progEl.hidden = true;
      Store.addAudit(tool.name, 'تشغيل الأداة', 'فشل: ' + err.message.slice(0, 80));
      resEl.innerHTML = errorHtml(err);
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-play"></i> تشغيل الأداة';
    }
  }

  /* ---------- عرض الأخطاء بشكل مفيد ---------- */
  function errorHtml(err) {
    let msg = err.message || 'خطأ غير معروف';
    let hint = '';
    if (err.code === 'NO_KEY' || msg === 'NO_KEY') {
      msg = 'مفتاح Gemini API غير موجود';
      hint = 'أضف المفتاح من <a href="#/settings">الإعدادات</a>. يمكنك الحصول على مفتاح مجانى من <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Google AI Studio</a>.';
    } else if (err.code === 'NO_OPENAI_KEY' || msg === 'NO_OPENAI_KEY') {
      msg = 'مفتاح OpenAI API غير موجود';
      hint = 'اخترت نموذج GPT فى أوركسترا النماذج لكن مفتاح OpenAI غير مضاف. أضفه من <a href="#/settings">الإعدادات</a> أو اختر نموذج Gemini بدلاً منه.';
    } else if (err.code === 'NO_YT_KEY' || msg === 'NO_YT_KEY') {
      msg = 'مفتاح YouTube Data API غير موجود';
      hint = 'أضف المفتاح من <a href="#/settings">الإعدادات</a>. أنشئه من <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener">Google Cloud Console</a> بعد تفعيل YouTube Data API v3.';
    } else if (/quota/i.test(msg)) {
      hint = 'يبدو أن حصة API نفدت لليوم. جرّب لاحقاً أو راجع أداة "مراقب استهلاك API".';
    } else if (/API key not valid|invalid/i.test(msg)) {
      hint = 'تأكد من صحة المفتاح فى <a href="#/settings">الإعدادات</a> ومن تفعيل الخدمة فى Google Cloud.';
    }
    return `<div class="notice red"><i class="fa-solid fa-circle-xmark"></i> <strong>${UI.esc(msg)}</strong>${hint ? `<p style="margin-top:6px">${hint}</p>` : ''}</div>`;
  }

  /* ============================================================
     وضع المحادثة (Chat Tools) — المدرب الذكي / Copilot
     ============================================================ */
  function renderChatTool(tool, mod) {
    const content = document.getElementById('content');
    const chatKey = 'chat_' + tool.id;
    const saved = Store.get(chatKey, []);
    content.innerHTML = `
      <section class="tool-page">
        <header class="tool-header">
          <div class="t-icon big"><i class="fa-solid ${tool.icon}"></i></div>
          <div>
            <h1>${UI.esc(tool.name)} <small class="sub">${UI.esc(tool.en || '')}</small></h1>
            <p class="sub">${UI.esc(tool.desc)}</p>
            <div class="badges">${apiBadges(tool.apis)}</div>
          </div>
        </header>
        ${keysNotice(tool)}
        <div class="card chat-box">
          <div id="chat-messages" class="chat-messages"></div>
          <form id="chat-form" class="chat-input-row">
            <textarea id="chat-input" rows="1" placeholder="اكتب رسالتك... (Enter للإرسال)"></textarea>
            <button type="submit" class="btn btn-primary" id="chat-send" aria-label="إرسال"><i class="fa-solid fa-paper-plane"></i></button>
            <button type="button" class="btn btn-secondary" id="chat-clear" title="مسح المحادثة"><i class="fa-solid fa-trash"></i></button>
          </form>
        </div>
      </section>`;

    const msgsEl = document.getElementById('chat-messages');
    const input = document.getElementById('chat-input');
    const history = [...saved]; // [{role:'user'|'model', text}]

    function draw() {
      const items = history.length ? history : [{ role: 'model', text: tool.chat.starter }];
      msgsEl.innerHTML = items.map(m => `
        <div class="chat-msg ${m.role === 'user' ? 'user' : 'bot'}">
          <div class="avatar"><i class="fa-solid ${m.role === 'user' ? 'fa-user' : tool.icon}"></i></div>
          <div class="bubble">${m.role === 'user' ? UI.esc(m.text).replace(/\n/g, '<br>') : UI.md(m.text)}</div>
        </div>`).join('');
      msgsEl.scrollTop = msgsEl.scrollHeight;
    }
    draw();

    async function send(text) {
      history.push({ role: 'user', text });
      draw();
      msgsEl.insertAdjacentHTML('beforeend', `<div class="chat-msg bot" id="chat-typing"><div class="avatar"><i class="fa-solid ${tool.icon}"></i></div><div class="bubble">${UI.inlineLoader('يفكر...')}</div></div>`);
      msgsEl.scrollTop = msgsEl.scrollHeight;
      try {
        // سياق القناة عند أول رسالة إن أمكن
        let channelCtx = '';
        if (tool.chat.useChannel && Store.settings().channelId && !send._ctxLoaded) {
          try {
            const b = await Ctx.channel(Store.settings().channelId, 25);
            channelCtx = '\n--- بيانات قناة المستخدم ---\n' + Ctx.channelText(b, 25);
            send._ctxLoaded = channelCtx;
          } catch {}
        } else if (send._ctxLoaded) channelCtx = send._ctxLoaded;

        const convo = history.slice(-14).map(m => `${m.role === 'user' ? 'المستخدم' : 'أنت'}: ${m.text}`).join('\n\n');
        const insights = Store.insights().slice(0, 5).map(i => `- من ${i.tool}: ${i.text.slice(0, 150)}`).join('\n');
        const prompt = `هذه محادثة جارية مع المستخدم. أكمل الرد على آخر رسالة فقط.
${channelCtx}
${insights ? '\n--- آخر توصيات النظام للمستخدم ---\n' + insights : ''}
${Ctx.kb()}
--- المحادثة ---
${convo}

ردك (مباشرة بدون تمهيد):`;
        const reply = await Gemini.generate(prompt, { system: SYS_PROMPT + (tool.chat.system || ''), tool: tool.id });
        history.push({ role: 'model', text: reply });
        Store.set(chatKey, history.slice(-40));
        Store.addAudit(tool.name, 'رسالة محادثة', 'ok');
      } catch (err) {
        document.getElementById('chat-typing')?.remove();
        msgsEl.insertAdjacentHTML('beforeend', `<div class="chat-msg bot"><div class="avatar"><i class="fa-solid fa-triangle-exclamation"></i></div><div class="bubble">${errorHtml(err)}</div></div>`);
        Store.addAudit(tool.name, 'رسالة محادثة', 'فشل');
        return;
      }
      draw();
    }

    document.getElementById('chat-form').addEventListener('submit', e => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      input.style.height = 'auto';
      send(text);
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        document.getElementById('chat-form').requestSubmit();
      }
    });
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(140, input.scrollHeight) + 'px';
    });
    document.getElementById('chat-clear').addEventListener('click', () => {
      history.length = 0;
      Store.remove(chatKey);
      send._ctxLoaded = null;
      draw();
      UI.toast('تم مسح المحادثة', 'info', 1500);
    });
  }

  return { renderTool };
})();
