import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { adaptCoverage } from '../archives-catalogue/adapt-coverage.mjs';
import { readerAllowlist } from '../archives-catalogue/reader-allowlist.mjs';
import { adaptArchiveExport, assertPrivateIgnoredOutput, renderReaderHtml, buildMediaManifest } from './render-reader.mjs';
import { renderAnnexSearch } from './render-annex-search.mjs';
import { renderStatusboard } from './render-statusboard.mjs';
import { renderOccurrence } from './render-occurrence.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const load = path => JSON.parse(readFileSync(path, 'utf8'));

export async function prepareLocal({ coverageDirectory, readerPath, mediaManifestPath, sourceManifestPath, preflightPath, annexPath, occurrencePath, outputPath, generatedAt, correctionsOrigin = null, correctionTextIds = [] }) {
  const output = assertPrivateIgnoredOutput(outputPath);
  if (existsSync(output)) throw new Error('A new, private output directory is required.');
  const reader = load(readerPath);
  const sourceBytes = readFileSync(sourceManifestPath);
  const preflight = load(preflightPath);
  if (preflight.passed !== true || preflight.corpus_root_accessible !== true ||
      preflight.corpus_root_reference !== 'env:PHD_CORPUS_ROOT' || preflight.input_manifest_sha256 !== sha(sourceBytes)) throw new Error('Manifest-bound passed preflight required.');
  const media = load(mediaManifestPath);
  const allowlist = readerAllowlist(reader, media);
  const model = adaptArchiveExport(reader);
  mkdirSync(output, { recursive: true });
  const hashes = {};
  const write = (name, value) => {
    const bytes = Buffer.from(typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
    writeFileSync(join(output, name), bytes, { flag: 'wx' });
    hashes[name] = sha(bytes);
  };
  write('reader-allowlist.json', allowlist);
  const catalogue = await adaptCoverage({
    cataloguePath: join(coverageDirectory, 'catalogue.jsonl'), relationsPath: join(coverageDirectory, 'relations.jsonl'),
    summaryPath: join(coverageDirectory, 'summary.json'), inputManifestPath: join(coverageDirectory, 'input-manifest.json'),
    checksumsPath: join(coverageDirectory, 'checksums.json'), allowlistPath: join(output, 'reader-allowlist.json'),
    generatedAt, collectionScope: 'clean'
  });
  write('catalogue.json', catalogue);
  write('reader.html', renderReaderHtml(model, { privatePreview: true, correctionsOrigin, correctionTextIds }));
  write('reader-media-selection.json', buildMediaManifest(model));
  if (annexPath) { const annex = load(annexPath); write('search.html', renderAnnexSearch(annex)); write('status.html', renderStatusboard(reader, annex)); }
  if (occurrencePath) write('occurrence.html', renderOccurrence(load(occurrencePath)));
  write('integration-proof.json', {
    version: 'atelier-site-technology-local/1', generated_at: generatedAt, scope: 'private-local',
    corpus_originals_read: false, historical_confirmation: false, publication_approved: false,
    input_hashes: {
      reader: sha(readFileSync(readerPath)), media_allowlist: sha(readFileSync(mediaManifestPath)), source_manifest: sha(sourceBytes),
      preflight: sha(readFileSync(preflightPath)), coverage_checksums: sha(readFileSync(join(coverageDirectory, 'checksums.json'))),
      ...(annexPath ? { annex: sha(readFileSync(annexPath)) } : {}), ...(occurrencePath ? { occurrence: sha(readFileSync(occurrencePath)) } : {})
    }, output_hashes: { ...hashes },
    counts: { clean_images: catalogue.record_count, reader_links: allowlist.entries.length, dossiers: model.dossiers.length },
    limits: ['Image discovery projection only; nonimage CLEAN records excluded.', 'Sync/Random excluded before browser payload.', 'Rights/credits pending; no public activation.']
  });
  return { output, images: catalogue.record_count, readerLinks: allowlist.entries.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const { values } = parseArgs({ strict: true, allowPositionals: false, options: { ...Object.fromEntries(['coverage-directory', 'reader', 'media-manifest', 'source-manifest', 'preflight', 'annex', 'occurrence', 'output', 'generated-at', 'corrections-origin'].map(key => [key, { type: 'string' }])), 'correction-text-id': { type: 'string', multiple: true } } });
    for (const key of ['coverage-directory', 'reader', 'media-manifest', 'source-manifest', 'preflight', 'output', 'generated-at']) if (!values[key]) throw new Error(`Required: --${key}`);
    const result = await prepareLocal({ coverageDirectory: resolve(values['coverage-directory']), readerPath: resolve(values.reader), mediaManifestPath: resolve(values['media-manifest']), sourceManifestPath: resolve(values['source-manifest']), preflightPath: resolve(values.preflight), annexPath: values.annex && resolve(values.annex), occurrencePath: values.occurrence && resolve(values.occurrence), outputPath: resolve(values.output), generatedAt: values['generated-at'], correctionsOrigin: values['corrections-origin'] ?? null, correctionTextIds: values['correction-text-id'] ?? [] });
    console.log(`Prepared CLEAN: ${result.images} image occurrences; ${result.readerLinks} explicit reader links.`);
  } catch (error) { console.error(`Preparation refused: ${error.message}`); process.exitCode = 1; }
}
