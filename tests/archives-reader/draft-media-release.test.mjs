import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { resolve, join, relative, isAbsolute, sep } from 'node:path';
import { loadDraftMediaRelease, acceptedDraftMediaEvidence, revalidateDraftMediaComposition, DRAFT_MEDIA_PILOT_IDS } from '../../scripts/archives/draft-media-release.mjs';
import { draftDerivativeSelection, draftDerivativeRoutes } from '../../scripts/archives/draft-derivative-bindings.mjs';

const directory = process.env.DRAFT_MEDIA_CANDIDATE;
const acceptanceDirectory = process.env.DRAFT_MEDIA_ACCEPTANCE;
const compositionDirectory = process.env.DRAFT_MEDIA_COMPOSITION;

test('sealed real union: private pilot closure and refusal boundaries, without originals or pixel decoding',
  { skip: !directory || !acceptanceDirectory }, async t => {
    const context = await loadDraftMediaRelease({ directory, acceptanceDirectory });
    assert.equal(draftDerivativeRoutes(context).size, 3);
    const selection = draftDerivativeSelection(context);
    assert.equal(selection.bindings.length, 17);
    assert.deepEqual(selection.selected_object_ids, DRAFT_MEDIA_PILOT_IDS);
    assert.ok(selection.bindings.every(item => item.candidate_view_id === null && item.canonical_view_id === null));
    assert.deepEqual([acceptedDraftMediaEvidence(context).originals_read, acceptedDraftMediaEvidence(context).pixels_decoded], [false, false]);
    assert.throws(() => acceptedDraftMediaEvidence({ ...context }));

    const testRoot = resolve('.private/archives-mvp');
    const temporary = await mkdtemp(join(testRoot, 'draft-release-test-'));
    const candidate = join(temporary, 'candidate'), accepted = join(temporary, 'acceptance');
    await mkdir(candidate); await mkdir(join(candidate, 'media')); await mkdir(accepted);
    const confined = path => { const part = relative(testRoot, path); assert.ok(part && part !== '..' && !part.startsWith('..' + sep) && !isAbsolute(part)); };
    confined(temporary);
    try {
      // Copy only the fixed candidate/receipt files. No source locator is followed.
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (entry.name === 'media') {
          for (const file of await readdir(join(directory, 'media'), { withFileTypes: true })) {
            assert.ok(file.isFile()); await copyFile(join(directory, 'media', file.name), join(candidate, 'media', file.name));
          }
        } else { assert.ok(entry.isFile()); await copyFile(join(directory, entry.name), join(candidate, entry.name)); }
      }
      for (const name of ['sealed-source-derivative-proof.json', 'run-manifest-final.json']) await copyFile(join(directory, '..', name), join(temporary, name));
      for (const file of await readdir(acceptanceDirectory, { withFileTypes: true })) {
        if (file.isFile()) await copyFile(join(acceptanceDirectory, file.name), join(accepted, file.name));
      }
      const load = selectedObjectIds => loadDraftMediaRelease({ directory: candidate, acceptanceDirectory: accepted, ...(selectedObjectIds ? { selectedObjectIds } : {}) });
      assert.equal(draftDerivativeRoutes(await load()).size, 3);
      async function changedFile(name, mutate, pattern, attempt = load) {
        const original = await readFile(name);
        try { await writeFile(name, mutate(Buffer.from(original))); await assert.rejects(attempt(), pattern); }
        finally { await writeFile(name, original); }
      }
      await t.test('receipt cannot be replaced by a pending or edited assertion', () => changedFile(join(accepted, 'acceptance-receipt.json'), bytes => Buffer.from(bytes.toString().replace('true', 'false')), /pin drift/));
      await t.test('closed acceptance output hashes refuse an edited union verification', () => changedFile(join(accepted, 'frozen-union-verification.json'), bytes => Buffer.concat([bytes, Buffer.from('\n')]), /closed output drift/));
      await t.test('a failing final closeout is refused', () => changedFile(join(accepted, 'closeout-final.json'), bytes => { const value = JSON.parse(bytes); value.passed = false; return Buffer.from(JSON.stringify(value)); }, /acceptance closeout drift/));
      await t.test('candidate mapping cannot be restamped', () => changedFile(join(candidate, 'checksums.json'), bytes => Buffer.concat([bytes, Buffer.from('\n')]), /pin drift/));
      await t.test('sealed source proof cannot be replaced', () => changedFile(join(temporary, 'sealed-source-derivative-proof.json'), bytes => Buffer.concat([bytes, Buffer.from('\n')]), /pin drift/));
      await t.test('derivative bytes are checked independently of their source SHA', () => changedFile(join(candidate, 'media', selection.bindings[0].derivative_sha256 + '.jpg'), bytes => { bytes[Math.floor(bytes.length / 2)] ^= 1; return bytes; }, /byte hash drift/));
      await t.test('a twenty-fourth candidate file is refused', async () => {
        const extra = join(candidate, 'extra.json'); await writeFile(extra, '{}');
        try { await assert.rejects(load(), /tree drift/); } finally { await rm(extra); }
      });
      await t.test('a missing derivative is refused', async () => {
        const file = join(candidate, 'media', selection.bindings[0].derivative_sha256 + '.jpg'), bytes = await readFile(file);
        await rm(file);
        try { await assert.rejects(load(), /seventeen JPEGs/); } finally { await writeFile(file, bytes); }
      });
      await t.test('only the exact pilot selection is eligible at the pilot boundary', async () => {
        await assert.rejects(load([DRAFT_MEDIA_PILOT_IDS[0], DRAFT_MEDIA_PILOT_IDS[1], selection.bindings.find(item => !DRAFT_MEDIA_PILOT_IDS.includes(item.source_object_id)).source_object_id]), /exact pilot\/full selection/);
        await assert.rejects(load(DRAFT_MEDIA_PILOT_IDS.slice(0, 2)), /exact pilot\/full selection/);
      });
      await t.test('APP1 receipt alone cannot activate the complete seventeen-view selection', async () => {
        await assert.rejects(load(selection.bindings.map(item => item.source_object_id)), /independent composition GO required/);
      });
      await t.test('full selection requires the exact closed composition GO, revalidated before serving', {skip: !compositionDirectory}, async () => {
        const composition = join(temporary, 'composition'); await mkdir(composition);
        for (const file of await readdir(compositionDirectory, {withFileTypes:true})) {
          if (file.isFile()) await copyFile(join(compositionDirectory,file.name),join(composition,file.name));
        }
        const full = () => loadDraftMediaRelease({directory:candidate,acceptanceDirectory:accepted,compositionReviewDirectory:composition,
          selectedObjectIds:selection.bindings.map(item=>item.source_object_id)});
        const acceptedFull = await full();
        assert.equal(draftDerivativeRoutes(acceptedFull).size,17);
        assert.equal(acceptedDraftMediaEvidence(acceptedFull).composition_review.source_bindings,17);
        await revalidateDraftMediaComposition(acceptedFull);
        await changedFile(join(composition,'verification.json'),bytes=>Buffer.concat([bytes,Buffer.from('\n')]),/pin drift/,full);
        await changedFile(join(composition,'HANDOFF.md'),bytes=>Buffer.concat([bytes,Buffer.from('\n')]),/handoff pin drift/,full);
        await changedFile(join(composition,'replay-seventeen.json'),bytes=>Buffer.concat([bytes,Buffer.from('\n')]),/closed output drift/,full);
        await changedFile(join(composition,'closeout-final.json'),bytes=>{const value=JSON.parse(bytes);value.passed=false;return Buffer.from(JSON.stringify(value));},/composition closeout drift/,full);
        await changedFile(join(composition,'verification.json'),bytes=>Buffer.concat([bytes,Buffer.from('\n')]),/pin drift/,()=>revalidateDraftMediaComposition(acceptedFull));
        await revalidateDraftMediaComposition(acceptedFull);
      });
    } finally { confined(temporary); await rm(temporary, { recursive: true, force: true }); }
  });
