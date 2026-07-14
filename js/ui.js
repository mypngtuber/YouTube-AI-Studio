/* ============================================================
   ui.js — مكونات الواجهة (Toast, Spinner, Markdown, Copy, Export, Charts)
   ============================================================ */
'use strict';

const UI = (() => {

  /* ---------- إشعارات Toast ---------- */
  function toast(msg, type = 'info', ms = 3500) {
    const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info', warning: 'fa-triangle-exclamation' };
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i><span></span>`;
    el.querySelector('span').textContent = msg;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, ms);
  }

  /* ---------- سبينر عام ---------- */
  function spinner(show, msg = 'جارِ المعالجة...') {
    const ov = document.getElementById('spinner-overlay');
    document.getElementById('spinner-msg').textContent = msg;
    ov.hidden = !show;
  }

  function inlineLoader(msg = 'جارِ التحليل بالذكاء الاصطناعي...') {
    return `<div class="inline-loader"><div class="spinner"></div><span>${esc(msg)}</span></div>`;
  }

  /* ---------- هروب HTML ---------- */
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ---------- محول Markdown خفيف ---------- */
  function md(text) {
    if (!text) return '';
    let t = String(text).replace(/\r/g, '');
    // كتل الأكواد
    const blocks = [];
    t = t.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      blocks.push(`<pre><code>${esc(code)}</code></pre>`);
      return `\u0000B${blocks.length - 1}\u0000`;
    });
    t = esc(t);
    // جداول
    t = t.replace(/((?:^\|.*\|\s*$\n?)+)/gm, (tbl) => {
      const lines = tbl.trim().split('\n').filter(l => l.trim().startsWith('|'));
      if (lines.length < 2) return tbl;
      const cells = l => l.split('|').slice(1, -1).map(c => c.trim());
      const head = cells(lines[0]);
      const bodyLines = lines.slice(lines[1].match(/^[\s|:-]+$/) ? 2 : 1);
      let html = '<table><thead><tr>' + head.map(h => `<th>${inline(h)}</th>`).join('') + '</tr></thead><tbody>';
      bodyLines.forEach(l => { html += '<tr>' + cells(l).map(c => `<td>${inline(c)}</td>`).join('') + '</tr>'; });
      return html + '</tbody></table>';
    });
    // عناوين
    t = t.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>')
         .replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
         .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
         .replace(/^#\s+(.+)$/gm, '<h1>$1</h1>')
         .replace(/^---+$/gm, '<hr>')
         .replace(/^>\s?(.+)$/gm, '<blockquote>$1</blockquote>');
    // قوائم
    t = t.replace(/((?:^[ \t]*[-*•]\s+.+$\n?)+)/gm, m =>
      '<ul>' + m.trim().split('\n').map(l => `<li>${inline(l.replace(/^[ \t]*[-*•]\s+/, ''))}</li>`).join('') + '</ul>');
    t = t.replace(/((?:^[ \t]*\d+[.)]\s+.+$\n?)+)/gm, m =>
      '<ol>' + m.trim().split('\n').map(l => `<li>${inline(l.replace(/^[ \t]*\d+[.)]\s+/, ''))}</li>`).join('') + '</ol>');
    // فقرات
    t = t.split(/\n{2,}/).map(p => {
      const trimmed = p.trim();
      if (!trimmed) return '';
      if (/^<(h\d|ul|ol|table|pre|blockquote|hr)/.test(trimmed)) return inlineKeep(trimmed);
      return '<p>' + inline(trimmed).replace(/\n/g, '<br>') + '</p>';
    }).join('\n');
    // إعادة كتل الأكواد
    t = t.replace(/\u0000B(\d+)\u0000/g, (_, i) => blocks[+i]);
    return `<div class="md">${t}</div>`;

    function inline(s) {
      return s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
              .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
              .replace(/`([^`]+)`/g, '<code>$1</code>');
    }
    function inlineKeep(s) {
      return s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`([^`<]+)`/g, '<code>$1</code>');
    }
  }

  /* ---------- نسخ ---------- */
  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast('تم النسخ ✓', 'success', 1600);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove();
      toast('تم النسخ ✓', 'success', 1600);
    }
  }

  /* قائمة عناصر قابلة للنسخ */
  function copyList(items, title = '') {
    const id = 'cl_' + Math.random().toString(36).slice(2, 8);
    const html = `
      ${title ? `<h3>${esc(title)}</h3>` : ''}
      <div class="copy-list" id="${id}">
        ${items.map(it => `
          <div class="copy-item">
            <span>${esc(it)}</span>
            <button class="btn btn-secondary btn-sm" data-copy><i class="fa-regular fa-copy"></i></button>
          </div>`).join('')}
      </div>
      ${items.length > 2 ? `<div class="actions-bar"><button class="btn btn-secondary btn-sm" data-copy-all="${id}"><i class="fa-solid fa-copy"></i> نسخ الكل</button></div>` : ''}`;
    return html;
  }

  /* ---------- حلقة درجة (Score Ring) ---------- */
  function scoreRing(score, label = '', size = 120) {
    score = Math.max(0, Math.min(100, Math.round(score)));
    const color = score >= 75 ? 'var(--green)' : score >= 50 ? 'var(--orange)' : 'var(--red)';
    const r = (size / 2) - 8, c = 2 * Math.PI * r;
    return `
      <div class="score-ring-wrap">
        <div class="score-ring" style="width:${size}px;height:${size}px">
          <svg width="${size}" height="${size}">
            <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="var(--bg3)" stroke-width="10"/>
            <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${color}" stroke-width="10"
              stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - score / 100)}"/>
          </svg>
          <div class="val">${score}<small>/100</small></div>
        </div>
        ${label ? `<strong style="font-size:.85rem">${esc(label)}</strong>` : ''}
      </div>`;
  }

  /* شريط تقدم مع تسمية */
  function bar(label, value, max = 100, color = 'var(--accent)') {
    const pct = Math.max(0, Math.min(100, (value / max) * 100));
    return `
      <div class="bar-row">
        <div class="bar-head"><span>${esc(label)}</span><strong>${Math.round(value)}${max === 100 ? '/100' : ''}</strong></div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div>
      </div>`;
  }

  /* بطاقة إحصائية */
  function statCard(icon, value, label, colorClass = 's-blue') {
    return `
      <div class="card stat-card">
        <div class="s-icon ${colorClass}"><i class="fa-solid ${icon}"></i></div>
        <div><div class="s-val">${value}</div><div class="s-lbl">${esc(label)}</div></div>
      </div>`;
  }

  /* ---------- أرقام مقروءة ---------- */
  function num(n) {
    n = +n || 0;
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n.toLocaleString('en');
  }
  function dateFmt(ts) {
    return new Date(ts).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  /* ---------- تصدير ---------- */
  function download(filename, content, mime = 'text/plain') {
    const blob = new Blob([content], { type: mime + ';charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function exportResult(title, text, fmt) {
    const safe = title.replace(/[^\w\u0600-\u06FF-]+/g, '_').slice(0, 50);
    if (fmt === 'txt') download(safe + '.txt', text);
    else if (fmt === 'md') download(safe + '.md', text, 'text/markdown');
    else if (fmt === 'json') download(safe + '.json', JSON.stringify({ title, date: new Date().toISOString(), content: text }, null, 2), 'application/json');
    else if (fmt === 'pdf') {
      // طباعة إلى PDF عبر نافذة الطباعة (حل عميل خالص)
      const w = window.open('', '_blank');
      w.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${esc(title)}</title>
        <style>body{font-family:'Segoe UI',Tahoma,sans-serif;padding:32px;line-height:1.9;color:#111}
        h1{border-bottom:2px solid #ff0033;padding-bottom:8px}table{border-collapse:collapse;width:100%}
        th,td{border:1px solid #ccc;padding:6px 10px}</style></head>
        <body><h1>${esc(title)}</h1>${md(text)}<script>window.onload=()=>window.print()<\/script></body></html>`);
      w.document.close();
    }
  }

  /* شريط أزرار التصدير + الحفظ */
  function exportBar(getTitle, getText) {
    const id = 'exp_' + Math.random().toString(36).slice(2, 8);
    setTimeout(() => {
      const wrap = document.getElementById(id);
      if (!wrap) return;
      wrap.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-fmt]');
        if (btn) exportResult(getTitle(), getText(), btn.dataset.fmt);
        const cp = e.target.closest('[data-copy-result]');
        if (cp) copy(getText());
      });
    }, 0);
    return `
      <div class="actions-bar" id="${id}" style="margin-top:16px">
        <button class="btn btn-secondary btn-sm" data-copy-result><i class="fa-regular fa-copy"></i> نسخ</button>
        <button class="btn btn-secondary btn-sm" data-fmt="txt"><i class="fa-regular fa-file-lines"></i> TXT</button>
        <button class="btn btn-secondary btn-sm" data-fmt="md"><i class="fa-brands fa-markdown"></i> MD</button>
        <button class="btn btn-secondary btn-sm" data-fmt="json"><i class="fa-solid fa-code"></i> JSON</button>
        <button class="btn btn-secondary btn-sm" data-fmt="pdf"><i class="fa-regular fa-file-pdf"></i> PDF</button>
      </div>`;
  }

  /* ---------- Chart.js ---------- */
  const charts = {};
  function chart(canvasId, config) {
    const el = document.getElementById(canvasId);
    if (!el) return null;
    if (charts[canvasId]) charts[canvasId].destroy();
    const isDark = document.documentElement.dataset.theme === 'dark';
    Chart.defaults.color = isDark ? '#98a2b5' : '#5b6474';
    Chart.defaults.borderColor = isDark ? '#28303f' : '#e3e8f0';
    Chart.defaults.font.family = 'Cairo, sans-serif';
    charts[canvasId] = new Chart(el, config);
    return charts[canvasId];
  }

  /* ---------- قراءة صورة كـBase64 ---------- */
  function readImage(file) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) return reject(new Error('اختر ملف صورة صالح'));
      if (file.size > 8 * 1024 * 1024) return reject(new Error('حجم الصورة يجب أن يكون أقل من 8MB'));
      const fr = new FileReader();
      fr.onload = () => resolve({ base64: fr.result.split(',')[1], mime: file.type, dataUrl: fr.result });
      fr.onerror = () => reject(new Error('فشل قراءة الصورة'));
      fr.readAsDataURL(file);
    });
  }

  /* ربط منطقة رفع الصور */
  function bindDropzone(zoneEl, onImage) {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.hidden = true;
    zoneEl.appendChild(input);
    const handle = async (file) => {
      try {
        const img = await readImage(file);
        zoneEl.querySelectorAll('img').forEach(i => i.remove());
        const preview = document.createElement('img');
        preview.src = img.dataUrl; preview.alt = 'معاينة الصورة';
        zoneEl.appendChild(preview);
        onImage(img);
      } catch (e) { toast(e.message, 'error'); }
    };
    zoneEl.addEventListener('click', () => input.click());
    input.addEventListener('change', () => input.files[0] && handle(input.files[0]));
    zoneEl.addEventListener('dragover', e => { e.preventDefault(); zoneEl.classList.add('drag'); });
    zoneEl.addEventListener('dragleave', () => zoneEl.classList.remove('drag'));
    zoneEl.addEventListener('drop', e => {
      e.preventDefault(); zoneEl.classList.remove('drag');
      if (e.dataTransfer.files[0]) handle(e.dataTransfer.files[0]);
    });
  }

  /* تفويض النقر لعناصر النسخ داخل النتائج */
  document.addEventListener('click', (e) => {
    const cbtn = e.target.closest('[data-copy]');
    if (cbtn) { copy(cbtn.closest('.copy-item')?.querySelector('span')?.textContent || ''); return; }
    const call = e.target.closest('[data-copy-all]');
    if (call) {
      const list = document.getElementById(call.dataset.copyAll);
      if (list) copy([...list.querySelectorAll('.copy-item span')].map(s => s.textContent).join('\n'));
    }
  });

  return { toast, spinner, inlineLoader, esc, md, copy, copyList, scoreRing, bar, statCard, num, dateFmt, download, exportResult, exportBar, chart, readImage, bindDropzone };
})();
