import { existsSync, lstatSync, mkdirSync } from 'node:fs';
import { resolve, join, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PRIVATE_ROOT = fileURLToPath(new URL('../../.archive-corrections-private/', import.meta.url));

export function storePaths(name, create = false, root = PRIVATE_ROOT) {
  if (typeof root !== 'string' || !isAbsolute(root)) throw new Error('Private runtime root must be absolute.');
  if (typeof name !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(name)) {
    throw new Error('Store name must be 1–64 ASCII letters, digits, underscores or hyphens.');
  }
  const directory = resolve(root, name);
  for (const path of [root, directory]) {
    if (existsSync(path) && (!lstatSync(path).isDirectory() || lstatSync(path).isSymbolicLink())) {
      throw new Error('The private runtime directories must be real local directories.');
    }
  }
  if (create) mkdirSync(directory, { recursive: true, mode: 0o700 });
  for (const file of ['corrections.sqlite', 'corrections.sqlite-wal', 'corrections.sqlite-shm', 'export.json', 'owner-auth.json']) {
    const path = join(directory, file);
    if (existsSync(path) && (!lstatSync(path).isFile() || lstatSync(path).isSymbolicLink())) {
      throw new Error('Runtime files must be regular local files.');
    }
  }
  return { directory, database: join(directory, 'corrections.sqlite'), snapshot: join(directory, 'export.json'), credential: join(directory, 'owner-auth.json') };
}
