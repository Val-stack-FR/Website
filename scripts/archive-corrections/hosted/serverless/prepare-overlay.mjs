import { readFileSync, readdirSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { PRIVATE_ROOT } from '../../runtime.mjs';
import { canonical, ensure, ApiError } from '../../contract.mjs';

const source = fileURLToPath(new URL('./api/', import.meta.url));
export function prepareOverlay() {
  const target = resolve(PRIVATE_ROOT, `d5-overlay-${randomUUID()}`);
  ensure(target.startsWith(resolve(PRIVATE_ROOT) + sep) && !existsSync(target), 409, 'overlay_exists', 'Use a new private integration overlay.');
  const paths = [];
  const visit = (directory, parts = []) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      ensure(!entry.isSymbolicLink(), 422, 'invalid_overlay_source', 'Overlay source must be regular files.');
      if (entry.isDirectory()) visit(join(directory, entry.name), [...parts, entry.name]);
      else {
        const rel = ['api', ...parts, entry.name].join('/');
        const output = join(target, rel); mkdirSync(dirname(output), { recursive: true });
        const rootPrefix = '../'.repeat(parts.length + 1);
        writeFileSync(output, `export { default } from '${rootPrefix}scripts/archive-corrections/hosted/serverless/function.mjs';\n`, { flag: 'wx' });
        paths.push(rel);
      }
    }
  };
  visit(source);
  const proposal = readFileSync(new URL('./vercel.proposal.json', import.meta.url));
  writeFileSync(join(target, 'vercel.merge-proposal.json'), proposal, { flag: 'wx' });
  writeFileSync(join(target, 'manifest.json'), canonical({ version: 'd5-integration-overlay/v1', function_files: paths.sort(),
    source: 'scripts/archive-corrections/hosted/serverless', original_site_modified: false, deployed: false, secrets_included: false }) + '\n', { flag: 'wx' });
  return { directory: relative(PRIVATE_ROOT, target), functions: paths.length, deployed: false };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { process.stdout.write(canonical(prepareOverlay()) + '\n'); }
  catch (error) { process.stderr.write((error instanceof ApiError ? error.message : 'Private overlay preparation failed.') + '\n'); process.exitCode = 1; }
}
