import { copyFileSync, existsSync, mkdirSync, realpathSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '../..'));
const inside = target => { const part = relative(root, target); return part && !isAbsolute(part) && part !== '..' && !part.startsWith('..' + (process.platform === 'win32' ? '\\' : '/')); };
export function buildPublicArchiveOverview() {
  const dist = resolve(root, 'dist');
  if (!existsSync(dist) || !inside(realpathSync(dist))) throw new Error('A real dist directory inside this checkout is required.');
  const archives = resolve(dist, 'archives');
  if (existsSync(archives) && !inside(realpathSync(archives))) throw new Error('Archives output resolves outside this checkout.');
  mkdirSync(archives, { recursive: true });
  const index = resolve(archives, 'index.html');
  if (existsSync(index) && realpathSync(index) !== index) throw new Error('Archives HTML must not be a symlink.');
  // This literal template is the whole public archive allowlist. Private outputs,
  // corpus data, media and the legacy invented reader are never copied.
  copyFileSync(resolve(root, 'scripts/archives/public-overview.html'), index);
  const sitemapPath = resolve(dist, 'sitemap.xml');
  if (existsSync(sitemapPath)) {
    if (realpathSync(sitemapPath) !== sitemapPath) throw new Error('Sitemap must not be a symlink.');
    const sitemap = readFileSync(sitemapPath, 'utf8');
    const canonical = 'https://valerianteissier.com/archives/';
    if (!sitemap.includes(`<loc>${canonical}</loc>`)) {
      if (!sitemap.includes('</urlset>')) throw new Error('Invalid public sitemap.');
      writeFileSync(sitemapPath, sitemap.replace('</urlset>', `  <url><loc>${canonical}</loc></url>\n</urlset>`));
    }
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) buildPublicArchiveOverview();
