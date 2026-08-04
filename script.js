const mapWrap = document.getElementById('mapWrap');
const oathBtn = document.getElementById('oathBtn');
const svg = document.getElementById('map');
const groups = document.querySelectorAll('.locale-group');
const body = document.getElementById('pageBody');
const langToggle = document.getElementById('langToggle');

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

let revealed = false;
let currentNote = null;
let currentLang = 'ar';

const placeholders = {
  ar: 'لسه من غير تفاصيل...',
  en: 'No details yet...'
};

// shrink a banner line's font-size just enough that it fits inside the ribbon;
// the ribbon itself is already drawn generously, this is just a safety net
function fitBannerText(el, maxWidth) {
  let size = 16;
  el.style.fontSize = size + 'px';
  el.style.fontWeight = '700';
  if (!el.textContent) return;
  try {
    let width = el.getBBox().width;
    while (width > maxWidth && size > 6) {
      size -= 0.5;
      el.style.fontSize = size + 'px';
      width = el.getBBox().width;
    }
  } catch (e) { /* element not measurable yet - ignore, re-fit runs again once fonts load */ }
}

function applyLanguage() {
  const isEn = currentLang === 'en';
  body.classList.toggle('lang-en', isEn);
  body.classList.toggle('lang-ar', !isEn);
  document.documentElement.dir = isEn ? 'ltr' : 'rtl';
  document.documentElement.lang = isEn ? 'en' : 'ar';

  langToggle.textContent = isEn ? langToggle.dataset.enLabel : langToggle.dataset.arLabel;

  document.querySelectorAll('[data-ar][data-en]').forEach(el => {
    el.textContent = isEn ? el.dataset.en : el.dataset.ar;
  });

  groups.forEach(g => {
    const label = g.querySelector('.locale-label');
    if (label) label.textContent = isEn ? g.dataset.nameEn : g.dataset.nameAr;
  });

  document.querySelectorAll('.name-banner').forEach(b => {
    const l1 = b.querySelector('.banner-line1');
    const l2 = b.querySelector('.banner-line2');
    if (l1) { l1.textContent = isEn ? b.dataset.enL1 : b.dataset.arL1; fitBannerText(l1, 76); }
    if (l2) { l2.textContent = isEn ? b.dataset.enL2 : b.dataset.arL2; fitBannerText(l2, 76); }
  });

  if (currentNote) { currentNote.remove(); currentNote = null; }
}

langToggle.addEventListener('click', () => {
  currentLang = currentLang === 'ar' ? 'en' : 'ar';
  applyLanguage();
});

applyLanguage();

// custom web fonts (Aref Ruqaa / MedievalSharp / Markazi Text) load asynchronously -
// re-measure the banner text once they're actually ready, or the very first fit can be
// based on a fallback font and end up too wide once the real font swaps in
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(applyLanguage).catch(() => {});
}

oathBtn.addEventListener('click', () => {
  revealed = !revealed;
  mapWrap.classList.toggle('revealed', revealed);
  oathBtn.classList.toggle('active', revealed);
  oathBtn.textContent = revealed ? 'Mischief Managed' : 'I solemnly swear that I am up to no good';
  if (!revealed && currentNote) { currentNote.remove(); currentNote = null; }
});

function svgPointToScreen(x, y) {
  const pt = svg.createSVGPoint();
  pt.x = x; pt.y = y;
  const ctm = svg.getScreenCTM();
  const screenPt = pt.matrixTransform(ctm);
  const wrapRect = mapWrap.getBoundingClientRect();
  return { x: screenPt.x - wrapRect.left, y: screenPt.y - wrapRect.top };
}

// --- walking system: the foot, the banner and the footprints are all positioned from
// ONE shared JS clock per trail (no separate SMIL animations), so they cannot drift apart ---
const trailDurations = { trail1: 12, trail2: 13.3, trail3: 14.6, trail4: 15.5, trail5: 16.6, trail6: 17.6, trail7: 18.7 };

