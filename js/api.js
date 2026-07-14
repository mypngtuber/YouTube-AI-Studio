/* ============================================================
   api.js — طبقة الاتصال بالخدمات الخارجية
   Gemini API + YouTube Data API v3 + YouTube Analytics API (OAuth)
   ============================================================ */
'use strict';

/* ---------------- Gemini API مع تبديل تلقائي للنماذج ---------------- */
const Gemini = (() => {
  const MODELS = [
    'gemini-3.5-flash',
    'gemini-3-flash-preview',
    'gemini-3.1-flash-lite',
    'gemini-3.1-flash-lite-preview',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite'
  ];
  const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

  function orderedModels() {
    const pref = Store.settings().model;
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
    for (const model of orderedModels()) {
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
    const text = await generate(prompt, Object.assign({ json: true, temperature: opts.temperature ?? 0.4 }, opts));
    try { return JSON.parse(text); }
    catch {
      const m = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (m) { try { return JSON.parse(m[0]); } catch {} }
      throw new Error('تعذر قراءة استجابة الذكاء الاصطناعي كبيانات منظمة');
    }
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

  return { generate, generateJSON, testKey, MODELS };
})();

/* ---------------- YouTube Data API v3 ---------------- */
const YT = (() => {
  const BASE = 'https://www.googleapis.com/youtube/v3';

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

  /* أدوات مساعدة */
  function parseDuration(iso) {
    const m = (iso || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return 0;
    return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
  }
  function isShort(v) { return parseDuration(v.contentDetails?.duration) <= 62; }

  /** تلخيص فيديو لإرساله إلى Gemini بدون استهلاك توكينز زائدة */
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

  return { request, resolveChannel, channelInfo, channelVideos, videosByIds, search, videoComments, playlists, video, parseVideoId, parseDuration, isShort, summarizeVideo };
})();

/* ---------------- YouTube Analytics API (OAuth عبر Google Identity) ---------------- */
const YTA = (() => {
  let accessToken = null;
  let tokenExpiry = 0;

  function connected() { return accessToken && Date.now() < tokenExpiry; }

  /** طلب صلاحية عبر Google Identity Services — يتطلب OAuth Client ID فى الإعدادات */
  function connect() {
    return new Promise((resolve, reject) => {
      const clientId = Store.settings().oauthClientId;
      if (!clientId) return reject(new Error('NO_OAUTH'));
      if (!window.google?.accounts?.oauth2) return reject(new Error('مكتبة Google لم تُحمَّل بعد. أعد المحاولة.'));
      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/yt-analytics.readonly https://www.googleapis.com/auth/yt-analytics-monetary.readonly',
        callback: (resp) => {
          if (resp.error) return reject(new Error(resp.error));
          accessToken = resp.access_token;
          tokenExpiry = Date.now() + (resp.expires_in - 60) * 1000;
          resolve(true);
        }
      });
      client.requestAccessToken();
    });
  }

  /** استعلام تقارير Analytics — يتطلب اتصال OAuth */
  async function query(params) {
    if (!connected()) await connect();
    const qs = new URLSearchParams(Object.assign({ ids: 'channel==MINE' }, params));
    const res = await fetch('https://youtubeanalytics.googleapis.com/v2/reports?' + qs, {
      headers: { Authorization: 'Bearer ' + accessToken }
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
