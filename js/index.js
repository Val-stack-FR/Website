document.addEventListener('DOMContentLoaded', () => {
  document.body.style.opacity = '1';

  const canvas = document.getElementById('starfield');
  const ctx    = canvas.getContext('2d');
  const hero   = document.querySelector('.hero');

  let W, H, stars = [], comets = [], satellites = [];
  let lastComet = 0, lastSatellite = 0;

  function rand(min, max) { return Math.random() * (max - min) + min; }

  function initStars() {
    stars = [];
    const count = Math.floor((W * H) / 1600);
    for (let i = 0; i < count; i++) {
      const bright = Math.random() < 0.08;
      stars.push({
        x:      rand(0, W), y: rand(0, H * 0.88),
        r:      bright ? rand(1.2, 2.2) : rand(0.25, 1.3),
        baseOp: bright ? rand(0.55, 0.95) : rand(0.25, 0.8),
        phase:  rand(0, Math.PI * 2),
        speed:  rand(0.4, 1.6),
        green:  bright,
      });
    }
  }

  function spawnComet() {
    const angle = rand(Math.PI * 0.55, Math.PI * 0.72);
    const speed = rand(1.2, 2.8);
    const length = rand(100, 260);
    comets.push({
      x: rand(W * 0.3, W * 1.1), y: rand(-40, H * 0.35),
      vx: -Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      length, life: 0, maxLife: Math.floor(length / speed) + 30,
    });
  }

  function spawnSatellite() {
    const fromLeft = Math.random() < 0.5;
    const angle    = rand(-0.12, 0.12);
    const speed    = rand(0.5, 1.1);
    satellites.push({
      x:     fromLeft ? -8 : W + 8,
      y:     rand(H * 0.08, H * 0.60),
      vx:    fromLeft ? Math.cos(angle) * speed : -Math.cos(angle) * speed,
      vy:    Math.sin(angle) * speed,
      curve: rand(-0.006, 0.006),
      blink: rand(0, Math.PI * 2),
    });
  }

  function draw(t) {
    ctx.clearRect(0, 0, W, H);

    const drift = t * 0.000012;
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(drift);
    ctx.translate(-W / 2, -H / 2);

    for (const s of stars) {
      const flicker = 0.5 + 0.5 * Math.sin(t * 0.001 * s.speed + s.phase);
      const op      = s.baseOp * (0.55 + 0.45 * flicker);
      if (s.green) {
        const grd = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 3.5);
        grd.addColorStop(0, `rgba(82,183,136,${op * 0.25})`);
        grd.addColorStop(1, 'transparent');
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 3.5, 0, Math.PI * 2);
        ctx.fillStyle = grd; ctx.fill();
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(82,183,136,${op})`; ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(232,242,237,${op})`; ctx.fill();
      }
    }

    for (let i = comets.length - 1; i >= 0; i--) {
      const c = comets[i];
      const headOp = Math.max(0, 1 - (c.life / c.maxLife) * 1.2);
      const spd    = Math.hypot(c.vx, c.vy);
      const tx = c.x - (c.vx / spd) * Math.min(c.length, c.life * spd);
      const ty = c.y - (c.vy / spd) * Math.min(c.length, c.life * spd);
      const grad = ctx.createLinearGradient(tx, ty, c.x, c.y);
      grad.addColorStop(0, 'transparent');
      grad.addColorStop(0.6, `rgba(232,242,237,${headOp * 0.15})`);
      grad.addColorStop(1,   `rgba(232,242,237,${headOp * 0.95})`);
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(c.x, c.y);
      ctx.strokeStyle = grad; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.beginPath(); ctx.arc(c.x, c.y, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(232,242,237,${headOp})`; ctx.fill();
      c.x += c.vx; c.y += c.vy; c.life++;
      if (c.life > c.maxLife || c.x < -80 || c.y > H + 80) comets.splice(i, 1);
    }

    ctx.restore();

    for (let i = satellites.length - 1; i >= 0; i--) {
      const s = satellites[i];
      s.blink += 0.04;
      const op = 0.35 + 0.42 * (0.5 + 0.5 * Math.sin(s.blink * 3.2));

      ctx.beginPath(); ctx.arc(s.x, s.y, 1.2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(82,183,136,${op})`; ctx.fill();
      ctx.beginPath();
      ctx.moveTo(s.x - s.vx * 7, s.y - s.vy * 7);
      ctx.lineTo(s.x, s.y);
      ctx.strokeStyle = `rgba(82,183,136,${op * 0.22})`;
      ctx.lineWidth = 0.8; ctx.stroke();

      const angle = Math.atan2(s.vy, s.vx) + s.curve;
      const speed = Math.hypot(s.vx, s.vy);
      s.vx = Math.cos(angle) * speed;
      s.vy = Math.sin(angle) * speed;
      s.x += s.vx; s.y += s.vy;
      if (s.x < -30 || s.x > W + 30 || s.y < -30 || s.y > H + 30) satellites.splice(i, 1);
    }

    if (t - lastComet > rand(5000, 11000)) { spawnComet(); lastComet = t; }
    if (t - lastSatellite > rand(12000, 24000)) { spawnSatellite(); lastSatellite = t; }

    requestAnimationFrame(draw);
  }

  function resize() {
    W = canvas.width  = hero.offsetWidth;
    H = canvas.height = hero.offsetHeight;
    initStars();
  }

  setTimeout(spawnSatellite, 2500);
  setTimeout(spawnComet, 1200);

  new ResizeObserver(resize).observe(hero);
  resize();
  requestAnimationFrame(draw);

  // ── ESSAY PREVIEWS ──────────────────────────────
  fetch('essays/index.json')
    .then(r => r.json())
    .then(essays => {
      essays.sort((a, b) => new Date(b.date) - new Date(a.date));
      const container = document.getElementById('essays-preview');
      essays.forEach(e => {
        const a = document.createElement('a');
        a.href = `essay-detail.html?essay=${e.slug}`;
        a.className = 'essay-preview';

        const meta = document.createElement('div');
        meta.className = 'ep-meta';
        const time = document.createElement('time');
        time.className = 'ep-date';
        time.setAttribute('datetime', e.date);
        time.textContent = e.date;
        meta.appendChild(time);
        e.tags.forEach(t => {
          const span = document.createElement('span');
          span.className = 'ep-tag';
          span.textContent = t;
          meta.appendChild(span);
        });

        const title = document.createElement('div');
        title.className = 'ep-title';
        title.textContent = e.title;

        const desc = document.createElement('div');
        desc.className = 'ep-desc';
        desc.textContent = e.description;

        a.appendChild(meta);
        a.appendChild(title);
        a.appendChild(desc);
        container.appendChild(a);
      });
    })
    .catch(() => {});

  // ── BOOK PREVIEWS ──────────────────────────────
  fetch('books/index.json')
    .then(r => r.json())
    .then(books => {
      books.sort((a, b) => new Date(b.readDate) - new Date(a.readDate));
      const container = document.getElementById('books-preview');
      books.forEach(b => {
        const a = document.createElement('a');
        a.href = `book-review.html?book=${b.slug}`;
        a.className = 'book-preview';

        const cover = document.createElement('div');
        cover.className = 'bp-cover';

        const img = document.createElement('img');
        img.className = 'bp-cover-img';
        img.alt = '';
        const initSpan = document.createElement('span');
        initSpan.className = 'bp-cover-init';
        initSpan.textContent = b.initials;
        img.addEventListener('load', () => {
          img.style.display = 'block';
          initSpan.style.display = 'none';
        });
        img.addEventListener('error', () => {
          img.src = `books/covers/${b.slug}.png`;
          img.onerror = null;
        });
        img.src = `books/covers/${b.slug}.jpg`;
        cover.appendChild(img);
        cover.appendChild(initSpan);

        const info = document.createElement('div');
        info.className = 'bp-info';

        const meta = document.createElement('div');
        meta.className = 'ep-meta ep-meta-compact';
        const time = document.createElement('time');
        time.className = 'ep-date';
        time.setAttribute('datetime', b.readDate);
        time.textContent = b.readDate;
        const catTag = document.createElement('span');
        catTag.className = 'ep-tag';
        catTag.textContent = b.category;
        meta.appendChild(time);
        meta.appendChild(catTag);

        const title = document.createElement('div');
        title.className = 'bp-title';
        title.textContent = b.title;

        const author = document.createElement('div');
        author.className = 'bp-author';
        author.textContent = b.author;

        const note = document.createElement('div');
        note.className = 'bp-note';
        note.textContent = b.note || b.description;

        info.appendChild(meta);
        info.appendChild(title);
        info.appendChild(author);
        info.appendChild(note);

        a.appendChild(cover);
        a.appendChild(info);
        container.appendChild(a);
      });
    })
    .catch(() => {});
});
