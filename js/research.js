/* ── UTILS ───────────────────────────────────────────────────────────────── */

const pad = n => String(n).padStart(2, '0');
const nowStamp = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

function prng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sparklePath(cx, cy, s) {
  const k = s * 0.13;
  return [
    `M${cx} ${cy - s}`,
    `C${cx+k} ${cy-k} ${cx+k} ${cy-k} ${cx+s} ${cy}`,
    `C${cx+k} ${cy+k} ${cx+k} ${cy+k} ${cx} ${cy+s}`,
    `C${cx-k} ${cy+k} ${cx-k} ${cy+k} ${cx-s} ${cy}`,
    `C${cx-k} ${cy-k} ${cx-k} ${cy-k} ${cx} ${cy-s}`,
    'Z',
  ].join(' ');
}

/* ── STATE ───────────────────────────────────────────────────────────────── */

let nodes = [];
let activeStatus = 'ALL';
let activeTag = 'ALL';
let logs = [];
let focusMode = false;
let logIntervalMs = 900;
let logIntervalId = null;
let logIdx = 0;
let cursor = { x: 0.5, y: 0.5 };
let scrollX = 0;
let isMobile = window.innerWidth < 768;
let W = window.innerWidth;
let H = window.innerHeight;

const LOG_LINES = [
  '[SYSTEM]   Scanning latent space... OK',
  '[QUERY]    Cross-referencing ontological frameworks',
  '[DATA]     Vectorizing semantic clusters · node_772',
  '[STATUS]   Calculating heuristic weights [0.882]',
  '[PROCESS]  Shifting probability distributions',
  '[MEM]      Re-indexing latent nodes',
  '[AGENT_01] Synthesizing inference graph...',
  '[QUERY]    Resolving citation chain · depth=4',
  '[DATA]     Embedding paragraph · dim=1536',
  '[STATUS]   Coherence delta +0.014',
  '[PROCESS]  Pruning low-salience tokens',
  '[SYSTEM]   Heartbeat OK · uptime 04:21:09',
];

/* ── NEBULA CANVAS ───────────────────────────────────────────────────────── */

const CLOUDS = [
  { x:0.20, y:0.32, r:0.44, rgb:[18,10,38],  bright:[118, 92,178], intensity:0.52, ph:0.0 },
  { x:0.62, y:0.22, r:0.35, rgb:[14, 8,30],  bright:[ 95, 72,148], intensity:0.44, ph:1.3 },
  { x:0.50, y:0.65, r:0.40, rgb:[20,11,40],  bright:[108, 84,162], intensity:0.48, ph:2.6 },
  { x:0.10, y:0.72, r:0.26, rgb:[ 6, 6,22],  bright:[ 75, 58,112], intensity:0.34, ph:3.9 },
  { x:0.78, y:0.58, r:0.28, rgb:[16, 9,34],  bright:[ 88, 68,132], intensity:0.38, ph:5.2 },
  { x:0.35, y:0.50, r:0.32, rgb:[12, 7,28],  bright:[ 80, 62,120], intensity:0.36, ph:6.5 },
  { x:0.25, y:0.33, r:0.08, rgb:[55,36, 8],  bright:[192,145, 48], intensity:0.26, ph:0.6, gold:true },
  { x:0.60, y:0.24, r:0.06, rgb:[46,30, 7],  bright:[168,126, 40], intensity:0.21, ph:1.8, gold:true },
  { x:0.50, y:0.58, r:0.07, rgb:[52,34, 8],  bright:[180,136, 44], intensity:0.23, ph:3.2, gold:true },
];

