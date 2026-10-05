import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, realpath, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { isAbsolute, relative, resolve, sep,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { prepareCatalogue, queryCatalogue } from '../archives-catalogue/contract.mjs';
import { parseDataRequest } from '../archives-catalogue/server.mjs';
import { renderCataloguePage } from '../archives-catalogue/render-page.mjs';
import { readerAllowlist } from '../archives-catalogue/reader-allowlist.mjs';
import { loadDraftMedia } from './draft-media.mjs';
import { buildCatalogueHierarchy, queryCatalogueHierarchy } from '../archives-catalogue/hierarchy.mjs';
import { loadDraftBridge } from './draft-bridge.mjs';
import { buildDraftReviewIndex, queryDraftReview, renderDraftReviewPage } from './draft-review.mjs';
import { loadPreexistingTextIndex, renderPreexistingTexts, renderPreexistingText } from './preexisting-texts.mjs';
import { loadReaderMediaRelease,readerMediaRoutes,readerMediaSelection,verifyReaderMediaHtml } from './reader-media-release.mjs';
import { guardRequest } from '../archives-integration/media-preview.mjs';
import { draftDerivativeSelection,draftDerivativeRoutes,verifyDraftDerivativeHtml } from './draft-derivative-bindings.mjs';
import { acceptedDraftMediaEvidence,revalidateDraftMediaComposition } from './draft-media-release.mjs';
import { acceptedAnnexEvidence,revalidateAnnexSearchShards,renderAcceptedAnnexSearch } from './annex-shards-release.mjs';

const assetRoutes = new Map([
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/css/archives.css', ['css/archives.css', 'text/css; charset=utf-8']],
  ['/js/archives-reader.js', ['js/archives-reader.js', 'text/javascript; charset=utf-8']],
  ['/favicon.svg', ['favicon.svg', 'image/svg+xml; charset=utf-8']]
]);
const htmlRoutes = new Set(['/', '/archives/', '/archives/index.html']);
const isInside = (root, candidate) => {
  const part = relative(root, candidate);
  return part !== '' && !isAbsolute(part) && part !== '..' && !part.startsWith('..' + sep);
};
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = message => { throw new Error(message); };

// Local verification only: every asset and source is explicitly selected.
export async function createArchivePreview({ htmlPath, searchHtmlPath, statusHtmlPath, occurrenceHtmlPath, cataloguePath, readerExportPath, assetsRoot, corpusRoot, mediaManifestPath, preflightPath, sourceManifestPath, draftMediaManifestPath, draftPreflightPath, draftSourceManifestPath, draftBridgeDirectories = [], hierarchyNotesPath, textIndexPath, textIndexSha256, textCoverageDirectory, textCoverageChecksumsSha256, textObjectIds=null, releaseMediaDirectory,releaseSelectionPath,releaseRunProofPath, draftDerivativeContext=null,draftDerivativeSelectionPath,draftDerivativeRunProofPath, annexShardsContext=null,annexShardsRunProofPath }) {
  if (!corpusRoot) fail('PHD_CORPUS_ROOT is required.');
  const root = await realpath(corpusRoot);
  const assets = await realpath(assetsRoot);
  const html = await readFile(htmlPath);
  const annexInputs=[annexShardsContext,annexShardsRunProofPath];
  if(annexInputs.some(Boolean) && !annexInputs.every(Boolean))fail('Annex shards require both context and run proof.');
  let annexProof=null;
  if(annexShardsContext){
    if(!searchHtmlPath || !releaseMediaDirectory || !draftDerivativeContext || draftDerivativeSelection(draftDerivativeContext).selected_object_ids.length!==17)fail('Annex shards require the complete private derivative reader and search page.');
    await revalidateAnnexSearchShards(annexShardsContext);
    annexProof=JSON.parse(await readFile(annexShardsRunProofPath));
    if(annexProof.version!=='private-annex-shards-integration/1' || annexProof.scope!=='private-local'
      || annexProof.originals_read!==false || annexProof.csv_tables_read!==false || annexProof.historical_confirmation!==false
      || annexProof.publication_approved!==false || annexProof.rights_status!=='unknown' || annexProof.human_review!=='pending'
      || JSON.stringify(annexProof.accepted_shards)!==JSON.stringify(acceptedAnnexEvidence(annexShardsContext))
      || annexProof.counts?.shards!==2 || annexProof.counts?.fiches!==10 || annexProof.counts?.name_mentions!==20 || annexProof.counts?.locators!==200
      || annexProof.output_hashes?.['search.html']!==sha256(Buffer.from(renderAcceptedAnnexSearch(annexShardsContext))))fail('Annex shard proof, state or rendered search drift.');
    const parentBytes=await readFile(resolve(dirname(annexShardsRunProofPath),'parent-media-integration-proof.json')),parent=JSON.parse(parentBytes);
    if(annexProof.input_hashes?.parent_integration!==sha256(parentBytes) || parent.version!=='reader-media-integration/1'
      || parent.output_hashes?.['reader.html']!==sha256(html) || parent.output_hashes?.['draft-derivative-proof.json']!==sha256(await readFile(draftDerivativeRunProofPath))
      || annexProof.input_hashes?.inherited_preflight!==sha256(await readFile(preflightPath)))fail('Annex shard parent reader or inherited preflight drift.');
    const code=['scripts/archives/annex-shards-release.mjs','scripts/archives/render-annex-search.mjs','scripts/archives/prepare-annex-shards.mjs','scripts/archives/preview-server.mjs','js/archives-annex-shards.js','css/archives-search.css'];
    if(JSON.stringify(Object.keys(annexProof.code_hashes??{}).sort())!==JSON.stringify([...code].sort()))fail('Annex shard code pin scope drift.');
    for(const name of code)if(annexProof.code_hashes[name]!==sha256(await readFile(resolve(assets,name))))fail('Annex shard code pin drift.');
  }
  const releaseInputs=[releaseMediaDirectory,releaseSelectionPath,releaseRunProofPath];
  if(releaseInputs.some(Boolean) && !releaseInputs.every(Boolean))fail('All three release media/run inputs required.');
  const releaseContext=releaseInputs.every(Boolean) ? await loadReaderMediaRelease(releaseMediaDirectory) : null;
  const derivativeFiles=releaseContext ? readerMediaRoutes(releaseContext) : new Map();
  const draftDerivativeInputs=[draftDerivativeContext,draftDerivativeSelectionPath,draftDerivativeRunProofPath];
  if(draftDerivativeInputs.some(Boolean) && !draftDerivativeInputs.every(Boolean))fail('All three draft derivative context/run inputs required.');
  const draftDerivativeSelected=draftDerivativeContext ? draftDerivativeSelection(draftDerivativeContext) : null;
  let draftDerivativeProof=null;
  if(draftDerivativeContext) {
    await revalidateDraftMediaComposition(draftDerivativeContext);
    if(!releaseContext || !draftMediaManifestPath || !draftSourceManifestPath || draftBridgeDirectories.length!==2 || draftDerivativeSelected.bindings.length!==17)fail('Draft derivatives require sealed normal media and exactly two lots/seventeen sources.');
    const selectionBytes=await readFile(draftDerivativeSelectionPath),proof=JSON.parse(await readFile(draftDerivativeRunProofPath,'utf8'));
    if(JSON.stringify(JSON.parse(selectionBytes))!==JSON.stringify(draftDerivativeSelected)
      || proof.version!=='draft-media-reader-integration/1' || proof.scope!=='private-local'
      || proof.originals_read!==false || proof.historical_confirmation!==false || proof.publication_approved!==false
      || proof.rights_review!=='pending' || proof.human_review!=='pending'
      || JSON.stringify(proof.accepted_media_evidence)!==JSON.stringify(acceptedDraftMediaEvidence(draftDerivativeContext))
      || proof.counts?.source_photographs!==17 || proof.counts?.selected_derivatives!==draftDerivativeSelected.selected_object_ids.length
      || proof.counts?.occurrences!==992 || proof.counts?.proposals!==89
      || proof.output_hashes?.['reader.html']!==sha256(html)
      || proof.output_hashes?.['draft-derivative-selection.json']!==sha256(selectionBytes)
      || proof.input_hashes?.draft_source_manifest!==sha256(await readFile(draftSourceManifestPath))
      || proof.input_hashes?.draft_media_manifest!==sha256(await readFile(draftMediaManifestPath)))fail('Draft derivative run binding or state drift.');
    draftDerivativeProof=proof;
    verifyDraftDerivativeHtml(html,draftDerivativeContext);
    for(const [url,entry] of draftDerivativeRoutes(draftDerivativeContext))derivativeFiles.set(url,entry);
  }
  const releaseSelection=releaseContext ? readerMediaSelection(releaseContext) : null;
  if(releaseContext) {
    const selectionBytes=await readFile(releaseSelectionPath),proof=JSON.parse(await readFile(releaseRunProofPath,'utf8'));
    if(JSON.stringify(JSON.parse(selectionBytes))!==JSON.stringify(releaseSelection) ||
       proof.version!=='reader-media-integration/1' || proof.scope!=='private-local' ||
       proof.originals_read!==false || proof.source_views_reidentified!==false ||
       proof.publication_approved!==false || proof.historical_confirmation!==false || proof.rights_review!=='pending' ||
       proof.counts?.accepted_source_views!==2 || proof.counts?.verified_derivatives!==2 ||
       proof.counts?.base_dossiers!==2 || proof.counts?.draft_dossiers!==draftBridgeDirectories.length ||
       JSON.stringify(proof.bindings)!==JSON.stringify(releaseSelection.bindings) ||
       proof.input_hashes?.media_checksums!==releaseSelection.checksums_sha256 ||
       proof.output_hashes?.['media-release-selection.json']!==sha256(selectionBytes) ||
       proof.output_hashes?.['reader.html']!==sha256(html) || !readerExportPath ||
       proof.input_hashes?.reader!==sha256(await readFile(readerExportPath)))fail('Release run selection, reader or proof drift.');
    if(!occurrenceHtmlPath || proof.output_hashes['occurrence.html']!==sha256(await readFile(occurrenceHtmlPath)))fail('Release requires its sealed H05 output.');
    if(draftDerivativeContext && proof.output_hashes?.['draft-derivative-proof.json']!==sha256(await readFile(draftDerivativeRunProofPath)))fail('Draft derivative proof differs from the normal release seal.');
    if(annexShardsContext && (proof.output_hashes?.['annex-shards-proof.json']!==sha256(await readFile(annexShardsRunProofPath))
      || proof.output_hashes?.['search.html']!==annexProof.output_hashes['search.html']
      || proof.output_hashes?.['parent-media-integration-proof.json']!==annexProof.input_hashes.parent_integration
      || proof.input_hashes?.annex_parent_integration!==annexProof.input_hashes.parent_integration))fail('Annex shard proof differs from normal release seal.');
    verifyReaderMediaHtml(html,releaseSelection);
  }
  const pages = new Map([...htmlRoutes].map(route => [route, html]));
  const routes = new Map(assetRoutes);
  const textInputs=[textIndexPath,textIndexSha256,textCoverageDirectory,textCoverageChecksumsSha256];
  if(textInputs.some(Boolean) && !textInputs.every(Boolean)) fail('All four private text index and catalogue inputs are required.');
  const textIndex=textInputs.every(Boolean) ? loadPreexistingTextIndex({indexPath:textIndexPath,indexSha256:textIndexSha256,coverageDirectory:textCoverageDirectory,coverageChecksumsSha256:textCoverageChecksumsSha256,objectIds:textObjectIds}) : null;
  if(textIndex) routes.set('/assets/archives-catalogue.css', ['scripts/archives-catalogue/catalogue.css', 'text/css; charset=utf-8']);
  if (html.toString('utf8').includes('data-draft-fragments')) {
    routes.set('/css/archives-drafts.css', ['css/archives-drafts.css', 'text/css; charset=utf-8']);
    routes.set('/js/archives-drafts.js', ['js/archives-drafts.js', 'text/javascript; charset=utf-8']);
  }
  let catalogueModel = null;
  let hierarchyModel = null;
  let hierarchyNotes = [];
  const hierarchyParameters = url => {
    if (url.search.length > 4096) fail('Query too long.');
    const parameters = {};
    for (const [key, value] of url.searchParams) { if (Object.hasOwn(parameters, key)) fail('Duplicate hierarchy parameter.'); parameters[key] = value; }
    return parameters;
  };
  const hierarchyPage = parameters => {
    const result = queryCatalogueHierarchy(hierarchyModel, parameters);
    result.counts.inventory_image_files = catalogueModel.records.length;
    result.counts.reader_links = catalogueModel.records.filter(record=>record.consultation.available).length;
    result.notes = hierarchyNotes.filter(note=>note.folder === result.selected_folder.logicalPath);
    return result;
  };
  if (cataloguePath) {
    const catalogueFile = await realpath(cataloguePath);
    if (!isInside(assets, catalogueFile)) fail('Catalogue resolves outside the checkout.');
    const catalogueBytes = await readFile(catalogueFile);
    catalogueModel = prepareCatalogue(JSON.parse(catalogueBytes.toString('utf8')), { inputSha256: sha256(catalogueBytes) });
    if (catalogueModel.records.some(record => record.collectionScope !== 'clean')) fail('Integrated consultation permits CLEAN only.');
    hierarchyModel = buildCatalogueHierarchy(catalogueModel);
    if (hierarchyNotesPath) {
      const notes = JSON.parse(await readFile(hierarchyNotesPath, 'utf8'));
      if (notes.format !== 'private-folder-observations/1' || notes.publication_status !== 'private' || !Array.isArray(notes.notes) || notes.notes.length > 100) fail('Invalid private folder observations.');
      for (const note of notes.notes) {
        if (!hierarchyModel.folders.has(note.folder) || typeof note.text !== 'string' || !note.text.trim() || note.text.length > 1000 || note.status !== 'owner-recollection-probable' || note.historical_confirmation !== false || !Array.isArray(note.object_ids) || note.object_ids.length < 1 || note.object_ids.length > 50 || new Set(note.object_ids).size !== note.object_ids.length || note.object_ids.some(id=>!catalogueModel.records.some(record=>record.digitalObjectId === id && record.logicalPath.slice(0,record.logicalPath.lastIndexOf('/')) === note.folder))) fail('Folder observation binding or state invalid.');
      }
      hierarchyNotes = notes.notes;
    }
    const catalogueHtml = Buffer.from(renderCataloguePage({ initialPage: hierarchyPage({}), cleanOnly: true, hierarchy: true, preexistingTexts:Boolean(textIndex) }));
    pages.set('/archives/catalogue/', catalogueHtml);
    pages.set('/archives/catalogue/index.html', catalogueHtml);
    routes.set('/assets/archives-catalogue.css', ['scripts/archives-catalogue/catalogue.css', 'text/css; charset=utf-8']);
    routes.set('/assets/archives-catalogue.js', ['scripts/archives-catalogue/catalogue.js', 'text/javascript; charset=utf-8']);
    routes.set('/assets/archives-hierarchy.js', ['scripts/archives-catalogue/hierarchy.js', 'text/javascript; charset=utf-8']);
  }
  if (searchHtmlPath) {
    const searchFile = await realpath(searchHtmlPath);
    if (!isInside(assets, searchFile)) fail('Search page resolves outside the checkout.');
    const searchBytes=await readFile(searchFile);
    if(!annexShardsContext && searchBytes.toString().includes('data-annex-package='))fail('Annex shards require their accepted context and proof.');
    if(annexProof && sha256(searchBytes)!==annexProof.output_hashes['search.html'])fail('Annex shard search file hash drift.');
    pages.set('/archives/recherche/', searchBytes);
    routes.set('/css/archives-search.css', ['css/archives-search.css', 'text/css; charset=utf-8']);
    routes.set('/js/archives-search.js', ['js/archives-search.js', 'text/javascript; charset=utf-8']);
    if(annexShardsContext)routes.set('/js/archives-annex-shards.js', ['js/archives-annex-shards.js', 'text/javascript; charset=utf-8']);
  }
  if (statusHtmlPath) {
    const statusFile = await realpath(statusHtmlPath);
    if (!isInside(assets, statusFile)) fail('Statusboard page resolves outside the checkout.');
    pages.set('/archives/avancement/', await readFile(statusFile));
    routes.set('/css/archives-statusboard.css', ['css/archives-statusboard.css', 'text/css; charset=utf-8']);
  }
  if (occurrenceHtmlPath) {
    const occurrenceFile = await realpath(occurrenceHtmlPath);
    if (!isInside(assets, occurrenceFile)) fail('Occurrence page resolves outside the checkout.');
    pages.set('/archives/formes/', await readFile(occurrenceFile));
    routes.set('/css/archives-occurrence.css', ['css/archives-occurrence.css', 'text/css; charset=utf-8']);
  }
  const manifest = JSON.parse(await readFile(mediaManifestPath, 'utf8'));
  if (catalogueModel?.records.some(record => record.consultation.available)) {
    if (!readerExportPath) fail('A reader export is required to verify catalogue links.');
    const expected = readerAllowlist(JSON.parse(await readFile(readerExportPath, 'utf8')), manifest).entries;
    for (const record of catalogueModel.records.filter(record => record.consultation.available)) {
      const entry = expected.find(item => item.object_id === record.digitalObjectId);
      if (!entry || record.consultation.href !== entry.href || record.consultation.approval_id !== entry.review_id ||
          !html.toString('utf8').includes(`id="${entry.href.split('#')[1]}"`)) fail('Catalogue link does not match the accepted reader export.');
    }
  }
  const preflight = JSON.parse(await readFile(preflightPath, 'utf8'));
  if (preflight.passed !== true) fail('The corpus preflight has not passed.');
  if (preflight.corpus_root_accessible !== true || preflight.corpus_root_reference !== 'env:PHD_CORPUS_ROOT' ||
      !/^[a-f0-9]{64}$/.test(preflight.input_manifest_sha256)) {
    fail('Invalid preflight corpus configuration or evidence.');
  }
  if (!sourceManifestPath) fail('The source manifest bound to the preflight is required.');
  const sourceBytes = await readFile(sourceManifestPath);
  if (sha256(sourceBytes) !== preflight.input_manifest_sha256) fail('Source manifest hash differs from the passed preflight.');
  const sources = JSON.parse(sourceBytes.toString('utf8'));
  if (sources.corpus_root_reference !== 'env:PHD_CORPUS_ROOT' || !Array.isArray(sources.objects)) {
    fail('Invalid source manifest.');
  }
  if (manifest.manifest_version !== 'atelier-tuce-local-media/1.0.0' ||
      manifest.corpus_root_reference !== 'env:PHD_CORPUS_ROOT' || manifest.access_tier !== 'project' ||
      manifest.publication_status !== 'not-published' || !Array.isArray(manifest.objects)) {
    fail('Invalid media allowlist.');
  }
  const media = manifest.objects.filter(item => item.media_type === 'image/jpeg');
  if (media.length < 1 || media.length > 4) fail('MVP allows one to four selected images.');
  const sourceImages=sources.objects.filter(item=>item.media_type==='image/jpeg');
  if(releaseContext && (media.length!==2 || sourceImages.length!==2 ||
      new Set(sourceImages.map(item=>item.digital_object_id)).size!==2 ||
      releaseSelection.bindings.some(binding=>!sourceImages.some(item=>item.digital_object_id===binding.source_object_id) ||
        !media.some(item=>item.view_id===binding.view_id))))fail('Release requires exactly the two accepted source selections.');
  const files = new Map();
  const viewIds = new Set();
  for (const item of media) {
    if (!item.view_id || viewIds.has(item.view_id)) fail('Missing or duplicate view ID.');
    viewIds.add(item.view_id);
    if (typeof item.approved_review_id !== 'string' || !item.approved_review_id.startsWith('review:')) {
      fail('A preserved approved link is required.');
    }
    if (item.bytes_verified !== true || item.source_reading_status !== 'unreviewed') {
      fail('Each selected image needs a verified allowlist entry with its unreviewed source state preserved.');
    }
    if (item.media_type !== 'image/jpeg' || !/^[a-f0-9]{64}$/.test(item.sha256)) {
      fail('Only SHA-256 verified JPEGs are allowed in this MVP.');
    }
    if (!Number.isSafeInteger(item.byte_size) || item.byte_size < 1) fail('Invalid declared byte size.');
    if (typeof item.relative_path !== 'string' || isAbsolute(item.relative_path) ||
        /^[A-Za-z]:/.test(item.relative_path) || item.relative_path.includes('\0') ||
        item.relative_path.split(/[\\/]/).some(part => part === '..')) fail('Unsafe source path.');
    const input = sources.objects.find(source => source.digital_object_id === item.digital_object_id);
    if (!input || input.view_id !== item.view_id || input.relative_path !== item.relative_path ||
        input.expected_sha256 !== item.sha256 || input.expected_byte_size !== item.byte_size ||
        input.media_type !== item.media_type || input.approved_review_id !== item.approved_review_id) {
      fail('Source does not match its preflight manifest (path/hash/declared byte size).');
    }
    if (input.rights?.local_consultation !== 'authorized' ||
        !input.rights?.permitted_uses?.includes('local-private-consultation')) {
      fail('The source manifest does not authorize local consultation.');
    }
    if(releaseContext) {
      const binding=releaseSelection.bindings.find(binding=>binding.view_id===item.view_id);
      if(!binding || binding.source_object_id!==item.digital_object_id || binding.source_sha256!==item.sha256 || binding.source_byte_size!==item.byte_size || binding.approved_review_id!==item.approved_review_id)fail('Source allowlist differs from verified derivative binding.');
      // Approved source references remain, but the sanitized snapshot is served.
      continue;
    }
    const candidate = resolve(root, item.relative_path);
    if (!isInside(root, candidate)) fail('Source is outside the configured corpus.');
    const file = await realpath(candidate);
    if (!isInside(root, file)) fail('Source resolves outside the configured corpus.');
    const bytes = await readFile(file);
    if (sha256(bytes) !== item.sha256) fail('The selected source hash has changed.');
    if (bytes.length !== item.byte_size) fail('The selected source differs from its declared byte size.');
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) fail('Selected file is not a JPEG.');
    if (files.has(item.sha256)) fail('Duplicate content requires a separate explicit mapping.');
    files.set(item.sha256, { file, contentType: 'image/jpeg', size: bytes.length });
  }
  const staticFiles = new Map();
  const draftInputs = [draftMediaManifestPath, draftPreflightPath, draftSourceManifestPath];
  if (!draftDerivativeContext && draftInputs.some(Boolean) && !draftInputs.every(Boolean)) fail('All three draft media/preflight/source manifests are required.');
  const draftFiles = !draftDerivativeContext && draftInputs.every(Boolean) ? await loadDraftMedia({ corpusRoot, mediaManifestPath: draftMediaManifestPath, sourceManifestPath: draftSourceManifestPath, preflightPath: draftPreflightPath, html }) : new Map();
  if (!draftInputs.some(Boolean) && html.toString('utf8').includes('/__archive_draft_media/')) fail('Candidate photographs require their separate source/preflight/selection manifests.');
  let draftReviewIndex = null;
  if (draftBridgeDirectories.length) {
    if (draftBridgeDirectories.length > 2 || !draftDerivativeContext && !draftInputs.every(Boolean)) fail('Review requires one or two manifest-bound draft lots.');
    const drafts = draftBridgeDirectories.map(loadDraftBridge);
    const selected = JSON.parse(await readFile(draftSourceManifestPath, 'utf8'));
    if (drafts.some(draft=>selected.bridge_hashes?.[draft.bridge.lot_id] !== draft.checksums['reader-bridge.json'] || selected.review_queue_hashes?.[draft.bridge.lot_id] !== draft.checksums['review-queue.json']) || Object.keys(selected.bridge_hashes ?? {}).length !== drafts.length || Object.keys(selected.review_queue_hashes ?? {}).length !== drafts.length || drafts.flatMap(draft=>draft.bridge.images).length !== selected.objects.length || drafts.some(draft=>draft.bridge.images.some(image=>!selected.objects.some(item=>item.digital_object_id === image.object_id && item.expected_sha256 === image.sha256 && item.expected_byte_size === image.expected_byte_size)))) fail('Review inputs differ from the sealed queues or selected photographs.');
    if (drafts.some(draft=>JSON.stringify(selected.source_alias_evidence?.[draft.bridge.lot_id] ?? null) !== JSON.stringify(draft.sourceAliasEvidence))) fail('Source alias evidence differs from its sealed manifest.');
    if(draftDerivativeSelected && (draftDerivativeSelected.bindings.length!==selected.objects.length || draftDerivativeSelected.bindings.some(binding=>!selected.objects.some(item=>item.digital_object_id===binding.source_object_id && item.expected_sha256===binding.source_sha256))))fail('Derivative source identities differ from sealed draft selection.');
    draftReviewIndex = buildDraftReviewIndex(drafts.map(draft=>({bridge:draft.reviewBridge,queue:draft.queue})),{mediaBindings:draftDerivativeContext});
    if(draftDerivativeProof && (draftReviewIndex.total!==draftDerivativeProof.counts.occurrences || drafts.reduce((sum,draft)=>sum+draft.bridge.proposals_count,0)!==draftDerivativeProof.counts.proposals))fail('Draft review counts differ from sealed run.');
    if(draftDerivativeProof && draftDerivativeProof.output_hashes?.['draft-review.html']!==sha256(Buffer.from(renderDraftReviewPage(queryDraftReview(draftReviewIndex)))))fail('Draft derivative initial review page hash drift.');
    routes.set('/css/archives-draft-review.css', ['css/archives-draft-review.css', 'text/css; charset=utf-8']);
    routes.set('/js/archives-draft-review.js', ['js/archives-draft-review.js', 'text/javascript; charset=utf-8']);
    if(draftDerivativeContext)routes.set('/js/archives-draft-derivatives.js', ['js/archives-draft-derivatives.js', 'text/javascript; charset=utf-8']);
  }
  for (const [url, [name, contentType]] of routes) {
    const file = await realpath(resolve(assets, name));
    if (!isInside(assets, file)) fail('Asset resolves outside the checkout.');
    const info = await stat(file);
    if (!info.isFile()) fail('Asset is not a file.');
    staticFiles.set(url, { file, contentType, size: info.size });
  }
  const server = createServer({maxHeaderSize:8192},(request, response) => {
    response.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Cache-Control', 'no-store');
    if(releaseContext) {
      const guarded=guardRequest(request,'http://127.0.0.1:'+server.address().port);
      if(guarded.status) { response.setHeader('Connection','close');if(guarded.status===405)response.setHeader('Allow','GET, HEAD');response.writeHead(guarded.status).end(request.method==='HEAD' ? undefined : 'Request refused');return; }
    }
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.setHeader('Allow', 'GET, HEAD');
      response.writeHead(405).end('Method not allowed');
      return;
    }
    let pathname;
    try {
      const url = new URL(request.url, 'http://127.0.0.1');
      if(textIndex && ['/archives/textes/','/archives/texte/'].includes(url.pathname)) {
        try {
          const rendered=url.pathname==='/archives/textes/' ? renderPreexistingTexts(textIndex,url.searchParams) : renderPreexistingText(textIndex,url.searchParams);
          if(rendered===null) { response.writeHead(404).end('Not found'); return; }
          const bytes=Buffer.from(rendered); response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Length':bytes.length}); response.end(request.method==='HEAD' ? undefined : bytes);
        } catch { response.writeHead(400,{'Content-Type':'text/plain; charset=utf-8'}).end(request.method==='HEAD' ? undefined : 'Fichier, dossier ou pagination invalide.'); }
        return;
      }
      if (hierarchyModel && ['/__catalogue_hierarchy', '/archives/catalogue/', '/archives/catalogue/index.html'].includes(url.pathname)) {
        try {
          const data = hierarchyPage(hierarchyParameters(url));
          const api = url.pathname === '/__catalogue_hierarchy';
          const bytes = Buffer.from(api ? JSON.stringify(data) : renderCataloguePage({initialPage:data,cleanOnly:true,hierarchy:true,preexistingTexts:Boolean(textIndex)}));
          response.writeHead(200, {'Content-Type':api ? 'application/json; charset=utf-8' : 'text/html; charset=utf-8','Content-Length':bytes.length}); response.end(request.method === 'HEAD' ? undefined : bytes);
        } catch { response.writeHead(400, {'Content-Type':'application/json; charset=utf-8'}).end(request.method === 'HEAD' ? undefined : JSON.stringify({error:'Dossier, filtres ou pagination invalides.'})); }
        return;
      }
      if (draftReviewIndex && ['/__draft_review_data', '/archives/formes-brouillons/'].includes(url.pathname)) {
        try {
          if (url.search.length > 4096) fail('Query too long.');
          const data = queryDraftReview(draftReviewIndex, url.searchParams);
          const api = url.pathname === '/__draft_review_data';
          const bytes = Buffer.from(api ? JSON.stringify(data) : renderDraftReviewPage(data));
          response.writeHead(200, {'Content-Type':api ? 'application/json; charset=utf-8' : 'text/html; charset=utf-8','Content-Length':bytes.length}); response.end(request.method === 'HEAD' ? undefined : bytes);
        } catch { response.writeHead(400, {'Content-Type':'application/json; charset=utf-8'}).end(request.method === 'HEAD' ? undefined : JSON.stringify({error:'Lot, recherche ou pagination invalides.'})); }
        return;
      }
      if (url.pathname === '/__catalogue_data' && catalogueModel) {
        try {
          const result = queryCatalogue(catalogueModel, parseDataRequest(url));
          const bytes = Buffer.from(JSON.stringify(result));
          response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': bytes.length });
          response.end(request.method === 'HEAD' ? undefined : bytes);
        } catch { response.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' }).end(request.method === 'HEAD' ? undefined : JSON.stringify({ error: 'Filtres ou pagination invalides.' })); }
        return;
      }
      if (url.search) { response.writeHead(404).end('Not found'); return; }
      pathname = decodeURIComponent(url.pathname);
    } catch { response.writeHead(400).end('Invalid URL'); return; }
    const page = pages.get(pathname);
    if (page) {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': page.length });
      response.end(request.method === 'HEAD' ? undefined : page);
      return;
    }
    const match = /^\/__archive_media\/([a-f0-9]{64})$/.exec(pathname);
    const draftMatch = /^\/__archive_draft_media\/([a-f0-9]{64})$/.exec(pathname);
    const entry = derivativeFiles.get(pathname) ?? (match ? files.get(match[1]) : draftMatch ? draftFiles.get(draftMatch[1]) : staticFiles.get(pathname));
    if (!entry) { response.writeHead(404).end('Not found'); return; }
    response.writeHead(200, { 'Content-Type': entry.contentType, 'Content-Length': entry.size });
    if (request.method === 'HEAD') { response.end(); return; }
    if (entry.bytes) { response.end(entry.bytes); return; }
    const stream = createReadStream(entry.file);
    stream.on('error', () => response.destroy());
    stream.pipe(response);
  });
  return {
    server,
    async listen(port = 0) {
      await new Promise((accept, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', () => { server.off('error', reject); accept(); });
      });
      return 'http://127.0.0.1:' + server.address().port + '/archives/';
    }
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { values } = parseArgs({
      options: {
        html: { type: 'string' }, 'search-html': { type: 'string' }, 'status-html': { type: 'string' }, 'occurrence-html': { type: 'string' }, catalogue: { type: 'string' }, 'reader-export': { type: 'string' }, 'media-manifest': { type: 'string' },
        preflight: { type: 'string' }, 'source-manifest': { type: 'string' }, 'draft-media-manifest': { type: 'string' }, 'draft-preflight': { type: 'string' }, 'draft-source-manifest': { type: 'string' }, 'draft-bridge-directory': {type:'string',multiple:true}, 'hierarchy-notes':{type:'string'}, 'text-index':{type:'string'}, 'text-index-sha256':{type:'string'}, 'text-coverage-directory':{type:'string'}, 'text-coverage-checksums-sha256':{type:'string'}, 'text-object-id':{type:'string',multiple:true}, 'release-media':{type:'string'}, 'release-selection':{type:'string'}, 'release-run-proof':{type:'string'}, port: { type: 'string', default: '8766' }
      }
    });
    if (!values.html || !values['media-manifest'] || !values.preflight || !values['source-manifest']) {
      fail('Required: --html, --media-manifest, --preflight, --source-manifest.');
    }
    const port = Number(values.port);
    if (!Number.isInteger(port) || port < 0 || port > 65535) fail('Invalid port.');
    const preview = await createArchivePreview({
      htmlPath: values.html, searchHtmlPath: values['search-html'], statusHtmlPath: values['status-html'], occurrenceHtmlPath: values['occurrence-html'], cataloguePath: values.catalogue, readerExportPath: values['reader-export'], mediaManifestPath: values['media-manifest'], preflightPath: values.preflight,
      sourceManifestPath: values['source-manifest'],
      draftMediaManifestPath: values['draft-media-manifest'], draftPreflightPath: values['draft-preflight'], draftSourceManifestPath: values['draft-source-manifest'],
      draftBridgeDirectories:values['draft-bridge-directory'] ?? [], hierarchyNotesPath:values['hierarchy-notes'],
      textIndexPath:values['text-index'],textIndexSha256:values['text-index-sha256'],textCoverageDirectory:values['text-coverage-directory'],textCoverageChecksumsSha256:values['text-coverage-checksums-sha256'],textObjectIds:values['text-object-id'] ?? null,
      releaseMediaDirectory:values['release-media'],releaseSelectionPath:values['release-selection'],releaseRunProofPath:values['release-run-proof'],
      assetsRoot: fileURLToPath(new URL('../..', import.meta.url)), corpusRoot: process.env.PHD_CORPUS_ROOT
    });
    console.log(await preview.listen(port));
  } catch (error) { console.error('Preview refused: ' + error.message); process.exitCode = 1; }
}
