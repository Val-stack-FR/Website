import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  drawRorschach, drawScrambler, drawLighthugger, drawCacheWeapon, drawInhibitor,
  drawPatternJuggler, drawTreeship, drawFarcaster, drawBlackHole, drawQuasar,
  drawMagnetar, drawWormhole, drawSupernova, drawGlobular, drawProtoDisk,
  drawGasGiant, drawCometNucleus, drawAuroraWorld, drawEclipse, drawBrownDwarf,
  drawJumpGate, drawDysonSwarm, drawRingworld, drawSolarSail, drawGenerationShip,
  drawDerelict, drawMonolith, drawMiningRig, drawStormPlanet,
} from "./LiteraryObjects";

type Entry = {
  date: string;
  location: string;
  type: string;
  doing: string;
  insight: string;
};

type Point = { x: number; y: number };
type CardLayout = Point & { top: number; width: number; above: boolean };
type Star = { x: number; y: number; r: number; baseOp: number; phase: number; speed: number; hue: number; sat: number; light: number; bright: boolean };
type Comet = { x: number; y: number; vx: number; vy: number; length: number; life: number; maxLife: number };
type Satellite = { x: number; y: number; vx: number; vy: number; curve: number; blink: number };
type LandingLayout = { x: number; top: number; width: number };

const ENTRIES: Entry[] = [
  { date: "2015", location: "Asteroid Belt", type: "asteroid", doing: "Systems & Industrial Networks", insight: "Two-year technical degree in Computer Science. Networks and code for industrial environments — including a project for STMicroelectronics. You cannot optimise a system you do not understand from the hardware up." },
  { date: "Sep 2019 – Sep 2021", location: "Ancient Nebula", type: "nebula", doing: "History & Political Societies — Master's in Research", insight: "Chivalry in Maine during post-Hundred Years' War reconstruction (~1450–1500). Two years in archives turning fragmented 15th-century data into coherent narrative. How to audit truth when the sources are messy. It scales." },
  { date: "Apr 2022", location: "Pulsar Station", type: "pulsar", doing: "Writing technical R&D narratives", insight: "The craft came first. That foundation is why the AI work later had any epistemic weight at all." },
  { date: "Mid 2023", location: "Observatory Moon", type: "moon", doing: "Optimising my own work with AI. Public documents only. No mandate.", insight: "Start safe, start small. Optimizing my own practice before making claims about anyone else's." },
  { date: "Feb 2024", location: "Binary System", type: "binary", doing: "A/B testing: Human vs. Human augmented with AI — 10 evaluators, ~40 documents.", insight: "'I think AI helps' wasn't an opinion anymore. The controlled comparison was an argument." },
  { date: "Mar 2024", location: "Command Orbit", type: "ringedplanet", doing: "First AI strategy session with senior leadership.", insight: "The comparative study was the entry ticket. Not enthusiasm — data. We built the first technical/practionner roadmap." },
  { date: "Mid 2024", location: "Orbital Station", type: "station", doing: "Building the first internal AI drafting system.", insight: "The work expanded to fill the absence of anyone else doing it. That's how I learnt where the problems were." },
  { date: "Jan 2025", location: "Open Cluster", type: "cluster", doing: "AI Ambassador network — 30 people. 50% AI mandate.", insight: "What I had built for myself worked — in my hands. It turned out to be harder than i expected to transfer my knowledge to everyone else." },
  { date: "Apr 2025", location: "Signal Beacon", type: "beacon", doing: "Mapping every mission steps, process-wise, to the right AI tool. 94 rows. The construction of 28 training videos.", insight: "Individual practice has a half-life. The only way to make it last is to make it legible." },
  { date: "Aug 2025", location: "Long-Range Array", type: "quasar", doing: "Mapping knowledge work onto 1, 3, and 5-year horizons — what the consultant role becomes when AI handles the first draft, then the structure, then the judgment call.", insight: "The document wasn't a forecast. It was a forcing function — making the organisation name what it was not yet willing to name." },
  { date: "Sep 2025", location: "Proving Ground", type: "crater", doing: "Drafted a full internal AI roadmap solo — before the official governance workshops — to locate where the real disagreements would land before the room started shaping them.", insight: "The exercise wasn't preparation. It was a way of finding out what I actually believed." },
  { date: "Oct 2025", location: "Survey Satellite", type: "satellite", doing: "Large-scale internal survey. 200 people. No real picture before.", insight: "We couldnt govern blindly, what we had not measured. The real move from builder to strategist started here." },
  { date: "Nov 2025", location: "The Axiom Monolith ", type: "monolith", doing: "Authored the internal standard on AI-era critical review — why reading AI output requires more scrutiny, not less.", insight: "The harder argument to make isn't 'AI helps.' It's 'AI makes your job as a reader more demanding.'" },
  { date: "Jan 2026", location: "The Synapse Complex", type: "complex", doing: "First high-end multi-agent writing system.", insight: "Technical sophistication and human adoptability are orthogonal problems." },
  { date: "Jan 2026", location: "Primary Star", type: "sunstar", doing: "Formally appointed to 100% AI.", insight: "The recognition of the value brought along the past two years." },
  { date: "Mar 2026", location: "New World", type: "protodisk", doing: "Claude Skills is the future of agentic creation for non-technical experts.", insight: "The answer to the adoption problem isn't always better tools. It would be giving people the means to build their own." },
];

const NODE_Y_FRACS = [0.80, 0.15, 0.82, 0.16, 0.78, 0.20, 0.82, 0.15, 0.84, 0.17, 0.82, 0.16, 0.80, 0.18, 0.76, 0.66];
const INTRO_W = 500;
const CARD_RANGE_FRAC = 0.50;
const SHIP_FRAC = 0.28;
const PATH_OFFSET = 142;
const CARD_PATH_GAP = 132;
const TURN_DURATION = 2000;
const TURN_COOLDOWN = 420;
const REVERSE_THRESHOLD = 46;
const REVERSE_DECAY_MS = 220;
const TRAIL_FADE_MS = 700;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const rand = (a: number, b: number) => Math.random() * (b - a) + a;
const stationDockX = (trackW: number, vw: number) => trackW - vw * (1 - SHIP_FRAC);

