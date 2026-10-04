import { createHash } from 'node:crypto';

const digest = value => createHash('sha256').update(value).digest('hex');

const candidate = literal => literal === null
  ? { literal: null, status: 'unknown' }
  : { literal, status: 'candidate' };

export function inventedRecord(index, overrides = {}) {
  const ordinal = String(index).padStart(5, '0');
  const collectionScope = overrides.collection_scope ?? (index % 7 === 0 ? 'other' : 'clean');
  const collectionType = overrides.collection_type ?? (index % 5 === 0 ? 'scan' : 'photo');
  const priority = overrides.priority ?? (index % 3 === 0 ? 'tuce' : index % 3 === 1 ? 'other-family' : 'unknown');
  const catalogueId = overrides.catalogue_id ?? `file:item-${ordinal}`;
  const fileName = overrides.file_name ?? candidate(`image-inventee-${ordinal}.jpg`);
  const logicalPath = overrides.logical_path ?? `${collectionScope === 'clean' ? 'CLEAN' : 'AUTRE'}/Photos inventées/image-${ordinal}.jpg`;
  const nameCandidates = overrides.name_candidates ?? [];
  const status = overrides.status ?? 'metadata-only';
  const record = {
    catalogue_id: catalogueId,
    sort_key: overrides.sort_key ?? index,
    digital_object_id: overrides.digital_object_id ?? null,
    logical_path: logicalPath,
    file_name: fileName,
    extension: overrides.extension ?? '.jpg',
    size_bytes: overrides.size_bytes ?? index * 101,
    collection_id: overrides.collection_id ?? `collection:${collectionScope}`,
    collection_label: overrides.collection_label ?? (collectionScope === 'clean' ? 'CLEAN inventé' : 'Autre fonds inventé'),
    collection_scope: collectionScope,
    collection_type: collectionType,
    media_type: overrides.media_type ?? 'image/jpeg',
    status,
    priority,
    name_candidates: nameCandidates,
    date_candidate: overrides.date_candidate ?? candidate(null),
    group_candidates: overrides.group_candidates ?? [],
    duplicate_candidate: overrides.duplicate_candidate ?? null,
    transcription: overrides.transcription ?? { status: 'none', version_labels: [] },
    consultation: overrides.consultation ?? { available: false, href: null, approval_id: null },
    interpretation: 'file-not-act',
    provenance: overrides.provenance ?? {
      manifest_record_id: `manifest:item-${ordinal}`,
      discovery_source: 'invented-fixture',
      source_sha256: digest(`invented-source-${ordinal}`),
      hash_freshness: overrides.hash_freshness ?? 'not_provided',
      inventory_observed_at: '2026-10-03T10:00:00Z',
      inventory_modified_at: null
    }
  };
  return record;
}

export function inventedCatalogue(recordCount = 123) {
  const records = Array.from({ length: recordCount }, (_, position) => inventedRecord(position + 1));
  if (recordCount >= 8) {
    records[0] = inventedRecord(1, {
      name_candidates: [{ literal: 'Marie Martin', status: 'candidate', basis: 'Nom inventé dans le libellé.' }],
      date_candidate: candidate('vers 1902'),
      priority: 'tuce'
    });
    records[1] = inventedRecord(2, {
      name_candidates: [{ literal: 'Marie Martin', status: 'candidate', basis: 'Homonyme inventé dans un autre fichier.' }],
      logical_path: 'CLEAN/Photos inventées/homonyme-distinct.jpg',
      priority: 'other-family'
    });
    records[2] = inventedRecord(3, {
      file_name: candidate(null),
      logical_path: 'CLEAN/Photos inventées/entrée-sans-nom-visible.jpg',
      date_candidate: candidate(null),
      status: 'unclassified',
      group_candidates: [{
        candidate_id: 'group:invented-p01',
        label: 'Lot P01 inventé',
        status: 'candidate-unclassified',
        basis: 'Proximité de chemin seulement.'
      }]
    });
    const possibleDuplicate = {
      candidate_set_id: 'duplicate:invented-a',
      status: 'possible-duplicate',
      basis: 'Empreinte inventée commune; occurrences conservées séparément.'
    };
    records[3] = inventedRecord(4, { status: 'duplicate-candidate', duplicate_candidate: possibleDuplicate });
    records[4] = inventedRecord(5, { status: 'duplicate-candidate', duplicate_candidate: possibleDuplicate });
    records[5] = inventedRecord(6, {
      status: 'reader-linked',
      consultation: { available: true, href: '/archives/#carnet-demo', approval_id: 'review:invented-allowlist' },
      transcription: { status: 'preexisting-unvalidated', version_labels: ['texte inventé A'] }
    });
    records[6] = inventedRecord(7, {
      collection_scope: 'other',
      collection_id: 'collection:other',
      collection_label: 'Famille Durand inventée',
      logical_path: 'AUTRE/Famille Durand/portrait.jpg',
      priority: 'other-family'
    });
    records[7] = inventedRecord(8, {
      file_name: candidate('<img src=x onerror=alert(1)>.jpg'),
      name_candidates: [{ literal: '<script>inventé</script>', status: 'candidate', basis: 'Chaîne hostile inventée.' }],
      transcription: { status: 'multiple-unresolved', version_labels: ['version inventée A', 'version inventée B'] }
    });
  }
  return {
    schema_version: 'archives-catalogue-discovery/0.1.0',
    package_id: 'package:invented-catalogue',
    generated_at: '2026-10-03T12:00:00Z',
    source_manifest_sha256: digest('invented-source-manifest'),
    record_count: records.length,
    default_collection_scope: 'clean',
    records,
    limitations: [
      'Jeu inventé: aucun fait historique ni document original.',
      'Les fichiers restent des occurrences; aucun regroupement ne vaut identification.',
      'Les textes associés, lorsqu’ils existent, restent non validés.'
    ]
  };
}

