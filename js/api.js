/* ============================================================
   api.js — طبقة الاتصال بالخدمات الخارجية
   Gemini API + OpenAI API + YouTube Data API v3
   + YouTube Analytics API (OAuth) + أوركسترا النماذج (AI)
   ============================================================ */
'use strict';

/* ---------------- Gemini API مع تبديل تلقائي للنماذج ---------------- */
const Gemini = (() => {
  const MODELS = [
    'gemini-3.5-flash',
    'gemini-3.6-flash',
    'gemini-3-flash-preview',
    'gemini-3.1-flash-lite',
    'gemini-3.1-flash-lite-preview',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite'
  ];
  const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

  function orderedModels(prefArg) {
    const pref = prefArg && MODELS.includes(prefArg) ? prefArg : Store.settings().model;
    const rest = MODELS.filter(m => m !== pref);
    return [pref, ...rest];
  }

  async function callModel(model, key, prompt, opts = {}) {
    const body = {
      contents: [{ parts: buildParts(prompt, opts) }],
      generationConfig: {
        temperature: opts.temperature ?? 0.7,
        maxOutputTokens: opts.maxTokens ?? 8192
      }
    };
    if (opts.json) body.generationConfig.responseMimeType = 'application/json';
    if (opts.search) body.tools = [{ google_search: {} }];
    if (opts.system) body.systemInstruction = { parts: [{ text: opts.system }] };

    const res = await fetch(`${BASE}/${model}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    Store.bumpQuota('gemini', opts.tool || model);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err?.error?.message || `HTTP ${res.status}`;
      const e = new Error(msg);
      e.status = res.status;
      throw e;
    }
    const data = await res.json();
    const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
    if (!text) throw new Error('استجابة فارغة من النموذج');
    return text;
  }

  function buildParts(prompt, opts) {
    const parts = [{ text: prompt }];
    if (opts.imageBase64) {
      parts.push({ inlineData: { mimeType: opts.imageMime || 'image/jpeg', data: opts.imageBase64 } });
    }
    if (opts.imageBase64_2) {
      parts.push({ inlineData: { mimeType: opts.imageMime2 || 'image/jpeg', data: opts.imageBase64_2 } });
    }
    return parts;
  }

  /**
   * توليد نص مع التبديل التلقائي بين النماذج عند الفشل.
   * أخطاء المفتاح (401/403) لا يعاد المحاولة معها لأنها ليست مشكلة نموذج.
   */
  async function generate(prompt, opts = {}) {
    const key = Store.settings().geminiKey;
    if (!key) { const e = new Error('NO_KEY'); e.code = 'NO_KEY'; throw e; }
    let lastErr = null;
    for (const model of orderedModels(opts.preferModel)) {
      try {
        const text = await callModel(model, key, prompt, opts);
        generate.lastModel = model;
        return text;
      } catch (err) {
        lastErr = err;
        if (err.status === 401 || err.status === 403) break; // مفتاح غير صالح — لا فائدة من التبديل
        console.warn(`نموذج ${model} فشل، جارِ التبديل...`, err.message);
      }
    }
    const e = new Error(lastErr?.status === 401 || lastErr?.status === 403
      ? 'مفتاح Gemini غير صالح أو غير مفعّل. راجع الإعدادات.'
      : 'تعذر الوصول لجميع نماذج Gemini حالياً. حاول مرة أخرى بعد قليل.\n' + (lastErr?.message || ''));
    e.original = lastErr;
    throw e;
  }

  /** توليد JSON منظم مع محاولة إصلاح النص إذا لم يكن JSON صافياً */
  async function generateJSON(prompt, opts = {}) {
    const text = await generate(prompt, Object.assign({ temperature: opts.temperature ?? 0.4 }, opts, { json: true }));
    try { return JSON.parse(text); }
    catch {
      const m = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (m) { try { return JSON.parse(m[0]); } catch {} }
      throw new Error('تعذر قراءة استجابة الذكاء الاصطناعي كبيانات منظمة');
    }
  }

  /** استدعاء نموذج Gemini محدد بالاسم بالضبط (بدون تبديل تلقائى) */
  async function generateWith(model, prompt, opts = {}) {
    const key = Store.settings().geminiKey;
    if (!key) { const e = new Error('NO_KEY'); e.code = 'NO_KEY'; throw e; }
    return callModel(model, key, prompt, opts);
  }

  async function testKey(key) {
    const res = await fetch(`${BASE}/gemini-2.5-flash-lite:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: 'قل: تم' }] }], generationConfig: { maxOutputTokens: 10 } })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${res.status}`);
    }
    return true;
  }

  // auto = دالة التوليد الأصلية بالتبديل التلقائى (تبقى ثابتة حتى بعد توجيه generate لطبقة الأوركسترا)
  return { generate, generateJSON, generateWith, auto: generate, testKey, MODELS };
})();

/* ---------------- OpenAI API (نماذج GPT) ---------------- */
const OpenAI = (() => {
  const MODELS = ['gpt-5.5', 'gpt-5.5-mini', 'gpt-5.5-nano', 'gpt-5', 'gpt-5-mini', 'gpt-5-nano'];
  const URL = 'https://api.openai.com/v1/chat/completions';

  /** استدعاء نموذج GPT محدد — يدعم الصور وإخراج JSON */
  async function generateWith(model, prompt, opts = {}) {
    const key = Store.settings().openaiKey;
    if (!key) { const e = new Error('NO_OPENAI_KEY'); e.code = 'NO_OPENAI_KEY'; throw e; }

    let system = opts.system || '';
    if (opts.json) system += '\nأجب بصيغة JSON صالحة فقط دون أى نص آخر. Respond with valid JSON only.';

    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    if (opts.imageBase64) {
      const content = [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: `data:${opts.imageMime || 'image/jpeg'};base64,${opts.imageBase64}` } }
      ];
      if (opts.imageBase64_2) {
        content.push({ type: 'image_url', image_url: { url: `data:${opts.imageMime2 || 'image/jpeg'};base64,${opts.imageBase64_2}` } });
      }
      messages.push({ role: 'user', content });
    } else {
      messages.push({ role: 'user', content: prompt });
    }

    const body = { model, messages, max_completion_tokens: opts.maxTokens ?? 8192 };
    if (opts.json) body.response_format = { type: 'json_object' };

    const res = await fetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify(body)
    });
    Store.bumpQuota('openai', opts.tool || model);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const e = new Error(err?.error?.message || `OpenAI API: HTTP ${res.status}`);
      e.status = res.status;
      throw e;
    }
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';
    if (!text) throw new Error('استجابة فارغة من نموذج OpenAI');
    return text;
  }

  async function testKey(key) {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: 'Bearer ' + key }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${res.status}`);
    }
    return true;
  }

  return { generateWith, testKey, MODELS };
})();