const About = () => {
  const starCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lineCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<(HTMLElement | null)[]>([]);

  const dimsRef = useRef({ vw: 0, vh: 0, trackW: 0, maxScrollX: 0, nodeStep: 300 });
  const pointsRef = useRef<{ objPts: Point[]; pathPts: Point[]; splinePts: Point[] }>({ objPts: [], pathPts: [], splinePts: [] });
  const motionRef = useRef({
    scrollX: 0,
    targetX: 0,
    introRunning: false,
    animT: 0,
    heading: 1 as 1 | -1,
    turning: false,
    turnStartT: 0,
    turnStartX: 0,
    turnStartY: 0,
    turnStartAngle: 0,
    turnDirSign: -1,
    turnApexSign: -1,
    turnArcW: 0,
    turnArcH: 0,
    turnP1x: 0,
    turnP1y: 0,
    turnP2x: 0,
    turnP2y: 0,
    turnP3x: 0,
    turnP3y: 0,
    turnEndT: -Infinity,
    turnCooldownUntil: 0,
    reverseAccum: 0,
    lastReverseT: 0,
    pendingTargetDelta: 0,
  });
  const skyRef = useRef<{ stars: Star[]; comets: Comet[]; satellites: Satellite[]; lastComet: number; lastSatellite: number }>({ stars: [], comets: [], satellites: [], lastComet: 0, lastSatellite: 0 });
  const frameRef = useRef<number>();
  const resizeRef = useRef<number>();

  const cardLayoutsRef = useRef<CardLayout[]>([]);
  const pushSmoothedRef = useRef<number[]>(Array(ENTRIES.length).fill(0));
  const [cardLayouts, setCardLayouts] = useState<CardLayout[]>([]);
  const [progress, setProgress] = useState(0);
  const [location, setLocation] = useState("");
  const [hintHidden, setHintHidden] = useState(false);
  const [landingLayout, setLandingLayout] = useState<LandingLayout | null>(null);

  const colors = useMemo(() => ({
    text: "221 54% 91%",
    muted: "221 54% 91%",
    dim: "221 54% 91%",
    accent: "146 43% 52%",
    propulsion: "205 100% 67%",
  }), []);

  const hsla = useCallback((token: keyof typeof colors, alpha: number) => `hsl(${colors[token]} / ${alpha})`, [colors]);

  const pathY = useCallback((x: number) => {
    const { splinePts } = pointsRef.current;
    const { vh } = dimsRef.current;
    const n = splinePts.length;
    if (n < 2) return vh * 0.5;
    if (x <= splinePts[0].x) return splinePts[0].y;
    if (x >= splinePts[n - 1].x) return splinePts[n - 1].y;

    for (let i = 0; i < n - 1; i += 1) {
      if (x <= splinePts[i + 1].x) {
        const u = (x - splinePts[i].x) / (splinePts[i + 1].x - splinePts[i].x);
        const p0 = splinePts[Math.max(0, i - 1)];
        const p1 = splinePts[i];
        const p2 = splinePts[i + 1];
        const p3 = splinePts[Math.min(n - 1, i + 2)];
        const u2 = u * u;
        const u3 = u2 * u;
        return 0.5 * (2 * p1.y + (-p0.y + p2.y) * u + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * u2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * u3);
      }
    }
    return splinePts[n - 1].y;
  }, []);

  const pathAngle = useCallback((x: number) => Math.atan2(pathY(x + 4) - pathY(x - 4), 8), [pathY]);

  const drawObject = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, type: string, t: number, dim: number) => {
    const libraryObjects: Record<string, (ctx: CanvasRenderingContext2D, x: number, y: number, t: number, dim: number, hsla: typeof hsla) => void> = {
      rorschach: drawRorschach, scrambler: drawScrambler, lighthugger: drawLighthugger,
      cacheweapon: drawCacheWeapon, inhibitor: drawInhibitor, patternjuggler: drawPatternJuggler,
      treeship: drawTreeship, farcaster: drawFarcaster, blackhole: drawBlackHole,
      quasar: drawQuasar, magnetar: drawMagnetar, wormhole: drawWormhole,
      supernova: drawSupernova, globular: drawGlobular, protodisk: drawProtoDisk,
      gasgiant: drawGasGiant, cometnucleus: drawCometNucleus, auroraworld: drawAuroraWorld,
      eclipse: drawEclipse, browndwarf: drawBrownDwarf, jumpgate: drawJumpGate,
      dysonswarm: drawDysonSwarm, ringworld: drawRingworld, solarsail: drawSolarSail,
      generationship: drawGenerationShip, derelict: drawDerelict, monolith: drawMonolith,
      miningrig: drawMiningRig, stormplanet: drawStormPlanet,
    };
    if (libraryObjects[type]) { libraryObjects[type](ctx, x, y, t, dim, hsla); return; }

    const pulse = 0.5 + 0.5 * Math.sin(t * 0.0018 + x * 0.008);
    ctx.save();
    ctx.translate(x, y);

    const glow = (r: number, alpha: number) => {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, hsla("accent", alpha * dim));
      g.addColorStop(1, "transparent");
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
    };

    if (type === "asteroid") {
      ctx.rotate(t * 0.0002); glow(42, 0.16);
      const pts = [[28, 4], [-2, 22], [-24, 8], [-20, -16], [-2, -26], [22, -14]];
      ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath();
      ctx.fillStyle = `hsl(39 31% 50% / ${0.78 * dim})`; ctx.fill(); ctx.strokeStyle = `hsl(39 28% 30% / ${0.55 * dim})`; ctx.stroke();
    } else if (type === "nebula") {
      [[0, 0, 52, 267], [-16, -10, 36, 224], [14, 16, 34, 184]].forEach(([cx, cy, r, h]) => {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, `hsl(${h} 55% 60% / ${0.32 * dim})`); g.addColorStop(1, "transparent");
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
      });
    } else if (type === "pulsar") {
      for (let b = 0; b < 4; b += 1) {
        ctx.save(); ctx.rotate((b * Math.PI) / 2 + t * 0.0005);
        const g = ctx.createLinearGradient(0, 0, 0, -64 * pulse);
        g.addColorStop(0, `hsl(224 100% 88% / ${0.58 * dim})`); g.addColorStop(1, "transparent");
        ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(2, 0); ctx.lineTo(0, -64 * pulse); ctx.closePath(); ctx.fillStyle = g; ctx.fill(); ctx.restore();
      }
      glow(18, 0.8);
    } else if (type === "binary") {
      const orb = t * 0.001;
      [[Math.cos(orb) * 24, Math.sin(orb) * 12, 14, "45 100% 72%"], [-Math.cos(orb) * 24, -Math.sin(orb) * 12, 12, "208 100% 72%"]].forEach(([sx, sy, r, col]) => {
        const g = ctx.createRadialGradient(Number(sx), Number(sy), 0, Number(sx), Number(sy), Number(r) * 2.8);
        g.addColorStop(0, `hsl(${col} / ${0.82 * dim})`); g.addColorStop(1, "transparent");
        ctx.beginPath(); ctx.arc(Number(sx), Number(sy), Number(r) * 2.8, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
      });
    } else if (type === "ringedplanet") {
      ctx.save(); ctx.scale(1, 0.28); ctx.beginPath(); ctx.arc(0, 0, 42, 0, Math.PI * 2); ctx.strokeStyle = `hsl(42 86% 66% / ${0.44 * dim})`; ctx.lineWidth = 8; ctx.stroke(); ctx.restore(); glow(24, 0.62);
    } else if (type === "satellite") {
      glow(18, 0.5);
      ctx.rotate(Math.sin(t * 0.0007) * 0.18);
      ctx.beginPath(); ctx.rect(-6, -7, 12, 14); ctx.fillStyle = hsla("accent", 0.52 * dim); ctx.fill(); ctx.strokeStyle = hsla("text", 0.58 * dim); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-46, -12); ctx.lineTo(-46, 12); ctx.closePath(); ctx.moveTo(8, 0); ctx.lineTo(46, -12); ctx.lineTo(46, 12); ctx.closePath(); ctx.fillStyle = `hsl(211 72% 58% / ${0.28 * dim})`; ctx.fill(); ctx.strokeStyle = hsla("text", 0.36 * dim); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(0, -28); ctx.moveTo(0, 7); ctx.lineTo(0, 25); ctx.strokeStyle = hsla("text", 0.5 * dim); ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -32, 3 + pulse * 2, 0, Math.PI * 2); ctx.fillStyle = hsla("accent", 0.7 * dim); ctx.fill();
    } else if (type === "complex") {
      glow(32, 0.42);
      ctx.rotate(t * 0.00018);
      for (let k = 0; k < 3; k += 1) {
        ctx.beginPath(); ctx.ellipse(0, 0, 46 - k * 10, 17 + k * 3, (k * Math.PI) / 3, 0, Math.PI * 2); ctx.strokeStyle = hsla(k === 1 ? "accent" : "text", (0.34 - k * 0.06) * dim); ctx.lineWidth = 1.4; ctx.stroke();
      }
      for (let k = 0; k < 6; k += 1) {
        const a = (k * Math.PI) / 3;
        ctx.beginPath(); ctx.arc(Math.cos(a) * 34, Math.sin(a) * 12, 3.5, 0, Math.PI * 2); ctx.fillStyle = hsla("text", 0.42 * dim); ctx.fill();
      }
      ctx.beginPath(); ctx.rect(-11, -9, 22, 18); ctx.fillStyle = hsla("accent", 0.34 * dim); ctx.fill(); ctx.strokeStyle = hsla("text", 0.62 * dim); ctx.stroke();
    } else if (type === "station") {
      glow(14, 0.62);
      for (let k = 0; k < 4; k += 1) {
        const a = t * 0.0004 + (k * Math.PI) / 2;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 34, Math.sin(a) * 34); ctx.strokeStyle = hsla("text", 0.48 * dim); ctx.lineWidth = 1.5; ctx.stroke();
      }
      ctx.beginPath(); ctx.rect(-8, -6, 16, 12); ctx.fillStyle = hsla("accent", 0.45 * dim); ctx.fill(); ctx.strokeStyle = hsla("text", 0.62 * dim); ctx.stroke();
    } else if (type === "cluster") {
      [[0, 0, 4], [12, -8, 3], [-11, -5, 3], [8, 12, 3], [-8, 10, 3], [18, 3, 2], [-15, 6, 2], [4, -18, 2], [13, -14, 2], [-5, 18, 2]].forEach(([cx, cy, r]) => {
        ctx.beginPath(); ctx.arc(cx, cy, r * 2.8, 0, Math.PI * 2); ctx.fillStyle = hsla("text", 0.55 * dim); ctx.fill();
      });
    } else if (type === "beacon") {
      [42, 30, 18, 8].forEach((r, i) => { ctx.beginPath(); ctx.arc(0, 0, r * (0.9 + 0.1 * pulse), 0, Math.PI * 2); ctx.strokeStyle = hsla("accent", (0.32 - i * 0.06) * dim); ctx.stroke(); }); glow(10, 0.85);
    } else if (type === "sunstar") {
      [72, 52, 30].forEach((r, i) => { const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * (0.7 + pulse * 0.3)); g.addColorStop(0, `hsl(51 100% 68% / ${(0.24 - i * 0.06) * dim})`); g.addColorStop(1, "transparent"); ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill(); });
    } else if (type === "telescope") {
      glow(40, 0.22);
      ctx.save();
      ctx.beginPath(); ctx.rect(-30, -7, 52, 14);
      ctx.fillStyle = `hsl(205 45% 38% / ${0.75 * dim})`; ctx.fill();
      ctx.strokeStyle = `hsl(205 55% 60% / ${0.5 * dim})`; ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.rect(-38, -4, 12, 8);
      ctx.fillStyle = `hsl(205 35% 28% / ${0.85 * dim})`; ctx.fill();
      const lensG = ctx.createRadialGradient(22, 0, 0, 22, 0, 18);
      lensG.addColorStop(0, `hsl(200 100% 88% / ${(0.45 + pulse * 0.4) * dim})`);
      lensG.addColorStop(0.5, `hsl(200 80% 55% / ${0.18 * dim})`);
      lensG.addColorStop(1, "transparent");
      ctx.beginPath(); ctx.arc(22, 0, 18, 0, Math.PI * 2); ctx.fillStyle = lensG; ctx.fill();
      for (let r = 0; r < 3; r += 1) {
        const a = (t * 0.0006 + r * 0.45) % (Math.PI * 0.5) - Math.PI * 0.25;
        ctx.beginPath(); ctx.moveTo(30, 0); ctx.lineTo(30 + Math.cos(a) * 46, Math.sin(a) * 46);
        ctx.strokeStyle = `hsl(200 100% 78% / ${0.12 * dim})`; ctx.lineWidth = 1; ctx.stroke();
      }
      ctx.restore();
    } else if (type === "crater") {
      glow(36, 0.18);
      ctx.save();
      ctx.rotate(t * 0.00006);
      for (let r = 0; r < 7; r += 1) {
        const a = (r / 7) * Math.PI * 2;
        const len = 30 + Math.sin(a * 2.3) * 8;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * 18, Math.sin(a) * 18);
        ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
        ctx.strokeStyle = `hsl(28 42% 48% / ${0.28 * dim})`; ctx.lineWidth = 1.2; ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.strokeStyle = `hsl(28 38% 54% / ${0.65 * dim})`; ctx.lineWidth = 3; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2);
      ctx.strokeStyle = `hsl(28 33% 44% / ${0.5 * dim})`; ctx.lineWidth = 2; ctx.stroke();
      const craterG = ctx.createRadialGradient(0, 0, 0, 0, 0, 11);
      craterG.addColorStop(0, `hsl(28 58% 68% / ${(0.3 + pulse * 0.18) * dim})`);
      craterG.addColorStop(1, "transparent");
      ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fillStyle = craterG; ctx.fill();
      ctx.restore();
    } else {
      glow(40, 0.36); ctx.beginPath(); ctx.arc(0, 0, 27, 0, Math.PI * 2); ctx.fillStyle = `hsl(194 60% 46% / ${0.82 * dim})`; ctx.fill(); ctx.beginPath(); ctx.ellipse(-5, -5, 14, 9, 0.4, 0, Math.PI * 2); ctx.fillStyle = `hsl(142 45% 47% / ${0.7 * dim})`; ctx.fill();
    }
    ctx.restore();
  }, [hsla]);

  const drawShip = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, t: number, turnIntensity = 0) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    const pulse = 0.5 + 0.5 * Math.sin(t * 0.012);
    const burst = clamp(turnIntensity, 0, 1);
    const trailMul = 1 + burst * 1.6;
    const widthMul = 1 + burst * 1.4;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const trailLength = (132 + pulse * 28) * trailMul;
    const trail = ctx.createLinearGradient(-trailLength - 32, 0, -34, 0);
    trail.addColorStop(0, "transparent");
    trail.addColorStop(0.32, hsla("propulsion", 0.05 + burst * 0.08));
    trail.addColorStop(0.74, hsla("propulsion", 0.18 + burst * 0.18));
    trail.addColorStop(1, hsla("propulsion", 0.54 + burst * 0.3));
    ctx.beginPath();
    ctx.ellipse(-82, 0, trailLength * 0.58, (12 + pulse * 3) * widthMul, 0, 0, Math.PI * 2);
    ctx.fillStyle = trail;
    ctx.fill();
    const streamCount = 3 + (burst > 0.05 ? 2 : 0);
    for (let i = 0; i < streamCount; i += 1) {
      const streamY = (i - (streamCount - 1) / 2) * 5.5 * widthMul;
      const stream = ctx.createLinearGradient(-trailLength - 18, streamY, -42, streamY);
      stream.addColorStop(0, "transparent");
      stream.addColorStop(0.55, hsla("propulsion", 0.08 + burst * 0.12));
      stream.addColorStop(1, hsla("propulsion", 0.34 + burst * 0.3));
      ctx.beginPath();
      ctx.moveTo(-trailLength - 18, streamY + Math.sin(t * 0.01 + i) * 1.5);
      ctx.quadraticCurveTo(-92, streamY + Math.sin(t * 0.008 + i * 1.7) * 8 * widthMul, -42, streamY);
      ctx.strokeStyle = stream;
      ctx.lineWidth = (i === Math.floor(streamCount / 2) ? 2.4 : 1.4) * widthMul;
      ctx.stroke();
    }
    if (burst > 0.05) {
      const coreGrad = ctx.createRadialGradient(-44, 0, 0, -44, 0, 22 * widthMul);
      coreGrad.addColorStop(0, `hsl(0 0% 100% / ${0.55 * burst})`);
      coreGrad.addColorStop(0.4, hsla("propulsion", 0.55 * burst));
      coreGrad.addColorStop(1, "transparent");
      ctx.beginPath();
      ctx.ellipse(-44, 0, 26 * widthMul, 7 * widthMul, 0, 0, Math.PI * 2);
      ctx.fillStyle = coreGrad;
      ctx.fill();
    }
    ctx.restore();

    const plume = ctx.createRadialGradient(-31, 0, 0, -31, 0, (30 + pulse * 8) * widthMul);
    plume.addColorStop(0, hsla("propulsion", 0.72 + burst * 0.2));
    plume.addColorStop(0.36, hsla("propulsion", 0.28 + burst * 0.18));
    plume.addColorStop(1, "transparent");
    ctx.beginPath(); ctx.ellipse(-31, 0, (32 + pulse * 9) * widthMul, (9 + pulse * 2) * widthMul, 0, 0, Math.PI * 2); ctx.fillStyle = plume; ctx.fill();

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = hsla("text", 0.34);
    ctx.lineWidth = 1.15;
    ctx.beginPath(); ctx.moveTo(-33, 0); ctx.lineTo(25, 0); ctx.moveTo(-19, -8); ctx.lineTo(1, 8); ctx.moveTo(-19, 8); ctx.lineTo(1, -8); ctx.stroke();

    const modules = [[-27, -5, 12, 10], [-12, -6, 15, 12], [5, -7, 17, 14], [22, -5, 10, 10]];
    modules.forEach(([mx, my, mw, mh], i) => {
      ctx.beginPath(); ctx.roundRect(mx, my, mw, mh, 2);
      ctx.fillStyle = hsla("text", i === 2 ? 0.86 : 0.72);
      ctx.fill();
      ctx.strokeStyle = hsla(i === 2 ? "propulsion" : "text", i === 2 ? 0.42 : 0.28);
      ctx.stroke();
    });
    ctx.beginPath(); ctx.moveTo(35, 0); ctx.lineTo(28, -5); ctx.lineTo(28, 5); ctx.closePath(); ctx.fillStyle = hsla("text", 0.9); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-34, -5); ctx.lineTo(-42, -9); ctx.moveTo(-34, 5); ctx.lineTo(-42, 9); ctx.strokeStyle = hsla("propulsion", 0.82); ctx.lineWidth = 1.5; ctx.stroke();
    [-19, -8, 8, 22].forEach((px) => { ctx.beginPath(); ctx.arc(px, 0, 1.4, 0, Math.PI * 2); ctx.fillStyle = hsla("propulsion", 0.78); ctx.fill(); });
    ctx.restore();
  }, [hsla]);

  const drawWaitStation = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, t: number, dim: number) => {
    ctx.save();
    ctx.translate(x, y);
    const pulse = 0.5 + 0.5 * Math.sin(t * 0.002);
    const dockGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, 92);
    dockGlow.addColorStop(0, hsla("accent", 0.22 * dim));
    dockGlow.addColorStop(1, "transparent");
    ctx.beginPath(); ctx.arc(0, 0, 92, 0, Math.PI * 2); ctx.fillStyle = dockGlow; ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, 42, 0, Math.PI * 2); ctx.strokeStyle = hsla("text", 0.28 * dim); ctx.lineWidth = 7; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 62 + pulse * 7, 0, Math.PI * 2); ctx.strokeStyle = hsla("accent", 0.18 * dim); ctx.lineWidth = 1; ctx.stroke();
    for (let i = 0; i < 4; i += 1) {
      const a = (Math.PI / 2) * i + t * 0.00018;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * 30, Math.sin(a) * 30); ctx.lineTo(Math.cos(a) * 88, Math.sin(a) * 88); ctx.strokeStyle = hsla("text", 0.18 * dim); ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.beginPath(); ctx.rect(-18, -12, 36, 24); ctx.fillStyle = hsla("accent", 0.26 * dim); ctx.fill(); ctx.strokeStyle = hsla("text", 0.46 * dim); ctx.stroke();
    ctx.restore();
  }, [hsla]);

  const drawTimeline = useCallback((t: number) => {
    const canvas = lineCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { vw, vh, trackW, maxScrollX } = dimsRef.current;
    const { objPts } = pointsRef.current;
    const { scrollX } = motionRef.current;
    ctx.clearRect(0, 0, trackW, vh);

    const leadX = clamp(scrollX + vw * SHIP_FRAC, 0, trackW - 2);
    const segs = Math.max(320, Math.floor(trackW / 6));
    ctx.beginPath();
    for (let i = 0; i <= segs; i += 1) { const x = (i / segs) * trackW; i === 0 ? ctx.moveTo(x, pathY(x)) : ctx.lineTo(x, pathY(x)); }
    ctx.strokeStyle = hsla("text", 0.06); ctx.lineWidth = 1; ctx.stroke();

    const doneSegs = Math.floor((leadX / trackW) * segs);
    if (doneSegs > 0) {
      ctx.beginPath();
      for (let i = 0; i <= doneSegs; i += 1) { const x = (i / segs) * trackW; i === 0 ? ctx.moveTo(x, pathY(x)) : ctx.lineTo(x, pathY(x)); }
      const g = ctx.createLinearGradient(Math.max(0, leadX - vw * 0.8), 0, leadX, 0);
      g.addColorStop(0, hsla("accent", 0.08)); g.addColorStop(0.72, hsla("accent", 0.42)); g.addColorStop(1, hsla("accent", 0.95));
      ctx.strokeStyle = g; ctx.lineWidth = 1.6; ctx.stroke();
    }

    objPts.forEach((obj, i) => {
      const py = pathY(obj.x);
      const maxDist = vw * CARD_RANGE_FRAC;
      const proximity = Math.max(0, 1 - Math.abs(obj.x - leadX) / maxDist);
      if (proximity > 0.04) {
        ctx.beginPath(); ctx.moveTo(obj.x, py); ctx.lineTo(obj.x, obj.y); ctx.setLineDash([3, 5]); ctx.strokeStyle = hsla("accent", 0.25 * proximity); ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
      }
      const reached = obj.x <= leadX + 20;
      const dim = reached ? Math.max(0.18, proximity * 0.85 + 0.15) : 0.16;
      drawObject(ctx, obj.x, obj.y, ENTRIES[i].type, t, dim);
    });

    const stationX = stationDockX(trackW, vw);
    const stationDim = clamp(1 - Math.abs(stationX - leadX) / (vw * 0.72), 0.36, 1);
    drawWaitStation(ctx, stationX, vh * 0.5, t, stationDim);

    const motion = motionRef.current;
    const turnDur = TURN_DURATION;
    const turnRaw = motion.turning ? clamp((t - motion.turnStartT) / turnDur, 0, 1) : 0;
    const turnEase = turnRaw < 0.5 ? 4 * turnRaw * turnRaw * turnRaw : 1 - Math.pow(-2 * turnRaw + 2, 3) / 2;
    const turnIntensity = motion.turning ? Math.sin(turnEase * Math.PI) : 0;

    let shipX: number;
    let shipY: number;
    let shipAngle: number;

    // Cubic Bézier helpers — tangent-continuous U-turn whose endpoint tangents
    // match the ship's heading and reversed heading. P0 is the origin (turn start).
    const bezierPos = (u: number) => {
      const inv = 1 - u;
      const bx =
        3 * inv * inv * u * motion.turnP1x +
        3 * inv * u * u * motion.turnP2x +
        u * u * u * motion.turnP3x;
      const by =
        3 * inv * inv * u * motion.turnP1y +
        3 * inv * u * u * motion.turnP2y +
        u * u * u * motion.turnP3y;
      return { x: bx, y: by };
    };
    const bezierTangent = (u: number) => {
      const inv = 1 - u;
      const dx =
        3 * inv * inv * motion.turnP1x +
        6 * inv * u * (motion.turnP2x - motion.turnP1x) +
        3 * u * u * (motion.turnP3x - motion.turnP2x);
      const dy =
        3 * inv * inv * motion.turnP1y +
        6 * inv * u * (motion.turnP2y - motion.turnP1y) +
        3 * u * u * (motion.turnP3y - motion.turnP2y);
      return { x: dx, y: dy };
    };

    if (motion.turning) {
      const u = turnEase;
      const pos = bezierPos(u);
      const tan = bezierTangent(u);
      shipX = motion.turnStartX + pos.x;
      shipY = motion.turnStartY + pos.y;
      shipAngle = Math.atan2(tan.y, tan.x);

      // Arc trail — ship's flight path during the maneuver
      const trailFadeIn = clamp(u / 0.3, 0, 1);
      const trailFadeOut = clamp((1 - u) / 0.25, 0, 1);
      const trailAlpha = Math.min(trailFadeIn, trailFadeOut);
      ctx.save();
      ctx.beginPath();
      const trailSegs = 48;
      for (let i = 0; i <= trailSegs; i += 1) {
        const tu = (i / trailSegs) * u;
        const p = bezierPos(tu);
        const tx = motion.turnStartX + p.x;
        const ty = motion.turnStartY + p.y;
        if (i === 0) ctx.moveTo(tx, ty); else ctx.lineTo(tx, ty);
      }
      ctx.strokeStyle = hsla("accent", 0.55 * trailAlpha);
      ctx.lineWidth = 1.6;
      ctx.shadowColor = hsla("accent", 0.5 * trailAlpha);
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.restore();
    } else {
      shipX = leadX;
      shipY = pathY(leadX);
      shipAngle = pathAngle(leadX) + (motion.heading === -1 ? Math.PI : 0);

      // Lingering trail fade-out after turn ends
      const sinceTurn = t - motion.turnEndT;
      if (sinceTurn >= 0 && sinceTurn < TRAIL_FADE_MS && motion.turnArcW > 0) {
        const fade = 1 - sinceTurn / TRAIL_FADE_MS;
        ctx.save();
        ctx.beginPath();
        const trailSegs = 48;
        for (let i = 0; i <= trailSegs; i += 1) {
          const tu = i / trailSegs;
          const p = bezierPos(tu);
          const tx = motion.turnStartX + p.x;
          const ty = motion.turnStartY + p.y;
          if (i === 0) ctx.moveTo(tx, ty); else ctx.lineTo(tx, ty);
        }
        ctx.strokeStyle = hsla("accent", 0.45 * fade);
        ctx.lineWidth = 1.4;
        ctx.shadowColor = hsla("accent", 0.4 * fade);
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.restore();
      }
    }

    drawShip(ctx, shipX, shipY, shipAngle, t, turnIntensity);
    setProgress(maxScrollX > 0 ? scrollX / maxScrollX : 0);
  }, [drawObject, drawShip, drawWaitStation, hsla, pathAngle, pathY]);

  const initStars = useCallback(() => {
    const { vw, vh } = dimsRef.current;
    const count = Math.floor((vw * vh) / 1400);
    const palettes = [[155, 45, 91], [42, 85, 82], [211, 100, 78], [146, 43, 70]];
    skyRef.current.stars = Array.from({ length: count }, () => {
      const bright = Math.random() < 0.07;
      const pal = palettes[Math.floor(Math.random() * palettes.length)];
      return { x: rand(0, vw), y: rand(0, vh), r: bright ? rand(1.2, 2.4) : rand(0.2, 1.1), baseOp: bright ? rand(0.5, 0.95) : rand(0.2, 0.75), phase: rand(0, Math.PI * 2), speed: rand(0.3, 1.8), hue: pal[0], sat: pal[1], light: pal[2], bright };
    });
  }, []);

  const rebuild = useCallback(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const nodeStep = clamp(vw * 0.50, 360, 620);
    const introW = vw < 700 ? vw * 0.7 : clamp(vw * 0.48, 320, INTRO_W);
    const tail = Math.ceil(vw * 1.12);
    const trackW = Math.ceil(introW + ENTRIES.length * nodeStep + tail);
    const maxScrollX = Math.max(0, trackW - vw);
    const cardW = clamp(vw * 0.7, 230, 280);

    dimsRef.current = { vw, vh, trackW, maxScrollX, nodeStep };
    motionRef.current.targetX = clamp(motionRef.current.targetX, 0, maxScrollX);
    motionRef.current.scrollX = clamp(motionRef.current.scrollX, 0, maxScrollX);

    const objPts = ENTRIES.map((_, i) => ({ x: introW + (i + 0.5) * nodeStep, y: clamp(vh * NODE_Y_FRACS[i], vh * 0.13, vh * 0.87) }));
    const pathPts = objPts.map((pt) => ({ x: pt.x, y: pt.y + (pt.y > vh * 0.5 ? -PATH_OFFSET : PATH_OFFSET) }));
    const splinePts: Point[] = [{ x: 0, y: vh * 0.5 }, { x: introW * 0.42, y: vh * 0.5 }];
    pathPts.forEach((pp, i) => {
      const prevX = i > 0 ? pathPts[i - 1].x : introW * 0.42;
      const nextX = i < pathPts.length - 1 ? pathPts[i + 1].x : pp.x + nodeStep * 0.5;
      splinePts.push({ x: (prevX + pp.x) * 0.5, y: vh * 0.5 }, { x: pp.x, y: pp.y }, { x: (pp.x + nextX) * 0.5, y: vh * 0.5 });
    });
    const stationX = stationDockX(trackW, vw);
    splinePts.push({ x: stationX - nodeStep * 0.22, y: vh * 0.5 }, { x: stationX, y: vh * 0.5 }, { x: trackW, y: vh * 0.5 });
    pointsRef.current = { objPts, pathPts, splinePts };

    setCardLayouts(objPts.map((pt) => {
      const above = pt.y > vh * 0.5;
      const estimatedH = vw < 700 ? 230 : 205;
      const left = vw < 700 ? pt.x + cardW * 0.24 : pt.x;
      return { x: left, y: pt.y, width: cardW, above, top: above ? clamp(pt.y - CARD_PATH_GAP - estimatedH, 82, vh - estimatedH - 54) : clamp(pt.y + CARD_PATH_GAP, 82, vh - estimatedH - 54) };
    }));
    const landingCardSide = stationX > maxScrollX + vw * 0.5 ? -1 : 1;
    setLandingLayout({ x: stationX + landingCardSide * Math.min(vw * 0.24, 220), top: clamp(vh * 0.5 - 96, 92, vh - 236), width: clamp(vw * 0.72, 240, 320) });

    const line = lineCanvasRef.current;
    if (line) {
      const dpr = window.devicePixelRatio || 1;
      line.width = Math.floor(trackW * dpr); line.height = Math.floor(vh * dpr);
      line.style.width = `${trackW}px`; line.style.height = `${vh}px`;
      const ctx = line.getContext("2d");
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    const star = starCanvasRef.current;
    if (star) {
      const dpr = window.devicePixelRatio || 1;
      star.width = Math.floor(vw * dpr); star.height = Math.floor(vh * dpr);
      star.style.width = `${vw}px`; star.style.height = `${vh}px`;
      const ctx = star.getContext("2d");
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    initStars();
  }, [initStars]);

  const runAutoIntro = useCallback(() => {
    const first = pointsRef.current.objPts[0];
    const { vw } = dimsRef.current;
    if (!first) return;
    const introTarget = vw < 700 ? 0 : Math.max(60, first.x - vw * SHIP_FRAC - 20);
    const duration = 4400;
    const start = performance.now();
    motionRef.current.introRunning = true;
    const ease = (n: number) => (n < 0.5 ? 4 * n * n * n : 1 - Math.pow(-2 * n + 2, 3) / 2);
    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      motionRef.current.scrollX = introTarget * ease(t);
      motionRef.current.targetX = motionRef.current.scrollX;
      if (t < 1) requestAnimationFrame(step);
      else motionRef.current.introRunning = false;
    };
    requestAnimationFrame(step);
  }, []);

  useEffect(() => {
    rebuild();
    const introTimer = window.setTimeout(runAutoIntro, 500);

    const onResize = () => {
      window.clearTimeout(resizeRef.current);
      resizeRef.current = window.setTimeout(rebuild, 150);
    };

    const tryStartTurn = (now: number) => {
      const m = motionRef.current;
      if (m.turning || m.introRunning) return false;
      if (now < m.turnCooldownUntil) return false;
      const { vw, vh, trackW } = dimsRef.current;
      const startX = m.scrollX + vw * SHIP_FRAC;
      const startY = pathY(startX);
      const startAngle = pathAngle(startX) + (m.heading === -1 ? Math.PI : 0);
      // Apex sign: place arc opposite to nearest card so it doesn't cross text.
      // Cards above when pt.y > vh*0.5 (above flag); use y position of nearest objPt.
      const objPts = pointsRef.current.objPts;
      let nearestSign = startY < vh * 0.5 ? -1 : 1;
      if (objPts.length) {
        let nearest = objPts[0];
        let nd = Math.abs(objPts[0].x - startX);
        for (let i = 1; i < objPts.length; i += 1) {
          const d = Math.abs(objPts[i].x - startX);
          if (d < nd) { nd = d; nearest = objPts[i]; }
        }
        // If card is above (nearest.y > vh*0.5 means card sits above the line per layout logic)
        // We want apex to go opposite side. Apex sign of -1 = upward in screen.
        nearestSign = nearest.y > vh * 0.5 ? 1 : -1;
      }
      const apexSign = nearestSign; // -1 = arc upward, +1 = arc downward
      // Arc extends "backward" relative to current heading (visual loop goes back the way we came)
      const dirSign = -m.heading;
      // Target the nearest previous node so the arc lands under a milestone card.
      let targetNodeX: number | null = null;
      let nearestNodeDist = Infinity;
      objPts.forEach(pt => {
        const isBehind = m.heading === 1 ? pt.x < startX : pt.x > startX;
        if (!isBehind) return;
        const d = Math.abs(pt.x - startX);
        if (d < nearestNodeDist) { nearestNodeDist = d; targetNodeX = pt.x; }
      });
      const desiredArcW = targetNodeX !== null
        ? Math.abs(targetNodeX - startX)
        : clamp(vw * 0.34, 380, 580);
      // Clamp to stay inside world bounds
      const maxBack = dirSign < 0 ? startX - 20 : (trackW - 20) - startX;
      const arcW = clamp(desiredArcW, 200, Math.max(200, maxBack));
      const arcH = clamp(vh * 0.26, 170, 270);

      // Cubic Bézier control points (relative to turn start) with endpoint
      // tangents matching heading and heading+π. Apex bulges along the
      // perpendicular to the heading, on the side opposite the nearest card.
      const a = startAngle;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const perpX = -sa;
      const perpY = ca;
      const k = arcW * 0.55;          // tangent handle length along heading
      const h = arcH * apexSign;      // perpendicular bulge (signed)
      const endX = -arcW * ca;        // end point sits "behind" the ship along its heading
      // Snap endpoint Y to the actual spline so the post-turn handoff is seamless
      const endWorldX = clamp(startX + endX, 0, trackW);
      const endWorldY = pathY(endWorldX);
      const p3y = endWorldY - startY;
      const p1x = k * ca + h * perpX;
      const p1y = k * sa + h * perpY;
      // Match the Bézier arrival tangent to the spline slope at the landing X
      // so the seam at turn end is C1-continuous (no angle snap on the next frame).
      // Post-turn heading is the opposite of the current heading.
      const postHeading = (m.heading === 1 ? -1 : 1);
      const arrivalAngle = pathAngle(endWorldX) + (postHeading === -1 ? Math.PI : 0);
      const p2x = endX - k * Math.cos(arrivalAngle);
      const p2y = p3y - k * Math.sin(arrivalAngle);

      m.turning = true;
      m.turnStartT = now;
      m.turnStartX = startX;
      m.turnStartY = startY;
      m.turnStartAngle = startAngle;
      m.turnDirSign = dirSign;
      m.turnApexSign = apexSign;
      m.turnArcW = arcW;
      m.turnArcH = arcH;
      m.turnP1x = p1x;
      m.turnP1y = p1y;
      m.turnP2x = p2x;
      m.turnP2y = p2y;
      m.turnP3x = endX;
      m.turnP3y = p3y;
      m.reverseAccum = 0;
      return true;
    };

    const accumulateInput = (delta: number) => {
      const m = motionRef.current;
      const now = m.animT;
      if (now - m.lastReverseT > REVERSE_DECAY_MS) m.reverseAccum = 0;
      m.lastReverseT = now;
      // Reverse = input opposite to ship's heading direction along scrollX
      // heading=+1 forward; "forward input" = positive delta. Reverse input = delta and heading have opposite sign.
      const reverseInput = (delta < 0 && m.heading === 1) || (delta > 0 && m.heading === -1);
      if (reverseInput) {
        m.reverseAccum += Math.abs(delta);
        if (m.reverseAccum >= REVERSE_THRESHOLD) tryStartTurn(now);
      } else if (Math.abs(delta) > 4) {
        m.reverseAccum = 0;
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const m = motionRef.current;
      if (m.introRunning) return;
      const { maxScrollX } = dimsRef.current;
      const delta = e.deltaY * 1.15 + e.deltaX * 1.15;
      accumulateInput(delta);
      if (m.turning) return;
      m.targetX = clamp(m.targetX + delta, 0, maxScrollX);
    };
    let tx0 = 0; let ty0 = 0; let sx0 = 0; let lastTouchDx = 0;
    const onTouchStart = (e: TouchEvent) => { tx0 = e.touches[0].clientX; ty0 = e.touches[0].clientY; sx0 = motionRef.current.targetX; lastTouchDx = 0; };
    const onTouchMove = (e: TouchEvent) => {
      const m = motionRef.current;
      if (m.introRunning) return;
      const dx = tx0 - e.touches[0].clientX;
      const dy = Math.abs(ty0 - e.touches[0].clientY);
      if (Math.abs(dx) > dy) e.preventDefault();
      const incremental = dx - lastTouchDx;
      lastTouchDx = dx;
      accumulateInput(incremental);
      if (m.turning) return;
      m.targetX = clamp(sx0 + dx * 1.65, 0, dimsRef.current.maxScrollX);
    };
    const onKey = (e: KeyboardEvent) => {
      const m = motionRef.current;
      if (m.introRunning) return;
      const step = dimsRef.current.vw * 0.35;
      let delta = 0;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") delta = step;
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") delta = -step;
      else return;
      accumulateInput(delta);
      if (m.turning) return;
      m.targetX = clamp(m.targetX + delta, 0, dimsRef.current.maxScrollX);
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("keydown", onKey);

    const spawnComet = () => {
      const { vw, vh } = dimsRef.current;
      const angle = rand(Math.PI * 0.52, Math.PI * 0.74);
      const speed = rand(1.0, 2.6);
      const length = rand(90, 280);
      skyRef.current.comets.push({ x: rand(vw * 0.2, vw * 1.1), y: rand(-50, vh * 0.4), vx: -Math.cos(angle) * speed, vy: Math.sin(angle) * speed, length, life: 0, maxLife: Math.floor(length / speed) + 28 });
    };
    const spawnSatellite = () => {
      const { vw, vh } = dimsRef.current;
      const left = Math.random() < 0.5;
      const angle = rand(-0.1, 0.1);
      const speed = rand(0.4, 1.0);
      skyRef.current.satellites.push({ x: left ? -8 : vw + 8, y: rand(vh * 0.06, vh * 0.6), vx: left ? Math.cos(angle) * speed : -Math.cos(angle) * speed, vy: Math.sin(angle) * speed, curve: rand(-0.005, 0.005), blink: rand(0, Math.PI * 2) });
    };

    const animate = (t: number) => {
      motionRef.current.animT = t;
      const { vw, vh, trackW } = dimsRef.current;
      const sky = skyRef.current;
      const ctx = starCanvasRef.current?.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, vw, vh);
        [[vw * 0.12, vh * 0.25, vw * 0.38, 267], [vw * 0.75, vh * 0.65, vw * 0.30, 216], [vw * 0.5, vh * 0.1, vw * 0.22, 166]].forEach(([nx, ny, nr, hue]) => {
          const g = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
          g.addColorStop(0, `hsl(${hue} 55% 35% / 0.10)`); g.addColorStop(1, "transparent");
          ctx.beginPath(); ctx.arc(nx, ny, nr, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
        });
        ctx.save(); ctx.translate(vw / 2, vh / 2); ctx.rotate(t * 0.00001); ctx.translate(-vw / 2, -vh / 2);
        sky.stars.forEach((s) => {
          const flicker = 0.5 + 0.5 * Math.sin(t * 0.001 * s.speed + s.phase);
          const op = s.baseOp * (0.5 + 0.5 * flicker);
          if (s.bright) {
            const grd = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 3.5);
            grd.addColorStop(0, `hsl(${s.hue} ${s.sat}% ${s.light}% / ${op * 0.25})`); grd.addColorStop(1, "transparent");
            ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 3.5, 0, Math.PI * 2); ctx.fillStyle = grd; ctx.fill();
          }
          ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fillStyle = `hsl(${s.hue} ${s.sat}% ${s.light}% / ${op})`; ctx.fill();
        });
        sky.comets.forEach((c, i) => {
          const headOp = Math.max(0, 1 - (c.life / c.maxLife) * 1.2);
          const spd = Math.hypot(c.vx, c.vy);
          const tx = c.x - (c.vx / spd) * Math.min(c.length, c.life * spd);
          const ty = c.y - (c.vy / spd) * Math.min(c.length, c.life * spd);
          const gr = ctx.createLinearGradient(tx, ty, c.x, c.y);
          gr.addColorStop(0, "transparent"); gr.addColorStop(1, hsla("text", headOp * 0.9));
          ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(c.x, c.y); ctx.strokeStyle = gr; ctx.lineWidth = 1.5; ctx.stroke();
          c.x += c.vx; c.y += c.vy; c.life += 1;
          if (c.life > c.maxLife || c.x < -80 || c.y > vh + 80) sky.comets.splice(i, 1);
        });
        ctx.restore();
        sky.satellites.forEach((s, i) => {
          s.blink += 0.04;
          const op = 0.3 + 0.4 * (0.5 + 0.5 * Math.sin(s.blink * 3));
          ctx.beginPath(); ctx.arc(s.x, s.y, 1.2, 0, Math.PI * 2); ctx.fillStyle = hsla("accent", op); ctx.fill();
          const ang = Math.atan2(s.vy, s.vx) + s.curve;
          const spd = Math.hypot(s.vx, s.vy);
          s.vx = Math.cos(ang) * spd; s.vy = Math.sin(ang) * spd; s.x += s.vx; s.y += s.vy;
          if (s.x < -30 || s.x > vw + 30 || s.y < -30 || s.y > vh + 30) sky.satellites.splice(i, 1);
        });
      }

      if (t - sky.lastComet > rand(5000, 10000)) { spawnComet(); sky.lastComet = t; }
      if (t - sky.lastSatellite > rand(11000, 22000)) { spawnSatellite(); sky.lastSatellite = t; }

      const motion = motionRef.current;
      if (motion.turning && t - motion.turnStartT >= TURN_DURATION) {
        motion.turning = false;
        motion.heading = (motion.heading === 1 ? -1 : 1) as 1 | -1;
        motion.turnEndT = t;
        motion.turnCooldownUntil = t + TURN_COOLDOWN;
        motion.reverseAccum = 0;
        // Arc already lands at the target node — hold position, no extra drift.
        motion.targetX = motion.scrollX;
      }
      if (motion.turning) {
        // Pin the ship to SHIP_FRAC within the viewport by driving scrollX from
        // the Bézier's current world X (same easing/formula as drawTimeline's bezierPos).
        const tRaw = clamp((t - motion.turnStartT) / TURN_DURATION, 0, 1);
        const tEase = tRaw < 0.5
          ? 4 * tRaw * tRaw * tRaw
          : 1 - Math.pow(-2 * tRaw + 2, 3) / 2;
        const inv = 1 - tEase;
        const bx =
          3 * inv * inv * tEase * motion.turnP1x +
          3 * inv * tEase * tEase * motion.turnP2x +
          tEase * tEase * tEase * motion.turnP3x;
        const shipWorldX = motion.turnStartX + bx;
        motion.scrollX = clamp(shipWorldX - vw * SHIP_FRAC, 0, dimsRef.current.maxScrollX);
      } else if (!motion.introRunning) {
        motion.scrollX += (motion.targetX - motion.scrollX) * 0.085;
      }
      const { scrollX } = motionRef.current;
      if (trackRef.current) {
        trackRef.current.style.width = `${trackW}px`;
        trackRef.current.style.transform = `translate3d(${-scrollX}px, 0, 0)`;
      }

      const leadX = scrollX + vw * SHIP_FRAC;
      const maxDist = vw * CARD_RANGE_FRAC;
      const stationX = stationDockX(dimsRef.current.trackW, vw);
      let loc = "";
      let activeIndex = 0;
      pointsRef.current.objPts.forEach((pt, i) => {
        if (pt.x <= leadX + 60) activeIndex = i;
      });
      cardRefs.current.forEach((card, i) => {
        const pt = pointsRef.current.objPts[i];
        if (!card || !pt) return;
        if (!cardLayoutsRef.current[i]) {
          card.style.opacity = "0";
          card.style.pointerEvents = "none";
          return;
        }
        const baseOp = Math.max(0, 1 - Math.abs(pt.x - leadX) / maxDist);
        const op = i === activeIndex ? Math.max(baseOp, 0.92) : baseOp * 0.5;
        card.style.opacity = `${op}`;
        card.style.pointerEvents = op > 0.25 ? "auto" : "none";
        if (i === activeIndex) loc = ENTRIES[i].location;

        // Organic push: as the ship approaches, nudge the card away via transform
        // so it never overlaps the ship. JS lerp provides the smooth anticipation.
        const layout = cardLayoutsRef.current[i];
        const proximity = Math.max(0, 1 - Math.abs(pt.x - leadX) / (vw * 0.9));
        let targetPush = 0;
        if (layout && proximity > 0.01) {
          const actualH = card.offsetHeight;
          const currentShipY = pathY(leadX);
          const SHIP_H = 18;
          const PUSH_GAP = 12;
          const MAX_PUSH = 90;
          if (layout.above) {
            const overshoot = (layout.top + actualH + SHIP_H + PUSH_GAP) - currentShipY;
            if (overshoot > 0) targetPush = -Math.min(overshoot, MAX_PUSH);
          } else {
            const overshoot = currentShipY + SHIP_H + PUSH_GAP - layout.top;
            if (overshoot > 0) targetPush = Math.min(overshoot, MAX_PUSH);
          }
        }
        pushSmoothedRef.current[i] = (pushSmoothedRef.current[i] ?? 0)
          + (targetPush - (pushSmoothedRef.current[i] ?? 0)) * 0.18;
        const push = pushSmoothedRef.current[i];
        card.style.transform = `translate3d(0, ${(1 - op) * 10 + push}px, 0)`;
      });
      if (leadX >= stationX - Math.max(36, vw * 0.08)) loc = "Temporary Wait Station";
      setLocation(loc);
      setHintHidden(scrollX > 80);
      drawTimeline(t);
      frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);

    return () => {
      window.clearTimeout(introTimer);
      window.clearTimeout(resizeRef.current);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKey);
    };
  }, [drawTimeline, hsla, rebuild, runAutoIntro]);

  // Keep cardLayoutsRef in sync so the animation loop always reads fresh layouts
  useEffect(() => {
    cardLayoutsRef.current = cardLayouts;
  }, [cardLayouts]);

  // Static correction: after cards render, use real offsetHeight to fix any
  // overlap introduced by the estimatedH approximation in rebuild().
  useEffect(() => {
    if (cardLayouts.length === 0) return;
    const { vh } = dimsRef.current;
    const MIN_GAP = 18;
    const adjusted = cardLayouts.map((layout, i) => {
      const el = cardRefs.current[i];
      if (!el) return layout;
      const actualH = el.offsetHeight;
      const pt = pointsRef.current.objPts[i];
      if (!pt) return layout;
      const shipPathY = pathY(pt.x);
      let newTop = layout.top;
      if (layout.above) {
        const maxBottom = shipPathY - MIN_GAP;
        if (newTop + actualH > maxBottom) newTop = maxBottom - actualH;
      } else {
        if (newTop < shipPathY + MIN_GAP) newTop = shipPathY + MIN_GAP;
      }
      newTop = clamp(newTop, 82, vh - actualH - 54);
      return Math.abs(newTop - layout.top) < 1 ? layout : { ...layout, top: newTop };
    });
    if (adjusted.some((a, i) => a !== cardLayouts[i])) setCardLayouts(adjusted);
  }, [cardLayouts, pathY]);

  return (
    <main className="about-page" aria-label="About Valérian Teissier flight log">
      <canvas ref={starCanvasRef} className="about-starfield" aria-hidden="true" />
      <nav className="about-nav" aria-label="Primary navigation">
        <a href="/" className="about-nav-logo">VT—</a>
        <div className="about-nav-links">
          <a href="/essays.html" className="about-nav-link">Essays</a>
          <a href="/books.html" className="about-nav-link">Books</a>
          <a href="/about/" className="about-nav-link active" aria-current="page">About</a>
        </div>
      </nav>

      <section className="about-stage" aria-label="Interactive flight timeline">
        <div ref={trackRef} className="about-track">
          <canvas ref={lineCanvasRef} className="about-line-canvas" aria-hidden="true" />
          <div className="about-intro-card">
            <div className="about-intro-eyebrow">Flight log</div>
            <h1 className="about-intro-name">How I<br />got here</h1>
            <p className="about-intro-sub">2015 → 2026<br />16 locations.</p>
          </div>
          {ENTRIES.map((entry, i) => {
            const layout = cardLayouts[i];
            return (
              <article
                key={`${entry.date}-${entry.location}`}
                ref={(node) => { cardRefs.current[i] = node; }}
                className="about-node-card"
                style={layout ? { left: layout.x - layout.width / 2, top: layout.top, width: layout.width } : undefined}
              >
                <div className="about-node-location">{entry.location}</div>
                <div className="about-node-date">{entry.date}</div>
                <h2 className="about-node-doing">{entry.doing}</h2>
                <p className="about-node-insight">{entry.insight}</p>
              </article>
            );
          })}
          {landingLayout && (
            <article
              className="about-landing-card"
              style={{ left: landingLayout.x - landingLayout.width / 2, top: landingLayout.top, width: landingLayout.width }}
            >
              <div className="about-node-location">Temporary Wait Station</div>
              <div className="about-node-date">Now</div>
              <h2 className="about-node-doing">Docked, not done.</h2>
              <p className="about-node-insight">A quiet orbit for the next build: skills, agents, adoption systems, and whatever the route reveals next.</p>
            </article>
          )}
        </div>
      </section>

      <div className="about-progress" aria-hidden="true"><div className="about-progress-fill" style={{ width: `${progress * 100}%` }} /></div>
      <div className="about-location-readout" aria-live="polite">{location}</div>
      <div className={`about-scroll-hint ${hintHidden ? "hidden" : ""}`}>Scroll or swipe</div>
    </main>
  );
};

export default About;
