// Literary & cosmic deep-cut space objects for the About flight log.
// Drop these branches into your existing `drawObject` switch in About.tsx.
//   Signature: (ctx, x, y, t, dim, hsla)
// where `hsla(token, alpha)` returns the same color string as your component.
// ─────────────────────────────────────────────────────────────────────────────

export type Hsla = (token: "text" | "muted" | "dim" | "accent" | "propulsion", alpha: number) => string;

const TAU = Math.PI * 2;

const seeded = (n: number) => {
  const v = Math.sin(n * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};

// ════════════════════════════════════════════════════════════════════════════
// LITERARY — kept (Shrike + Theseus removed)
// ════════════════════════════════════════════════════════════════════════════

export const drawRorschach = (ctx: CanvasRenderingContext2D, x: number, y: number, t: number, dim: number, hsla: Hsla) => {
  ctx.save(); ctx.translate(x, y);
  const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, 60);
  halo.addColorStop(0, `hsl(282 60% 38% / ${0.22 * dim})`);
  halo.addColorStop(1, "transparent");
  ctx.beginPath(); ctx.arc(0, 0, 60, 0, TAU); ctx.fillStyle = halo; ctx.fill();
  const arms = 7;
  for (let i = 0; i < arms; i += 1) {
    const a = (i / arms) * TAU + Math.sin(t * 0.0003 + i) * 0.4;
    ctx.beginPath(); ctx.moveTo(0, 0);
    const segs = 6;
    for (let s = 1; s <= segs; s += 1) {
      const r = (s / segs) * 38;
      const wobble = Math.sin(t * 0.0018 + i * 1.7 + s * 0.6) * 6;
      const aa = a + wobble * 0.04;
      ctx.lineTo(Math.cos(aa) * r, Math.sin(aa) * r);
    }
    ctx.strokeStyle = `hsl(282 30% 22% / ${0.78 * dim})`;
    ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU);
  ctx.fillStyle = `hsl(282 40% 8% / ${0.92 * dim})`; ctx.fill();
  const flash = Math.max(0, Math.sin(t * 0.0007) - 0.85) * 6.6;
  if (flash > 0) {
    const fg = ctx.createRadialGradient(0, 0, 0, 0, 0, 50);
    fg.addColorStop(0, `hsl(282 90% 70% / ${flash * 0.5 * dim})`);
    fg.addColorStop(1, "transparent");
    ctx.beginPath(); ctx.arc(0, 0, 50, 0, TAU); ctx.fillStyle = fg; ctx.fill();
  }
  ctx.restore();
};

export const drawScrambler = (ctx: CanvasRenderingContext2D, x: number, y: number, t: number, dim: number, hsla: Hsla) => {
  ctx.save(); ctx.translate(x, y);
  const arms = 9;
  for (let i = 0; i < arms; i += 1) {
    const baseA = (i / arms) * TAU;
    const twitch = Math.sin(t * (0.002 + i * 0.0004) + i * 2.3) * 0.28
                 + Math.sin(t * 0.007 + i * 5.1) * 0.12;
    const a = baseA + twitch;
    const len = 22 + Math.sin(t * 0.003 + i * 1.9) * 4;
    const midR = len * 0.55;
    const bend = Math.sin(t * 0.004 + i) * 5;
    const perpX = -Math.sin(a), perpY = Math.cos(a);
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(
      Math.cos(a) * midR + perpX * bend, Math.sin(a) * midR + perpY * bend,
      Math.cos(a) * len, Math.sin(a) * len,
    );
    ctx.strokeStyle = `hsl(18 35% 55% / ${0.82 * dim})`;
    ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.stroke();
    ctx.beginPath(); ctx.arc(Math.cos(a) * len, Math.sin(a) * len, 1.6, 0, TAU);
    ctx.fillStyle = `hsl(18 50% 70% / ${0.9 * dim})`; ctx.fill();
  }
  ctx.beginPath(); ctx.ellipse(1, -1, 7, 6, 0.4, 0, TAU);
  ctx.fillStyle = `hsl(18 30% 38% / ${0.92 * dim})`; ctx.fill();
  ctx.restore();
};

export const drawLighthugger = (ctx: CanvasRenderingContext2D, x: number, y: number, t: number, dim: number, hsla: Hsla) => {
  ctx.save(); ctx.translate(x, y); ctx.rotate(-Math.PI / 2);
  ctx.beginPath();
  ctx.moveTo(0, -34); ctx.lineTo(-5, -10); ctx.lineTo(-7, 22);
  ctx.lineTo(7, 22); ctx.lineTo(5, -10); ctx.closePath();
  ctx.fillStyle = `hsl(220 18% 18% / ${0.92 * dim})`; ctx.fill();
  ctx.strokeStyle = `hsl(220 25% 38% / ${0.8 * dim})`; ctx.lineWidth = 1; ctx.stroke();
  for (let i = -28; i < 18; i += 6) {
    ctx.beginPath(); ctx.moveTo(-4, i); ctx.lineTo(4, i);
    ctx.strokeStyle = `hsl(220 22% 28% / ${0.7 * dim})`; ctx.lineWidth = 0.8; ctx.stroke();
  }
  for (let i = 0; i < 6; i += 1) {
    const flick = 0.5 + 0.5 * Math.sin(t * 0.005 + i * 2.7);
    ctx.beginPath(); ctx.arc((i % 2 ? 3 : -3), -22 + i * 7, 0.9, 0, TAU);
    ctx.fillStyle = `hsl(45 90% 70% / ${flick * 0.85 * dim})`; ctx.fill();
  }
  const pulse = 0.6 + 0.4 * Math.sin(t * 0.008);
  [-3.5, 3.5].forEach((ex) => {
    const g = ctx.createLinearGradient(ex, 22, ex, 60);
    g.addColorStop(0, `hsl(205 100% 75% / ${0.95 * dim})`);
    g.addColorStop(0.5, `hsl(225 100% 60% / ${0.55 * dim})`);
    g.addColorStop(1, "transparent");
    ctx.beginPath();
    ctx.moveTo(ex - 2, 22); ctx.lineTo(ex + 2, 22);
    ctx.lineTo(ex + 1.2, 22 + 32 * pulse); ctx.lineTo(ex - 1.2, 22 + 32 * pulse);
    ctx.closePath(); ctx.fillStyle = g; ctx.fill();
  });
  ctx.restore();
};

export const drawCacheWeapon = (ctx: CanvasRenderingContext2D, x: number, y: number, t: number, dim: number, hsla: Hsla) => {
  ctx.save(); ctx.translate(x, y); ctx.rotate(-0.3);
  ctx.beginPath();
  ctx.moveTo(-30, -2); ctx.lineTo(28, -5); ctx.lineTo(32, 0);
  ctx.lineTo(28, 5); ctx.lineTo(-30, 3); ctx.closePath();
  ctx.fillStyle = `hsl(0 0% 9% / ${0.95 * dim})`; ctx.fill();
  ctx.strokeStyle = `hsl(0 0% 28% / ${0.85 * dim})`; ctx.lineWidth = 1; ctx.stroke();
  [-18, -6, 8, 20].forEach((bx) => {
    ctx.beginPath(); ctx.moveTo(bx, -6); ctx.lineTo(bx, 6);
    ctx.strokeStyle = `hsl(0 0% 35% / ${0.85 * dim})`; ctx.lineWidth = 1.4; ctx.stroke();
  });
  const cycle = (t * 0.0004) % 1;
  if (cycle > 0.85) {
    const sweep = (cycle - 0.85) / 0.15;
    const len = 70;
    const beamY = -22 + sweep * 44;
    const g = ctx.createLinearGradient(32, 0, 32 + len, beamY);
    g.addColorStop(0, `hsl(0 90% 55% / ${0.8 * dim})`);
    g.addColorStop(1, "transparent");
    ctx.beginPath(); ctx.moveTo(32, 0); ctx.lineTo(32 + len, beamY);
    ctx.strokeStyle = g; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.beginPath(); ctx.arc(28, 0, 2, 0, TAU);
    ctx.fillStyle = `hsl(0 95% 60% / ${0.9 * dim})`; ctx.fill();
  }
  ctx.restore();
};

