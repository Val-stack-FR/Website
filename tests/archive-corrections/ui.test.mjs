import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { request } from 'node:http';
import { startLocalService, loopbackOrigin } from '../../scripts/archive-corrections/server.mjs';
import { PASSAGE, INITIAL_REVISION } from '../../scripts/archive-corrections/fixture.mjs';
import { createReplayKeys, draftAfterRefresh } from '../../scripts/archive-corrections/ui/state.mjs';
import { proposalCard, revisionCard, decisionCard } from '../../scripts/archive-corrections/ui/render.mjs';

const maliciousText = '<img src=x onerror="alert(1)"><script>alert(2)</script> & texte inventé';

test('W03 HTTP: explicit assets, strict same origin, inert visitor text and server owner permission', async t => {
  const secret = randomBytes(32).toString('hex');
  const service = await startLocalService({ name: `ui-test-${randomUUID()}`, port: 0, ownerSecret: secret });
  t.after(async () => {
    await new Promise(resolve => { service.server.close(resolve); service.server.closeIdleConnections(); });
    service.store.close();
  });
  const origin = new URL(service.url).origin;
  const call = async (path, options = {}) => {
    const response = await fetch(`${service.url}${path}`, options);
    const text = await response.text();
    return { status: response.status, headers: response.headers, text };
  };
  const mutation = (path, payload, key, token, suppliedOrigin = origin) => call(path, {
    method: 'POST', headers: {
      'Content-Type': 'application/json', 'Idempotency-Key': key, Origin: suppliedOrigin,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }, body: JSON.stringify(payload),
  });

  await t.test('only /demo/ and four named assets are served with external-only CSP', async () => {
    const assets = [['/demo/', 'text/html'], ['/demo/styles.css', 'text/css'],
      ['/demo/app.mjs', 'text/javascript'], ['/demo/state.mjs', 'text/javascript'], ['/demo/render.mjs', 'text/javascript']];
    for (const [path, mime] of assets) {
      const response = await call(path);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type').startsWith(mime), true);
      const csp = response.headers.get('content-security-policy');
      assert.match(csp, /default-src 'none'/);
      assert.match(csp, /script-src 'self'/);
      assert.match(csp, /style-src 'self'/);
      assert.match(csp, /connect-src 'self'/);
      assert.match(csp, /frame-ancestors 'none'/);
      assert.equal(/unsafe-inline|unsafe-eval/.test(csp), false);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(response.text.includes(secret), false);
    }
    for (const path of ['/demo', '/demo/index.html', '/demo/README.md', '/demo/missing.js', '/demo/app.mjs?secret=x', '/server.mjs', '/demo/%2e%2e/store.mjs', '/.archive-corrections-private/export.json']) {
      assert.equal((await call(path)).status, 404, path);
    }
    const html = (await call('/demo/')).text;
    assert.match(html, /aucune lecture historique/i);
    assert.match(html, /owner_test/);
    assert.equal(/\sstyle=|\son\w+=|<style\b/i.test(html), false);
    assert.equal((html.match(/<script\b/g) ?? []).length, 1);
    assert.match(html, /<script type="module" src="\/demo\/app\.mjs"><\/script>/);
    const passwordTag = html.match(/<input[^>]*id="owner-secret"[^>]*>/)?.[0];
    assert.match(passwordTag, /type="password"/);
    assert.match(passwordTag, /autocomplete="off"/);
    assert.equal(/\svalue=|\sname=/.test(passwordTag), false);
    const app = (await call('/demo/app.mjs')).text;
    assert.equal(/innerHTML|outerHTML|insertAdjacentHTML|localStorage|sessionStorage|document\.cookie|console\./.test(app), false);
  });

  let proposal;
  let decision;
  await t.test('browser same-origin proposals succeed; foreign/null/near-match origins and wrong Host fail', async () => {
    const payload = {
      passage_id: PASSAGE.passage_id, base_revision: INITIAL_REVISION.text_revision,
      replacement_text: maliciousText, reason: '</textarea><script>motif inventé</script>',
      evidence_refs: PASSAGE.evidence_refs, simulation: true,
    };
    for (const deniedOrigin of ['null', 'http://localhost:' + new URL(origin).port, origin + '/', origin + '.example', 'https://127.0.0.1:' + new URL(origin).port, 'https://untrusted.example']) {
      const response = await mutation('/v1/proposals', payload, 'ui-proposal-origin', undefined, deniedOrigin);
      assert.equal(response.status, 403, deniedOrigin);
      assert.equal(JSON.parse(response.text).error.code, 'local_clients_only');
    }
    const wrongHostStatus = await new Promise((resolve, reject) => {
      const req = request(`${service.url}/demo/`, { headers: { Host: 'untrusted.example', Origin: origin } }, response => {
        response.resume();
        response.once('end', () => resolve(response.statusCode));
      });
      req.once('error', reject);
      req.end();
    });
    assert.equal(wrongHostStatus, 403);
    const response = await mutation('/v1/proposals', payload, 'ui-proposal-origin');
    assert.equal(response.status, 201);
    proposal = JSON.parse(response.text).proposal;
    assert.equal(proposal.replacement_text, maliciousText);
    assert.equal(proposal.actor_role, 'anonymous');
    const replay = await mutation('/v1/proposals', payload, 'ui-proposal-origin');
    assert.equal(replay.status, 200);
    assert.equal(JSON.parse(replay.text).proposal.proposal_id, proposal.proposal_id);
    const history = JSON.parse((await call(`/v1/passages/${PASSAGE.passage_id}`)).text);
    assert.equal(history.proposals.length, 1);
    assert.equal(history.current_revision.text, INITIAL_REVISION.text);
    assert.equal((await call('/demo/')).text.includes(maliciousText), false, 'Visitor text must not be interpolated into static HTML.');
  });

  await t.test('same-origin owner action still requires the server secret and renders visitor content only as text', async () => {
    const payload = {
      proposal_id: proposal.proposal_id, base_revision: proposal.base_revision, outcome: 'accept',
      reason: '<b>Décision fictive</b>', evidence_refs: PASSAGE.evidence_refs, simulation: true,
    };
    assert.equal((await mutation('/v1/decisions', payload, 'ui-decision-owner')).status, 403);
    assert.equal((await mutation('/v1/decisions', { ...payload, actor_role: 'owner' }, 'ui-decision-spoof')).status, 403);
    assert.equal((await mutation('/v1/decisions', payload, 'ui-decision-owner', secret, 'https://untrusted.example')).status, 403);
    const accepted = await mutation('/v1/decisions', payload, 'ui-decision-owner', secret);
    assert.equal(accepted.status, 201);
    decision = JSON.parse(accepted.text).decision;
    assert.equal(decision.actor_role, 'owner_test');
    const history = JSON.parse((await call(`/v1/passages/${PASSAGE.passage_id}`, { headers: { Origin: origin } })).text);
    assert.equal(history.current_revision.text, maliciousText);
    assert.equal(history.revisions[0].text, INITIAL_REVISION.text);
    assert.equal(JSON.stringify(history).includes(secret), false);
    const tags = [];
    const textValues = [];
    const document = {
      createElement(tag) {
        tags.push(tag);
        return {
          append() {},
          set textContent(value) { textValues.push(value); },
          set innerHTML(_value) { throw new Error('Unsafe HTML rendering.'); },
        };
      },
    };
    proposalCard(document, history, proposal);
    revisionCard(document, history.current_revision);
    decisionCard(document, decision);
    assert.equal(tags.includes('script') || tags.includes('img') || tags.includes('b'), false);
    assert.equal(textValues.filter(value => value === maliciousText).length, 2);
    assert.equal(textValues.includes(proposal.reason), true);
    assert.equal(textValues.includes(decision.reason), true);
  });
});

