import { writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Store } from './store.mjs';
import { SYNTHETIC_CONTEXT } from './fixture.mjs';
import { loadReaderContext, READER_PACKAGE_ENV } from './reader-binding.mjs';
import { canonical, ensure, ApiError } from './contract.mjs';

const fields = ['passage_id', 'transcription_id', 'source_object_id', 'text_revision', 'based_on_revision', 'text_json', 'reading_status', 'simulation'];
// JSON encoding preserves exact text while making spreadsheet cells start with a quote, not a formula.
const csv = value => `"${String(value ?? '').replaceAll('"', '""')}"`;

export function exportPortable(name, context = SYNTHETIC_CONTEXT) {
  const store = new Store(name, { readOnly: true, context });
  try {
    const history = store.history();
    const rows = history.revisions.map(revision => ({
      passage_id: history.passage.passage_id, transcription_id: history.passage.transcription_id ?? null,
      source_object_id: history.passage.source_object_id ?? null, text_revision: revision.text_revision,
      based_on_revision: revision.based_on_revision, text: revision.text,
      reading_status: history.passage.reading_status ?? 'synthetic', simulation: true,
    }));
    const jsonl = `${rows.map(canonical).join('\n')}\n`;
    const csvText = `${[fields.map(csv).join(','), ...rows.map(row => fields.map(field => csv(field === 'text_json' ? JSON.stringify(row.text) : row[field])).join(','))].join('\r\n')}\r\n`;
    const jsonlPath = join(store.paths.directory, 'revisions.jsonl');
    const csvPath = join(store.paths.directory, 'revisions.csv');
    ensure(!existsSync(jsonlPath) && !existsSync(csvPath), 409, 'export_exists', 'Portable exports are never overwritten.');
    writeFileSync(jsonlPath, jsonl, { flag: 'wx', mode: 0o600, flush: true });
    writeFileSync(csvPath, csvText, { flag: 'wx', mode: 0o600, flush: true });
    return { revisions: rows.length, simulation: true, publication_status: 'not-published', formats: ['jsonl', 'csv'] };
  } finally { store.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [mode, name, ...extra] = process.argv.slice(2);
    ensure(['synthetic', 'reader-local'].includes(mode) && name && extra.length === 0,
      422, 'usage', 'Usage: node portable.mjs synthetic|reader-local STORE');
    const context = mode === 'reader-local' ? loadReaderContext(process.env[READER_PACKAGE_ENV]) : SYNTHETIC_CONTEXT;
    process.stdout.write(`${canonical(exportPortable(name, context))}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof ApiError ? error.message : 'Private portable export failed.'}\n`);
    process.exitCode = 1;
  }
}