export const drawInhibitor = (ctx: CanvasRenderingContext2D, x: number, y: number, t: number, dim: number, hsla: Hsla) => {
  ctx.save(); ctx.translate(x, y);
  const void0 = ctx.createRadialGradient(0, 0, 0, 0, 0, 14);
  void0.addColorStop(0, `hsl(0 0% 0% / ${0.95 * dim})`);
  void0.addColorStop(1, "transparent");
  ctx.beginPath(); ctx.arc(0, 0, 14, 0, TAU); ctx.fillStyle = void0; ctx.fill();
  const cycle = (t * 0.0003) % 1;
  let snap = 0;
  if (cycle > 0.6 && cycle < 0.9) snap = cycle < 0.75 ? (cycle - 0.6) / 0.15 : 1;
  else if (cycle >= 0.9) snap = 1 - (cycle - 0.9) / 0.1;
  for (let i = 0; i < 12; i += 1) {
    const baseA = (i / 12) * TAU;
    const orbR = 24 + Math.sin(t * 0.001 + i * 1.3) * 4;
    const orbA = baseA + t * 0.0006 * (i % 2 ? 1 : -1);
    const gx = ((i % 4) - 1.5) * 12;
    const gy = (Math.floor(i / 4) - 1) * 12;
    const ox = Math.cos(orbA) * orbR;
    const oy = Math.sin(orbA) * orbR;
    const px = ox + (gx - ox) * snap;
    const py = oy + (gy - oy) * snap;
    ctx.save(); ctx.translate(px, py); ctx.rotate(t * 0.001 + i);
    ctx.beginPath(); ctx.rect(-3, -3, 6, 6);
    ctx.fillStyle = `hsl(220 12% 12% / ${0.95 * dim})`; ctx.fill();
    ctx.strokeStyle = `hsl(220 18% 32% / ${0.7 * dim})`; ctx.lineWidth = 0.6; ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
};

export const drawPatternJuggler = (ctx: CanvasRenderingContext2D, x: number, y: number, t: number, dim: number, hsla: Hsla) => {
  ctx.save(); ctx.translate(x, y);
  ctx.save(); ctx.scale(1, 0.42);
  const disc = ctx.createRadialGradient(0, 0, 0, 0, 0, 46);
  disc.addColorStop(0, `hsl(186 60% 28% / ${0.85 * dim})`);
  disc.addColorStop(1, `hsl(195 55% 12% / ${0.55 * dim})`);
  ctx.beginPath(); ctx.arc(0, 0, 46, 0, TAU); ctx.fillStyle = disc; ctx.fill();
  ctx.restore();
  const glyphs = 9;
  for (let i = 0; i < glyphs; i += 1) {
    const phase = t * 0.0006 + i * 0.7;
    const r = 14 + (i % 3) * 10;
    const a = phase + i;
    const cx = Math.cos(a) * r;
    const cy = Math.sin(a) * r * 0.42;
    const len = 6 + Math.sin(t * 0.002 + i) * 2;
    const ang = a + Math.PI / 2 + Math.sin(t * 0.0015 + i * 2) * 0.6;
    ctx.beginPath();
    ctx.moveTo(cx - Math.cos(ang) * len, cy - Math.sin(ang) * len * 0.42);
    ctx.quadraticCurveTo(
      cx + Math.sin(t * 0.002 + i) * 3,
      cy + Math.cos(t * 0.002 + i) * 1.5,
      cx + Math.cos(ang) * len, cy + Math.sin(ang) * len * 0.42,
    );
    const flick = 0.5 + 0.5 * Math.sin(t * 0.003 + i * 1.4);
    ctx.strokeStyle = `hsl(146 70% 60% / ${(0.55 + flick * 0.35) * dim})`;
    ctx.lineWidth = 1.4; ctx.lineCap = "round"; ctx.stroke();
  }
  ctx.restore();
};

export const drawTreeship = (ctx: CanvasRenderingContext2D, x: number, y: number, t: number, dim: number, hsla: Hsla) => {
  ctx.save(); ctx.translate(x, y);
  const sway = Math.sin(t * 0.0007) * 0.05;
  ctx.rotate(sway);

  // Soft luminous halo behind the canopy (life-bearing aura in vacuum)
  const halo = ctx.createRadialGradient(0, -4, 6, 0, -4, 42);
  halo.addColorStop(0, `hsl(146 70% 55% / ${0.28 * dim})`);
  halo.addColorStop(0.6, `hsl(146 60% 40% / ${0.10 * dim})`);
  halo.addColorStop(1, "transparent");
  ctx.beginPath(); ctx.arc(0, -4, 42, 0, TAU); ctx.fillStyle = halo; ctx.fill();

  // Lower trailing roots / vines
  ctx.strokeStyle = `hsl(28 40% 26% / ${0.7 * dim})`;
  ctx.lineWidth = 1; ctx.lineCap = "round";
  for (let i = -2; i <= 2; i += 1) {
    const ox = i * 3;
    ctx.beginPath();
    ctx.moveTo(ox, 14);
    ctx.bezierCurveTo(ox + Math.sin(t * 0.001 + i) * 2, 22, ox * 1.6, 28, ox * 2 + Math.sin(t * 0.0012 + i) * 2, 36);
    ctx.stroke();
  }

  // Central trunk (short, thick, tapering)
  ctx.beginPath();
  ctx.moveTo(-3, 16); ctx.lineTo(-2, -2); ctx.lineTo(2, -2); ctx.lineTo(3, 16); ctx.closePath();
  ctx.fillStyle = `hsl(28 38% 24% / ${0.95 * dim})`; ctx.fill();

  // Branching scaffolding (bezier limbs reaching up & out into the canopy)
  ctx.strokeStyle = `hsl(28 42% 30% / ${0.85 * dim})`;
  ctx.lineWidth = 1.4;
  const limbs: [number, number, number, number, number, number][] = [
    [0, -2, -10, -10, -22, -18],
    [0, -2,  10, -10,  22, -18],
    [0, -4, -14, -4, -26, -2],
    [0, -4,  14, -4,  26, -2],
    [0, -6,  -4, -18,  -6, -28],
    [0, -6,   4, -18,   6, -28],
    [0, -2, -8,  6, -16, 10],
    [0, -2,  8,  6,  16, 10],
  ];
  limbs.forEach(([sx, sy, cx, cy, ex, ey]) => {
    ctx.beginPath(); ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(cx, cy, ex, ey);
    ctx.stroke();
  });

  // Dense canopy: layered translucent foliage clouds (gives the orb/tree-of-life look)
  const canopy: [number, number, number, number][] = [
    [0,   -16, 22, 146],
    [-14, -12, 16, 142],
    [14,  -12, 16, 150],
    [-8,  -22, 14, 138],
    [10,  -22, 14, 152],
    [0,    -6, 20, 148],
    [-20,  -4, 12, 140],
    [20,   -4, 12, 150],
  ];
  canopy.forEach(([cx, cy, cr, hue], i) => {
    const breathe = 0.5 + 0.5 * Math.sin(t * 0.0015 + i * 0.9);
    const grad = ctx.createRadialGradient(cx, cy, 1, cx, cy, cr);
    grad.addColorStop(0, `hsl(${hue} 65% ${52 + breathe * 12}% / ${0.55 * dim})`);
    grad.addColorStop(0.7, `hsl(${hue} 55% 30% / ${0.35 * dim})`);
    grad.addColorStop(1, "transparent");
    ctx.beginPath(); ctx.arc(cx, cy, cr, 0, TAU);
    ctx.fillStyle = grad; ctx.fill();
  });

  // Bright leaf highlights flickering in the canopy
  const leafPts: [number, number][] = [
    [-18, -14], [-10, -22], [-2, -28], [6, -28], [16, -20], [22, -10],
    [-22, -6], [-14, -4], [-6, -10], [4, -16], [12, -8], [18, -2],
    [-8, -16], [0, -12], [8, -22], [-4, -6], [10, -14],
  ];
  leafPts.forEach(([lx, ly], i) => {
    const flick = 0.5 + 0.5 * Math.sin(t * 0.0028 + i * 1.3);
    ctx.beginPath(); ctx.arc(lx, ly, 1.6 + flick * 0.6, 0, TAU);
    ctx.fillStyle = `hsl(${140 + (i % 3) * 6} 70% ${55 + flick * 20}% / ${(0.65 + flick * 0.3) * dim})`;
    ctx.fill();
  });

  // Tiny blossom / fruit-light specks (warm)
  for (let i = 0; i < 4; i += 1) {
    const ang = (i / 4) * TAU + t * 0.0006;
    const bx = Math.cos(ang) * 18; const by = -10 + Math.sin(ang) * 10;
    const tw = 0.5 + 0.5 * Math.sin(t * 0.004 + i);
    ctx.beginPath(); ctx.arc(bx, by, 0.9, 0, TAU);
    ctx.fillStyle = `hsl(45 90% 75% / ${(0.5 + tw * 0.5) * dim})`;
    ctx.fill();
  }

  ctx.restore();
};

export const drawFarcaster = (ctx: CanvasRenderingContext2D, x: number, y: number, t: number, dim: number, hsla: Hsla) => {
  ctx.save(); ctx.translate(x, y);
  const usePulse = 0.5 + 0.5 * Math.sin(t * 0.0014);
  ctx.save(); ctx.scale(0.62, 1);
  const halo = ctx.createRadialGradient(0, 0, 18, 0, 0, 44);
  halo.addColorStop(0, `hsl(45 95% 60% / ${(0.18 + usePulse * 0.18) * dim})`);
  halo.addColorStop(1, "transparent");
  ctx.beginPath(); ctx.arc(0, 0, 44, 0, TAU); ctx.fillStyle = halo; ctx.fill();
  const inside = ctx.createRadialGradient(0, 0, 0, 0, 0, 26);
  inside.addColorStop(0, `hsl(220 60% 18% / ${0.95 * dim})`);
  inside.addColorStop(0.7, `hsl(260 50% 12% / ${0.92 * dim})`);
  inside.addColorStop(1, `hsl(0 0% 4% / ${0.95 * dim})`);
  ctx.beginPath(); ctx.arc(0, 0, 26, 0, TAU); ctx.fillStyle = inside; ctx.fill();
  const elseStars: [number, number, number][] = [
    [-8, -12, 1.2], [6, -6, 0.9], [-4, 4, 0.8], [10, 10, 1.1], [2, 14, 0.7], [-12, 0, 0.9],
  ];
  elseStars.forEach(([sx, sy, sr], i) => {
    const tw = 0.5 + 0.5 * Math.sin(t * 0.003 + i * 1.7);
    ctx.beginPath(); ctx.arc(sx, sy, sr, 0, TAU);
    ctx.fillStyle = `hsl(45 60% 85% / ${(0.5 + tw * 0.5) * dim})`; ctx.fill();
  });
  const scan = ((t * 0.0008) % 1) * 52 - 26;
  const sg = ctx.createLinearGradient(0, scan - 4, 0, scan + 4);
  sg.addColorStop(0, "transparent");
  sg.addColorStop(0.5, `hsl(45 90% 75% / ${0.22 * dim})`);
  sg.addColorStop(1, "transparent");
  ctx.beginPath(); ctx.arc(0, 0, 26, 0, TAU); ctx.clip();
  ctx.fillStyle = sg; ctx.fillRect(-30, scan - 4, 60, 8);
  ctx.restore();
  ctx.save(); ctx.scale(0.62, 1);
  ctx.beginPath(); ctx.arc(0, 0, 27, 0, TAU);
  ctx.strokeStyle = `hsl(45 90% ${55 + usePulse * 12}% / ${(0.85 + usePulse * 0.15) * dim})`;
  ctx.lineWidth = 2.2; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 23, 0, TAU);
  ctx.strokeStyle = `hsl(45 80% 70% / ${0.45 * dim})`; ctx.lineWidth = 0.6; ctx.stroke();
  ctx.restore();
  ctx.restore();
};

