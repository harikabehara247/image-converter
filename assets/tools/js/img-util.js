/* file: assets/tools/js/img-util.js */
/* Shared image helpers for the tools */
const svg = (p) => '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
export const ICON = {
  down: svg('<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 20h16"/>'),
  x: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  up: svg('<path d="M12 19V5M6 11l6-6 6 6"/>'),
  dn: svg('<path d="M12 5v14M6 13l6 6 6-6"/>'),
  check: svg('<path d="M20 6 9 17l-5-5"/>'),
  undo: svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
  redo: svg('<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>'),
};

/* Decode a file into an ImageBitmap (or canvas), respecting phone photo rotation */
export async function loadBitmap(file) {
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { /* fall back below */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.decoding = 'async'; img.src = url;
    await img.decode();
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0); return c;
  } finally { URL.revokeObjectURL(url); }
}

/* Draw src into a w×h canvas. fit: stretch | cover (fill and crop) | contain (fit with background) */
export function toCanvas(src, w, h, fit = 'stretch', bg = null, position = null) {
  const sw = src.width, sh = src.height;
  let sx = 0, sy = 0, cw = sw, ch = sh, dx = 0, dy = 0, dw = w, dh = h;
  if (fit === 'cover') { const s = Math.max(w / sw, h / sh); cw = w / s; ch = h / s; const z = Math.max(1, Math.min(4, Number(position?.zoom) || 1)); cw /= z; ch /= z; sx = (sw - cw) * Math.max(0, Math.min(1, position?.x ?? 0.5)); sy = (sh - ch) * Math.max(0, Math.min(1, position?.y ?? 0.5)); }
  else if (fit === 'contain') { const s = Math.min(w / sw, h / sh); dw = Math.round(sw * s); dh = Math.round(sh * s); dx = Math.round((w - dw) * Math.max(0, Math.min(1, position?.x ?? 0.5))); dy = Math.round((h - dh) * Math.max(0, Math.min(1, position?.y ?? 0.5))); }
  /* Step down in halves for big reductions: sharper than one large jump */
  let source = src, srcX = sx, srcY = sy, srcW = cw, srcH = ch;
  while (srcW / dw > 2.2 && srcH / dh > 2.2) {
    const t = document.createElement('canvas'); t.width = Math.max(1, Math.round(srcW / 2)); t.height = Math.max(1, Math.round(srcH / 2));
    const tc = t.getContext('2d'); tc.imageSmoothingEnabled = true; tc.imageSmoothingQuality = 'high';
    tc.drawImage(source, srcX, srcY, srcW, srcH, 0, 0, t.width, t.height);
    source = t; srcX = 0; srcY = 0; srcW = t.width; srcH = t.height;
  }
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(source, srcX, srcY, srcW, srcH, dx, dy, dw, dh);
  return c;
}

export function encode(canvas, type, quality) {
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('the image could not be saved'))), type, quality));
}

export function extFor(type) { return ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' })[type] || 'png'; }

/* Before/after comparison slider. Returns the element. */
export function compare(beforeUrl, afterUrl, checker = false, sweep = true) {
  const el = document.createElement('div');
  el.className = 'hvt-compare' + (checker ? ' is-checker' : '');
  el.innerHTML = '<img alt="Before" class="hvt-cmp-a"><div class="hvt-cmp-b"><img alt="After"></div><span class="hvt-cmp-line"></span><input type="range" min="0" max="100" value="50" aria-label="Compare before and after"><span class="hvt-cmp-l">Before</span><span class="hvt-cmp-r">After</span>';
  el.querySelector('.hvt-cmp-a').src = beforeUrl;
  el.querySelector('.hvt-cmp-b img').src = afterUrl;
  const r = el.querySelector('input'), b = el.querySelector('.hvt-cmp-b');
  const set = () => { b.style.clipPath = 'inset(0 0 0 ' + r.value + '%)'; el.style.setProperty('--x', r.value + '%'); };
  r.addEventListener('input', set); set();
  /* a short sweep shows that the slider can be dragged */
  if (sweep && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let t0 = 0; const run = (t) => { if (!t0) t0 = t; const p = Math.min(1, (t - t0) / 1100); r.value = 50 + Math.sin(p * Math.PI * 2) * 30 * (1 - p); set(); if (p < 1) requestAnimationFrame(run); else { r.value = 50; set(); } };
    setTimeout(() => requestAnimationFrame(run), 350);
  }
  return el;
}

/* Large preview of an image or video in the stage */
export function view(html, checker = false) {
  const v = document.createElement('div'); v.className = 'hvt-view' + (checker ? ' is-checker' : ''); v.innerHTML = html; return v;
}

/* Save a canvas as JPEG within a size range (for forms that say "20 KB to 50 KB").
 * Finds the best quality that stays under maxKB. If even the best quality is below minKB (tiny pixel sizes),
 * the file is padded with an empty JPEG comment so it meets the minimum; the picture itself is unchanged. */
export async function fitKB(canvas, minKB, maxKB) {
  const max = (maxKB || 1e6) * 1024 * 0.985, min = (minKB || 0) * 1024;
  let lo = 0.05, hi = 1, best = null, bestQ = 0;
  const top = await encode(canvas, 'image/jpeg', 0.98);
  if (top.size <= max) { best = top; bestQ = 0.98; }
  else {
    for (let i = 0; i < 9; i++) {
      const q = (lo + hi) / 2, b = await encode(canvas, 'image/jpeg', q);
      if (b.size <= max) { best = b; bestQ = q; lo = q; } else hi = q;
    }
    if (!best) { best = await encode(canvas, 'image/jpeg', 0.05); bestQ = 0.05; }
  }
  let padded = false;
  if (best.size < min) {
    const buf = new Uint8Array(await best.arrayBuffer()), need = Math.ceil(min - buf.length + 64), parts = [buf.slice(0, 2)];
    let left = need;
    while (left > 0) { const n = Math.min(65533, Math.max(1, left - 4)); const seg = new Uint8Array(n + 4); seg[0] = 0xFF; seg[1] = 0xFE; seg[2] = (n + 2) >> 8; seg[3] = (n + 2) & 255; seg.fill(32, 4); parts.push(seg); left -= n + 4; }
    parts.push(buf.slice(2)); best = new Blob(parts, { type: 'image/jpeg' }); padded = true;
  }
  return { blob: best, quality: bestQ, padded, over: best.size > max };
}