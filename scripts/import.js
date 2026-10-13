#!/usr/bin/env node

import { resolve } from 'path';
import { existsSync } from 'fs';
import { loadFromJsonFile } from '../dist/db/json-data.js';
import { closeDb } from '../dist/db/index.js';

const inputPath = resolve(process.cwd(), 'waypoint-data.json');

console.log('Importing Waypoint data from JSON...');

try {
  if (!existsSync(inputPath)) {
    console.error(`File not found: ${inputPath}`);
    process.exit(1);
  }

  loadFromJsonFile(inputPath);
  console.log(`Imported from: ${inputPath}`);
} catch (error) {
  console.error('Error importing data:', error);
  process.exit(1);
} finally {
  closeDb();
}