function initNebula() {
  const canvas = document.getElementById('nebula-canvas');
  const ctx = canvas.getContext('2d');
  const t0 = performance.now();
  const rng = prng(42);

  const stars = Array.from({ length: 230 }, () => ({
    x: rng(), y: rng(), r: 0.3 + rng() * 1.4, o: 0.18 + rng() * 0.72, ph: rng() * Math.PI * 2,
  }));
  const wisps = Array.from({ length: 95 }, () => ({
    x: rng(), y: rng(), len: 0.04 + rng() * 0.20,
    ang: rng() * Math.PI * 2, wob: (rng() - 0.5) * 0.75, o: 0.010 + rng() * 0.042,
  }));

  function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  resize();
  window.addEventListener('resize', resize);

  function draw(now) {
    const t = (now - t0) * 0.001;
    const CW = canvas.width, CH = canvas.height;
    ctx.fillStyle = '#05030e';
    ctx.fillRect(0, 0, CW, CH);
    ctx.globalCompositeOperation = 'lighter';

    for (const c of CLOUDS) {
      const dx = Math.sin(t * 0.046 + c.ph) * 0.017 * CW;
      const dy = Math.cos(t * 0.031 + c.ph) * 0.011 * CH;
      const cx = c.x * CW + dx, cy = c.y * CH + dy;
      const r  = c.r * Math.min(CW, CH);
      const [br, bg, bb] = c.bright, [cr, cg, cb] = c.rgb;

      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0,    `rgba(${br},${bg},${bb},${c.intensity})`);
      g.addColorStop(0.11, `rgba(${Math.round(br*.82)},${Math.round(bg*.82)},${Math.round(bb*.82)},${c.intensity*.73})`);
      g.addColorStop(0.34, `rgba(${cr},${cg},${cb},${c.intensity*.40})`);
      g.addColorStop(0.65, `rgba(${Math.round(cr*.45)},${Math.round(cg*.45)},${Math.round(cb*.45)},${c.intensity*.12})`);
      g.addColorStop(1,    'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();

      if (!c.gold) {
        const gi = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.3);
        gi.addColorStop(0, `rgba(215,200,240,${c.intensity * 0.18})`);
        gi.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gi;
        ctx.beginPath(); ctx.arc(cx, cy, r * 0.3, 0, Math.PI * 2); ctx.fill();
      }
    }

    for (const w of wisps) {
      ctx.strokeStyle = `rgba(168,150,210,${w.o})`;
      ctx.lineWidth = 0.35;
      ctx.beginPath();
      const wx = w.x * CW, wy = w.y * CH, len = w.len * Math.min(CW, CH);
      ctx.moveTo(wx, wy);
      ctx.quadraticCurveTo(
        wx + Math.cos(w.ang + w.wob) * len * 0.5,
        wy + Math.sin(w.ang + w.wob) * len * 0.5,
        wx + Math.cos(w.ang) * len,
        wy + Math.sin(w.ang) * len,
      );
      ctx.stroke();
    }

    for (const s of stars) {
      const twinkle = 0.60 + 0.40 * Math.sin(t * (0.7 + s.ph * 0.45) + s.ph * 5.1);
      const sx = s.x * CW, sy = s.y * CH, op = Math.min(1, s.o * twinkle);
      const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, s.r * 4.2);
      sg.addColorStop(0,    `rgba(255,252,248,${op})`);
      sg.addColorStop(0.28, `rgba(220,208,235,${op * 0.30})`);
      sg.addColorStop(1,    'rgba(0,0,0,0)');
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.arc(sx, sy, s.r * 4.2, 0, Math.PI * 2); ctx.fill();
    }

    ctx.globalCompositeOperation = 'source-over';
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
}

/* ── DEEP PARALLAX ───────────────────────────────────────────────────────── */

let deepInnerEl = null;

