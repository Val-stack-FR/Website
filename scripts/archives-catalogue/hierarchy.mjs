import { createHash } from 'node:crypto';
import {
  CATALOGUE_CONTRACT, COLLECTION_TYPES, MAX_PAGE_SIZE, MAX_RECORDS,
  PRIORITIES, RECORD_STATUSES, normalizeSearch
} from './contract.mjs';

const CONTRACT = 'archives-catalogue-hierarchy/0.1.0';
const ROOT = 'CLEAN';
const collator = new Intl.Collator('fr', { numeric: true, sensitivity: 'variant' });
const ensure = (condition, message) => { if (!condition) throw new Error(message); };
const exactCompare = (left, right) => left === right ? 0 : left < right ? -1 : 1;
const folderId = path => `folder:${createHash('sha256').update(path, 'utf8').digest('hex')}`;

const partsFor = (path, label) => {
  ensure(typeof path === 'string' && path.length > 0 && path.length <= 1200, `${label} must be a bounded logical path.`);
  ensure(!/[\\:\u0000-\u001f\u007f]/u.test(path), `${label} must be a forward-slash logical path.`);
  ensure(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(path), `${label} contains invalid Unicode.`);
  const parts = path.split('/');
  ensure(parts.every(part => part && part !== '.' && part !== '..'), `${label} contains an unsafe segment.`);
  ensure(parts[0] === ROOT, `${label} must stay within exact CLEAN scope.`);
  return parts;
};

const comparePaths = (left, right) => collator.compare(left.split('/').at(-1), right.split('/').at(-1)) || exactCompare(left, right);
const descriptor = (node, matched = node.descendantFileCount) => ({
  folderId: node.folderId,
  logicalPath: node.logicalPath,
  name: node.name,
  parentPath: node.parentPath,
  descendantFileCount: node.descendantFileCount,
  directFileCount: node.files.length,
  childFolderCount: node.childPaths.length,
  matchedDescendantFileCount: matched
});

/** Build exact folder membership from the prepared camelCase contract, CLEAN only.
 * Folder IDs hash the exact UTF-8 logical path: no case/Unicode/name normalization.
 * Candidate groups, historical dates and filename similarities never create folders.
 */
export function buildCatalogueHierarchy(model) {
  ensure(model && model.schemaVersion === CATALOGUE_CONTRACT && Array.isArray(model.records) && model.records.length <= MAX_RECORDS, 'A prepared catalogue model is required.');
  const folders = new Map();
  const records = [];
  const searchIndex = new Map();
  const seenIds = new Set();
  const ensureFolder = path => {
    if (!folders.has(path)) {
      const parts = path.split('/');
      folders.set(path, {
        folderId: folderId(path), logicalPath: path, name: parts.at(-1),
        parentPath: parts.length === 1 ? null : parts.slice(0, -1).join('/'),
        descendantFileCount: 0, childPaths: [], childPathSet: new Set(), files: []
      });
    }
    return folders.get(path);
  };
  ensureFolder(ROOT);
  for (const record of model.records) {
    ensure(record && ['clean', 'other'].includes(record.collectionScope), 'A prepared record collectionScope is required.');
    if (record.collectionScope !== 'clean') continue;
    const parts = partsFor(record.logicalPath, 'record.logicalPath');
    ensure(parts.length >= 2, 'record.logicalPath must include a file below CLEAN.');
    ensure(typeof record.catalogueId === 'string' && !seenIds.has(record.catalogueId), 'Duplicate or invalid CLEAN catalogueId.');
    seenIds.add(record.catalogueId);
    for (let depth = 1; depth < parts.length; depth += 1) {
      const path = parts.slice(0, depth).join('/');
      const node = ensureFolder(path);
      node.descendantFileCount += 1;
      if (node.parentPath !== null) {
        const parent = ensureFolder(node.parentPath);
        if (!parent.childPathSet.has(path)) {
          parent.childPathSet.add(path);
          parent.childPaths.push(path);
        }
      }
    }
    folders.get(parts.slice(0, -1).join('/')).files.push(record);
    records.push(record);
    searchIndex.set(record.catalogueId, normalizeSearch([
      record.logicalPath, record.fileName?.literal ?? '',
      ...(record.names ?? []).map(name => name.literal),
      record.collectionType, record.status, record.priority
    ].join(' ')));
  }
  for (const node of folders.values()) {
    node.childPaths.sort(comparePaths);
    node.files.sort((left, right) => comparePaths(left.logicalPath, right.logicalPath) || exactCompare(left.catalogueId, right.catalogueId));
  }
  return { contractVersion: CONTRACT, model, rootPath: ROOT, rootId: folderId(ROOT), folders, records, searchIndex };
}

const integerParameter = (value, label, fallback, maximum) => {
  if (value === undefined || value === null || value === '') return fallback;
  ensure((typeof value === 'number' && Number.isSafeInteger(value)) || (typeof value === 'string' && /^\d+$/u.test(value)), `${label} must be an integer.`);
  const number = Number(value);
  ensure(Number.isSafeInteger(number) && number >= 1 && number <= maximum, `${label} must be between 1 and ${maximum}.`);
  return number;
};

