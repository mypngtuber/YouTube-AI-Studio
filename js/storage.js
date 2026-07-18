/* ============================================================
   storage.js — طبقة التخزين المحلي (إعدادات، سجل، قوالب، كاش، سجل نشاط)
   ============================================================ */
'use strict';

const Store = (() => {
  const PREFIX = 'yais_';

  function get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  }
  function set(key, value) {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true; }
    catch (e) { console.warn('Storage full', e); return false; }
  }
  function remove(key) { localStorage.removeItem(PREFIX + key); }

  /* ---------- الإعدادات ---------- */
  const DEFAULT_SETTINGS = {
    geminiKey: '',
    ytKey: '',
    openaiKey: '',
    oauthClientId: '',
    channelId: '',
    model: 'gemini-3.5-flash',
    aiMode: '1',          // وضع الأوركسترا: 1 نموذج واحد / 2 توازى / 3 تحكيم / 4 مناقشة
    modelA: '',           // النموذج الأساسى (فارغ = نفس model)
    modelB: '',           // النموذج الثانى للأوضاع 2-4
    modelJudge: '',       // نموذج الحَكَم للوضع 3
    theme: 'light',
    language: 'ar',
    niche: '',
    competitors: '' // قنوات المنافسين مفصولة بسطر
  };
  function settings() { return Object.assign({}, DEFAULT_SETTINGS, get('settings', {})); }
  function saveSettings(patch) {
    const s = Object.assign(settings(), patch);
    set('settings', s);
    return s;
  }
  function resetSettings() { remove('settings'); }

  /* ---------- السجل (History) ---------- */
  function history() { return get('history', []); }
  function addHistory(entry) {
    const list = history();
    entry.id = 'h_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    entry.date = Date.now();
    list.unshift(entry);
    if (list.length > 300) list.length = 300;
    set('history', list);
    return entry;
  }
  function updateHistory(id, patch) {
    const list = history();
    const i = list.findIndex(h => h.id === id);
    if (i > -1) { Object.assign(list[i], patch); set('history', list); }
  }
  function deleteHistory(id) { set('history', history().filter(h => h.id !== id)); }

  /* ---------- سجل النشاط (Audit Log) ---------- */
  function audit() { return get('audit', []); }
  function addAudit(tool, action, status = 'ok') {
    const list = audit();
    list.unshift({ tool, action, status, date: Date.now() });
    if (list.length > 500) list.length = 500;
    set('audit', list);
  }

  /* ---------- سجل توصيات الذكاء الاصطناعي ---------- */
  function insights() { return get('insights', []); }
  function addInsight(tool, title, text) {
    const list = insights();
    list.unshift({ id: 'i_' + Date.now(), tool, title, text: String(text).slice(0, 4000), date: Date.now(), status: 'new' });
    if (list.length > 200) list.length = 200;
    set('insights', list);
  }
  function updateInsight(id, patch) {
    const list = insights();
    const i = list.findIndex(x => x.id === id);
    if (i > -1) { Object.assign(list[i], patch); set('insights', list); }
  }

  /* ---------- الكاش الذكي ---------- */
  function cacheGet(key, maxAgeMs) {
    const c = get('cache_' + key);
    if (c && (Date.now() - c.t) < maxAgeMs) return c.v;
    return null;
  }
  function cacheSet(key, value) { set('cache_' + key, { t: Date.now(), v: value }); }
  function cacheClear() {
    Object.keys(localStorage)
      .filter(k => k.startsWith(PREFIX + 'cache_'))
      .forEach(k => localStorage.removeItem(k));
  }
  function cacheStats() {
    let n = 0, bytes = 0;
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith(PREFIX + 'cache_')) { n++; bytes += (localStorage.getItem(k) || '').length; }
    });
    return { count: n, kb: Math.round(bytes / 1024) };
  }

  /* ---------- عداد الـQuota اليومي ---------- */
  function todayKey() { return new Date().toISOString().slice(0, 10); }
  function quota() {
    const q = get('quota', {});
    return q.day === todayKey() ? q : { day: todayKey(), yt: 0, gemini: 0, tools: {} };
  }
  function bumpQuota(type, tool = '') {
    const q = quota();
    q[type] = (q[type] || 0) + 1;
    if (tool) q.tools[tool] = (q.tools[tool] || 0) + 1;
    set('quota', q);
    const el = document.getElementById('quota-count');
    if (el) el.textContent = (q.yt || 0) + (q.gemini || 0);
  }

  /* ---------- القوالب / القواعد / الأهداف / التجارب ---------- */
  function collection(name) {
    return {
      all: () => get(name, []),
      add(item) {
        const list = get(name, []);
        item.id = name.slice(0, 2) + '_' + Date.now();
        item.date = Date.now();
        list.unshift(item);
        set(name, list);
        return item;
      },
      update(id, patch) {
        const list = get(name, []);
        const i = list.findIndex(x => x.id === id);
        if (i > -1) { Object.assign(list[i], patch); set(name, list); }
      },
      remove(id) { set(name, get(name, []).filter(x => x.id !== id)); }
    };
  }

  const templates = collection('templates');
  const goals = collection('goals');
  const experiments = collection('experiments');
  const rules = collection('rules');
  const approvals = collection('approvals');
  const knowledge = {
    get: () => get('knowledge', { profile: '', audience: '', style: '', rules: '', patterns: '' }),
    save: (v) => set('knowledge', v)
  };

  /* ---------- تصدير/استيراد كل شيء ---------- */
  function exportAll() {
    const out = {};
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith(PREFIX)) out[k] = localStorage.getItem(k);
    });
    return JSON.stringify({ app: 'YouTube AI Studio', version: 1, exported: new Date().toISOString(), data: out }, null, 2);
  }
  function importAll(json) {
    const parsed = JSON.parse(json);
    if (!parsed.data) throw new Error('ملف غير صالح');
    Object.entries(parsed.data).forEach(([k, v]) => {
      if (k.startsWith(PREFIX)) localStorage.setItem(k, v);
    });
  }

  return {
    get, set, remove,
    settings, saveSettings, resetSettings,
    history, addHistory, updateHistory, deleteHistory,
    audit, addAudit,
    insights, addInsight, updateInsight,
    cacheGet, cacheSet, cacheClear, cacheStats,
    quota, bumpQuota,
    templates, goals, experiments, rules, approvals, knowledge,
    exportAll, importAll
  };
})();