function buildDeepParallax() {
  const container = document.getElementById('deep-parallax');
  container.textContent = '';

  const rng = prng(888);
  const SPREAD = Math.max(W * 2.5, 2400);
  const svgNS = 'http://www.w3.org/2000/svg';

  const wrap = document.createElement('div');
  wrap.style.width = '100%';
  wrap.style.height = '100%';
  wrap.style.willChange = 'transform';

  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', SPREAD);
  svg.setAttribute('height', H);
  svg.style.position = 'absolute';
  svg.style.left = '0';
  svg.style.top = '0';

  for (let i = 0; i < 40; i++) {
    const c = document.createElementNS(svgNS, 'circle');
    c.setAttribute('cx', rng() * SPREAD);
    c.setAttribute('cy', rng() * H);
    c.setAttribute('r', 0.7 + rng() * 1.8);
    c.setAttribute('fill', `rgba(195,178,225,${(0.06 + rng() * 0.14).toFixed(3)})`);
    svg.appendChild(c);
  }
  for (let i = 0; i < 22; i++) {
    const x = rng() * SPREAD, y = rng() * H;
    const len = 18 + rng() * 80, ang = rng() * Math.PI * 2;
    const l = document.createElementNS(svgNS, 'line');
    l.setAttribute('x1', x); l.setAttribute('y1', y);
    l.setAttribute('x2', x + Math.cos(ang) * len); l.setAttribute('y2', y + Math.sin(ang) * len);
    l.setAttribute('stroke', `rgba(178,162,212,${(0.035 + rng() * 0.065).toFixed(3)})`);
    l.setAttribute('stroke-width', '0.55');
    svg.appendChild(l);
  }
  for (let i = 0; i < 5; i++) {
    const c = document.createElementNS(svgNS, 'circle');
    c.setAttribute('cx', rng() * SPREAD);
    c.setAttribute('cy', rng() * H);
    c.setAttribute('r', 25 + rng() * 55);
    c.setAttribute('fill', 'none');
    c.setAttribute('stroke', `rgba(190,175,222,${(0.03 + rng() * 0.05).toFixed(3)})`);
    c.setAttribute('stroke-width', '0.55');
    c.setAttribute('stroke-dasharray', '2 4');
    svg.appendChild(c);
  }

  wrap.appendChild(svg);
  container.appendChild(wrap);
  deepInnerEl = wrap;
}

function updateDeepParallax(sx) {
  if (deepInnerEl) deepInnerEl.style.transform = `translateX(${-sx * 0.25}px)`;
}

/* ── SCIENTIFIC HUD ──────────────────────────────────────────────────────── */

let hudInnerEl = null;
let hudCoordA1x = null, hudCoordA1y = null, hudCoordA2x = null, hudCoordA2y = null;
let hudCornerText = null, hudNodeFieldText = null;

