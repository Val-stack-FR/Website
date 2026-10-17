'use strict';

// Static checks for essay figures (see docs/figures.md). No dependency.
// Usage: node scripts/check-figures.js   (exit 1 on any error)
const { existsSync, readdirSync, readFileSync, statSync } = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const figuresDir = path.join(root, 'essays', 'figures');
const MAX_SVG = 30 * 1024;
const MAX_RASTER = 300 * 1024;
const RASTER = /\.(png|jpe?g|webp)$/i;

const errors = [];
const warnings = [];
const fail = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}
const rel = file => path.relative(root, file).split(path.sep).join('/');

// ── Asset files ────────────────────────────────────────────────────────────
const assets = walk(figuresDir).filter(f => !f.endsWith('.gitkeep'));
for (const file of assets) {
  const where = rel(file);
  const size = statSync(file).size;
  if (/\.svg$/i.test(file)) {
    const svg = readFileSync(file, 'utf8');
    if (size > MAX_SVG) fail(where, `SVG weighs ${size} bytes (max ${MAX_SVG})`);
    if (/<style[\s>]/i.test(svg)) fail(where, 'contains <style> (use presentation attributes)');
    if (/\sstyle\s*=/i.test(svg)) fail(where, 'contains a style= attribute');
    if (/<script[\s>]/i.test(svg)) fail(where, 'contains <script>');
    if (/\son[a-z]+\s*=/i.test(svg)) fail(where, 'contains an event handler attribute');
    if (/<foreignObject|<image[\s>]|@import|url\(\s*['"]?https?:/i.test(svg)) fail(where, 'embeds or imports an external or foreign resource');
    if (/(?:xlink:)?href\s*=\s*["'](?!#)/i.test(svg)) fail(where, 'contains a non-fragment href');
    if (!/viewBox="/.test(svg)) fail(where, 'missing viewBox');
    if (!/role="img"/.test(svg) || !/<title[\s>]/.test(svg) || !/<desc[\s>]/.test(svg)) fail(where, 'needs role="img", <title> and <desc>');
  } else if (RASTER.test(file)) {
    if (size > MAX_RASTER) fail(where, `raster weighs ${size} bytes (max ${MAX_RASTER})`);
    else if (size > MAX_RASTER * 0.66) warn(where, `raster weighs ${size} bytes`);
  } else {
    fail(where, 'unsupported file type in essays/figures/');
  }
  const pair = file.match(/^(.*)\.(fr|en)(\.[a-z0-9]+)$/i);
  if (pair) {
    const other = `${pair[1]}.${pair[2].toLowerCase() === 'fr' ? 'en' : 'fr'}${pair[3]}`;
    if (!existsSync(other)) fail(where, `missing ${pair[2].toLowerCase() === 'fr' ? 'EN' : 'FR'} counterpart ${rel(other)}`);
  }
}

// ── Figures in essay Markdown ─────────────────────────────────────────────
const referenced = new Set();
const figureCount = {};
const mdFiles = walk(path.join(root, 'essays')).filter(f => f.endsWith('.md'));
for (const file of mdFiles) {
  const text = readFileSync(file, 'utf8');
  const blocks = text.split(/\n\n+/).filter(b => /<(figure|img)[\s>]/.test(b));
  const rawFigures = text.match(/<figure[\s>]/g) || [];
  const slug = path.basename(file, '.md');
  const lang = file.includes(`${path.sep}fr${path.sep}`) ? 'fr' : 'en';
  figureCount[slug] = figureCount[slug] || {};
  figureCount[slug][lang] = rawFigures.length;

  for (const block of blocks) {
    const where = rel(file);
    const isFigure = /^<figure[\s>]/.test(block.trim());
    if (!isFigure) { fail(where, 'an <img> must sit inside a <figure> block that starts a paragraph'); continue; }
    if (/\n\s*\n/.test(block)) fail(where, 'blank line inside a figure block');
    if (/\sstyle\s*=|<style[\s>]|<script[\s>]|\son[a-z]+\s*=/i.test(block)) fail(where, 'inline style, script or handler in a figure');
    if (!/<figcaption[\s>]/.test(block)) fail(where, 'figure without <figcaption>');
    if (/<table[\s>]/.test(block)) continue;
    for (const tag of block.match(/<img\b[^>]*>/g) || []) {
      const attr = name => (tag.match(new RegExp(`\\s${name}="([^"]*)"`)) || [])[1];
      const label = `${where} (${(attr('src') || '?').split('/').pop()})`;
      const alt = attr('alt');
      if (alt === undefined) fail(label, 'missing alt');
      else if (alt.trim().length < 20) fail(label, 'alt too short to describe the figure (use alt="" only for decorative images, outside figures)');
      if (!/^\d+$/.test(attr('width') || '') || !/^\d+$/.test(attr('height') || '')) fail(label, 'missing numeric width/height');
      if (attr('loading') !== 'lazy') fail(label, 'missing loading="lazy"');
      const files = [attr('src')];
      for (const candidate of (attr('srcset') || '').split(',')) if (candidate.trim()) files.push(candidate.trim().split(/\s+/)[0]);
      for (const src of files) {
        if (!src) { fail(label, 'missing src'); continue; }
        if (!src.startsWith('/essays/figures/')) { fail(label, `src must start with /essays/figures/ (got ${src})`); continue; }
        const target = path.join(root, src);
        referenced.add(target);
        if (!existsSync(target)) fail(label, `file not found: ${src}`);
      }
      if (attr('srcset') && !attr('sizes')) fail(label, 'srcset without sizes');
      if (lang === 'fr' && /\.en\.[a-z0-9]+$/i.test(attr('src') || '')) fail(label, 'French essay points to an EN image');
      if (lang === 'en' && /\.fr\.[a-z0-9]+$/i.test(attr('src') || '')) fail(label, 'English essay points to an FR image');
    }
  }
}
for (const [slug, counts] of Object.entries(figureCount)) {
  if (counts.fr !== undefined && counts.en !== undefined && counts.fr !== counts.en) {
    fail(`essays/${slug}`, `${counts.en} figure(s) in EN but ${counts.fr} in FR`);
  }
}
for (const file of assets) {
  if (!referenced.has(file)) warn(rel(file), 'not referenced by any essay yet');
}

for (const w of warnings) console.warn(`warn  ${w}`);
for (const e of errors) console.error(`error ${e}`);
console.log(`check-figures: ${assets.length} asset(s), ${mdFiles.length} essay file(s), ${errors.length} error(s), ${warnings.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