// ════════════════════════════════════════════════════════════════════════════
// NEW BATCH — 20 more (12 cosmic + 8 sci-fi hardware)
// ════════════════════════════════════════════════════════════════════════════

// 1. Black hole + accretion disk
export const drawBlackHole = (ctx: CanvasRenderingContext2D, x: number, y: number, t: number, dim: number, _h: Hsla) => {
  ctx.save(); ctx.translate(x, y);
  ctx.beginPath(); ctx.arc(0, 0, 16, 0, TAU);
  ctx.strokeStyle = `hsl(35 100% 70% / ${0.85 * dim})`;
  ctx.lineWidth = 1.4;
  ctx.shadowColor = `hsl(35 100% 70% / ${0.7 * dim})`;
  ctx.shadowBlur = 10; ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.save(); ctx.scale(1, 0.22); ctx.rotate(t * 0.0008);
  for (let r = 22; r <= 48; r += 4) {
    const a = 0.42 - (r - 22) * 0.012;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU);
    ctx.strokeStyle = `hsl(${28 + (r - 22)} 100% ${65 - (r - 22) * 0.5}% / ${a * dim})`;
    ctx.lineWidth = 1.6; ctx.stroke();
  }
  ctx.restore();
  ctx.beginPath(); ctx.arc(0, 0, 13, 0, TAU);
  ctx.fillStyle = `hsl(0 0% 0% / ${0.98 * dim})`; ctx.fill();
  ctx.restore();
};

// 2. Quasar
export const drawQuasar = (ctx: CanvasRenderingContext2D, x: number, y: number, t: number, dim: number, _h: Hsla) => {
  ctx.save(); ctx.translate(x, y); ctx.rotate(0.2);
  ctx.save(); ctx.scale(1, 0.3);
  const disk = ctx.createRadialGradient(0, 0, 4, 0, 0, 30);
  disk.addColorStop(0, `hsl(45 100% 80% / ${0.95 * dim})`);
  disk.addColorStop(1, `hsl(280 70% 30% / ${0.2 * dim})`);
  ctx.beginPath(); ctx.arc(0, 0, 30, 0, TAU); ctx.fillStyle = disk; ctx.fill();
  ctx.restore();
  const pulse = 0.6 + 0.4 * Math.sin(t * 0.003);
  [1, -1].forEach((dir) => {
    const g = ctx.createLinearGradient(0, 0, 0, dir * 60 * pulse);
    g.addColorStop(0, `hsl(200 100% 80% / ${0.95 * dim})`);
    g.addColorStop(0.5, `hsl(220 100% 60% / ${0.5 * dim})`);
    g.addColorStop(1, "transparent");
    ctx.beginPath();
    ctx.moveTo(-2, 0); ctx.lineTo(2, 0);
    ctx.lineTo(1, dir * 60 * pulse); ctx.lineTo(-1, dir * 60 * pulse);
    ctx.closePath(); ctx.fillStyle = g; ctx.fill();
  });
  ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU);
  ctx.fillStyle = `hsl(45 100% 95% / ${0.98 * dim})`; ctx.fill();
  ctx.restore();
};

// 3. Magnetar
export const drawMagnetar = (ctx: CanvasRenderingContext2D, x: number, y: number, t: number, dim: number, _h: Hsla) => {
  ctx.save(); ctx.translate(x, y);
  const pulse = 0.5 + 0.5 * Math.sin(t * 0.012);
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * TAU + t * 0.0004;
    ctx.save(); ctx.rotate(a); ctx.scale(1, 0.25);
    ctx.beginPath(); ctx.arc(0, 0, 36 - (i % 3) * 6, 0, TAU);
    ctx.strokeStyle = `hsl(290 80% 60% / ${0.32 * dim})`;
    ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  }
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 14);
  g.addColorStop(0, `hsl(0 0% 100% / ${0.95 * dim})`);
  g.addColorStop(0.6, `hsl(290 100% 70% / ${0.6 * dim})`);
  g.addColorStop(1, "transparent");
  ctx.beginPath(); ctx.arc(0, 0, 14 * (0.85 + pulse * 0.3), 0, TAU);
  ctx.fillStyle = g; ctx.fill();
  ctx.restore();
};

// 4. Wormhole
export const drawWormhole = (ctx: CanvasRenderingContext2D, x: number, y: number, t: number, dim: number, _h: Hsla) => {
  ctx.save(); ctx.translate(x, y);
  for (let i = 0; i < 7; i += 1) {
    const r = 8 + i * 5;
    const off = (t * 0.0005 + i * 0.4) % 1;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU);
    ctx.strokeStyle = `hsl(${200 + i * 12} 70% ${60 - i * 4}% / ${(0.55 - i * 0.06) * dim})`;
    ctx.lineWidth = 1 + (1 - off) * 0.6;
    ctx.stroke();
  }
  const inner = ctx.createRadialGradient(0, 0, 0, 0, 0, 7);
  inner.addColorStop(0, `hsl(220 70% 75% / ${0.95 * dim})`);
  inner.addColorStop(1, `hsl(260 50% 10% / ${0.95 * dim})`);
  ctx.beginPath(); ctx.arc(0, 0, 7, 0, TAU); ctx.fillStyle = inner; ctx.fill();
  ctx.restore();
};

// 5. Supernova remnant
export const drawSupernova = (ctx: CanvasRenderingContext2D, x: number, y: number, t: number, dim: number, _h: Hsla) => {
  ctx.save(); ctx.translate(x, y);
  const shock = ((t * 0.0003) % 1);
  ctx.beginPath(); ctx.arc(0, 0, 14 + shock * 38, 0, TAU);
  ctx.strokeStyle = `hsl(15 100% 60% / ${(1 - shock) * 0.5 * dim})`;
  ctx.lineWidth = 1.5; ctx.stroke();
  for (let i = 0; i < 14; i += 1) {
    const a = (i / 14) * TAU + seeded(i) * 0.4;
    const r = 18 + seeded(i + 7) * 22;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 6, Math.sin(a) * 6);
    ctx.quadraticCurveTo(
      Math.cos(a + 0.3) * (r * 0.6), Math.sin(a + 0.3) * (r * 0.6),
      Math.cos(a) * r, Math.sin(a) * r,
    );
    ctx.strokeStyle = `hsl(${seeded(i) > 0.5 ? 15 : 280} 80% 60% / ${0.5 * dim})`;
    ctx.lineWidth = 1.2; ctx.stroke();
  }
  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, 10);
  core.addColorStop(0, `hsl(40 100% 90% / ${0.95 * dim})`);
  core.addColorStop(1, "transparent");
  ctx.beginPath(); ctx.arc(0, 0, 10, 0, TAU); ctx.fillStyle = core; ctx.fill();
  ctx.restore();
};

// 6. Globular cluster — stars orbit core at varying speeds + twinkle
export const drawGlobular = (ctx: CanvasRenderingContext2D, x: number, y: number, t: number, dim: number, _h: Hsla) => {
  ctx.save(); ctx.translate(x, y);
  for (let i = 0; i < 80; i += 1) {
    const r = Math.pow(seeded(i), 1.4) * 32;
    // angular speed inversely proportional to radius (Keplerian-ish)
    const speed = 0.00045 / (0.25 + r / 32);
    const a = seeded(i + 100) * TAU + t * speed * (i % 2 ? 1 : -1);
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    const tw = 0.5 + 0.5 * Math.sin(t * 0.004 + i * 1.7);
    const sz = (0.5 + (1 - r / 32) * 1.2) * (0.7 + tw * 0.6);
    ctx.beginPath(); ctx.arc(px, py, sz, 0, TAU);
    ctx.fillStyle = `hsl(${40 + seeded(i + 50) * 30} 60% ${65 + tw * 25}% / ${(0.5 + tw * 0.5) * dim})`;
    ctx.fill();
  }
  const corePulse = 0.85 + 0.15 * Math.sin(t * 0.0025);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 14 * corePulse);
  g.addColorStop(0, `hsl(45 80% 75% / ${0.5 * dim})`);
  g.addColorStop(1, "transparent");
  ctx.beginPath(); ctx.arc(0, 0, 14 * corePulse, 0, TAU); ctx.fillStyle = g; ctx.fill();
  ctx.restore();
};