function buildHud() {
  const container = document.getElementById('sci-hud');
  container.textContent = '';

  const svgNS = 'http://www.w3.org/2000/svg';
  const mf = "'Space Mono','Courier New',monospace";
  const CW = W, CH = H, MIN = Math.min(CW, CH);

  const C1 = { x: CW * 0.34, y: CH * 0.44, r: MIN * 0.27 };
  const C2 = { x: CW * 0.58, y: CH * 0.36, r: MIN * 0.23 };
  const A1 = { x: CW * 0.355, y: CH * 0.305, r: 54 };
  const A2 = { x: CW * 0.565, y: CH * 0.265, r: 42 };

  const rays = [
    [C1, { x: CW * 0.01, y: CH * 0.02 }],
    [C1, { x: CW * 0.87, y: CH * 0.04 }],
    [C1, { x: CW * 0.97, y: CH * 0.63 }],
    [C2, { x: CW * 0.98, y: CH * 0.01 }],
    [C2, { x: CW * 0.04, y: CH * 0.10 }],
  ];

  const mkDots = (ray, n) => Array.from({ length: n }, (_, i) => ({
    x: ray[0].x + (ray[1].x - ray[0].x) * (i + 1) / (n + 1),
    y: ray[0].y + (ray[1].y - ray[0].y) * (i + 1) / (n + 1),
  }));
  const dots1 = mkDots(rays[0], 5);
  const dots2 = mkDots(rays[3], 4);

  const inner = document.createElement('div');
  inner.style.width = '100%';
  inner.style.height = '100%';
  inner.style.transition = 'transform 0.38s cubic-bezier(0.2,0,0,1)';
  inner.style.willChange = 'transform';

  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.setAttribute('viewBox', `0 0 ${CW} ${CH}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.style.position = 'absolute';
  svg.style.inset = '0';
  svg.style.overflow = 'visible';

  const mk = (tag, attrs) => {
    const el = document.createElementNS(svgNS, tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  };
  const mkText = (x, y, content, fill, fontSize, ls) => {
    const t = document.createElementNS(svgNS, 'text');
    t.setAttribute('x', x); t.setAttribute('y', y);
    t.setAttribute('fill', fill); t.setAttribute('font-size', fontSize);
    t.setAttribute('font-family', mf);
    if (ls !== null) t.setAttribute('letter-spacing', ls);
    t.textContent = content;
    return t;
  };

  svg.appendChild(mk('line', { x1:C1.x, y1:0, x2:C1.x, y2:CH, stroke:'rgba(255,255,255,0.03)', 'stroke-width':'0.6' }));
  svg.appendChild(mk('line', { x1:0, y1:C1.y, x2:CW, y2:C1.y, stroke:'rgba(255,255,255,0.03)', 'stroke-width':'0.6' }));
  svg.appendChild(mk('circle', { cx:C1.x, cy:C1.y, r:C1.r, fill:'none', stroke:'rgba(255,255,255,0.06)', 'stroke-width':'0.75' }));
  svg.appendChild(mk('circle', { cx:C2.x, cy:C2.y, r:C2.r, fill:'none', stroke:'rgba(255,255,255,0.06)', 'stroke-width':'0.75' }));
  rays.forEach(([f, t]) => svg.appendChild(mk('line', { x1:f.x, y1:f.y, x2:t.x, y2:t.y, stroke:'rgba(255,255,255,0.07)', 'stroke-width':'0.5' })));
  dots1.forEach(p => svg.appendChild(mk('circle', { cx:p.x, cy:p.y, r:1.7, fill:'rgba(255,255,255,0.27)' })));
  dots2.forEach(p => svg.appendChild(mk('circle', { cx:p.x, cy:p.y, r:1.4, fill:'rgba(255,255,255,0.20)' })));
  svg.appendChild(mk('circle', { cx:A1.x, cy:A1.y, r:A1.r, fill:'none', stroke:'rgba(255,255,255,0.19)', 'stroke-width':'0.65', 'stroke-dasharray':'3 3.5' }));
  svg.appendChild(mk('circle', { cx:A2.x, cy:A2.y, r:A2.r, fill:'none', stroke:'rgba(255,255,255,0.17)', 'stroke-width':'0.60', 'stroke-dasharray':'3 3.5' }));

  [A1, A2].forEach((a, i) => {
    svg.appendChild(mk('circle', { cx:a.x, cy:a.y, r:i === 0 ? 12 : 10, fill:'rgba(255,255,255,0.025)', stroke:'rgba(255,255,255,0.24)', 'stroke-width':'0.65' }));
    svg.appendChild(mk('line', { x1:a.x-7, y1:a.y, x2:a.x+7, y2:a.y, stroke:'rgba(255,255,255,0.30)', 'stroke-width':'0.7' }));
    svg.appendChild(mk('line', { x1:a.x, y1:a.y-7, x2:a.x, y2:a.y+7, stroke:'rgba(255,255,255,0.30)', 'stroke-width':'0.7' }));
  });

  hudCoordA1x = mkText(A1.x + A1.r + 7, A1.y - 1,  'x: 0.500', 'rgba(255,255,255,0.28)', 10, '0.4');
  hudCoordA1y = mkText(A1.x + A1.r + 7, A1.y + 12, 'y: 0.500', 'rgba(255,255,255,0.28)', 10, '0.4');
  hudCoordA2x = mkText(A2.x + A2.r + 6, A2.y - 1,  '0.619',    'rgba(255,255,255,0.20)', 9,  null);
  hudCoordA2y = mkText(A2.x + A2.r + 6, A2.y + 10, '0.515',    'rgba(255,255,255,0.20)', 9,  null);
  svg.appendChild(hudCoordA1x); svg.appendChild(hudCoordA1y);
  svg.appendChild(hudCoordA2x); svg.appendChild(hudCoordA2y);

  [
    [A1.x, A1.y, 7,   'rgba(255,255,255,0.56)'],
    [A2.x, A2.y, 5.5, 'rgba(255,255,255,0.50)'],
    [C1.x, C1.y, 9.5, 'rgba(255,255,255,0.26)'],
    [C2.x + C2.r * 0.55, C2.y - C2.r * 0.55, 4.5, 'rgba(255,255,255,0.38)'],
    [dots1[2].x, dots1[2].y, 3, 'rgba(255,255,255,0.36)'],
  ].forEach(([cx, cy, s, fill]) => {
    svg.appendChild(mk('path', { d: sparklePath(cx, cy, s), fill }));
  });

  hudCornerText    = mkText(CW - 148, 30,     'x: 0.500 · y: 0.500', 'rgba(255,255,255,0.18)', 9, '0.7');
  hudNodeFieldText = mkText(22,        CH - 168, 'NODE_FIELD · 0x0000', 'rgba(255,255,255,0.18)', 9, '0.7');
  svg.appendChild(hudCornerText);
  svg.appendChild(hudNodeFieldText);

  inner.appendChild(svg);
  container.appendChild(inner);
  hudInnerEl = inner;
}

function updateHud(cx, cy, sx) {
  if (!hudInnerEl) return;
  const tx = (cx - 0.5) * 20 + (-sx * 0.50);
  const ty = (cy - 0.5) * 20;
  hudInnerEl.style.transform = `translate(${tx}px,${ty}px)`;
  if (hudCoordA1x) hudCoordA1x.textContent = `x: ${cx.toFixed(3)}`;
  if (hudCoordA1y) hudCoordA1y.textContent = `y: ${cy.toFixed(3)}`;
  if (hudCoordA2x) hudCoordA2x.textContent = ((cx * 1.13 + 0.03) % 1).toFixed(3);
  if (hudCoordA2y) hudCoordA2y.textContent = ((cy * 0.91 + 0.06) % 1).toFixed(3);
  if (hudCornerText)    hudCornerText.textContent = `x: ${cx.toFixed(3)} · y: ${cy.toFixed(3)}`;
  if (hudNodeFieldText) hudNodeFieldText.textContent = `NODE_FIELD · 0x${Math.floor(cx * 65535).toString(16).padStart(4, '0')}`;
}

/* ── SUBTITLE ────────────────────────────────────────────────────────────── */

function getFiltered() {
  return nodes.filter(n => {
    const matchStatus = activeStatus === 'ALL' || n.status === activeStatus;
    const matchTag = activeTag === 'ALL' || (n.tags && n.tags.includes(activeTag));
    return matchStatus && matchTag;
  });
}

function updateSubtitle() {
  const sub = document.getElementById('page-subtitle');
  if (!sub) return;
  const filtered = getFiltered();
  sub.textContent = `// ${filtered.length} nodes active · last sync ${nowStamp()} · engine status `;
  const ok = document.createElement('span');
  ok.className = 'engine-ok';
  ok.textContent = 'OK';
  sub.appendChild(ok);
}

/* ── CARDS ───────────────────────────────────────────────────────────────── */

function buildCard(node, index, cardH) {
  const article = document.createElement('article');
  article.className = 'research-card fade-in';
  article.style.animationDelay = `${index * 55}ms`;
  if (cardH && !isMobile) article.style.height = `${cardH}px`;

  ['tl', 'tr', 'bl', 'br'].forEach(pos => {
    const s = document.createElement('span');
    s.className = `corner-tick corner-tick-${pos}`;
    article.appendChild(s);
  });

  const header = document.createElement('div');
  header.className = 'card-header';
  const nodeId = document.createElement('span');
  nodeId.textContent = `[${node.id}]`;
  const headerRight = document.createElement('span');
  headerRight.className = 'card-header-right';
  const badge = document.createElement('span');
  badge.className = `card-type-badge card-type-${node.status.toLowerCase().replace(/\s+/g, '-')}`;
  badge.textContent = node.status;
  headerRight.appendChild(badge);
  header.appendChild(nodeId);
  header.appendChild(headerRight);
  article.appendChild(header);

  const title = document.createElement('h2');
  title.className = 'card-title';
  title.textContent = node.title;
  article.appendChild(title);

  const abstract = document.createElement('p');
  abstract.className = 'card-abstract';
  abstract.textContent = node.description;
  article.appendChild(abstract);

  const bottom = document.createElement('div');
  bottom.className = 'card-bottom';

  if (node.status === 'DONE' && node.link) {
    const linkEl = document.createElement('span');
    linkEl.className = 'card-link';
    linkEl.textContent = node.linkLabel || '→ READ';
    bottom.appendChild(linkEl);
  }

  const tagList = document.createElement('div');
  tagList.className = 'card-tags';
  (node.tags || []).forEach(t => {
    const chip = document.createElement('span');
    chip.className = 'card-tag';
    chip.textContent = t;
    tagList.appendChild(chip);
  });
  bottom.appendChild(tagList);

  article.appendChild(bottom);

  const coord = document.createElement('span');
  coord.className = 'hover-coord';
  coord.textContent = `x: 0.${(482 + index * 17) % 999} · y: 0.${(345 + index * 23) % 999}`;
  article.appendChild(coord);

  if (node.link) {
    const wrapper = document.createElement('a');
    wrapper.href = node.link;
    wrapper.className = 'card-link-wrapper';
    wrapper.appendChild(article);
    return wrapper;
  }

  return article;
}

function renderCards() {
  const track = document.getElementById('cards-track');
  if (!track) return;
  track.textContent = '';

  const progress = document.createElement('div');
  progress.id = 'scroll-progress';
  track.appendChild(progress);

  const flex = document.createElement('div');
  flex.id = 'cards-flex';

  const filtered = getFiltered();
  const cardH = isMobile ? null : Math.max(320, H - 402);

  filtered.forEach((node, idx) => flex.appendChild(buildCard(node, idx, cardH)));

  const cta = document.createElement('div');
  cta.id = 'load-more-cta';
  if (cardH && !isMobile) cta.style.height = `${cardH}px`;

  const line1 = document.createElement('div');
  line1.className = 'load-more-line';
  line1.style.background = 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.2))';

  const loadBtn = document.createElement('button');
  loadBtn.id = 'load-more-btn';
  loadBtn.textContent = '> LOAD_MORE_NODES';

  const line2 = document.createElement('div');
  line2.className = 'load-more-line';
  line2.style.background = 'linear-gradient(to top, transparent, rgba(255,255,255,0.2))';

  cta.appendChild(line1);
  cta.appendChild(loadBtn);
  cta.appendChild(line2);
  flex.appendChild(cta);
  track.appendChild(flex);

  if (!isMobile) {
    try {
      const saved = parseInt(localStorage.getItem('cr-sx') || '0', 10);
      if (saved > 0) track.scrollLeft = saved;
    } catch (_) {}
  }

  updateSubtitle();
}

