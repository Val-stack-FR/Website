import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const sharp = createRequire(import.meta.url)('sharp');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const source = resolve('.private/archives-integration/publication-package-20261004-v12-r2/site/dist/archives/next-readings/media/2a7b6be96cff6891a061152cf4e8f25d8a010a1a8697f8d6cc57b2ba76a98c34.jpg');
const output = resolve('.private/archives-integration/p09-word-review-crops-20261004-v1');
const bytes = await readFile(source);
if (sha(bytes) !== '2a7b6be96cff6891a061152cf4e8f25d8a010a1a8697f8d6cc57b2ba76a98c34') throw Error('Selected derivative drift.');
const meta = await sharp(bytes).metadata();
if (meta.width !== 3968 || meta.height !== 2976) throw Error('Native frame drift.');
await mkdir(output);
// Rectangles are manual candidates from visual inspection of the overview.
// Text offsets are deliberately not used to estimate any image geometry.
const regions = [
  { id: 'l01-name', line: 'L01', quote: '⟦[…]trix ?⟧', rectangle: { left: 1830, top: 450, width: 510, height: 170 } },
  { id: 'l04-souille', line: 'L04', quote: '⟦souille ?⟧', rectangle: { left: 3190, top: 645, width: 530, height: 165 } },
  { id: 'l21-month', line: 'L21', quote: '⟦septenbre ?⟧', rectangle: { left: 1930, top: 2330, width: 700, height: 190 } },
];
for (const region of regions) {
  const crop = await sharp(bytes).extract(region.rectangle).png().toBuffer();
  region.file = region.id + '.png'; region.sha256 = sha(crop); region.bytes = crop.length;
  region.frame = 'selected-overview-native-3968x2976'; region.physical_crop_review = 'pending';
  region.word_bbox = null; region.processing = [{ operation: 'extract', rectangle: region.rectangle }, { operation: 'lossless-png-encoding' }];
  await writeFile(resolve(output, region.file), crop, { flag: 'wx' });
}
await writeFile(resolve(output, 'candidate.json'), JSON.stringify({
  format: 'p09-manual-word-review-crop-candidates/1', created_at: new Date().toISOString(),
  source_derivative_sha256: sha(bytes), source_object_id: 'object:path-bb85ab737e3b2ef749a76d8b40636202af7b27fd9dea1feace413fc36f43670b',
  source_frame: { width: 3968, height: 2976, transform: 'identity', historical_orientation: 'unknown' },
  source_edition: 'author-full-view-r0', source_body_sha256: 'b827189b0e30ad119e825bfdd8e2267c3321c635891dd08581d16ac080c1dee1',
  association_basis: 'manual-visual-candidate-needs-physical-inspection', text_offsets_used_for_geometry: false,
  historical_reading_confirmed: false, original_source_unchanged: true, contrast_applied: false, regions,
}, null, 2) + '\n', { flag: 'wx' });
if (sha(await readFile(source)) !== sha(bytes)) throw Error('Source changed.');
console.log(JSON.stringify({ candidates: regions.length, physical_review_pending: true, source_unchanged: true }));
