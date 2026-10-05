import test from 'node:test';
import assert from 'node:assert/strict';
import { permittedAtelierRoute, addAtelierNavigation } from '../../scripts/archives-integration/atelier-preview.mjs';
import { queryLexicalSearch, renderLexicalSearch } from '../../scripts/archives-integration/lexical-search.mjs';

const index = { rows: [{ candidate_id: 'mentioncandidate:' + '1'.repeat(64), candidate_kind: 'person_name_candidate', literal: 'Nom fictif de Tucé', citation: '<script>fictif</script>\r\n', source: { object_id: 'object:path-' + '2'.repeat(64), logical_path: 'CLEAN/fixture.txt', source_sha256: '3'.repeat(64) }, span: { start: 1, end: 5 } }] };
test('only derivative routes enter the atelier media proxy', () => {
  assert.equal(permittedAtelierRoute(new URL('http://127.0.0.1/__archive_media/' + 'a'.repeat(64))), false);
  assert.equal(permittedAtelierRoute(new URL('http://127.0.0.1/__archive_draft_media/' + 'a'.repeat(64))), false);
  assert.equal(permittedAtelierRoute(new URL('http://127.0.0.1/__archive_draft_derivative/' + 'a'.repeat(64))), true);
  assert.equal(permittedAtelierRoute(new URL('http://127.0.0.1/.private/secret')), false);
});
test('accent normalization changes matching only, exact/expanded stay distinct', () => {
  assert.equal(queryLexicalSearch(index, new URLSearchParams('q=tuce')).total, 1);
  assert.equal(queryLexicalSearch(index, new URLSearchParams('q=tuce&match=exact')).total, 0);
  assert.equal(index.rows[0].literal, 'Nom fictif de Tucé');
});
test('unknown, duplicate, oversized and out-of-range query parameters fail', () => {
  for (const value of ['q=a&q=b', 'entity=x', 'page=2', 'kind=person', 'q=' + 'a'.repeat(101)]) assert.throws(() => queryLexicalSearch(index, new URLSearchParams(value)));
});
test('source strings are escaped and CR is retained in HTML', () => {
  const html = renderLexicalSearch(index, new URLSearchParams('q=%22%3E%3Cscript%3E'));
  assert.ok(!html.includes('<script>'));
  const all = renderLexicalSearch(index, new URLSearchParams());
  assert.ok(all.includes('&lt;script&gt;fictif&lt;/script&gt;&#13;\n'));
});
test('navigation enables corrections only with a mounted adapter', () => {
  const html = '<html><head></head><body><main>Fixture</main></body></html>';
  assert.equal(addAtelierNavigation(html).includes('Proposer une correction'), false);
  assert.equal(addAtelierNavigation(html, { corrections: true }).includes('Proposer une correction'), true);
  assert.throws(() => addAtelierNavigation('<p>No shell</p>'));
});