function renderFilters() {
  const bar = document.getElementById('filter-bar');
  if (!bar) return;
  bar.textContent = '';

  function makeRow(className, label, items, activeValue, onClick) {
    const row = document.createElement('div');
    row.className = 'filter-row ' + className;
    const lbl = document.createElement('span');
    lbl.className = 'filter-row-label';
    lbl.textContent = label;
    row.appendChild(lbl);
    items.forEach(val => {
      const btn = document.createElement('button');
      btn.className = 'filter-btn' + (val === activeValue ? ' active' : '');
      btn.textContent = val;
      btn.addEventListener('click', () => {
        onClick(val);
        row.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.textContent === val));
        renderCards();
      });
      row.appendChild(btn);
    });
    return row;
  }

  const dynamicStatuses = [...new Set(nodes.map(n => n.status))];
  const orderedStatuses = ['TO REVIEW', 'TO SEARCH', 'DONE'].filter(s => dynamicStatuses.includes(s));
  const statusValues = ['ALL', ...orderedStatuses];

  const allTags = ['ALL', ...new Set(nodes.flatMap(n => n.tags || []))];

  bar.appendChild(makeRow('status-row', 'STATUS /', statusValues, activeStatus, v => { activeStatus = v; }));
  bar.appendChild(makeRow('tag-row', 'TOPIC /', allTags, activeTag, v => { activeTag = v; }));
}

