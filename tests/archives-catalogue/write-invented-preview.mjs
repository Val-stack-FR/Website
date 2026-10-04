import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { inventedCatalogue } from './fixtures/invented-catalogue.mjs';

const output = resolve(process.argv[2] ?? '.private/catalogue-preview/invented-catalogue.json');
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(inventedCatalogue())}\n`, 'utf8');
console.log(output);