// 7. Protoplanetary disk — fast spin, orbiting protoplanets carving the gaps, pulsing star
export const drawProtoDisk = (ctx: CanvasRenderingContext2D, x: number, y: number, t: number, dim: number, _h: Hsla) => {
  ctx.save(); ctx.translate(x, y); ctx.rotate(0.3);
  ctx.save(); ctx.scale(1, 0.3); ctx.rotate(t * 0.0009);
  const disk = ctx.createRadialGradient(0, 0, 0, 0, 0, 44);
  disk.addColorStop(0, `hsl(30 80% 70% / ${0.6 * dim})`);
  disk.addColorStop(1, "transparent");
  ctx.beginPath(); ctx.arc(0, 0, 44, 0, TAU); ctx.fillStyle = disk; ctx.fill();
  // dust streaks rotating with the disk
  for (let i = 0; i < 30; i += 1) {
    const a = (i / 30) * TAU + t * 0.0006;
    const r = 14 + (i % 3) * 8 + seeded(i) * 4;
    ctx.beginPath();
    ctx.arc(0, 0, r, a, a + 0.25);
    ctx.strokeStyle = `hsl(${28 + (i % 3) * 6} 70% ${60 + seeded(i) * 15}% / ${0.45 * dim})`;
    ctx.lineWidth = 1.2; ctx.stroke();
  }
  [16, 26, 36].forEach((r, i) => {
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU);
    ctx.strokeStyle = `hsl(${30 + i * 8} 30% 15% / ${0.85 * dim})`;
    ctx.lineWidth = 2.2; ctx.stroke();
  });
  ctx.restore();
  // protoplanets shepherding the gaps (drawn unscaled, projected)
  [16, 26, 36].forEach((r, i) => {
    const speed = 0.0012 / (0.5 + i * 0.4);
    const a = t * speed + i * 1.7;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r * 0.3;
    ctx.beginPath(); ctx.arc(px, py, 1.6 + i * 0.3, 0, TAU);
    ctx.fillStyle = `hsl(${20 + i * 10} 50% 70% / ${0.95 * dim})`; ctx.fill();
  });
  const pulse = 0.85 + 0.15 * Math.sin(t * 0.003);
  const star = ctx.createRadialGradient(0, 0, 0, 0, 0, 9 * pulse);
  star.addColorStop(0, `hsl(45 100% 92% / ${0.95 * dim})`);
  star.addColorStop(0.5, `hsl(40 100% 70% / ${0.6 * dim})`);
  star.addColorStop(1, "transparent");
  ctx.beginPath(); ctx.arc(0, 0, 9 * pulse, 0, TAU); ctx.fillStyle = star; ctx.fill();
  ctx.restore();
};

// 8. Gas giant — bands scroll horizontally, storm orbits the disk
export const drawGasGiant = (ctx: CanvasRenderingContext2D, x: number, y: number, t: number, dim: number, _h: Hsla) => {
  ctx.save(); ctx.translate(x, y);
  ctx.beginPath(); ctx.arc(0, 0, 28, 0, TAU);
  const body = ctx.createLinearGradient(0, -28, 0, 28);
  body.addColorStop(0, `hsl(28 50% 55% / ${0.95 * dim})`);
  body.addColorStop(0.5, `hsl(35 60% 65% / ${0.95 * dim})`);
  body.addColorStop(1, `hsl(20 45% 40% / ${0.95 * dim})`);
  ctx.fillStyle = body; ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.arc(0, 0, 28, 0, TAU); ctx.clip();
  for (let i = -28; i < 28; i += 3) {
    // each latitudinal band scrolls at its own speed (zonal winds)
    const dir = (Math.floor(i / 6) % 2 === 0) ? 1 : -1;
    const speed = 0.025 * dir * (1 - Math.abs(i) / 40);
    const phase = t * speed + i * 0.4;
    const wob = Math.sin(phase) * 1.5;
    ctx.beginPath();
    ctx.moveTo(-30, i + wob); ctx.lineTo(30, i - wob);
    ctx.strokeStyle = `hsl(${20 + (i + 28) * 0.6} 40% ${30 + Math.abs(i) * 0.2}% / ${0.45 * dim})`;
    ctx.lineWidth = 1.8; ctx.stroke();
  }
  // great red spot orbits in its band
  const spotX = -6 + Math.cos(t * 0.0009) * 14;
  const spotR = 1 + Math.sin(t * 0.0018) * 0.5;
  ctx.save(); ctx.translate(spotX, 6); ctx.rotate(t * 0.002);
  ctx.beginPath(); ctx.ellipse(0, 0, 7, 4, 0, 0, TAU);
  ctx.fillStyle = `hsl(15 70% 35% / ${0.92 * dim})`; ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, 0, 4, 2.2, 0, 0, TAU);
  ctx.fillStyle = `hsl(10 80% 45% / ${0.6 * dim * spotR})`; ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.beginPath(); ctx.arc(0, 0, 28, 0, TAU);
  const shade = ctx.createRadialGradient(-10, -10, 8, 0, 0, 30);
  shade.addColorStop(0, "transparent");
  shade.addColorStop(1, `hsl(0 0% 0% / ${0.45 * dim})`);
  ctx.fillStyle = shade; ctx.fill();
  ctx.restore();
};

// 9. Comet nucleus — pulsing coma, streaming dust + ion particles, tumbling nucleus
export const drawCometNucleus = (ctx: CanvasRenderingContext2D, x: number, y: number, t: number, dim: number, _h: Hsla) => {
  ctx.save(); ctx.translate(x, y);
  // dust tail base
  const tail = ctx.createLinearGradient(0, 0, 50, -10);
  tail.addColorStop(0, `hsl(45 30% 70% / ${0.55 * dim})`);
  tail.addColorStop(1, "transparent");
  ctx.beginPath();
  ctx.moveTo(0, -3); ctx.lineTo(55, -16); ctx.lineTo(55, -4); ctx.lineTo(8, 4); ctx.closePath();
  ctx.fillStyle = tail; ctx.fill();
  // ion tail base
  const ion = ctx.createLinearGradient(0, 0, 60, 6);
  ion.addColorStop(0, `hsl(200 80% 70% / ${0.5 * dim})`);
  ion.addColorStop(1, "transparent");
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(62, 2); ctx.lineTo(62, 8); ctx.lineTo(2, 6); ctx.closePath();
  ctx.fillStyle = ion; ctx.fill();
  // streaming dust particles (slower, curved)
  for (let i = 0; i < 14; i += 1) {
    const phase = (t * 0.04 + i * 13) % 60;
    const px = 6 + phase;
    const py = -3 - (phase / 60) * 13 + Math.sin(i + t * 0.003) * 0.8;
    const a = (1 - phase / 60) * 0.8 * dim;
    ctx.beginPath(); ctx.arc(px, py, 0.9, 0, TAU);
    ctx.fillStyle = `hsl(45 60% 80% / ${a})`; ctx.fill();
  }
  // streaming ion particles (faster, straighter, blue)
  for (let i = 0; i < 16; i += 1) {
    const phase = (t * 0.08 + i * 11) % 62;
    const px = 4 + phase;
    const py = 3 + (phase / 62) * 5;
    const a = (1 - phase / 62) * 0.85 * dim;
    ctx.beginPath(); ctx.arc(px, py, 0.8, 0, TAU);
    ctx.fillStyle = `hsl(200 90% 75% / ${a})`; ctx.fill();
  }
  // pulsing coma
  const pulse = 1 + 0.12 * Math.sin(t * 0.004);
  const coma = ctx.createRadialGradient(0, 0, 0, 0, 0, 14 * pulse);
  coma.addColorStop(0, `hsl(180 40% 80% / ${0.6 * dim})`);
  coma.addColorStop(1, "transparent");
  ctx.beginPath(); ctx.arc(0, 0, 14 * pulse, 0, TAU); ctx.fillStyle = coma; ctx.fill();
  // tumbling nucleus
  ctx.save(); ctx.rotate(t * 0.0015);
  const pts: [number, number][] = [[-5, -1], [-2, -5], [3, -4], [6, 0], [4, 4], [-1, 5], [-5, 3]];
  ctx.beginPath();
  pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py));
  ctx.closePath();
  ctx.fillStyle = `hsl(30 25% 32% / ${0.95 * dim})`; ctx.fill();
  ctx.strokeStyle = `hsl(30 20% 18% / ${0.9 * dim})`; ctx.stroke();
  ctx.restore();
  ctx.restore();
};