/* ---------------- YouTube Data API v3 ---------------- */
const YT = (() => {
  const BASE = 'https://www.googleapis.com/youtube/v3';
  const WRITE_SCOPE = 'https://www.googleapis.com/auth/youtube.force-ssl';

  async function request(endpoint, params = {}, useCacheMin = 10) {
    const key = Store.settings().ytKey;
    if (!key) { const e = new Error('NO_YT_KEY'); e.code = 'NO_YT_KEY'; throw e; }
    const qs = new URLSearchParams(Object.assign({}, params, { key }));
    const cacheKey = endpoint + '_' + JSON.stringify(params);
    if (useCacheMin) {
      const cached = Store.cacheGet(cacheKey, useCacheMin * 60000);
      if (cached) return cached;
    }
    const res = await fetch(`${BASE}/${endpoint}?${qs}`);
    Store.bumpQuota('yt', endpoint);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `YouTube API: HTTP ${res.status}`);
    }
    const data = await res.json();
    if (useCacheMin) Store.cacheSet(cacheKey, data);
    return data;
  }

  /** حل معرف القناة من ID أو @handle أو رابط */
  async function resolveChannel(input) {
    input = (input || '').trim();
    if (!input) throw new Error('أدخل معرف القناة أولاً (فى الإعدادات أو الحقل)');
    // استخراج من رابط
    const urlMatch = input.match(/youtube\.com\/(?:channel\/)?(UC[\w-]{20,})/);
    if (urlMatch) input = urlMatch[1];
    const handleMatch = input.match(/youtube\.com\/(@[\w.-]+)/);
    if (handleMatch) input = handleMatch[1];

    if (/^UC[\w-]{20,}$/.test(input)) return input;
    // handle
    const handle = input.startsWith('@') ? input : '@' + input;
    const data = await request('channels', { part: 'id', forHandle: handle }, 1440);
    if (data.items?.length) return data.items[0].id;
    // بحث كملاذ أخير
    const s = await request('search', { part: 'snippet', q: input, type: 'channel', maxResults: 1 }, 1440);
    if (s.items?.length) return s.items[0].snippet.channelId;
    throw new Error('لم يتم العثور على القناة: ' + input);
  }

  async function channelInfo(channelId) {
    const data = await request('channels', {
      part: 'snippet,statistics,contentDetails,brandingSettings', id: channelId
    }, 60);
    if (!data.items?.length) throw new Error('القناة غير موجودة');
    return data.items[0];
  }

  /** جلب فيديوهات القناة (من قائمة الرفع) مع التفاصيل */
  async function channelVideos(channelId, max = 50) {
    const ch = await channelInfo(channelId);
    const uploadsId = ch.contentDetails.relatedPlaylists.uploads;
    let items = [], pageToken = '';
    while (items.length < max) {
      const page = await request('playlistItems', {
        part: 'contentDetails', playlistId: uploadsId,
        maxResults: Math.min(50, max - items.length),
        ...(pageToken ? { pageToken } : {})
      }, 30);
      items = items.concat(page.items || []);
      pageToken = page.nextPageToken;
      if (!pageToken) break;
    }
    const ids = items.map(i => i.contentDetails.videoId);
    return videosByIds(ids);
  }

  async function videosByIds(ids) {
    let out = [];
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50).join(',');
      if (!chunk) break;
      const data = await request('videos', {
        part: 'snippet,statistics,contentDetails,topicDetails', id: chunk
      }, 30);
      out = out.concat(data.items || []);
    }
    return out;
  }

  async function search(q, opts = {}) {
    return request('search', Object.assign({
      part: 'snippet', q, type: 'video', maxResults: 15, relevanceLanguage: 'ar'
    }, opts), 60);
  }

  async function videoComments(videoId, max = 50) {
    const data = await request('commentThreads', {
      part: 'snippet', videoId, maxResults: Math.min(100, max), order: 'relevance', textFormat: 'plainText'
    }, 15);
    return (data.items || []).map(i => {
      const c = i.snippet.topLevelComment.snippet;
      return { author: c.authorDisplayName, text: c.textDisplay, likes: c.likeCount, date: c.publishedAt, replies: i.snippet.totalReplyCount };
    });
  }

  async function playlists(channelId) {
    const data = await request('playlists', { part: 'snippet,contentDetails', channelId, maxResults: 50 }, 60);
    return data.items || [];
  }

  /** استخراج معرف فيديو من رابط أو نص */
  function parseVideoId(input) {
    input = (input || '').trim();
    const m = input.match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/) || input.match(/^([\w-]{11})$/);
    if (!m) throw new Error('رابط أو معرف فيديو غير صالح');
    return m[1];
  }

  async function video(videoIdOrUrl) {
    const id = parseVideoId(videoIdOrUrl);
    const items = await videosByIds([id]);
    if (!items.length) throw new Error('الفيديو غير موجود');
    return items[0];
  }

  /** تحديث بيانات فيديو فعلياً على يوتيوب — يتطلب OAuth بصلاحية الكتابة.
      مهم: يجب أن يحتوى snippet على categoryId الأصلى وإلا سيرفض يوتيوب الطلب. */
  async function updateVideo(videoId, snippet) {
    const token = await GAuth.token(WRITE_SCOPE);
    const res = await fetch(`${BASE}/videos?part=snippet`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ id: videoId, snippet })
    });
    Store.bumpQuota('yt', 'videos.update');
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `YouTube API: HTTP ${res.status}`);
    }
    return res.json();
  }

  /** رفع صورة مصغرة جديدة لفيديو — يتطلب OAuth بصلاحية الكتابة */
  async function setThumbnail(videoId, base64, mime = 'image/jpeg') {
    const token = await GAuth.token(WRITE_SCOPE);
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const res = await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(videoId)}`, {
      method: 'POST',
      headers: { 'Content-Type': mime, Authorization: 'Bearer ' + token },
      body: bytes
    });
    Store.bumpQuota('yt', 'thumbnails.set');
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `YouTube API: HTTP ${res.status}`);
    }
    return res.json();
  }

  /* أدوات مساعدة */
  function parseDuration(iso) {
    const m = (iso || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return 0;
    return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
  }
  function isShort(v) { return parseDuration(v.contentDetails?.duration) <= 62; }

  /** تلخيص فيديو لإرساله إلى الذكاء الاصطناعى بدون استهلاك توكينز زائدة */
  function summarizeVideo(v) {
    return {
      id: v.id,
      title: v.snippet.title,
      published: v.snippet.publishedAt?.slice(0, 10),
      views: +(v.statistics?.viewCount || 0),
      likes: +(v.statistics?.likeCount || 0),
      comments: +(v.statistics?.commentCount || 0),
      durationSec: parseDuration(v.contentDetails?.duration),
      isShort: isShort(v),
      tags: (v.snippet.tags || []).slice(0, 10)
    };
  }

  return {
    request, resolveChannel, channelInfo, channelVideos, videosByIds, search,
    videoComments, playlists, video, parseVideoId, parseDuration, isShort,
    summarizeVideo, updateVideo, setThumbnail, WRITE_SCOPE
  };
})();

/* ---------------- GAuth — إدارة رموز OAuth لكل صلاحية (Google Identity) ---------------- */
const GAuth = (() => {
  const tokens = {}; // scope -> { token, expiry }

  function connected(scope) {
    const t = tokens[scope];
    return !!(t && Date.now() < t.expiry);
  }

  /** طلب صلاحية عبر Google Identity Services — يتطلب OAuth Client ID فى الإعدادات */
  function connect(scope) {
    return new Promise((resolve, reject) => {
      const clientId = Store.settings().oauthClientId;
      if (!clientId) return reject(new Error('NO_OAUTH'));
      if (!window.google?.accounts?.oauth2) return reject(new Error('مكتبة Google لم يتم تحميلها بعد. أعد المحاولة.'));
      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope,
        callback: (resp) => {
          if (resp.error) return reject(new Error(resp.error));
          tokens[scope] = { token: resp.access_token, expiry: Date.now() + (resp.expires_in - 60) * 1000 };
          resolve(resp.access_token);
        }
      });
      client.requestAccessToken();
    });
  }

  /** إرجاع رمز صالح للصلاحية المطلوبة (يطلب الإذن إذا لزم) */
  async function token(scope) {
    if (connected(scope)) return tokens[scope].token;
    return connect(scope);
  }

  return { connected, connect, token };
})();

/* ---------------- YouTube Analytics API (OAuth عبر GAuth) ---------------- */
const YTA = (() => {
  const SCOPE = 'https://www.googleapis.com/auth/yt-analytics.readonly https://www.googleapis.com/auth/yt-analytics-monetary.readonly';

  function connected() { return GAuth.connected(SCOPE); }
  function connect() { return GAuth.connect(SCOPE); }

  /** استعلام تقارير Analytics — يتطلب اتصال OAuth */
  async function query(params) {
    const token = await GAuth.token(SCOPE);
    const qs = new URLSearchParams(Object.assign({ ids: 'channel==MINE' }, params));
    const res = await fetch('https://youtubeanalytics.googleapis.com/v2/reports?' + qs, {
      headers: { Authorization: 'Bearer ' + token }
    });
    Store.bumpQuota('yt', 'analytics');
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Analytics API: HTTP ${res.status}`);
    }
    return res.json();
  }

  /** تحويل نتيجة Analytics إلى صفوف مسماة */
  function rows(data) {
    const headers = (data.columnHeaders || []).map(h => h.name);
    return (data.rows || []).map(r => Object.fromEntries(r.map((v, i) => [headers[i], v])));
  }

  function dateStr(d) { return d.toISOString().slice(0, 10); }
  function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return dateStr(d); }

  return { connect, connected, query, rows, daysAgo, dateStr };
})();

