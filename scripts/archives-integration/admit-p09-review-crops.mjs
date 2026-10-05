import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const ensure = (ok, message) => { if (!ok) throw Error(message); };
const run = resolve('.private/archives-integration/p09-word-review-crops-20261004-v1');
const candidateBytes = await readFile(resolve(run, 'candidate.json')), candidate = JSON.parse(candidateBytes);
const formBytes = await readFile('Z:/Codex/repos/PHD-Maine-paleography-harness/data/private/p09-form-projection-mvp-20261004-v1/run02/forms.json');
ensure(sha(formBytes) === '1824607dc38d3d71e76aba06e36d24befd7fa61592b728e96a6e35bc4f8ebe23', 'Four-form source drift.');
const forms = JSON.parse(formBytes);
const body = await readFile('Z:/Codex/repos/PHD-Maine-paleography-harness/data/private/transcription-campaign/e99-p09-full-view-20261004-v1/transcription-body.full-r0.txt');
ensure(sha(body) === candidate.source_body_sha256, 'Frozen edition drift.');
const text = body.toString('utf8'), points = Array.from(text), lines = text.trimEnd().split('\n');
ensure(lines.length === 21 && candidate.regions.length === 3 && candidate.source_frame.transform === 'identity', 'Exact three-region overview pilot required.');
const selected = [];
for (const region of candidate.regions) {
  const form = forms.forms.find(f => f.physical_line === region.line && f.quote === region.quote);
  ensure(form && points.slice(form.span.start, form.span.end).join('') === region.quote && lines[Number(region.line.slice(1)) - 1] === form.line_context_exact, 'Exact line/quote association required.');
  const bytes = await readFile(resolve(run, region.file)); ensure(bytes.length === region.bytes && sha(bytes) === region.sha256, 'Inspected crop drift.');
  selected.push({
    ...region, occurrence_id: form.id, source_quote: form.quote, source_span: form.span, line_context_exact: form.line_context_exact,
    physical_crop_review: 'root-visually-inspected-target-group-and-line', historical_reading_confirmed: false,
    region_kind: 'small-context-region-around-observed-glyph-group', word_bbox: null,
    public_route: '/archives/review-crops/p09/' + region.sha256 + '.png',
    review_note: 'Manual rectangle around the visible difficult group. Its association with this proposed reading is a review aid, not a confirmed decipherment or canonical identity.',
  });
}
const proof = {
  format: 'p09-three-word-review-crops-admission/1', created_at: new Date().toISOString(), candidate_sha256: sha(candidateBytes),
  source_derivative_sha256: candidate.source_derivative_sha256, source_object_id: candidate.source_object_id,
  source_edition: candidate.source_edition, source_body_sha256: candidate.source_body_sha256, forms_sha256: sha(formBytes),
  coordinate_frame: candidate.source_frame, explicit_visual_inspection: true, exact_quote_and_line_checks: 3,
  text_offsets_used_for_geometry: false, generative_processing: false, contrast_applied: false,
  historical_confirmation: false, canonical_updates: 0, confirmed_memory: false, human_review: 'pending',
  original_source_modified: false, new_photographic_views: 0, review_crop_assets: 3, regions: selected,
};
await writeFile(resolve(run, 'root-admission.json'), JSON.stringify(proof, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ admitted_review_contexts: 3, exact_quote_line_checks: 3, historical_confirmation: false }));