/* ── THINKING LOG ────────────────────────────────────────────────────────── */

function initLog() {
  const logEl    = document.getElementById('thinking-log');
  const focusBtn = document.getElementById('focus-btn');
  const linesEl  = document.getElementById('log-lines');

  focusBtn.addEventListener('click', () => {
    focusMode = !focusMode;
    logEl.classList.toggle('focus', focusMode);
    focusBtn.textContent = focusMode ? '× EXIT_FOCUS' : '⤢ FOCUS_MODE';
    renderLogLines();
  });

  function renderLogLines() {
    linesEl.textContent = '';
    logs.forEach((text, i) => {
      const age = logs.length - 1 - i;
      const opacity = focusMode ? 1 : Math.max(0.15, 1 - age * 0.065);
      const div = document.createElement('div');
      div.className = 'log-line';
      div.style.opacity = opacity;
      div.textContent = text;
      linesEl.appendChild(div);
    });
    linesEl.scrollTop = linesEl.scrollHeight;
  }

  function tick() {
    const line = LOG_LINES[logIdx % LOG_LINES.length];
    logIdx++;
    logs = [...logs, `${nowStamp()}  ${line}`].slice(-60);
    renderLogLines();
  }

  function startTicker() {
    if (logIntervalId) clearInterval(logIntervalId);
    tick();
    logIntervalId = setInterval(tick, logIntervalMs);
  }

  startTicker();
}

