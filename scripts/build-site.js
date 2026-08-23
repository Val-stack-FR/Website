'use strict';

// Builds a deliberately small deployable tree. Repository instructions,
// workflows, synchronisation scripts and development configuration never enter
// `dist/`.
const { cpSync, existsSync, mkdirSync, rmSync } = require('fs');
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const run = (command, args, cwd, env = process.env) => {
  const executable = process.platform === 'win32' && command === 'npm' ? 'npm.cmd' : command;
  const result = spawnSync(executable, args, {
    cwd, env, stdio: 'inherit', shell: process.platform === 'win32' && command === 'npm'
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
};

if (existsSync(dist)) rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

for (const name of ['css', 'js', 'essays', 'books', 'research']) {
  cpSync(path.join(root, name), path.join(dist, name), { recursive: true });
}
for (const name of [
  'index.html', 'essays.html', 'essay-detail.html', 'books.html',
  'book-review.html', 'research.html', 'styles.css',
  'favicon.svg', 'robots.txt'
]) {
  cpSync(path.join(root, name), path.join(dist, name));
}

run('node', [path.join(__dirname, 'prerender.js')], root, { ...process.env, SITE_ROOT: dist });
run('npm', ['ci'], path.join(root, 'Spaceship'));
run('npm', ['run', 'build', '--', '--outDir', '../dist/about'], path.join(root, 'Spaceship'));

console.log('✓ dist/ built from deployable public assets only');

