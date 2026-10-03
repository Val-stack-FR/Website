'use strict';

// Builds a deliberately small deployable tree. Repository instructions,
// workflows, synchronisation scripts and development configuration never enter
// `dist/`.
const { cpSync, existsSync, mkdirSync, realpathSync, rmSync } = require('fs');
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const checkout = realpathSync(root);
// Both dist cleanup and npm ci may remove trees. Refuse a junction/symlink
// pointing outside this checkout before either operation starts.
for (const directory of [dist, path.join(root, 'Spaceship'), path.join(root, 'Spaceship', 'node_modules')]) {
  if (!existsSync(directory)) continue;
  const relative = path.relative(checkout, realpathSync(directory));
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Build directory outside checkout: ${directory}`);
  }
}
const npmCli = process.env.NPM_CLI_JS ? path.resolve(process.env.NPM_CLI_JS) : null;
if (npmCli && !existsSync(npmCli)) throw new Error('NPM_CLI_JS does not point to an existing npm CLI');
const run = (command, args, cwd, env = process.env) => {
  const useNpmCli = command === 'npm' && npmCli;
  const executable = useNpmCli ? process.execPath : process.platform === 'win32' && command === 'npm' ? 'npm.cmd' : command;
  const result = spawnSync(executable, useNpmCli ? [npmCli, ...args] : args, {
    cwd, env, stdio: 'inherit', shell: !useNpmCli && process.platform === 'win32' && command === 'npm'
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
};

if (existsSync(dist)) rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

for (const name of ['css', 'js', 'essays', 'books', 'research']) {
  cpSync(path.join(root, name), path.join(dist, name), {
    recursive: true,
    filter: source => {
      const relative = path.relative(root, source).split(path.sep).join('/');
      return relative !== 'css/library.css' && relative !== 'js/library.js';
    },
  });
}
for (const name of [
  'index.html', 'essays.html', 'essay-detail.html', 'books.html',
  'book-review.html', 'research.html', 'styles.css',
  'favicon.svg', 'robots.txt'
]) {
  cpSync(path.join(root, name), path.join(dist, name));
}

run(process.execPath, [path.join(__dirname, 'prerender.js')], root, { ...process.env, SITE_ROOT: dist });
run('npm', ['ci'], path.join(root, 'Spaceship'));
run('npm', ['run', 'build', '--', '--outDir', '../dist/about'], path.join(root, 'Spaceship'));

console.log('✓ dist/ built from deployable public assets only');