/** Query one exact folder. Entries are immediate matching folders, then direct files.
 * A folder survives filters iff at least one descendant file matches every filter.
 * Pagination is shared by both entry kinds; folders/records only contain this page.
 */
export function queryCatalogueHierarchy(hierarchy, parameters = {}) {
  ensure(hierarchy?.contractVersion === CONTRACT && hierarchy.folders instanceof Map, 'A catalogue hierarchy is required.');
  ensure(parameters && typeof parameters === 'object' && !Array.isArray(parameters), 'parameters must be an object.');
  const allowed = new Set(['query', 'folder', 'page', 'page_size', 'priority', 'status', 'collection_type', 'collection_scope']);
  ensure(Object.keys(parameters).every(key => allowed.has(key)), 'Unsupported hierarchy parameter.');
  ensure(parameters.collection_scope === undefined || parameters.collection_scope === null || parameters.collection_scope === '' || parameters.collection_scope === 'clean', 'collection_scope must remain clean.');
  const rawQuery = parameters.query ?? '';
  ensure(typeof rawQuery === 'string' && rawQuery.length <= 100, 'query must be a string of at most 100 characters.');
  const query = normalizeSearch(rawQuery);
  const path = parameters.folder === undefined || parameters.folder === null || parameters.folder === '' ? ROOT : parameters.folder;
  const selectedParts = partsFor(path, 'folder');
  const selected = hierarchy.folders.get(path);
  ensure(selected, 'Unknown folder logical path.');
  const priority = parameters.priority ?? '';
  const status = parameters.status ?? '';
  const collectionType = parameters.collection_type ?? '';
  for (const [label, value, values] of [['priority', priority, PRIORITIES], ['status', status, RECORD_STATUSES], ['collection_type', collectionType, COLLECTION_TYPES]]) {
    ensure(typeof value === 'string' && (value === '' || values.includes(value)), `${label} is unsupported.`);
  }
  const page = integerParameter(parameters.page, 'page', 1, MAX_RECORDS);
  const pageSize = integerParameter(parameters.page_size, 'page_size', 20, MAX_PAGE_SIZE);
  const matchedIds = new Set();
  const matchedCounts = new Map();
  for (const record of hierarchy.records) {
    if ((priority && record.priority !== priority) || (status && record.status !== status) || (collectionType && record.collectionType !== collectionType)) continue;
    if (query && !hierarchy.searchIndex.get(record.catalogueId).includes(query)) continue;
    matchedIds.add(record.catalogueId);
    const parts = record.logicalPath.split('/');
    for (let depth = 1; depth < parts.length; depth += 1) {
      const parentPath = parts.slice(0, depth).join('/');
      matchedCounts.set(parentPath, (matchedCounts.get(parentPath) ?? 0) + 1);
    }
  }
  const matchedFolders = selected.childPaths.filter(childPath => (matchedCounts.get(childPath) ?? 0) > 0);
  const matchedFiles = selected.files.filter(record => matchedIds.has(record.catalogueId));
  const units = [
    ...matchedFolders.map(childPath => ({ kind: 'folder', folder: descriptor(hierarchy.folders.get(childPath), matchedCounts.get(childPath)) })),
    ...matchedFiles.map(record => ({ kind: 'file', record }))
  ];
  const offset = (page - 1) * pageSize;
  const entries = units.slice(offset, offset + pageSize);
  const model = hierarchy.model;
  return {
    contract_version: CONTRACT,
    package: { package_id: model.packageId, generated_at: model.generatedAt, source_manifest_sha256: model.sourceManifestSha256, input_sha256: model.inputSha256, limitations: model.limitations },
    filters: { query, folder: path, collection_scope: 'clean', priority, status, collection_type: collectionType },
    selected_folder: descriptor(selected, matchedCounts.get(path) ?? 0),
    breadcrumbs: selectedParts.map((_, index) => {
      const parentPath = selectedParts.slice(0, index + 1).join('/');
      return descriptor(hierarchy.folders.get(parentPath), matchedCounts.get(parentPath) ?? 0);
    }),
    counts: {
      clean_image_files: hierarchy.records.length,
      descendant_image_files: selected.descendantFileCount,
      matched_image_files: matchedCounts.get(path) ?? 0,
      child_folders: selected.childPaths.length,
      files: selected.files.length,
      matched_child_folders: matchedFolders.length,
      matched_files: matchedFiles.length,
      matched_entries: units.length
    },
    pagination: { page, page_size: pageSize, page_count: Math.max(1, Math.ceil(units.length / pageSize)), returned_entries: entries.length },
    entries,
    folders: entries.filter(entry => entry.kind === 'folder').map(entry => entry.folder),
    records: entries.filter(entry => entry.kind === 'file').map(entry => entry.record)
  };
}
