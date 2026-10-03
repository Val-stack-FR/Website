'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = readFileSync(path.join(root, 'scripts', 'build-site.js'), 'utf8');
const cli = path.join(root, '.private', 'npm runtime', 'npm-cli.js');

function build({ env = {}, outside = null, missingCli = false } = {}) {
  const spawned = [];
  const removed = [];
  const fs = {
    existsSync: target => target === cli ? !missingCli : Boolean(outside && target === outside),
    realpathSync: target => target === outside ? path.resolve(root, '..', 'external') : path.resolve(target),
    rmSync: target => removed.push(target),
    mkdirSync: () => {},
    cpSync: () => {},
  };
  const context = {
    __dirname: path.join(root, 'scripts'),
    process: { env, platform: 'win32', execPath: process.execPath, exit: code => { throw new Error(`exit ${code}`); } },
    console: { log: () => {} },
    require: name => name === 'fs' ? fs : name === 'child_process' ? {
      spawnSync: (executable, args, options) => { spawned.push({ executable, args: [...args], options }); return { status: 0 }; },
    } : require(name),
  };
  vm.runInNewContext(source, context, { filename: 'build-site.js' });
  return { spawned, removed };
}

test('configured npm CLI uses the current Node without a shell and preserves ci/build', () => {
  const { spawned } = build({ env: { NPM_CLI_JS: cli } });
  assert.equal(spawned[0].executable, process.execPath);
  assert.equal(spawned[0].options.env.SITE_ROOT, path.join(root, 'dist'));
  assert.deepEqual(spawned.slice(1).map(call => call.args), [
    [cli, 'ci'],
    [cli, 'run', 'build', '--', '--outDir', '../dist/about'],
  ]);
  for (const call of spawned.slice(1)) {
    assert.equal(call.executable, process.execPath);
    assert.equal(call.options.shell, false);
    assert.equal(call.options.cwd, path.join(root, 'Spaceship'));
  }
});

test('unconfigured Windows retains the npm.cmd fallback', () => {
  const { spawned } = build();
  assert.equal(spawned[0].executable, process.execPath);
  assert.equal(spawned[1].executable, 'npm.cmd');
  assert.equal(spawned[1].options.shell, true);
  assert.deepEqual(spawned[1].args, ['ci']);
});

test('an invalid explicit npm CLI fails before cleanup or child processes', () => {
  assert.throws(() => build({ env: { NPM_CLI_JS: cli }, missingCli: true }), /existing npm CLI/);
});

test('dist and npm ci trees resolving outside the checkout are refused before cleanup', () => {
  for (const outside of [path.join(root, 'dist'), path.join(root, 'Spaceship'), path.join(root, 'Spaceship', 'node_modules')]) {
    assert.throws(() => build({ outside }), /outside checkout/);
  }
});