// 10. Aurora world — slowly rotating planet, undulating bright auroras, occasional flare
export const drawAuroraWorld = (ctx: CanvasRenderingContext2D, x: number, y: number, t: number, dim: number, _h: Hsla) => {
  ctx.save(); ctx.translate(x, y);
  ctx.beginPath(); ctx.arc(0, 0, 24, 0, TAU);
  const body = ctx.createLinearGradient(0, -24, 0, 24);
  body.addColorStop(0, `hsl(220 50% 25% / ${0.95 * dim})`);
  body.addColorStop(1, `hsl(220 60% 12% / ${0.95 * dim})`);
  ctx.fillStyle = body; ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.arc(0, 0, 24, 0, TAU); ctx.clip();
  // surface continents drifting (planet rotation)
  for (let i = 0; i < 5; i += 1) {
    const cx = ((seeded(i + 7) * 60 - t * 0.012) % 60) - 30;
    const cy = (seeded(i + 11) - 0.5) * 30;
    ctx.beginPath(); ctx.ellipse(cx, cy, 4 + seeded(i) * 3, 2, 0, 0, TAU);
    ctx.fillStyle = `hsl(220 40% 18% / ${0.7 * dim})`; ctx.fill();
  }
  // dancing aurora caps
  for (let p = 0; p < 2; p += 1) {
    const sign = p ? 1 : -1;
    const flare = 1 + 0.4 * Math.sin(t * 0.003 + p * 2);
    for (let i = 0; i < 7; i += 1) {
      const wave = Math.sin(t * 0.005 + i * 0.9 + p * 3) * 4;
      const yoff = sign * (14 + i * 0.4) + wave * 0.3;
      ctx.beginPath();
      ctx.ellipse(wave * 0.6, yoff, (22 - i * 2.2) * flare, (3.5 - i * 0.25) * flare, 0, 0, TAU);
      ctx.fillStyle = `hsl(${140 + i * 10 + Math.sin(t * 0.004) * 20} 80% ${55 + i * 4}% / ${(0.55 - i * 0.07) * dim})`;
      ctx.fill();
    }
  }
  ctx.restore();
  ctx.beginPath(); ctx.arc(0, 0, 24, 0, TAU);
  const shade = ctx.createRadialGradient(-8, -8, 6, 0, 0, 26);
  shade.addColorStop(0, "transparent");
  shade.addColorStop(1, `hsl(0 0% 0% / ${0.5 * dim})`);
  ctx.fillStyle = shade; ctx.fill();
  ctx.restore();
};

// 11. Eclipse
export const drawEclipse = (ctx: CanvasRenderingContext2D, x: number, y: number, t: number, dim: number, _h: Hsla) => {
  ctx.save(); ctx.translate(x, y);
  const cor = ctx.createRadialGradient(0, 0, 18, 0, 0, 44);
  cor.addColorStop(0, `hsl(45 100% 80% / ${0.6 * dim})`);
  cor.addColorStop(1, "transparent");
  ctx.beginPath(); ctx.arc(0, 0, 44, 0, TAU); ctx.fillStyle = cor; ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, 18, 0, TAU);
  ctx.strokeStyle = `hsl(45 100% 85% / ${0.95 * dim})`; ctx.lineWidth = 1.6;
  ctx.shadowColor = `hsl(45 100% 80% / ${0.8 * dim})`; ctx.shadowBlur = 12; ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.beginPath(); ctx.arc(0, 0, 16, 0, TAU);
  ctx.fillStyle = `hsl(0 0% 4% / ${0.99 * dim})`; ctx.fill();
  for (let i = 0; i < 4; i += 1) {
    const a = t * 0.0005 + i * (TAU / 4);
    ctx.beginPath(); ctx.arc(Math.cos(a) * 18, Math.sin(a) * 18, 1.4, 0, TAU);
    ctx.fillStyle = `hsl(45 100% 90% / ${0.9 * dim})`; ctx.fill();
  }
  ctx.restore();
};

// 12. Brown dwarf
export const drawBrownDwarf = (ctx: CanvasRenderingContext2D, x: number, y: number, t: number, dim: number, _h: Hsla) => {
  ctx.save(); ctx.translate(x, y);
  const pulse = 0.5 + 0.5 * Math.sin(t * 0.0008);
  const g = ctx.createRadialGradient(0, 0, 6, 0, 0, 26);
  g.addColorStop(0, `hsl(15 80% 30% / ${(0.5 + pulse * 0.2) * dim})`);
  g.addColorStop(1, "transparent");
  ctx.beginPath(); ctx.arc(0, 0, 26, 0, TAU); ctx.fillStyle = g; ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, 16, 0, TAU);
  const body = ctx.createRadialGradient(-4, -4, 2, 0, 0, 16);
  body.addColorStop(0, `hsl(20 60% 35% / ${0.95 * dim})`);
  body.addColorStop(1, `hsl(0 50% 12% / ${0.95 * dim})`);
  ctx.fillStyle = body; ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.arc(0, 0, 16, 0, TAU); ctx.clip();
  for (let i = -16; i < 16; i += 5) {
    ctx.beginPath();
    ctx.moveTo(-18, i + Math.sin(t * 0.001 + i) * 1.5);
    ctx.lineTo(18, i + Math.sin(t * 0.001 + i + 1) * 1.5);
    ctx.strokeStyle = `hsl(15 50% 18% / ${0.6 * dim})`; ctx.lineWidth = 1.4; ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
};

// 13. Jump gate
export const drawJumpGate = (ctx: CanvasRenderingContext2D, x: number, y: number, t: number, dim: number, hsla: Hsla) => {
  ctx.save(); ctx.translate(x, y);
  ctx.save(); ctx.rotate(t * 0.0003);
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * TAU;
    const r = 28;
    if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.strokeStyle = hsla("text", 0.7 * dim); ctx.lineWidth = 2; ctx.stroke();
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * TAU;
    ctx.beginPath(); ctx.arc(Math.cos(a) * 28, Math.sin(a) * 28, 2.4, 0, TAU);
    ctx.fillStyle = hsla("accent", 0.9 * dim); ctx.fill();
  }
  ctx.restore();
  ctx.save(); ctx.rotate(-t * 0.0008);
  ctx.beginPath(); ctx.arc(0, 0, 18, 0, TAU);
  ctx.strokeStyle = hsla("propulsion", 0.85 * dim);
  ctx.setLineDash([4, 3]); ctx.lineWidth = 1.5; ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  const pulse = 0.5 + 0.5 * Math.sin(t * 0.005);
  const plasma = ctx.createRadialGradient(0, 0, 0, 0, 0, 14);
  plasma.addColorStop(0, hsla("propulsion", 0.85 * dim));
  plasma.addColorStop(1, "transparent");
  ctx.beginPath(); ctx.arc(0, 0, 12 + pulse * 3, 0, TAU);
  ctx.fillStyle = plasma; ctx.fill();
  ctx.restore();
};

// 14. Dyson swarm
export const drawDysonSwarm = (ctx: CanvasRenderingContext2D, x: number, y: number, t: number, dim: number, hsla: Hsla) => {
  ctx.save(); ctx.translate(x, y);
  const star = ctx.createRadialGradient(0, 0, 0, 0, 0, 10);
  star.addColorStop(0, `hsl(45 100% 90% / ${0.95 * dim})`);
  star.addColorStop(1, "transparent");
  ctx.beginPath(); ctx.arc(0, 0, 10, 0, TAU); ctx.fillStyle = star; ctx.fill();
  const rings = [
    { r: 18, count: 8, speed: 0.0012, tilt: 0 },
    { r: 28, count: 12, speed: -0.0008, tilt: 0.5 },
    { r: 38, count: 16, speed: 0.0005, tilt: -0.3 },
  ];
  rings.forEach((ring) => {
    ctx.save(); ctx.rotate(ring.tilt); ctx.scale(1, 0.35);
    ctx.beginPath(); ctx.arc(0, 0, ring.r, 0, TAU);
    ctx.strokeStyle = hsla("text", 0.18 * dim); ctx.lineWidth = 0.6; ctx.stroke();
    for (let i = 0; i < ring.count; i += 1) {
      const a = (i / ring.count) * TAU + t * ring.speed;
      const px = Math.cos(a) * ring.r, py = Math.sin(a) * ring.r;
      ctx.beginPath(); ctx.rect(px - 1.2, py - 1.2, 2.4, 2.4);
      ctx.fillStyle = hsla("accent", 0.85 * dim); ctx.fill();
    }
    ctx.restore();
  });
  ctx.restore();
};