/* ── ANIMATION LOOP ──────────────────────────────────────────────────────── */

function animLoop() {
  updateHud(cursor.x, cursor.y, scrollX);
  updateDeepParallax(scrollX);
  requestAnimationFrame(animLoop);
}

/* ── MAIN ────────────────────────────────────────────────────────────────── */

window.addEventListener('resize', () => {
  isMobile = window.innerWidth < 768;
  W = window.innerWidth;
  H = window.innerHeight;
  buildDeepParallax();
  buildHud();
});

window.addEventListener('mousemove', e => {
  cursor.x = e.clientX / window.innerWidth;
  cursor.y = e.clientY / window.innerHeight;
});

initNebula();
buildDeepParallax();
buildHud();
initLog();
requestAnimationFrame(animLoop);

document.getElementById('page-title-section').classList.add('fade-in');

/* Attach scroll + wheel listeners once */
(function () {
  const track = document.getElementById('cards-track');
  if (!track) return;

  track.addEventListener('scroll', () => {
    scrollX = track.scrollLeft;
    const maxScroll = Math.max(1, track.scrollWidth - track.clientWidth);
    const pBar = document.getElementById('scroll-progress');
    if (pBar) pBar.style.width = `${Math.min(100, (scrollX / maxScroll) * 100)}%`;
    try { localStorage.setItem('cr-sx', String(scrollX)); } catch (_) {}
  }, { passive: true });

  track.addEventListener('wheel', e => {
    if (isMobile) return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    e.preventDefault();
    track.scrollLeft += e.deltaY;
  }, { passive: false });
}());

fetch('research/index.json')
  .then(r => r.json())
  .then(data => {
    nodes = data.map((item, i) => ({
      ...item,
      id: `NODE_${String(i + 1).padStart(3, '0')}`,
    }));
    renderFilters();
    renderCards();
  })
  .catch(() => {
    const track = document.getElementById('cards-track');
    if (!track) return;
    const p = document.createElement('p');
    p.style.color = 'rgba(255,255,255,0.36)';
    p.style.fontFamily = "'Space Mono', monospace";
    p.style.fontSize = '12px';
    p.style.padding = '40px clamp(16px,4vw,40px)';
    p.textContent = 'Could not load research nodes. Make sure the site is served over HTTP.';
    track.appendChild(p);
  });
