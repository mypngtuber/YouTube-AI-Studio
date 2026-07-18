/* ============================================================
   app.js — التطبيق الرئيسى: التوجيه، الشريط الجانبي،
   الصفحة الرئيسية، صفحات الوحدات، الإعدادات، السجل
   ============================================================ */
'use strict';

const App = (() => {

  const content = () => document.getElementById('content');
  const breadcrumb = () => document.getElementById('breadcrumb');

  /* ============ الشريط الجانبي ============ */
  function buildSidebar(filter = '') {
    const nav = document.getElementById('sidebar-nav');
    const q = filter.trim().toLowerCase();
    const currentHash = location.hash;
    let html = `
      <a class="nav-item single ${currentHash === '' || currentHash === '#/' ? 'active' : ''}" href="#/"><i class="fa-solid fa-house"></i> الرئيسية</a>
      <a class="nav-item single ${currentHash === '#/history' ? 'active' : ''}" href="#/history"><i class="fa-solid fa-clock-rotate-left"></i> سجل النتائج</a>
      <a class="nav-item single ${currentHash === '#/settings' ? 'active' : ''}" href="#/settings"><i class="fa-solid fa-gear"></i> الإعدادات</a>
      <hr style="border:none;border-top:1px solid var(--border);margin:10px 4px">`;

    MODULES.forEach(m => {
      let tools = Tools.byModule(m.id);
      if (q) tools = tools.filter(t => (t.name + ' ' + (t.en || '') + ' ' + t.desc).toLowerCase().includes(q));
      if (q && !tools.length) return;
      const isOpen = q || currentHash.startsWith('#/module/' + m.id) ||
        tools.some(t => currentHash === '#/tool/' + t.id);
      html += `
        <div class="nav-group ${isOpen ? 'open' : ''}" data-module="${m.id}">
          <button type="button" class="nav-group-title">
            <i class="fa-solid ${m.icon} grp-icon"></i>
            <span>${UI.esc(m.name)}</span>
            <i class="fa-solid fa-chevron-left chev"></i>
          </button>
          <div class="nav-group-items">
            <a class="nav-item ${currentHash === '#/module/' + m.id ? 'active' : ''}" href="#/module/${m.id}"><i class="fa-solid fa-table-cells-large"></i> كل أدوات الوحدة (${tools.length})</a>
            ${tools.map(t => `<a class="nav-item ${currentHash === '#/tool/' + t.id ? 'active' : ''}" href="#/tool/${t.id}"><i class="fa-solid ${t.icon}"></i> ${UI.esc(t.name)}</a>`).join('')}
          </div>
        </div>`;
    });
    nav.innerHTML = html;

    // فتح/غلق المجموعات
    nav.querySelectorAll('.nav-group-title').forEach(btn => {
      btn.addEventListener('click', () => btn.closest('.nav-group').classList.toggle('open'));
    });
  }

  /* ============ الصفحة الرئيسية ============ */
  function renderHome() {
    const total = Tools.all().length;
    const hist = Store.history();
    const q = Store.quota();
    breadcrumb().textContent = 'الرئيسية';
    content().innerHTML = `
      <section class="home-hero">
        <h1><i class="fa-brands fa-youtube"></i> YouTube AI Studio</h1>
        <p>منصة متكاملة لإدارة وتنمية قناتك على يوتيوب بالذكاء الاصطناعي — ${total} أداة احترافية: تحليلات، بحث منافسين، كتابة، SEO، ثمبنيل، أتمتة، وتنبؤ.</p>
        <div class="hero-stats">
          <div><strong>${total}</strong> أداة</div>
          <div><strong>${MODULES.length}</strong> وحدات</div>
          <div><strong>${hist.length}</strong> نتيجة محفوظة</div>
          <div><strong>${(q.yt || 0) + (q.gemini || 0)}</strong> طلب API اليوم</div>
        </div>
      </section>
      ${setupNotice()}
      <div class="grid cols-2" style="margin-bottom:22px">
        <a class="card tool-card" href="#/tool/ai-command">
          <div class="t-icon"><i class="fa-solid fa-terminal"></i></div>
          <h3>مركز الأوامر الذكي</h3><p>اكتب طلبك بلغة طبيعية والنظام يرشح الأداة وينفذ</p>
        </a>
        <a class="card tool-card" href="#/tool/daily-briefing">
          <div class="t-icon"><i class="fa-solid fa-mug-hot"></i></div>
          <h3>الإحاطة اليومية</h3><p>ملخص صباحى ذكى عن قناتك ومهمة اليوم</p>
        </a>
        <a class="card tool-card" href="#/tool/channel-dashboard">
          <div class="t-icon"><i class="fa-solid fa-gauge-high"></i></div>
          <h3>لوحة القناة</h3><p>نظرة شاملة على أداء قناتك بالأرقام والرسوم</p>
        </a>
        <a class="card tool-card" href="#/tool/ai-workspace">
          <div class="t-icon"><i class="fa-solid fa-layer-group"></i></div>
          <h3>مساحة عمل الفيديو الشاملة</h3><p>من فكرة واحدة: حزمة نشر كاملة بضغطة</p>
        </a>
      </div>
      <h2 style="margin-bottom:14px"><i class="fa-solid fa-cubes" style="color:var(--primary)"></i> الوحدات</h2>
      <div class="grid cols-3">
        ${MODULES.map(m => {
          const n = Tools.byModule(m.id).length;
          return `<a class="card tool-card module-card" href="#/module/${m.id}">
            <div style="display:flex;align-items:center;gap:12px;width:100%">
              <div class="t-icon"><i class="fa-solid ${m.icon}"></i></div>
              <span class="m-count">${n} أداة</span>
            </div>
            <h3>${UI.esc(m.name)}</h3>
            <p>${UI.esc(m.en)}</p>
          </a>`;
        }).join('')}
      </div>
      ${hist.length ? `
      <h2 style="margin:26px 0 14px"><i class="fa-solid fa-clock-rotate-left" style="color:var(--primary)"></i> آخر النتائج</h2>
      <div class="grid cols-3">
        ${hist.slice(0, 6).map(h => `
          <a class="card tool-card" href="#/history">
            <h3>${UI.esc(h.title || h.tool)}</h3>
            <p>${UI.esc((h.text || '').slice(0, 110))}...</p>
            <small class="sub">${UI.dateFmt(h.date)}</small>
          </a>`).join('')}
      </div>` : ''}`;
  }

  function setupNotice() {
    const s = Store.settings();
    if (s.geminiKey && s.ytKey) return '';
    return `<div class="notice orange"><i class="fa-solid fa-key"></i>
      <div><strong>ابدأ الإعداد:</strong> أضف مفاتيح API المجانية لتفعيل الأدوات —
      ${!s.geminiKey ? '<a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">مفتاح Gemini</a>' : ''}
      ${!s.geminiKey && !s.ytKey ? ' + ' : ''}
      ${!s.ytKey ? '<a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener">مفتاح YouTube Data API</a>' : ''}
      ثم احفظهما فى <a href="#/settings">الإعدادات</a>.</div></div>`;
  }

  /* ============ صفحة وحدة ============ */
  function renderModule(moduleId) {
    const m = MODULES.find(x => x.id === moduleId);
    if (!m) return renderHome();
    const tools = Tools.byModule(moduleId);
    breadcrumb().textContent = m.name;
    content().innerHTML = `
      <header class="page-head">
        <h1><i class="fa-solid ${m.icon}"></i> ${UI.esc(m.name)}</h1>
        <p>${UI.esc(m.en)} — ${tools.length} أداة</p>
      </header>
      <div class="grid cols-3">
        ${tools.map(t => `
          <a class="card tool-card" href="#/tool/${t.id}">
            <div class="t-icon"><i class="fa-solid ${t.icon}"></i></div>
            <h3>${UI.esc(t.name)}</h3>
            <p>${UI.esc(t.desc)}</p>
            <div class="t-apis">
              ${(t.apis || []).map(a => a === 'ai' ? '<span class="chip ai">Gemini AI</span>' : a === 'yt' ? '<span class="chip yt">YouTube</span>' : '<span class="chip">Analytics</span>').join('')}
            </div>
          </a>`).join('')}
      </div>`;
  }

  /* ============ صفحة الإعدادات ============ */
  /** خيارات قائمة النماذج: مجموعتا Gemini و OpenAI */
  function modelOptions(selected) {
    const grp = (label, models) => `<optgroup label="${label}">${models.map(m => `<option value="${m}"${m === selected ? ' selected' : ''}>${m}</option>`).join('')}</optgroup>`;
    return grp('Google Gemini', Gemini.MODELS) + grp('OpenAI GPT', OpenAI.MODELS);
  }

  function renderSettings() {
    const s = Store.settings();
    breadcrumb().textContent = 'الإعدادات';
    content().innerHTML = `
      <header class="page-head"><h1><i class="fa-solid fa-gear"></i> الإعدادات</h1>
        <p>المفاتيح والبيانات محفوظة محلياً فى متصفحك فقط — لا تُرسل لأى خادم خارجى سوى Google مباشرة.</p></header>

      <form id="settings-form">
        <div class="card">
          <h3><i class="fa-solid fa-key"></i> مفاتيح API</h3>
          <div class="tool-form" style="margin-top:12px">
            <label class="field"><span>مفتاح Gemini API <span style="color:var(--red)">*</span></span>
              <input type="password" id="set-gemini" value="${UI.esc(s.geminiKey)}" placeholder="AIza..." autocomplete="off">
              <small class="sub">مجانى من <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Google AI Studio</a></small></label>
            <label class="field"><span>مفتاح YouTube Data API v3 <span style="color:var(--red)">*</span></span>
              <input type="password" id="set-yt" value="${UI.esc(s.ytKey)}" placeholder="AIza..." autocomplete="off">
              <small class="sub">من <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener">Google Cloud Console</a> بعد تفعيل YouTube Data API v3</small></label>
            <label class="field"><span>مفتاح OpenAI API (اختيارى — لنماذج GPT)</span>
              <input type="password" id="set-openai" value="${UI.esc(s.openaiKey)}" placeholder="sk-..." autocomplete="off">
              <small class="sub">من <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener">OpenAI Platform</a> — يفعّل نماذج gpt-5.5 و gpt-5 بجانب Gemini</small></label>
            <label class="field"><span>OAuth Client ID (اختيارى — لـ Analytics وتعديل الفيديوهات)</span>
              <input type="text" id="set-oauth" value="${UI.esc(s.oauthClientId)}" placeholder="xxxx.apps.googleusercontent.com" autocomplete="off">
              <small class="sub">يفعّل CTR ووقت المشاهدة والإيرادات وتعديل معلومات فيديوهاتك. أنشئ OAuth Client من نوع Web وأضف نطاق موقعك فى Authorized JavaScript origins.</small></label>
            <label class="field"><span>النموذج المفضل (نماذج Gemini)</span>
              <select id="set-model">${Gemini.MODELS.map(m => `<option${m === s.model ? ' selected' : ''}>${m}</option>`).join('')}</select>
              <small class="sub">عند فشل النموذج يتم التبديل تلقائياً للنماذج الأخرى</small></label>
          </div>
          <div class="actions-bar">
            <button type="button" class="btn btn-secondary btn-sm" id="test-gemini"><i class="fa-solid fa-vial"></i> اختبار مفتاح Gemini</button>
            <button type="button" class="btn btn-secondary btn-sm" id="test-openai"><i class="fa-solid fa-vial"></i> اختبار مفتاح OpenAI</button>
            <button type="button" class="btn btn-secondary btn-sm" id="test-yt"><i class="fa-solid fa-vial"></i> اختبار مفتاح YouTube</button>
            <button type="button" class="btn btn-secondary btn-sm" id="connect-oauth"><i class="fa-solid fa-plug"></i> اختبار اتصال Analytics</button>
          </div>
        </div>

        <div class="card" style="margin-top:18px">
          <h3><i class="fa-solid fa-sliders"></i> أوركسترا النماذج — وضع العمل</h3>
          <p class="sub" style="margin-top:6px">اختر كيف تعمل النماذج معاً فى كل الأدوات. النماذج التى تبدأ بـ gpt تتطلب مفتاح OpenAI.</p>
          <div class="tool-form" style="margin-top:12px">
            <label class="field" style="grid-column:1/-1"><span>وضع العمل</span>
              <select id="set-aimode">
                <option value="1"${s.aiMode === '1' ? ' selected' : ''}>الوضع 1 — نموذج واحد (الأسرع والأوفر)</option>
                <option value="2"${s.aiMode === '2' ? ' selected' : ''}>الوضع 2 — نموذجان بالتوازى وعرض النتيجتين معاً</option>
                <option value="3"${s.aiMode === '3' ? ' selected' : ''}>الوضع 3 — نموذجان + حَكَم ثالث يدمج أفضل ما فيهما</option>
                <option value="4"${s.aiMode === '4' ? ' selected' : ''}>الوضع 4 — مناقشة: مسودة ← نقد ← صياغة نهائية</option>
              </select></label>
            <label class="field"><span>النموذج A (الأساسى)</span>
              <select id="set-model-a">${modelOptions(s.modelA || s.model)}</select></label>
            <label class="field"><span>النموذج B (للأوضاع 2-4)</span>
              <select id="set-model-b">${modelOptions(s.modelB || 'gemini-2.5-flash')}</select></label>
            <label class="field"><span>نموذج الحَكَم (للوضع 3)</span>
              <select id="set-model-judge">${modelOptions(s.modelJudge || s.modelA || s.model)}</select></label>
          </div>
        </div>

        <div class="card" style="margin-top:18px">
          <h3><i class="fa-solid fa-tv"></i> بيانات قناتك</h3>
          <div class="tool-form" style="margin-top:12px">
            <label class="field"><span>معرف قناتك أو @handle</span>
              <input type="text" id="set-channel" value="${UI.esc(s.channelId)}" placeholder="@mychannel أو UC..."></label>
            <label class="field"><span>النيتش / مجال المحتوى</span>
              <input type="text" id="set-niche" value="${UI.esc(s.niche)}" placeholder="مثال: تعليم البرمجة"></label>
            <label class="field" style="grid-column:1/-1"><span>قنوات المنافسين (سطر لكل قناة)</span>
              <textarea id="set-competitors" rows="3" placeholder="@competitor1&#10;@competitor2">${UI.esc(s.competitors)}</textarea></label>
          </div>
        </div>

        <div class="card" style="margin-top:18px">
          <h3><i class="fa-solid fa-database"></i> النسخ الاحتياطى</h3>
          <p class="sub">تصدير/استيراد كل بياناتك (الإعدادات، السجل، التوصيات، القوالب، الأهداف...)</p>
          <div class="actions-bar">
            <button type="button" class="btn btn-secondary btn-sm" id="export-all"><i class="fa-solid fa-download"></i> تصدير كل البيانات</button>
            <button type="button" class="btn btn-secondary btn-sm" id="import-all"><i class="fa-solid fa-upload"></i> استيراد نسخة</button>
            <button type="button" class="btn btn-danger btn-sm" id="clear-cache"><i class="fa-solid fa-broom"></i> مسح الكاش</button>
            <input type="file" id="import-file" accept=".json" hidden>
          </div>
        </div>

        <div class="actions-bar" style="margin-top:18px">
          <button type="submit" class="btn btn-primary"><i class="fa-solid fa-floppy-disk"></i> حفظ الإعدادات</button>
        </div>
      </form>`;

    const $ = id => document.getElementById(id);
    $('settings-form').addEventListener('submit', e => {
      e.preventDefault();
      Store.saveSettings({
        geminiKey: $('set-gemini').value.trim(),
        ytKey: $('set-yt').value.trim(),
        openaiKey: $('set-openai').value.trim(),
        oauthClientId: $('set-oauth').value.trim(),
        model: $('set-model').value,
        aiMode: $('set-aimode').value,
        modelA: $('set-model-a').value,
        modelB: $('set-model-b').value,
        modelJudge: $('set-model-judge').value,
        channelId: $('set-channel').value.trim(),
        niche: $('set-niche').value.trim(),
        competitors: $('set-competitors').value.trim()
      });
      UI.toast('تم حفظ الإعدادات ✓', 'success');
    });

    $('test-gemini').addEventListener('click', async () => {
      const key = $('set-gemini').value.trim();
      if (!key) return UI.toast('أدخل مفتاح Gemini أولاً', 'warning');
      UI.spinner(true, 'جارِ اختبار مفتاح Gemini...');
      try { await Gemini.testKey(key); UI.toast('مفتاح Gemini يعمل ✓', 'success'); }
      catch (e) { UI.toast('فشل: ' + e.message, 'error', 5000); }
      finally { UI.spinner(false); }
    });

    $('test-openai').addEventListener('click', async () => {
      const key = $('set-openai').value.trim();
      if (!key) return UI.toast('أدخل مفتاح OpenAI أولاً', 'warning');
      UI.spinner(true, 'جارِ اختبار مفتاح OpenAI...');
      try { await OpenAI.testKey(key); UI.toast('مفتاح OpenAI يعمل ✓', 'success'); }
      catch (e) { UI.toast('فشل: ' + e.message, 'error', 5000); }
      finally { UI.spinner(false); }
    });

    $('test-yt').addEventListener('click', async () => {
      const key = $('set-yt').value.trim();
      if (!key) return UI.toast('أدخل مفتاح YouTube أولاً', 'warning');
      UI.spinner(true, 'جارِ اختبار مفتاح YouTube...');
      try {
        const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=id&chart=mostPopular&maxResults=1&key=${encodeURIComponent(key)}`);
        if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err?.error?.message || 'HTTP ' + res.status); }
        UI.toast('مفتاح YouTube يعمل ✓', 'success');
      } catch (e) { UI.toast('فشل: ' + e.message, 'error', 5000); }
      finally { UI.spinner(false); }
    });

    $('connect-oauth').addEventListener('click', async () => {
      const cid = $('set-oauth').value.trim();
      if (!cid) return UI.toast('أدخل OAuth Client ID أولاً', 'warning');
      Store.saveSettings({ oauthClientId: cid });
      try { await YTA.connect(); UI.toast('تم الاتصال بـ Analytics ✓', 'success'); }
      catch (e) { UI.toast('فشل الاتصال: ' + (e.message === 'NO_OAUTH' ? 'أدخل Client ID صالحاً' : e.message), 'error', 5000); }
    });

    $('export-all').addEventListener('click', () => {
      UI.download('youtube-ai-studio-backup.json', Store.exportAll(), 'application/json');
      UI.toast('تم تصدير النسخة الاحتياطية ✓', 'success');
    });
    $('import-all').addEventListener('click', () => $('import-file').click());
    $('import-file').addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        Store.importAll(await file.text());
        UI.toast('تم الاستيراد ✓ — جارِ إعادة التحميل...', 'success');
        setTimeout(() => location.reload(), 1200);
      } catch (err) { UI.toast('فشل الاستيراد: ' + err.message, 'error'); }
    });
    $('clear-cache').addEventListener('click', () => {
      Store.cacheClear();
      UI.toast('تم مسح الكاش ✓', 'success');
    });
  }

  /* ============ صفحة السجل ============ */
  function renderHistory() {
    breadcrumb().textContent = 'سجل النتائج';
    const hist = Store.history();
    if (!hist.length) {
      content().innerHTML = `
        <header class="page-head"><h1><i class="fa-solid fa-clock-rotate-left"></i> سجل النتائج</h1></header>
        <div class="empty-state"><i class="fa-solid fa-clock-rotate-left"></i><p>لا توجد نتائج بعد — استخدم أى أداة وستُحفظ نتيجتها هنا تلقائياً.</p></div>`;
      return;
    }
    content().innerHTML = `
      <header class="page-head"><h1><i class="fa-solid fa-clock-rotate-left"></i> سجل النتائج (${hist.length})</h1>
        <p>كل نتائج الأدوات محفوظة محلياً — اعرض أو صدّر أو احذف.</p></header>
      <div id="history-list">
        ${hist.map(h => `
          <div class="card" style="margin-bottom:12px" data-hid="${h.id}">
            <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center">
              <h3 style="margin:0">${UI.esc(h.title || h.tool)} <small class="sub">${UI.dateFmt(h.date)}</small></h3>
              <div class="actions-bar" style="margin:0">
                <button class="btn btn-secondary btn-sm" data-act="view"><i class="fa-solid fa-eye"></i> عرض</button>
                <button class="btn btn-secondary btn-sm" data-act="copy"><i class="fa-regular fa-copy"></i></button>
                <button class="btn btn-secondary btn-sm" data-act="export"><i class="fa-solid fa-download"></i></button>
                <button class="btn btn-danger btn-sm" data-act="del"><i class="fa-solid fa-trash"></i></button>
              </div>
            </div>
            <div class="hist-body" hidden style="margin-top:12px;border-top:1px solid var(--border);padding-top:12px"></div>
          </div>`).join('')}
      </div>`;

    document.getElementById('history-list').addEventListener('click', e => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const cardEl = btn.closest('[data-hid]');
      const h = Store.history().find(x => x.id === cardEl.dataset.hid);
      if (!h) return;
      const act = btn.dataset.act;
      if (act === 'view') {
        const body = cardEl.querySelector('.hist-body');
        if (body.hidden) { body.innerHTML = UI.md(h.text || ''); body.hidden = false; }
        else body.hidden = true;
      } else if (act === 'copy') UI.copy(h.text || '');
      else if (act === 'export') UI.exportResult(h.title || h.tool, h.text || '', 'md');
      else if (act === 'del') { Store.deleteHistory(h.id); cardEl.remove(); UI.toast('تم الحذف', 'info', 1500); }
    });
  }

  /* ============ التوجيه (Router) ============ */
  function route() {
    const hash = location.hash || '#/';
    window.scrollTo(0, 0);
    const toolMatch = hash.match(/^#\/tool\/([\w-]+)/);
    const moduleMatch = hash.match(/^#\/module\/([\w-]+)/);
    if (toolMatch) {
      const tool = Tools.get(toolMatch[1]);
      breadcrumb().textContent = tool ? tool.name : 'أداة';
      Engine.renderTool(toolMatch[1]);
    }
    else if (moduleMatch) renderModule(moduleMatch[1]);
    else if (hash === '#/settings') renderSettings();
    else if (hash === '#/history') renderHistory();
    else renderHome();
    buildSidebar(document.getElementById('sidebar-search').value);
    document.body.classList.remove('sidebar-open');
  }

  /* ============ الوضع الليلي ============ */
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    const icon = document.querySelector('#theme-btn i');
    if (icon) icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  }

  /* ============ التهيئة ============ */
  function init() {
    applyTheme(Store.settings().theme);
    document.getElementById('theme-btn').addEventListener('click', () => {
      const next = (document.documentElement.dataset.theme === 'dark') ? 'light' : 'dark';
      Store.saveSettings({ theme: next });
      applyTheme(next);
    });

    // القائمة الجانبية للموبايل
    document.getElementById('menu-btn').addEventListener('click', () => document.body.classList.add('sidebar-open'));
    document.getElementById('sidebar-close').addEventListener('click', () => document.body.classList.remove('sidebar-open'));
    document.getElementById('sidebar-backdrop').addEventListener('click', () => document.body.classList.remove('sidebar-open'));

    // بحث الأدوات
    document.getElementById('sidebar-search').addEventListener('input', e => buildSidebar(e.target.value));

    // عداد الكوتا
    const q = Store.quota();
    document.getElementById('quota-count').textContent = (q.yt || 0) + (q.gemini || 0);

    window.addEventListener('hashchange', route);
    route();
  }

  document.addEventListener('DOMContentLoaded', init);
  return { route, buildSidebar };
})();