// 15. Ringworld
export const drawRingworld = (ctx: CanvasRenderingContext2D, x: number, y: number, t: number, dim: number, hsla: Hsla) => {
  ctx.save(); ctx.translate(x, y); ctx.rotate(0.18);
  const star = ctx.createRadialGradient(0, 0, 0, 0, 0, 8);
  star.addColorStop(0, `hsl(45 100% 92% / ${0.95 * dim})`);
  star.addColorStop(1, "transparent");
  ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fillStyle = star; ctx.fill();
  ctx.save(); ctx.scale(1, 0.18); ctx.rotate(t * 0.0002);
  ctx.beginPath(); ctx.arc(0, 0, 38, 0, TAU);
  ctx.strokeStyle = hsla("text", 0.7 * dim); ctx.lineWidth = 1; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 32, 0, TAU);
  ctx.strokeStyle = hsla("text", 0.55 * dim); ctx.lineWidth = 1; ctx.stroke();
  for (let i = 0; i < 60; i += 1) {
    const a = (i / 60) * TAU;
    const r = 33 + seeded(i) * 4;
    const sz = 1 + seeded(i + 10) * 1.2;
    ctx.beginPath(); ctx.arc(Math.cos(a) * r, Math.sin(a) * r, sz, 0, TAU);
    ctx.fillStyle = `hsl(${seeded(i) > 0.6 ? 200 : 146} 50% ${40 + seeded(i + 5) * 15}% / ${0.85 * dim})`;
    ctx.fill();
  }
  ctx.restore();
  ctx.restore();
};

// 16. Solar sail
export const drawSolarSail = (ctx: CanvasRenderingContext2D, x: number, y: number, t: number, dim: number, hsla: Hsla) => {
  ctx.save(); ctx.translate(x, y);
  ctx.save(); ctx.rotate(Math.sin(t * 0.0005) * 0.1);
  const sail = ctx.createLinearGradient(-30, -30, 30, 30);
  sail.addColorStop(0, `hsl(45 50% 80% / ${0.55 * dim})`);
  sail.addColorStop(0.5, `hsl(45 60% 88% / ${0.85 * dim})`);
  sail.addColorStop(1, `hsl(45 30% 60% / ${0.55 * dim})`);
  ctx.beginPath();
  ctx.moveTo(-28, -22); ctx.lineTo(28, -22); ctx.lineTo(28, 22); ctx.lineTo(-28, 22); ctx.closePath();
  ctx.fillStyle = sail; ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-28, 0); ctx.lineTo(28, 0); ctx.moveTo(0, -22); ctx.lineTo(0, 22);
  ctx.strokeStyle = `hsl(45 30% 30% / ${0.65 * dim})`; ctx.lineWidth = 0.7; ctx.stroke();
  [[-28, -22], [28, -22], [28, 22], [-28, 22]].forEach(([px, py]) => {
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(0, 32);
    ctx.strokeStyle = `hsl(45 20% 50% / ${0.4 * dim})`; ctx.lineWidth = 0.4; ctx.stroke();
  });
  ctx.restore();
  ctx.beginPath(); ctx.rect(-3, 30, 6, 5);
  ctx.fillStyle = hsla("text", 0.85 * dim); ctx.fill();
  ctx.beginPath(); ctx.arc(0, 36, 1.2, 0, TAU);
  ctx.fillStyle = hsla("propulsion", 0.9 * dim); ctx.fill();
  ctx.restore();
};

// 17. Generation ship
export const drawGenerationShip = (ctx: CanvasRenderingContext2D, x: number, y: number, t: number, dim: number, hsla: Hsla) => {
  ctx.save(); ctx.translate(x, y); ctx.rotate(0.04);

  // Central spine
  ctx.beginPath(); ctx.moveTo(-44, 0); ctx.lineTo(40, 0);
  ctx.strokeStyle = `hsl(220 12% 55% / ${0.85 * dim})`; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-44, 0); ctx.lineTo(40, 0);
  ctx.strokeStyle = `hsl(220 18% 22% / ${0.95 * dim})`; ctx.lineWidth = 0.6; ctx.stroke();

  // Main O'Neill habitat cylinder (centered, with shaded body)
  ctx.save(); ctx.translate(-4, 0);
  const W = 50, H = 22;
  // Body gradient
  const body = ctx.createLinearGradient(0, -H / 2, 0, H / 2);
  body.addColorStop(0, `hsl(220 14% 38% / ${0.98 * dim})`);
  body.addColorStop(0.5, `hsl(220 14% 22% / ${0.98 * dim})`);
  body.addColorStop(1, `hsl(220 14% 14% / ${0.98 * dim})`);
  ctx.beginPath();
  ctx.moveTo(-W / 2 + 4, -H / 2);
  ctx.lineTo(W / 2 - 4, -H / 2);
  ctx.quadraticCurveTo(W / 2 + 2, 0, W / 2 - 4, H / 2);
  ctx.lineTo(-W / 2 + 4, H / 2);
  ctx.quadraticCurveTo(-W / 2 - 2, 0, -W / 2 + 4, -H / 2);
  ctx.closePath();
  ctx.fillStyle = body; ctx.fill();
  ctx.strokeStyle = `hsl(220 18% 60% / ${0.6 * dim})`; ctx.lineWidth = 0.8; ctx.stroke();

  // Structural ribs
  for (let i = -2; i <= 2; i += 1) {
    const rx = i * 8;
    ctx.beginPath();
    ctx.moveTo(rx, -H / 2 + 2);
    ctx.lineTo(rx, H / 2 - 2);
    ctx.strokeStyle = `hsl(220 18% 48% / ${0.5 * dim})`; ctx.lineWidth = 0.5; ctx.stroke();
  }

  // Rotating window stripe (spin gravity) — single bright band that drifts
  const spin = (t * 0.0006) % 1;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-W / 2 + 4, -3); ctx.lineTo(W / 2 - 4, -3);
  ctx.lineTo(W / 2 - 4, 3); ctx.lineTo(-W / 2 + 4, 3); ctx.closePath();
  ctx.clip();
  for (let i = 0; i < 14; i += 1) {
    const px = -W / 2 + ((i / 14 + spin) % 1) * W;
    const bright = 0.5 + 0.5 * Math.sin(i * 1.3);
    ctx.beginPath(); ctx.rect(px, -2.5, 1.4, 5);
    ctx.fillStyle = `hsl(45 85% ${65 + bright * 15}% / ${(0.7 + bright * 0.25) * dim})`;
    ctx.fill();
  }
  ctx.restore();

  // Top & bottom rim lights
  ctx.beginPath(); ctx.moveTo(-W / 2 + 6, -H / 2); ctx.lineTo(W / 2 - 6, -H / 2);
  ctx.strokeStyle = `hsl(45 70% 60% / ${0.5 * dim})`; ctx.lineWidth = 0.4; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-W / 2 + 6, H / 2); ctx.lineTo(W / 2 - 6, H / 2);
  ctx.strokeStyle = `hsl(205 70% 55% / ${0.5 * dim})`; ctx.lineWidth = 0.4; ctx.stroke();
  ctx.restore();

  // Forward comms dish (right side, beyond the cylinder)
  ctx.save(); ctx.translate(34, 0);
  ctx.beginPath(); ctx.arc(0, 0, 6, -Math.PI * 0.55, Math.PI * 0.55);
  ctx.fillStyle = `hsl(220 14% 70% / ${0.9 * dim})`; ctx.fill();
  ctx.strokeStyle = `hsl(220 18% 30% / ${0.9 * dim})`; ctx.lineWidth = 0.6; ctx.stroke();
  ctx.beginPath(); ctx.arc(2, 0, 1.2, 0, TAU);
  ctx.fillStyle = `hsl(45 90% 70% / ${0.9 * dim})`; ctx.fill();
  ctx.restore();

  // Aft engine block (left side)
  ctx.save(); ctx.translate(-36, 0);
  ctx.beginPath(); ctx.rect(-6, -5, 8, 10);
  ctx.fillStyle = `hsl(220 14% 22% / ${0.98 * dim})`; ctx.fill();
  ctx.strokeStyle = `hsl(220 18% 50% / ${0.8 * dim})`; ctx.lineWidth = 0.6; ctx.stroke();

  // Twin engine plumes
  const burn = 0.7 + 0.3 * Math.sin(t * 0.012);
  [-2.5, 2.5].forEach((py) => {
    const len = 22 * burn;
    const g = ctx.createLinearGradient(-6, py, -6 - len, py);
    g.addColorStop(0, `hsl(205 100% 75% / ${0.95 * dim})`);
    g.addColorStop(0.4, `hsl(205 100% 60% / ${0.7 * dim})`);
    g.addColorStop(1, "transparent");
    ctx.beginPath();
    ctx.moveTo(-6, py - 1.6);
    ctx.lineTo(-6 - len, py);
    ctx.lineTo(-6, py + 1.6);
    ctx.closePath();
    ctx.fillStyle = g; ctx.fill();
  });
  ctx.restore();

  ctx.restore();
};