/* ---------------- AI — أوركسترا النماذج (4 أوضاع عمل) ----------------
   الوضع 1: نموذج واحد أساسى
   الوضع 2: نموذجان بالتوازى وعرض النتيجتين معاً
   الوضع 3: نموذجان + نموذج ثالث حَكَم يدمج أفضل ما فيهما
   الوضع 4: مناقشة — مسودة A ثم نقد B ثم صياغة نهائية A
   كما تحقن الطبقة تاريخ اليوم الفعلى فى كل استدعاء حتى لا تعامل
   النماذج بيانات القناة الحديثة على أنها تواريخ مستقبلية. */
const AI = (() => {

  /** ملحوظة نظام بتاريخ اليوم الفعلى تُضاف لكل استدعاء */
  function dateNote() {
    const d = new Date();
    return `\n\n[معلومة نظام: تاريخ اليوم الفعلى هو ${d.toISOString().slice(0, 10)} (${d.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}). أى تواريخ فى البيانات قبل هذا التاريخ هى بيانات حقيقية ماضية وليست مستقبلية — تعامل معها على هذا الأساس.]`;
  }

  function cfg() {
    const s = Store.settings();
    const A = s.modelA || s.model || 'gemini-3.5-flash';
    return {
      mode: parseInt(s.aiMode, 10) || 1,
      A,
      B: s.modelB || 'gemini-2.5-flash',
      J: s.modelJudge || A
    };
  }

  const isGpt = m => /^gpt/i.test(m || '');

  /** استدعاء نموذج محدد بالضبط من العائلة المناسبة */
  function call(model, prompt, opts) {
    return isGpt(model) ? OpenAI.generateWith(model, prompt, opts) : Gemini.generateWith(model, prompt, opts);
  }

  /** استدعاء النموذج الأساسى مع تبديل تلقائى / تحويل بين العائلتين عند الفشل */
  async function callPrimary(prompt, opts, A) {
    if (isGpt(A)) {
      try { return await OpenAI.generateWith(A, prompt, opts); }
      catch (err) {
        if (err.code !== 'NO_OPENAI_KEY' && Store.settings().geminiKey) {
          console.warn('نموذج OpenAI فشل، جارِ التحويل إلى Gemini...', err.message);
          return Gemini.auto(prompt, opts);
        }
        throw err;
      }
    }
    return Gemini.auto(prompt, Object.assign({}, opts, { preferModel: A }));
  }

  async function generate(prompt, opts = {}) {
    opts = Object.assign({}, opts);
    opts.system = (opts.system || '') + dateNote();
    const { mode, A, B, J } = cfg();

    /* الوضع 2: نموذجان بالتوازى — عرض النتيجتين */
    if (mode === 2) {
      const [ra, rb] = await Promise.allSettled([callPrimary(prompt, opts, A), call(B, prompt, opts)]);
      if (ra.status === 'rejected' && rb.status === 'rejected') throw ra.reason;
      const va = ra.status === 'fulfilled' ? ra.value : `> ⚠️ فشل النموذج A (${A}): ${ra.reason?.message || ''}`;
      const vb = rb.status === 'fulfilled' ? rb.value : `> ⚠️ فشل النموذج B (${B}): ${rb.reason?.message || ''}`;
      return `## 🅰️ نتيجة النموذج A — \`${A}\`\n\n${va}\n\n---\n\n## 🅱️ نتيجة النموذج B — \`${B}\`\n\n${vb}`;
    }

    /* الوضع 3: نموذجان + حكم يدمج */
    if (mode === 3) {
      const [ra, rb] = await Promise.allSettled([callPrimary(prompt, opts, A), call(B, prompt, opts)]);
      if (ra.status === 'rejected' && rb.status === 'rejected') throw ra.reason;
      if (ra.status === 'rejected' || rb.status === 'rejected') {
        const ok = ra.status === 'fulfilled' ? ra.value : rb.value;
        return `> ⚖️ وضع التحكيم: نجح نموذج واحد فقط، هذه نتيجته مباشرة.\n\n${ok}`;
      }
      const judgePrompt = `أنت حَكَم خبير فى تحسين محتوى يوتيوب. أمامك إجابتان من نموذجين مختلفين على نفس المهمة.\n\n== المهمة الأصلية ==\n${prompt}\n\n== إجابة النموذج A ==\n${ra.value}\n\n== إجابة النموذج B ==\n${rb.value}\n\nمهمتك: ادمج أفضل ما فى الإجابتين، صحح أى أخطاء، وقدّم إجابة نهائية واحدة كاملة بأفضل جودة ممكنة وبنفس التنسيق والهيكل المطلوب فى المهمة الأصلية. لا تذكر أنك حكم ولا تشرح عملية الدمج — قدّم النتيجة النهائية فقط.`;
      const final = await call(J, judgePrompt, opts);
      return `> ⚖️ وضع التحكيم: نتيجة مدموجة من \`${A}\` + \`${B}\` بواسطة الحَكَم \`${J}\`\n\n${final}`;
    }

    /* الوضع 4: مناقشة (مسودة → نقد → نهائى) */
    if (mode === 4) {
      const draft = await callPrimary(prompt, opts, A);
      const critique = await call(B, `أنت مراجع خبير صارم فى محتوى يوتيوب. راجع الإجابة التالية على المهمة، واذكر فى نقاط محددة: نقاط الضعف، الأخطاء، ما ينقصها، وكيفية تحسينها.\n\n== المهمة ==\n${prompt}\n\n== الإجابة ==\n${draft}`, opts);
      const final = await callPrimary(`== المهمة الأصلية ==\n${prompt}\n\n== مسودتك الأولى ==\n${draft}\n\n== ملاحظات المراجع ==\n${critique}\n\nأعد كتابة الإجابة النهائية بأفضل جودة ممكنة مستفيداً من ملاحظات المراجع الوجيهة، وبنفس التنسيق المطلوب فى المهمة الأصلية. قدّم الإجابة النهائية فقط دون الإشارة لعملية المراجعة.`, opts, A);
      return `> 💬 وضع المناقشة: مسودة \`${A}\` ← نقد \`${B}\` ← صياغة نهائية \`${A}\`\n\n${final}`;
    }

    /* الوضع 1 (الافتراضى): نموذج واحد */
    return callPrimary(prompt, opts, A);
  }

  async function generateJSON(prompt, opts = {}) {
    opts = Object.assign({ temperature: opts.temperature ?? 0.4 }, opts, { json: true });
    opts.system = (opts.system || '') + dateNote();
    const { mode, A, B, J } = cfg();

    let text;
    if (mode === 3) {
      const [ra, rb] = await Promise.allSettled([callPrimary(prompt, opts, A), call(B, prompt, opts)]);
      if (ra.status === 'rejected' && rb.status === 'rejected') throw ra.reason;
      if (ra.status === 'rejected' || rb.status === 'rejected') {
        text = ra.status === 'fulfilled' ? ra.value : rb.value;
      } else {
        text = await call(J, `أنت حَكَم خبير. أمامك نتيجتان بصيغة JSON من نموذجين مختلفين لنفس المهمة. ادمج أفضل ما فيهما وأخرج JSON واحداً نهائياً بنفس البنية تماماً (نفس المفاتيح والأنواع)، دون أى نص خارج الـ JSON.\n\n== المهمة الأصلية ==\n${prompt}\n\n== نتيجة A ==\n${ra.value}\n\n== نتيجة B ==\n${rb.value}`, opts);
      }
    } else if (mode === 4) {
      const draft = await callPrimary(prompt, opts, A);
      const critique = await call(B, `راجع نتيجة الـ JSON التالية للمهمة، واذكر بإيجاز فى نقاط ما يجب تحسينه فى المحتوى (وليس البنية):\n\n== المهمة ==\n${prompt}\n\n== النتيجة ==\n${draft}`, Object.assign({}, opts, { json: false }));
      text = await callPrimary(`== المهمة الأصلية ==\n${prompt}\n\n== مسودتك ==\n${draft}\n\n== ملاحظات المراجع ==\n${critique}\n\nأخرج النسخة النهائية المحسّنة بصيغة JSON بنفس البنية تماماً (نفس المفاتيح والأنواع)، دون أى نص خارج الـ JSON.`, opts, A);
    } else {
      // الوضعان 1 و2: للنتائج المنظمة يُستخدم النموذج الأساسى فقط
      text = await callPrimary(prompt, opts, A);
    }

    try { return JSON.parse(text); }
    catch {
      const m = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (m) { try { return JSON.parse(m[0]); } catch {} }
      throw new Error('تعذر قراءة استجابة الذكاء الاصطناعي كبيانات منظمة');
    }
  }

  return { generate, generateJSON, dateNote };
})();

/* توجيه كل الأدوات الـ 145 القائمة عبر طبقة الأوركسترا دون تعديلها */
Gemini.generate = AI.generate;
Gemini.generateJSON = AI.generateJSON;
