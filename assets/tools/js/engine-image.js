/* file: assets/tools/js/engine-image.js */
/* Image converter, compressor and resizer (one engine, three modes). Uses the browser's own canvas. */
import { loadBitmap, toCanvas, encode, extFor, ICON } from './img-util.js?v=20261025-1';

const QUALITY = { small: 0.6, balanced: 0.75, high: 0.88 };

export default function (ctx) {
  const mode = ctx.mode;
  let items = [];
  ctx.stage.innerHTML = '<div data-big></div><ul class="hvt-files" data-list></ul><div data-preview></div>';
  const list = ctx.stage.querySelector('[data-list]'), preview = ctx.stage.querySelector('[data-preview]'), big = ctx.stage.querySelector('[data-big]');
  let liveTimer = 0, selected = null;

  /* One image: show it large. Resizer: draw the actual output (crop, fit, background) live as settings change */
  function drawBig() {
    clearTimeout(liveTimer);
    if (!items.length) { big.innerHTML = ''; list.classList.remove('is-one'); return; }
    list.classList.toggle('is-one', items.length === 1);
    const it = items.includes(selected) ? selected : (selected = items[0]), o = ctx.opts();
    if(o.keepalpha && outType(it,o)!=='image/jpeg') o.bg=null;
    big.innerHTML = '';
    const frame = document.createElement('div'); frame.className = 'hvt-view is-checker'; big.appendChild(frame);
    if (mode !== 'resize') { const img = new Image(); img.alt = 'Your image'; img.src = it.url; frame.appendChild(img); return; }
    const size = targetSize(it, o), k = Math.min(1, 640 / Math.max(size.w, size.h));
    const host = document.createElement('div'); host.className = 'hvt-live'; frame.appendChild(host);
    const draw = () => {
      const c = toCanvas(it.bmp, Math.max(1, Math.round(size.w*k)), Math.max(1, Math.round(size.h*k)), size.fit, size.fit === 'contain' ? o.bg : null, it.position);
      const old = host.querySelector('canvas'); if (old) old.replaceWith(c); else host.prepend(c);
      c.style.maxWidth='100%'; c.style.maxHeight='420px'; c.style.touchAction='none'; c.style.cursor=size.fit==='cover'||size.fit==='contain'?'grab':'default';
      c.tabIndex=0; c.setAttribute('aria-label','Image position preview. Use arrow keys to move the image.');
      let drag=null;
      const change = () => { it.out=null; it.li.querySelector('.hvt-save').hidden=true; it.li.querySelector('[data-dl]').hidden=true; preview.innerHTML=''; ctx.reset(); };
      c.addEventListener('pointerdown', e=>{ if(ctx.root.classList.contains('is-busy')||!['cover','contain'].includes(size.fit))return; e.preventDefault(); c.setPointerCapture(e.pointerId); drag={x:e.clientX,y:e.clientY,px:it.position.x,py:it.position.y}; c.style.cursor='grabbing'; });
      c.addEventListener('pointermove',e=>{if(!drag)return; const r=c.getBoundingClientRect(), scale=(size.fit==='cover'?Math.max(size.w/it.w,size.h/it.h)*it.position.zoom:Math.min(size.w/it.w,size.h/it.h)); const dx=size.w-it.w*scale,dy=size.h-it.h*scale; it.position.x=dx?Math.max(0,Math.min(1,drag.px+(e.clientX-drag.x)*size.w/r.width/dx)):0.5; it.position.y=dy?Math.max(0,Math.min(1,drag.py+(e.clientY-drag.y)*size.h/r.height/dy)):0.5; const next=toCanvas(it.bmp,c.width,c.height,size.fit,size.fit==='contain'?o.bg:null,it.position); c.getContext('2d').clearRect(0,0,c.width,c.height); c.getContext('2d').drawImage(next,0,0); sync(); change();});
      const finish=()=>{drag=null;c.style.cursor='grab';}; c.addEventListener('pointerup',finish);c.addEventListener('pointercancel',finish);
      c.addEventListener('keydown',e=>{const move={ArrowLeft:[-0.02,0],ArrowRight:[0.02,0],ArrowUp:[0,-0.02],ArrowDown:[0,0.02]}[e.key];if(!move||!['cover','contain'].includes(size.fit))return;e.preventDefault(); const sign=size.fit==='cover'?-1:1; it.position.x=Math.max(0,Math.min(1,it.position.x+move[0]*sign));it.position.y=Math.max(0,Math.min(1,it.position.y+move[1]*sign));change();draw();sync();});
    };
    const controls=document.createElement('div'); controls.className='hvt-position'; controls.style.cssText='display:grid;gap:10px;padding:14px;border:1px solid #ded8f4;border-radius:12px;margin:12px 0;background:#fff';
    controls.innerHTML='<strong>Position your image</strong><p style="margin:0">Drag the preview or use the controls. For logos, choose Fit whole image to keep every edge.</p><label>Horizontal position <input type="range" min="0" max="100" data-pos="x" aria-label="Horizontal position"></label><label>Vertical position <input type="range" min="0" max="100" data-pos="y" aria-label="Vertical position"></label><label data-zoom>Zoom <input type="range" min="100" max="400" data-pos="zoom" aria-label="Crop zoom"></label><button type="button" data-center>Reset position and zoom</button><small></small>';
    big.appendChild(controls);
    const sync=()=>{controls.querySelector('[data-pos=x]').value=it.position.x*100;controls.querySelector('[data-pos=y]').value=it.position.y*100;controls.querySelector('[data-pos=zoom]').value=it.position.zoom*100;};
    controls.hidden=!['cover','contain'].includes(size.fit);controls.querySelector('[data-zoom]').hidden=size.fit!=='cover';
    controls.querySelector('small').textContent='Preview and download: '+size.w+' × '+size.h+' px'+(items.length>1?' · Select an image below to adjust it.':'');
    controls.addEventListener('input',e=>{if(!e.target.dataset.pos)return;it.position[e.target.dataset.pos]=Number(e.target.value)/100;invalidateOutput();draw();});
    const invalidateOutput=()=>{it.out=null;it.li.querySelector('.hvt-save').hidden=true;it.li.querySelector('[data-dl]').hidden=true;preview.innerHTML='';ctx.reset();ctx.status('Position updated. Press Resize to create the download.');};
    controls.querySelector('[data-center]').addEventListener('click',()=>{it.position={x:0.5,y:0.5,zoom:1};invalidateOutput();sync();draw();});
    sync();draw();
  }

  const row = (it) => {
    const li = document.createElement('li');
    li.innerHTML = '<img alt="" class="hvt-thumb"><div class="hvt-file-main"><span class="hvt-file-name"></span><span class="hvt-file-meta"></span><div class="hvt-save" hidden><div class="hvt-save-bar"><i></i></div><small></small></div></div>'
      + '<div class="hvt-file-acts"><button type="button" class="hvt-icon-btn" data-dl hidden aria-label="Download this image">' + ICON.down + '</button><button type="button" class="hvt-icon-btn" data-rm aria-label="Remove this image">' + ICON.x + '</button></div>';
    li.querySelector('img').src = it.url;
    if (mode === 'resize') { const choose = document.createElement('button'); choose.type='button'; choose.className='hvt-edit-position'; choose.textContent='Edit position'; choose.addEventListener('click',()=>{selected=it;drawBig();}); li.querySelector('.hvt-file-acts').prepend(choose); }
    li.querySelector('.hvt-file-name').textContent = it.file.name;
    li.querySelector('.hvt-file-meta').textContent = it.w + ' × ' + it.h + ' px · ' + ctx.bytes(it.file.size);
    li.querySelector('[data-rm]').addEventListener('click', () => { URL.revokeObjectURL(it.url); items = items.filter((x) => x !== it); li.remove(); invalidate(); });
    li.querySelector('[data-dl]').addEventListener('click', () => it.out && ctx.save(it.out.blob, it.out.name));
    it.li = li; return li;
  };

  const head = () => {
    const total = items.reduce((s, x) => s + x.file.size, 0);
    ctx.summary(items.length ? items.length + (items.length === 1 ? ' image · ' : ' images · ') + ctx.bytes(total) : '');
    if (!items.length) ctx.status('Add images to get started.');
  };

  const invalidate = () => {
    items.forEach((x) => { x.out = null; if (x.li) { x.li.querySelector('.hvt-save').hidden = true; x.li.querySelector('[data-dl]').hidden = true; } });
    preview.innerHTML = ''; ctx.reset(); head(); drawBig();
    if (items.length) ctx.status(items.length === 1 ? 'Ready. Choose your settings and press the button.' : items.length + ' images ready.');
  };

  async function add(files) {
    for (const file of files) {
      try {
        const bmp = await loadBitmap(file);
        const it = { file, url: URL.createObjectURL(file), w: bmp.width, h: bmp.height, bmp, position: { x: 0.5, y: 0.5, zoom: 1 } };
        items.push(it); list.appendChild(row(it));
      } catch (e) { ctx.status(file.name + ' could not be opened. This browser cannot read that image type.', 'error'); }
    }
    invalidate();
  }

  function targetSize(it, o) {
    if (mode === 'compress') {
      const max = Number(o.max) || 0, s = max && Math.max(it.w, it.h) > max ? max / Math.max(it.w, it.h) : 1;
      return { w: Math.round(it.w * s), h: Math.round(it.h * s), fit: 'stretch' };
    }
    if (mode !== 'resize') return { w: it.w, h: it.h, fit: 'stretch' };
    if (o.preset === 'percent') return { w: Math.max(1, Math.round(it.w * o.pct / 100)), h: Math.max(1, Math.round(it.h * o.pct / 100)), fit: 'stretch' };
    if (o.preset === 'custom') {
      const w = Math.max(1, o.w || it.w), h = Math.max(1, o.h || it.h);
      if (o.lock) { const s = Math.min(w / it.w, h / it.h); return { w: Math.max(1, Math.round(it.w * s)), h: Math.max(1, Math.round(it.h * s)), fit: 'stretch' }; }
      return { w, h, fit: o.fit };
    }
    const m = /^(\d+)x(\d+)/.exec(o.preset || '1080x1080'); return { w: +m[1], h: +m[2], fit: o.fit };
  }
  const outType = (it, o) => (o.format && o.format !== 'keep' ? o.format : (/^image\/(png|jpeg|webp)$/.test(it.file.type) ? it.file.type : 'image/png'));

  async function one(it, o) {
    const size = targetSize(it, o);
    let type = outType(it, o);
    const target = mode === 'compress' && o.goal === 'kb';
    if (target && type === 'image/png') type = 'image/jpeg';
    if (target) {
      const kb = o.kbsel === 'custom' ? Number(o.kb) : Number(o.kbsel);
      const limit = Math.max(1, kb || 50) * 1024;
      let scale = 1;
      for (let round = 0; round < 14; round++) {
        const c = toCanvas(it.bmp, Math.max(16, Math.round(size.w * scale)), Math.max(16, Math.round(size.h * scale)), 'stretch', type === 'image/jpeg' ? '#ffffff' : null);
        let lo = 0.05, hi = 0.95, fit = null;
        const top = await encode(c, type, hi);
        if (top.size <= limit) fit = top;
        else for (let i = 0; i < 7; i++) { const q = (lo + hi) / 2, b = await encode(c, type, q); if (b.size <= limit) { fit = b; lo = q; } else hi = q; }
        if (!fit) { const b = await encode(c, type, 0.05); if (b.size <= limit) fit = b; }
        if (fit) return { blob: fit, name: ctx.rename(it.file.name, extFor(fit.type)), w: c.width, h: c.height };
        scale *= 0.82;
      }
      throw new Error('it could not get under ' + kb + ' KB');
    }
    const bg = type === 'image/jpeg' ? (o.bg || '#ffffff') : (size.fit === 'contain' && !o.keepalpha ? o.bg : null);
    const c = toCanvas(it.bmp, size.w, size.h, size.fit, bg, it.position);
    const q = mode === 'compress' ? (QUALITY[o.goal] || 0.75) : (o.quality ? o.quality / 100 : 0.92);
    const blob = await encode(c, type, q);
    return { blob, name: ctx.rename(it.file.name, extFor(blob.type)), w: c.width, h: c.height };
  }

  async function run(o) {
    if (!items.length) { ctx.status('Add images first.', 'error'); return; }
    let i = 0, fallback = false;
    for (const it of items) {
      ctx.status(items.length > 1 ? 'Working on ' + (i + 1) + ' of ' + items.length + '…' : 'Working…'); ctx.progress(i / items.length);
      const save = it.li.querySelector('.hvt-save'), small = save.querySelector('small'), barI = save.querySelector('i');
      try {
        it.out = await one(it, o);
        if (o.format && o.format !== 'keep' && it.out.blob.type !== o.format) fallback = true;
        const ratio = it.out.blob.size / it.file.size, pct = Math.round((1 - ratio) * 100);
        barI.style.width = Math.max(3, Math.min(100, ratio * 100)) + '%';
        small.className = pct > 0 ? '' : 'is-up';
        small.textContent = ctx.bytes(it.out.blob.size) + ' ' + extFor(it.out.blob.type).toUpperCase() + ' · ' + it.out.w + ' × ' + it.out.h + (pct > 0 ? ' · ' + pct + '% smaller' : pct < 0 ? ' · ' + -pct + '% larger' : '');
        save.hidden = false; barI.style.animation = 'none'; void barI.offsetWidth; barI.style.animation = '';
        it.li.querySelector('[data-dl]').hidden = false;
      } catch (e) { it.out = null; save.hidden = false; barI.style.width = '0'; small.className = 'is-up'; small.textContent = 'Not done: ' + (e.message || e); }
      i++; await new Promise((r) => setTimeout(r, 0));
    }
    ctx.progress(null);
    const done = items.filter((x) => x.out);
    if (!done.length) { ctx.status('None of the images could be processed.', 'error'); return; }
    const a = done.reduce((s, x) => s + x.file.size, 0), b = done.reduce((s, x) => s + x.out.blob.size, 0), pct = Math.round((1 - b / a) * 100);
    ctx.status((done.length === 1 ? 'Done: ' : 'Done, ' + done.length + ' images: ') + ctx.bytes(a) + ' → ' + ctx.bytes(b) + (pct > 0 ? ', ' + pct + '% smaller.' : '.') + (fallback ? ' This browser cannot save that format, so PNG was used.' : ''), 'ok');
    preview.innerHTML = '';
    if (done.length === 1 && mode !== 'resize') {
      const r = document.createElement('div'); r.className = 'hvt-result';
      r.innerHTML = '<p>' + ICON.check + 'Result</p><div class="hvt-view is-checker"><img alt="Result"></div>';
      r.querySelector('img').src = URL.createObjectURL(done[0].out.blob); preview.appendChild(r);
    }
    const files = done.map((x) => x.out);
    ctx.done(done.length > 1 ? 'Download all (ZIP)' : 'Download ' + extFor(done[0].out.blob.type).toUpperCase(),
      () => (done.length === 1 ? ctx.save(done[0].out.blob, done[0].out.name) : ctx.zip(files, 'hview-' + mode + '-' + done.length + '-images.zip')), files);
  }

  function clear() { items.forEach((x) => URL.revokeObjectURL(x.url)); items = []; list.innerHTML = ''; preview.innerHTML = ''; big.innerHTML = ''; }
  function optionsChanged() { if (items.some((x) => x.out)) invalidate(); else drawBig(); }
  return { add, run, clear, optionsChanged };
}