// 18. Derelict hulk
export const drawDerelict = (ctx: CanvasRenderingContext2D, x: number, y: number, t: number, dim: number, _h: Hsla) => {
  ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.00018);

  // Main hull silhouette — fully opaque, slightly larger
  ctx.beginPath();
  ctx.moveTo(-30, -9); ctx.lineTo(-12, -14); ctx.lineTo(10, -12);
  ctx.lineTo(24, -3); ctx.lineTo(16, 12); ctx.lineTo(-6, 14);
  ctx.lineTo(-26, 9); ctx.closePath();
  const hullGrad = ctx.createLinearGradient(0, -14, 0, 14);
  hullGrad.addColorStop(0, `hsl(220 10% 30% / ${dim})`);
  hullGrad.addColorStop(0.55, `hsl(220 10% 18% / ${dim})`);
  hullGrad.addColorStop(1, `hsl(220 12% 10% / ${dim})`);
  ctx.fillStyle = hullGrad; ctx.fill();
  ctx.strokeStyle = `hsl(220 14% 45% / ${0.95 * dim})`; ctx.lineWidth = 1; ctx.stroke();

  // Hull plating lines
  ctx.beginPath(); ctx.moveTo(-22, -6); ctx.lineTo(18, -4);
  ctx.strokeStyle = `hsl(220 14% 38% / ${0.7 * dim})`; ctx.lineWidth = 0.5; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-20, 4); ctx.lineTo(14, 6);
  ctx.stroke();

  // Glowing fracture / exposed interior cracks (warm orange)
  ctx.beginPath();
  ctx.moveTo(-12, -12); ctx.lineTo(-4, -2); ctx.lineTo(2, -6); ctx.lineTo(8, 2);
  ctx.strokeStyle = `hsl(15 90% 50% / ${0.85 * dim})`; ctx.lineWidth = 1.4; ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-2, -2); ctx.lineTo(-6, 6);
  ctx.strokeStyle = `hsl(20 95% 55% / ${0.7 * dim})`; ctx.lineWidth = 1; ctx.stroke();

  // Detached fragment (fully opaque, tumbling)
  ctx.save(); ctx.translate(24, -18); ctx.rotate(-t * 0.0005);
  ctx.beginPath();
  ctx.moveTo(-5, -3); ctx.lineTo(4, -4); ctx.lineTo(6, 3); ctx.lineTo(-3, 4); ctx.closePath();
  ctx.fillStyle = `hsl(220 10% 22% / ${dim})`; ctx.fill();
  ctx.strokeStyle = `hsl(220 14% 48% / ${0.95 * dim})`; ctx.lineWidth = 0.7; ctx.stroke();
  ctx.restore();

  // Emergency-light flicker
  const flickPhase = (t * 0.004) % (TAU * 2);
  const flick = Math.max(0, Math.sin(flickPhase)) * (0.5 + 0.5 * Math.sin(t * 0.017));
  if (flick > 0.3) {
    const glow = ctx.createRadialGradient(-4, -2, 0, -4, -2, 6);
    glow.addColorStop(0, `hsl(15 95% 65% / ${flick * dim})`);
    glow.addColorStop(1, "transparent");
    ctx.beginPath(); ctx.arc(-4, -2, 6, 0, TAU); ctx.fillStyle = glow; ctx.fill();
    ctx.beginPath(); ctx.arc(-4, -2, 1.4, 0, TAU);
    ctx.fillStyle = `hsl(15 95% 70% / ${flick * dim})`; ctx.fill();
  }
  ctx.restore();
};

// 19. Monolith (Clarke 1:4:9)
export const drawMonolith = (ctx: CanvasRenderingContext2D, x: number, y: number, t: number, dim: number, _h: Hsla) => {
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 0.0003) * 0.02);
  const aura = ctx.createRadialGradient(0, 0, 8, 0, 0, 28);
  aura.addColorStop(0, `hsl(220 30% 8% / ${0.5 * dim})`);
  aura.addColorStop(1, "transparent");
  ctx.beginPath(); ctx.arc(0, 0, 28, 0, TAU); ctx.fillStyle = aura; ctx.fill();
  const w = 8, h = 32;
  ctx.beginPath();
  ctx.rect(-w / 2, -h / 2, w, h);
  const slab = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  slab.addColorStop(0, `hsl(0 0% 8% / ${0.99 * dim})`);
  slab.addColorStop(0.5, `hsl(0 0% 2% / ${0.99 * dim})`);
  slab.addColorStop(1, `hsl(0 0% 6% / ${0.99 * dim})`);
  ctx.fillStyle = slab; ctx.fill();
  ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(-w / 2, h / 2);
  ctx.strokeStyle = `hsl(220 20% 25% / ${0.6 * dim})`; ctx.lineWidth = 0.5; ctx.stroke();
  ctx.restore();
};

// 20. Mining rig
export const drawMiningRig = (ctx: CanvasRenderingContext2D, x: number, y: number, t: number, dim: number, hsla: Hsla) => {
  ctx.save(); ctx.translate(x, y);

  // ── Asteroid: solid bumpy rock with shaded gradient and craters ──
  ctx.save(); ctx.translate(-16, 8); ctx.rotate(t * 0.00015);

  // Bumpy organic silhouette
  const baseR = 16;
  const lobes = 14;
  ctx.beginPath();
  for (let i = 0; i <= lobes; i += 1) {
    const a = (i / lobes) * TAU;
    // deterministic bump per vertex
    const noise = Math.sin(i * 2.3) * 0.18 + Math.cos(i * 5.1) * 0.12 + Math.sin(i * 1.1) * 0.08;
    const r = baseR * (1 + noise);
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r * 0.85;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();

  // Solid rocky fill with directional shading
  const rock = ctx.createRadialGradient(-5, -6, 2, 0, 0, baseR * 1.3);
  rock.addColorStop(0, `hsl(30 22% 48% / ${dim})`);
  rock.addColorStop(0.55, `hsl(28 22% 32% / ${dim})`);
  rock.addColorStop(1, `hsl(24 24% 16% / ${dim})`);
  ctx.fillStyle = rock; ctx.fill();
  ctx.strokeStyle = `hsl(24 22% 12% / ${0.95 * dim})`; ctx.lineWidth = 0.8; ctx.stroke();

  // Craters & surface marks
  const craters: [number, number, number][] = [
    [-4, -4, 2.6], [5, -2, 1.8], [-2, 5, 2.2], [7, 5, 1.4], [-9, 1, 1.6], [2, -8, 1.2],
  ];
  craters.forEach(([cx, cy, cr]) => {
    const cg = ctx.createRadialGradient(cx - cr * 0.3, cy - cr * 0.3, 0.2, cx, cy, cr);
    cg.addColorStop(0, `hsl(24 22% 18% / ${0.9 * dim})`);
    cg.addColorStop(0.7, `hsl(28 22% 30% / ${0.7 * dim})`);
    cg.addColorStop(1, `hsl(30 22% 42% / ${0.3 * dim})`);
    ctx.beginPath(); ctx.arc(cx, cy, cr, 0, TAU); ctx.fillStyle = cg; ctx.fill();
  });

  // Hot mining impact point (where the laser is striking)
  const heat = 0.6 + 0.4 * Math.sin(t * 0.012);
  const impact = ctx.createRadialGradient(8, -4, 0, 8, -4, 5);
  impact.addColorStop(0, `hsl(15 100% 75% / ${heat * dim})`);
  impact.addColorStop(0.5, `hsl(20 95% 55% / ${0.6 * heat * dim})`);
  impact.addColorStop(1, "transparent");
  ctx.beginPath(); ctx.arc(8, -4, 5, 0, TAU); ctx.fillStyle = impact; ctx.fill();
  ctx.beginPath(); ctx.arc(8, -4, 1.2, 0, TAU);
  ctx.fillStyle = `hsl(15 100% 80% / ${heat * dim})`; ctx.fill();
  ctx.restore();

  // ── Rig body (off to the side, firing the laser) ──
  ctx.save(); ctx.translate(14, -10);
  // Main hull
  ctx.beginPath(); ctx.rect(-9, -7, 18, 14);
  const hull = ctx.createLinearGradient(0, -7, 0, 7);
  hull.addColorStop(0, `hsl(220 14% 42% / ${dim})`);
  hull.addColorStop(1, `hsl(220 14% 18% / ${dim})`);
  ctx.fillStyle = hull; ctx.fill();
  ctx.strokeStyle = `hsl(220 18% 60% / ${0.85 * dim})`; ctx.lineWidth = 0.7; ctx.stroke();

  // Rib detail
  ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(9, 0);
  ctx.strokeStyle = `hsl(220 18% 28% / ${0.8 * dim})`; ctx.lineWidth = 0.5; ctx.stroke();

  // Solar / radiator panels
  ctx.beginPath(); ctx.rect(-19, -3, 9, 6);
  ctx.fillStyle = `hsl(215 55% 38% / ${dim})`; ctx.fill();
  ctx.strokeStyle = `hsl(215 30% 18% / ${0.9 * dim})`; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-15, -3); ctx.lineTo(-15, 3);
  ctx.stroke();

  ctx.beginPath(); ctx.rect(10, -3, 9, 6);
  ctx.fillStyle = `hsl(215 55% 38% / ${dim})`; ctx.fill();
  ctx.strokeStyle = `hsl(215 30% 18% / ${0.9 * dim})`; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(14, -3); ctx.lineTo(14, 3); ctx.stroke();

  // Status light
  const blink = 0.5 + 0.5 * Math.sin(t * 0.006);
  ctx.beginPath(); ctx.arc(6, -4, 0.9, 0, TAU);
  ctx.fillStyle = `hsl(146 80% 60% / ${(0.5 + blink * 0.5) * dim})`; ctx.fill();

  // Mining laser (from rig toward asteroid impact point at world ~(-8,-2))
  const pulse = 0.7 + 0.3 * Math.sin(t * 0.018);
  // Local target ≈ (-22, 6) since rig is translated to (14,-10)
  const tx = -22, ty = 6;
  const lg = ctx.createLinearGradient(-9, 0, tx, ty);
  lg.addColorStop(0, `hsl(15 100% 80% / ${pulse * dim})`);
  lg.addColorStop(0.5, `hsl(15 100% 60% / ${0.9 * pulse * dim})`);
  lg.addColorStop(1, `hsl(15 100% 50% / ${0.2 * pulse * dim})`);
  // beam as thin polygon
  const dx = tx - (-9), dy = ty - 0;
  const len = Math.hypot(dx, dy);
  const nx = -dy / len, ny = dx / len; // perpendicular
  const w = 1.2;
  ctx.beginPath();
  ctx.moveTo(-9 + nx * w, 0 + ny * w);
  ctx.lineTo(tx + nx * w * 0.4, ty + ny * w * 0.4);
  ctx.lineTo(tx - nx * w * 0.4, ty - ny * w * 0.4);
  ctx.lineTo(-9 - nx * w, 0 - ny * w);
  ctx.closePath();
  ctx.fillStyle = lg; ctx.fill();
  ctx.restore();

  // Ore particles drifting up from impact site
  for (let i = 0; i < 5; i += 1) {
    const off = ((t * 0.0009 + i * 0.2) % 1);
    const py = -2 - off * 30;
    const px = -8 + Math.sin(off * 6 + i) * 4;
    const r = 1.4 - off;
    ctx.beginPath(); ctx.arc(px, py, Math.max(0.3, r), 0, TAU);
    ctx.fillStyle = `hsl(${20 + i * 6} 80% ${55 + i * 4}% / ${(1 - off) * 0.9 * dim})`;
    ctx.fill();
  }

  ctx.restore();
};

