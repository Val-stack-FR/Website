import { createHash } from 'node:crypto';
import { open, readFile, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const inside = (root, file) => { const part = relative(root, file); return part && !isAbsolute(part) && part !== '..' && !part.startsWith('..' + sep); };
const fail = message => { throw new Error('Draft media: ' + message); };
export const MAX_DRAFT_JPEG_BYTES = 32 * 1024 * 1024;
export const MAX_DRAFT_TOTAL_BYTES = 128 * 1024 * 1024;
export function assertDraftMediaBudget(objects) {
  if (!Array.isArray(objects) || objects.length < 1 || objects.length > 17 || objects.some(item => !Number.isSafeInteger(item.byte_size) || item.byte_size < 1 || item.byte_size > MAX_DRAFT_JPEG_BYTES) || objects.reduce((total, item) => total + item.byte_size, 0) > MAX_DRAFT_TOTAL_BYTES) fail('invalid or oversized candidate byte budget.');
}

export async function loadDraftMedia({ corpusRoot, mediaManifestPath, sourceManifestPath, preflightPath, html }) {
  const sourceBytes = await readFile(sourceManifestPath);
  const sources = JSON.parse(sourceBytes.toString('utf8'));
  const preflight = JSON.parse(await readFile(preflightPath, 'utf8'));
  const selection = JSON.parse(await readFile(mediaManifestPath, 'utf8'));
  if (preflight.passed !== true || preflight.corpus_root_accessible !== true || preflight.corpus_root_reference !== 'env:PHD_CORPUS_ROOT' || preflight.input_manifest_sha256 !== sha(sourceBytes)) fail('passed manifest-bound preflight required.');
  if (sources.manifest_version !== 'atelier-draft-source-input/1' || sources.corpus_root_reference !== 'env:PHD_CORPUS_ROOT' || !Array.isArray(sources.objects)) fail('explicit draft source manifest required.');
  if (selection.manifest_version !== 'atelier-draft-local-media/1' || selection.corpus_root_reference !== 'env:PHD_CORPUS_ROOT' || selection.source_manifest_sha256 !== sha(sourceBytes) || selection.publication_status !== 'not-published' || selection.link_status !== 'candidate' || !Array.isArray(selection.objects)) fail('private candidate selection required.');
  assertDraftMediaBudget(selection.objects);
  if (sources.objects.length !== selection.objects.length) fail('exact candidate sources required.');
  const htmlHashes = new Set([...String(html).matchAll(/\/__archive_draft_media\/([a-f0-9]{64})/gu)].map(match => match[1]));
  if (htmlHashes.size !== selection.objects.length || selection.objects.some(item => !htmlHashes.has(item.sha256))) fail('HTML photograph selection differs from its manifest.');
  const htmlPairs = new Map();
  for (const [tag] of String(html).matchAll(/<img\b[^>]*>/giu)) {
    const hash = /\bsrc="\/__archive_draft_media\/([a-f0-9]{64})"/u.exec(tag)?.[1];
    if (!hash) continue;
    const objectId = /\bdata-draft-object-id="(object:path-[a-f0-9]{64})"/u.exec(tag)?.[1];
    if (!objectId || htmlPairs.has(objectId)) fail('explicit distinct HTML object/hash pairs required.');
    htmlPairs.set(objectId, hash);
  }
  if (htmlPairs.size !== selection.objects.length || selection.objects.some(item => htmlPairs.get(item.digital_object_id) !== item.sha256)) fail('HTML object/hash binding differs from its manifest.');
  const root = await realpath(corpusRoot);
  const files = new Map();
  const ids = new Set();
  for (const item of selection.objects) {
    if (!/^object:path-[a-f0-9]{64}$/u.test(item.digital_object_id) || ids.has(item.digital_object_id) || !/^[a-f0-9]{64}$/u.test(item.sha256) || files.has(item.sha256) || item.media_type !== 'image/jpeg' || !Number.isSafeInteger(item.byte_size) || item.byte_size < 1 || item.byte_size > MAX_DRAFT_JPEG_BYTES || item.approved_review_id != null || item.review_status === 'accepted') fail('invalid, oversized, duplicate or promoted candidate source.');
    ids.add(item.digital_object_id);
    const source = sources.objects.find(entry => entry.digital_object_id === item.digital_object_id);
    if (!source || source.expected_sha256 !== item.sha256 || source.expected_byte_size !== item.byte_size || source.media_type !== item.media_type || source.association_status !== 'candidate' || source.approved_review_id != null || source.rights?.local_consultation !== 'authorized' || !source.rights?.permitted_uses?.includes('local-private-consultation')) fail('source binding or private consultation permission missing.');
    const path = source.relative_path;
    if (typeof path !== 'string' || !path || isAbsolute(path) || /^[A-Za-z]:/u.test(path) || path.includes('\0') || path.split(/[\\/]/u).some(part => part === '..')) fail('unsafe candidate source path.');
    const lexical = resolve(root, path);
    if (!inside(root, lexical)) fail('source is outside corpus.');
    const file = await realpath(lexical);
    if (!inside(root, file)) fail('source resolves outside corpus.');
    const handle = await open(file, 'r');
    try {
      const info = await handle.stat();
      if (!info.isFile() || info.size !== item.byte_size) fail('candidate JPEG file size differs before read.');
      const bytes = Buffer.alloc(item.byte_size);
      let offset = 0;
      while (offset < bytes.length) {
        const { bytesRead } = await handle.read(bytes, offset, bytes.length - offset, null);
        if (!bytesRead) fail('candidate JPEG shortened during read.');
        offset += bytesRead;
      }
      if ((await handle.read(Buffer.alloc(1), 0, 1, null)).bytesRead) fail('candidate JPEG grew during read.');
      if (sha(bytes) !== item.sha256 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) fail('candidate JPEG bytes differ.');
      files.set(item.sha256, { bytes, size: bytes.length, contentType: 'image/jpeg' });
    } finally { await handle.close(); }
  }
  return files;
}