test('W03 draft and replay state: refresh preserves base/text/reason; uncertain retry keeps key; edits allocate a new key', () => {
  let sequence = 0;
  const keys = createReplayKeys(() => `generated-${++sequence}`);
  const initial = { passage: PASSAGE, current_revision: INITIAL_REVISION };
  const draft = draftAfterRefresh(undefined, initial);
  draft.replacement_text = 'Variante fictive en cours de saisie.';
  draft.reason = 'Motif fictif conservé.';
  const original = structuredClone(draft);
  const first = keys.prepare('proposal', draft);
  const reordered = Object.fromEntries(Object.entries(draft).reverse());
  assert.deepEqual(keys.prepare('proposal', reordered), first, 'Retry after uncertain network response keeps exactly the original key/body.');
  const refreshed = { ...initial, current_revision: { ...INITIAL_REVISION, text_revision: `${PASSAGE.passage_id}:r2`, text: 'Nouvelle version fictive distante.' } };
  assert.equal(draftAfterRefresh(draft, refreshed), draft);
  assert.deepEqual(draft, original, 'Refreshing cannot accept, overwrite or rebase the draft.');
  assert.deepEqual(keys.prepare('proposal', draft), first);
  keys.changed('proposal');
  const edited = keys.prepare('proposal', { ...draft, reason: 'Nouveau motif fictif.' });
  assert.notEqual(edited.key, first.key);
  assert.equal(keys.prepare('proposal', { ...draft, reason: 'Nouveau motif fictif.' }).key, edited.key);
  keys.changed('proposal');
  assert.notEqual(keys.prepare('proposal', original).key, first.key, 'Editing and returning to original text still allocates a new key.');
  const decision = keys.prepare('decision', { proposal_id: 'test-reference', outcome: 'accept' });
  assert.notEqual(keys.prepare('decision', { proposal_id: 'test-reference', outcome: 'reject' }).key, decision.key);
  keys.clear();
  assert.notEqual(keys.prepare('proposal', original).key, first.key);
});

test('loopback browser origin uses URL normalization for default HTTP port without binding it', () => {
  assert.equal(loopbackOrigin(80), 'http://127.0.0.1');
  assert.equal(loopbackOrigin(8787), 'http://127.0.0.1:8787');
});