// 29. Storm planet — planet wrapped in a thick swirling cyclone of clouds with lightning flashes
export const drawStormPlanet = (ctx: CanvasRenderingContext2D, x: number, y: number, t: number, dim: number, _h: Hsla) => {
  ctx.save(); ctx.translate(x, y);
  ctx.beginPath(); ctx.arc(0, 0, 22, 0, TAU);
  const body = ctx.createRadialGradient(-6, -6, 4, 0, 0, 24);
  body.addColorStop(0, `hsl(200 60% 35% / ${0.95 * dim})`);
  body.addColorStop(1, `hsl(220 70% 12% / ${0.95 * dim})`);
  ctx.fillStyle = body; ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.arc(0, 0, 22, 0, TAU); ctx.clip();
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * TAU + t * 0.0006;
    const r = 6 + (i % 3) * 5;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r * 0.9;
    ctx.beginPath(); ctx.ellipse(px, py, 8, 3, a, 0, TAU);
    ctx.fillStyle = `hsl(210 40% 70% / ${0.35 * dim})`; ctx.fill();
  }
  const flash = (Math.sin(t * 0.007) > 0.92) ? 1 : 0;
  if (flash) {
    const fx = (seeded(Math.floor(t / 200)) - 0.5) * 28;
    const fy = (seeded(Math.floor(t / 200) + 3) - 0.5) * 28;
    const fg = ctx.createRadialGradient(fx, fy, 0, fx, fy, 12);
    fg.addColorStop(0, `hsl(60 100% 90% / ${0.9 * dim})`);
    fg.addColorStop(1, "transparent");
    ctx.beginPath(); ctx.arc(fx, fy, 12, 0, TAU); ctx.fillStyle = fg; ctx.fill();
  }
  ctx.restore();
  ctx.save(); ctx.rotate(t * 0.0012);
  for (let arm = 0; arm < 3; arm += 1) {
    ctx.beginPath();
    const armPhase = (arm / 3) * TAU;
    for (let s = 0; s < 60; s += 1) {
      const u = s / 60;
      const ang = armPhase + u * Math.PI * 2.4;
      const rad = 22 + u * 22;
      const px = Math.cos(ang) * rad;
      const py = Math.sin(ang) * rad;
      if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = `hsl(${210 + arm * 10} 30% ${70 - arm * 8}% / ${0.55 * dim})`;
    ctx.lineWidth = 4 - arm * 0.8;
    ctx.lineCap = "round";
    ctx.stroke();
  }
  for (let i = 0; i < 14; i += 1) {
    const a = (i / 14) * TAU + t * 0.0008 * (i % 2 ? 1 : 1.3);
    const r = 30 + (i % 3) * 6 + Math.sin(t * 0.002 + i) * 2;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    const sz = 3 + seeded(i) * 3;
    const g = ctx.createRadialGradient(px, py, 0, px, py, sz * 2);
    g.addColorStop(0, `hsl(220 25% 80% / ${0.6 * dim})`);
    g.addColorStop(1, "transparent");
    ctx.beginPath(); ctx.arc(px, py, sz * 2, 0, TAU); ctx.fillStyle = g; ctx.fill();
  }
  ctx.restore();
  const eye = ctx.createRadialGradient(0, 0, 0, 0, 0, 4);
  eye.addColorStop(0, `hsl(200 60% 70% / ${(0.3 + 0.2 * Math.sin(t * 0.003)) * dim})`);
  eye.addColorStop(1, "transparent");
  ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fillStyle = eye; ctx.fill();
  ctx.restore();
};

// ─────────────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────────────
export const LITERARY_RENDERERS = {
  rorschach: drawRorschach,
  scrambler: drawScrambler,
  lighthugger: drawLighthugger,
  cacheweapon: drawCacheWeapon,
  inhibitor: drawInhibitor,
  patternjuggler: drawPatternJuggler,
  treeship: drawTreeship,
  farcaster: drawFarcaster,
  blackhole: drawBlackHole,
  quasar: drawQuasar,
  magnetar: drawMagnetar,
  wormhole: drawWormhole,
  supernova: drawSupernova,
  globular: drawGlobular,
  protodisk: drawProtoDisk,
  gasgiant: drawGasGiant,
  cometnucleus: drawCometNucleus,
  auroraworld: drawAuroraWorld,
  eclipse: drawEclipse,
  browndwarf: drawBrownDwarf,
  jumpgate: drawJumpGate,
  dysonswarm: drawDysonSwarm,
  ringworld: drawRingworld,
  solarsail: drawSolarSail,
  generationship: drawGenerationShip,
  derelict: drawDerelict,
  monolith: drawMonolith,
  miningrig: drawMiningRig,
  stormplanet: drawStormPlanet,
} as const;

export type LiteraryType = keyof typeof LITERARY_RENDERERS;

export const LITERARY_META: { type: LiteraryType; label: string; source: string }[] = [
  { type: "rorschach",      label: "Rorschach",        source: "Watts — Blindsight" },
  { type: "scrambler",      label: "Scrambler",        source: "Watts — Blindsight" },
  { type: "lighthugger",    label: "Lighthugger",      source: "Reynolds — Revelation Space" },
  { type: "cacheweapon",    label: "Cache Weapon",     source: "Reynolds — Redemption Ark" },
  { type: "inhibitor",      label: "Inhibitor",        source: "Reynolds — Revelation Space" },
  { type: "patternjuggler", label: "Pattern Juggler",  source: "Reynolds — Revelation Space" },
  { type: "treeship",       label: "Templar Treeship", source: "Simmons — Hyperion" },
  { type: "farcaster",      label: "Farcaster",        source: "Simmons — Hyperion" },
  { type: "blackhole",      label: "Black Hole",       source: "Real — accretion disk" },
  { type: "quasar",         label: "Quasar",           source: "Real — AGN with jets" },
  { type: "magnetar",       label: "Magnetar",         source: "Real — neutron star" },
  { type: "wormhole",       label: "Wormhole",         source: "Theoretical" },
  { type: "supernova",      label: "Supernova Remnant",source: "Real — shock front" },
  { type: "globular",       label: "Globular Cluster", source: "Real — dense cluster" },
  { type: "protodisk",      label: "Protoplanetary Disk", source: "Real — young system" },
  { type: "gasgiant",       label: "Gas Giant",        source: "Real — Jovian planet" },
  { type: "cometnucleus",   label: "Comet Nucleus",    source: "Real — dust + ion tails" },
  { type: "auroraworld",    label: "Aurora World",     source: "Real — magnetosphere" },
  { type: "eclipse",        label: "Eclipse",          source: "Real — solar corona" },
  { type: "browndwarf",     label: "Brown Dwarf",      source: "Real — failed star" },
  { type: "jumpgate",       label: "Jump Gate",        source: "Sci-fi — FTL portal" },
  { type: "dysonswarm",     label: "Dyson Swarm",      source: "Sci-fi — megastructure" },
  { type: "ringworld",      label: "Ringworld",        source: "Niven — habitat band" },
  { type: "solarsail",      label: "Solar Sail",       source: "Sci-fi — light propulsion" },
  { type: "generationship", label: "Generation Ship",  source: "Sci-fi — slow voyage" },
  { type: "derelict",       label: "Derelict Hulk",    source: "Sci-fi — abandoned ship" },
  { type: "monolith",       label: "Monolith",         source: "Clarke — 2001" },
  { type: "miningrig",      label: "Mining Rig",       source: "Sci-fi — asteroid harvest" },
  { type: "stormplanet",    label: "Storm Planet",     source: "Sci-fi — cyclone-wrapped world" },
];
