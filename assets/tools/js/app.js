/* file: assets/tools/js/app.js */
/* free tools: shared controller. Every tool runs in the visitor's browser; nothing is uploaded.
 * Wires the start card (choose, drop anywhere on the page, paste, sample), opens the studio, reads the
 * settings, and loads the engine for the page (image, bg, enhance, video, pdf, passport, pdfedit, pdfpages,
 * pdfsquash, ocr, qr). Tools without a file (the QR Code Generator) start from a small form in the start card. */
const page = document.querySelector('[data-hvt-page]');
const studio = document.querySelector('[data-hvt]');
if (page && studio) boot();

function boot() {
  const $ = (s) => studio.querySelector(s);
  const $$ = (s) => Array.from(studio.querySelectorAll(s));
  const engineName = studio.dataset.engine, mode = studio.dataset.mode || '';
  const input = page.querySelector('[data-input]'), drop = page.querySelector('[data-drop]');
  const statusEl = $('[data-status]'), prog = $('[data-progress]'), bar = $('[data-bar]');
  const runBtn = $('[data-act="run"]'), doneBox = $('[data-done]'), dlLabel = $('[data-dl-label]');
  const summaryEl = $('[data-summary]');
  let runText = runBtn.textContent;
  const multiple = input.multiple;
  let engine = null, busy = false, dl = null, results = [], pill = null;
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* After a result: a check pops in over the preview with a small burst in the colours */
  const celebrate = () => {
    if (calm) return;
    const old = ctx.stage.querySelector('.hvt-burst'); if (old) old.remove();
    const b = document.createElement('span'); b.className = 'hvt-burst'; b.setAttribute('aria-hidden', 'true');
    const cols = ['#2343d4', '#6a31c0', '#c81b84', '#f59e0b', '#16a34a'];
    let h = '<b><svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></b>';
    for (let i = 0; i < 16; i++) { const ang = (i / 16) * Math.PI * 2, d = 70 + Math.random() * 60; h += '<i style="--c:' + cols[i % cols.length] + ';--x:' + Math.round(Math.cos(ang) * d) + 'px;--y:' + Math.round(Math.sin(ang) * d) + 'px;--r:' + Math.round(Math.random() * 360) + 'deg"></i>'; }
    b.innerHTML = h;
    const view = ctx.stage.querySelector('.hvt-result, .hvt-view'), host = ctx.stage;
    if (view) { const r = view.getBoundingClientRect(), s = host.getBoundingClientRect(); b.style.top = (r.top - s.top + Math.min(r.height, 420) / 2) + 'px'; }
    host.appendChild(b); setTimeout(() => b.remove(), 1700);
  };

  /* ---------- settings ---------- */
  const opts = () => {
    const o = {};
    $$('[data-o]').forEach((el) => {
      const k = el.dataset.o;
      if (el.type === 'radio') { if (el.checked) o[k] = el.value; }
      else if (el.type === 'checkbox') o[k] = el.checked;
      else if (el.type === 'range' || el.type === 'number') o[k] = Number(el.value);
      else o[k] = el.value;
    });
    return o;
  };
  const rules = {
    'image:convert': (o) => ({ lossy: o.format !== 'image/png', jpeg: o.format === 'image/jpeg' }),
    'image:compress': (o) => ({ kb: o.goal === 'kb', custom: o.goal === 'kb' && o.kbsel === 'custom' }),
    'image:resize': (o) => ({ custom: o.preset === 'custom', percent: o.preset === 'percent', fit: o.preset !== 'percent' && !(o.preset === 'custom' && o.lock), pad: o.preset !== 'percent' && !(o.preset === 'custom' && o.lock) && o.fit === 'contain' }),
    'bg:': (o) => ({ color: o.bg === 'color' }),
    'video:convert': (o) => ({ gif: o.format === 'gif' }),
    'passport:': (o) => ({ photo: o.kind !== 'sig', sig: o.kind === 'sig', custom: o.kind !== 'sig' && o.preset === 'custom', scustom: o.kind === 'sig' && o.spreset === 'custom', color: o.kind !== 'sig' && o.bg === 'color' }),
    'pdfsquash:': (o) => ({ kb: o.goal === 'kb', custom: o.goal === 'kb' && o.kbsel === 'custom' }),
    'pdfpages:': (o) => ({ ranges: o.out === 'ranges' }),
    'qr:': (o) => { const t = o.qtype || 'link'; return { link: t === 'link', upi: t === 'upi', wifi: t === 'wifi', wpass: t === 'wifi' && o.sec !== 'nopass', vcard: t === 'vcard', whatsapp: t === 'whatsapp', text: t === 'text', cap: !!o.capon, png: o.fmt !== 'svg' }; },
  };
  const refresh = (changed) => {
    const o = opts();
    $$('[data-out]').forEach((out) => { const v = o[out.dataset.out]; if (v !== undefined) out.textContent = v; });
    const r = (rules[engineName + ':' + mode] || (window.HVT_RULES || {})[engineName + ':' + mode] || (() => ({})))(o);
    $$('[data-show]').forEach((el) => { const k = el.dataset.show; el.hidden = k in r ? !r[k] : false; });
    if (changed && engine && engine.optionsChanged) engine.optionsChanged(o, changed);
  };
  studio.addEventListener('input', (e) => { if (e.target.matches('[data-o]')) refresh(e.target.dataset.o); });
  studio.addEventListener('change', (e) => { if (e.target.matches('[data-o]')) refresh(e.target.dataset.o); });

  /* ---------- helpers handed to the engines ---------- */
  const ctx = {
    root: studio, mode, opts, $, $$,
    stage: $('[data-stage]'),
    base: 'assets/tools/',
    status(msg, kind) { statusEl.textContent = msg || ''; statusEl.dataset.kind = kind || ''; },
    summary(text) { summaryEl.textContent = text ? ' · ' + text : ''; },
    progress(p) {
      if (p === null || p === undefined) { prog.hidden = true; prog.classList.remove('is-busy'); bar.style.width = '0'; if (pill) pill.lastChild.textContent = 'Working…'; return; }
      prog.hidden = false; prog.classList.toggle('is-busy', p < 0);
      if (p >= 0) bar.style.width = Math.max(2, Math.min(100, p * 100)).toFixed(1) + '%';
      if (pill) pill.lastChild.textContent = p >= 0 ? 'Working… ' + Math.round(p * 100) + '%' : 'Working…';
    },
    /* A result is ready: show the download button and the "Continue with" buttons */
    done(label, onDownload, files) {
      dl = onDownload; results = files || [];
      if (busy || engineName === "qr") document.dispatchEvent(new CustomEvent("hvt:completed"));
      if (busy) celebrate();   /* only for a fresh result, not when a setting re-draws it */
      dlLabel.textContent = label || 'Download';
      doneBox.hidden = false; studio.classList.add('is-done');
      runBtn.textContent = 'Run again';
      const nb = $('[data-next-box]'); if (nb) nb.hidden = !results.length;
    },
    reset() { dl = null; results = []; doneBox.hidden = true; studio.classList.remove('is-done'); runBtn.textContent = runText; },
    runLabel(t) { runText = t; if (!busy && !studio.classList.contains('is-done')) runBtn.textContent = t; },
    setDownload(label, fn, files) { if (fn) ctx.done(label, fn, files); else ctx.reset(); },
    bytes(n) { if (!isFinite(n)) return ''; const u = ['B', 'KB', 'MB', 'GB']; let i = 0; while (n >= 1024 && i < 3) { n /= 1024; i++; } return (i ? n.toFixed(n < 10 ? 2 : n < 100 ? 1 : 0) : Math.round(n)) + ' ' + u[i]; },
    save(blob, name) {
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    },
    rename(name, ext) { const b = (name || 'file').replace(/\.[^.\/]+$/, '').replace(/-converted(-\w+)?$/, '') || 'file'; return b + '-converted.' + ext; },
    loadScript(src) {
      return new Promise((res, rej) => {
        if (document.querySelector('script[data-src="' + src + '"]')) return res();
        const s = document.createElement('script'); s.src = src; s.async = true; s.dataset.src = src;
        s.onload = () => res(); s.onerror = () => rej(new Error('could not load ' + src)); document.head.appendChild(s);
      });
    },
    async zip(files, name) {
      await ctx.loadScript(ctx.base + 'vendor/fflate/fflate.min.js');
      const data = {}, used = {};
      for (const f of files) {
        let n = f.name, i = 1; const dot = n.lastIndexOf('.'), b = dot > 0 ? n.slice(0, dot) : n, x = dot > 0 ? n.slice(dot) : '';
        while (used[n]) n = b + '-' + (++i) + x; used[n] = 1;
        data[n] = [new Uint8Array(await f.blob.arrayBuffer()), { level: 0 }];
      }
      ctx.save(new Blob([window.fflate.zipSync(data)], { type: 'application/zip' }), name);
    },
    busy(on) {
      busy = on; runBtn.disabled = on; studio.classList.toggle('is-busy', on);
      if (on && !pill) { pill = document.createElement('span'); pill.className = 'hvt-working'; pill.innerHTML = '<i></i>'; pill.appendChild(document.createTextNode('Working…')); ctx.stage.appendChild(pill); }
      if (!on && pill) { pill.remove(); pill = null; }
      runBtn.textContent = on ? 'Working…' : (studio.classList.contains('is-done') ? 'Run again' : runText);
      $$('[data-act="clear"],[data-act="add"]').forEach((b) => { b.disabled = on; });
    },
  };

  /* ---------- files in ---------- */
  const okType = (f) => {
    const a = (input.getAttribute('accept') || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!a.length) return true;
    if (a.some((p) => p.startsWith('.') && (f.name || '').toLowerCase().endsWith(p.toLowerCase()))) return true;   /* extensions (.docx, .xlsx) */
    return a.some((p) => (p.endsWith('/*') ? (f.type || '').startsWith(p.slice(0, -1)) : f.type === p)) ||
      (!f.type && /\.(mov|mkv|avi|heic|heif|webm|mp4|m4v|m4a|3gp|flv|wmv|ts|mts|mp3|wav)$/i.test(f.name)) ||
      (/\.pdf$/i.test(f.name) && a.includes('application/pdf'));
  };
  const openStudio = () => {
    if (!studio.hidden) return;
    studio.hidden = false; studio.classList.add('is-new');
    requestAnimationFrame(() => {
      const r = studio.getBoundingClientRect();
      if (r.top > innerHeight * 0.55 || r.top < 0) studio.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    });
  };
  const kindText = () => { const a = input.getAttribute('accept') || ''; return /\.docx/.test(a) ? 'a Word file (.docx).' : /\.xlsx/.test(a) ? 'an Excel file (.xlsx).' : /\.pptx/.test(a) ? 'a PowerPoint file (.pptx).' : engineName === 'video' ? 'a video file.' : a.includes('pdf') && a.includes('image') ? 'an image or a PDF.' : a.includes('pdf') ? 'a PDF file.' : 'an image file.'; };
  const loadEngine = async () => { if (!engine) { ctx.status('Loading the tool…'); const m = await import('./engine-' + engineName + '.js?v=20261030-1'); engine = m.default(ctx); ctx.status(''); } };
  const take = async (list, seed) => {
    if (busy) return;
    const all = Array.from(list || []);
    const files = all.filter(okType);
    if (!files.length && !seed) { flash(all.length ? 'That file type does not work here. Choose ' + kindText() : ''); return; }
    openStudio();
    try {
      await loadEngine();
      ctx.reset();
      await engine.add(multiple ? files : files.slice(0, 1), seed);
      refresh();
    } catch (e) { console.error(e); ctx.status('This file could not be opened: ' + (e.message || e), 'error'); }
  };
  /* Tools without a file: the start card is a small form (QR Code Generator) */
  const quick = page.querySelector('[data-quick]');
  if (quick) {
    quick.addEventListener('submit', (e) => { e.preventDefault(); take([], { text: (quick.querySelector('[data-quick-in]') || {}).value || '' }); });
    page.querySelectorAll('[data-quick-type]').forEach((b) => b.addEventListener('click', () => take([], { type: b.dataset.quickType })));
  }
  const flash = (msg) => {
    if (!msg) return;
    let p = page.querySelector('.hvt-drop-err');
    if (!p) { p = document.createElement('p'); p.className = 'hvt-status hvt-drop-err'; p.dataset.kind = 'error'; drop.appendChild(p); }
    p.textContent = msg;
  };
  if (input) input.addEventListener('change', () => { take(input.files); input.value = ''; });

  /* Drop anywhere on the page */
  let depth = 0, overlay = null;
  const showOverlay = (on) => {
    if (on && !overlay) { overlay = document.createElement('div'); overlay.className = 'hvt hvt-overlay'; overlay.innerHTML = '<span>Drop to ' + (studio.hidden || !multiple ? 'start' : 'add') + '</span>'; document.body.appendChild(overlay); }
    if (!on && overlay) { overlay.remove(); overlay = null; }
    drop.classList.toggle('is-over', on);
  };
  const hasFiles = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
  window.addEventListener('dragenter', (e) => { if (!hasFiles(e) || quick) return; e.preventDefault(); depth++; showOverlay(true); });
  window.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
  window.addEventListener('dragleave', (e) => { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (!depth) showOverlay(false); });
  window.addEventListener('drop', (e) => { if (!hasFiles(e) || quick) return; e.preventDefault(); depth = 0; showOverlay(false); take(e.dataTransfer.files); });
  if (engineName !== 'video' && !quick) document.addEventListener('paste', (e) => {
    const items = Array.from((e.clipboardData && e.clipboardData.files) || []);
    if (items.length && !/^(INPUT|TEXTAREA)$/.test((document.activeElement || {}).tagName || '')) { e.preventDefault(); take(items); }
  });

  /* Sample file */
  const sampleBtn = page.querySelector('[data-sample]');
  if (sampleBtn) sampleBtn.addEventListener('click', async () => {
    sampleBtn.disabled = true; const t = sampleBtn.textContent; sampleBtn.textContent = 'Loading the sample…';
    try {
      const url = sampleBtn.dataset.sample, r = await fetch(url); if (!r.ok) throw new Error(r.status);
      const b = await r.blob(); await take([new File([b], url.split('/').pop(), { type: b.type || (url.endsWith('.mp4') ? 'video/mp4' : url.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg') })]);
    } catch (e) { flash('The sample could not be loaded. Please choose your own file.'); }
    sampleBtn.disabled = false; sampleBtn.textContent = t;
  });

  /* ---------- send a result to the next tool ---------- */
  const DB = 'hview-tools';
  const idb = () => new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore('handoff'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const putHandoff = async (files) => { const db = await idb(); await new Promise((res, rej) => { const tx = db.transaction('handoff', 'readwrite'); tx.objectStore('handoff').put({ at: Date.now(), files: files.map((f) => ({ name: f.name, type: f.blob.type, blob: f.blob })) }, 'last'); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); };
  const takeHandoff = async () => {
    const db = await idb();
    const v = await new Promise((res) => { const tx = db.transaction('handoff', 'readwrite'); const st = tx.objectStore('handoff'); const g = st.get('last'); g.onsuccess = () => { st.delete('last'); res(g.result); }; g.onerror = () => res(null); });
    if (v && Date.now() - v.at < 10 * 60 * 1000 && v.files && v.files.length) return v.files.map((f) => new File([f.blob], f.name, { type: f.type }));
    return [];
  };
  studio.addEventListener('click', async (e) => {
    const nb = e.target.closest('[data-next-slug]'); if (!nb || !results.length) return;
    nb.disabled = true;
    try { const ready = await Promise.all(results.map(async (f) => ({ name: f.name, blob: f.blob || await f.get() }))); await putHandoff(ready); location.href = '/tools/' + nb.dataset.nextSlug + '/#from-' + studio.dataset.slug; }
    catch (err) { nb.disabled = false; ctx.status('Could not pass the file on. Download it and add it to the next tool instead.', 'error'); }
  });
  if (/^#from-/.test(location.hash)) {
    takeHandoff().then((files) => { if (files.length) { history.replaceState(null, '', location.pathname); take(files); } }).catch(() => {});
  }

  /* ---------- buttons ---------- */
  studio.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]'); if (!b || !studio.contains(b)) return;
    const act = b.dataset.act;
    if (act === 'add') { input.click(); return; }
    if (act === 'clear') {
      if (engine) engine.clear(); ctx.reset(); ctx.status(''); ctx.progress(null); ctx.summary('');
      studio.hidden = true; studio.classList.remove('is-new');
      page.querySelector('.hvt-hero').scrollIntoView({ behavior: 'smooth', block: 'start' }); return;
    }
    if (act === 'download') { if (dl) dl(); return; }
    if (act === 'run') {
      if (!engine || busy) return;
      ctx.busy(true); ctx.reset(); ctx.busy(true);

      try { await engine.run(opts()); }
      catch (err) { console.error(err); ctx.progress(null); ctx.status(friendly(err), 'error'); }
      finally { ctx.busy(false); }
      return;
    }
    if (engine && engine.action) engine.action(act, opts());
  });
  refresh();
}

function friendly(err) {
  const m = String((err && err.message) || err || '');
  if (/memory|allocation|RangeError|OOM/i.test(m)) return 'This device ran out of memory for this file. Try a smaller file or a lower setting, or use a computer.';
  if (/could not load|fetch|network|Failed to load/i.test(m)) return 'The tool could not load its files. Check your connection and try again.';
  return 'That did not work: ' + m;
}