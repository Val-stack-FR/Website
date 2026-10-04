import { adaptArchiveExport } from '../archives/render-reader.mjs';

// Join only already selected endpoints, never names, folders or historical persons.
export function readerAllowlist(readerExport, mediaAllowlist) {
  if (mediaAllowlist.manifest_version !== 'atelier-tuce-local-media/1.0.0' ||
      mediaAllowlist.access_tier !== 'project' || mediaAllowlist.publication_status !== 'not-published' ||
      !Array.isArray(mediaAllowlist.objects)) throw new Error('Private media allowlist required.');
  const model = adaptArchiveExport(readerExport);
  const entries = [];
  const seen = new Set();
  for (const dossier of model.dossiers) for (const image of dossier.images) {
    const source = mediaAllowlist.objects.find(item => item.digital_object_id === image.digitalObjectId);
    if (!source || source.view_id !== image.viewId || source.sha256 !== image.sha256 ||
        source.approved_review_id !== image.reviewId || source.bytes_verified !== true ||
        source.source_reading_status !== 'unreviewed') throw new Error('Reader endpoint does not match its verified media allowlist.');
    if (seen.has(image.digitalObjectId)) throw new Error('Ambiguous reader endpoint.');
    seen.add(image.digitalObjectId);
    entries.push({ object_id: image.digitalObjectId, href: `/archives/#${dossier.slug}`, review_id: image.reviewId });
  }
  return { schema_version: 'archives-catalogue-reader-allowlist/0.1.0', entries };
}