const walkers = Object.keys(trailDurations).map(id => {
  const pathEl = document.getElementById(id);
  const foot = document.querySelector('.walker-foot[data-trail="' + id + '"]');
  const banner = document.querySelector('.walker-banner[data-trail="' + id + '"]');
  const dest = document.getElementById('fp-' + id);
  if (!pathEl || !foot || !banner || !dest) {
    console.warn('maltiverse map: missing element(s) for', id, { pathEl, foot, banner, dest });
    return null;
  }
  return {
    id,
    dur: trailDurations[id],
    path: pathEl,
    len: pathEl.getTotalLength(),
    foot,
    banner,
    dest,
    toggle: false,
    lastSpawn: 0
  };
}).filter(Boolean);

const startTime = performance.now();

function spawnFootprint(w, x, y, angle) {
  const side = w.toggle ? 3.4 : -3.4;
  w.toggle = !w.toggle;
  const rad = (angle + 90) * Math.PI / 180;
  const cx = x + side * Math.cos(rad);
  const cy = y + side * Math.sin(rad);
  const fp = document.createElementNS(SVG_NS, 'use');
  fp.setAttributeNS(XLINK_NS, 'href', '#bootprint');
  fp.setAttribute('class', 'bootprint footstep-live');
  fp.setAttribute('width', '7');
  fp.setAttribute('height', '13');
  fp.setAttribute('x', -3.5);
  fp.setAttribute('y', -6.5);
  fp.setAttribute('transform', 'translate(' + cx + ' ' + cy + ') rotate(' + (angle + 90) + ')');
  w.dest.appendChild(fp);
  setTimeout(() => fp.remove(), 2400);
}

function tick(now) {
  const elapsed = (now - startTime) / 1000;
  walkers.forEach(w => {
    // guard each walker independently so one bad frame can never freeze the whole loop
    try {
      const t = (elapsed % w.dur) / w.dur;
      const dist = t * w.len;
      const p = w.path.getPointAtLength(dist);
      const p2 = w.path.getPointAtLength(Math.min(dist + 0.75, w.len));
      const angle = Math.atan2(p2.y - p.y, p2.x - p.x) * 180 / Math.PI;

      w.foot.setAttribute('transform', 'translate(' + p.x + ' ' + p.y + ') rotate(' + angle + ')');
      w.banner.setAttribute('transform', 'translate(' + p.x + ' ' + p.y + ')');

      if (revealed && now - w.lastSpawn > 240) {
        w.lastSpawn = now;
        spawnFootprint(w, p.x, p.y, angle);
      }
    } catch (e) {
      console.warn('maltiverse map: tick error for', w.id, e);
    }
  });
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

groups.forEach(g => {
  g.addEventListener('click', () => {
    if (!revealed) {
      revealed = true;
      mapWrap.classList.add('revealed');
      oathBtn.classList.add('active');
      oathBtn.textContent = 'Mischief Managed';
    }

    if (currentNote) currentNote.remove();

    const text = (currentLang === 'en' ? g.dataset.textEn : g.dataset.textAr) || '';
    const bodyHtml = text.trim()
      ? `<p>${text}</p>`
      : `<p class="placeholder">${placeholders[currentLang]}</p>`;

    const name = currentLang === 'en' ? g.dataset.nameEn : g.dataset.nameAr;

    const note = document.createElement('div');
    note.className = 'note';
    note.innerHTML = `
      <button class="close" aria-label="close">✕</button>
      <h3>${name}</h3>
      ${bodyHtml}
    `;
    mapWrap.appendChild(note);

    const x = parseFloat(g.dataset.x);
    const y = parseFloat(g.dataset.y);
    const pos = svgPointToScreen(x, y);
    let left = pos.x - 105;
    let top = pos.y - 150;
    left = Math.max(8, Math.min(left, mapWrap.clientWidth - 290));
    top = Math.max(8, top);
    note.style.left = left + 'px';
    note.style.top = top + 'px';

    requestAnimationFrame(() => note.classList.add('show'));

    note.querySelector('.close').addEventListener('click', (ev) => {
      ev.stopPropagation();
      note.classList.remove('show');
      setTimeout(() => note.remove(), 300);
      currentNote = null;
    });

    currentNote = note;
  });
});