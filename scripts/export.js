#!/usr/bin/env node

import { resolve } from 'path';
import { saveToJsonFile } from '../dist/db/json-data.js';
import { closeDb } from '../dist/db/index.js';

const outputPath = resolve(process.cwd(), 'waypoint-data.json');

console.log('Exporting Waypoint database to JSON...');

try {
  saveToJsonFile(outputPath);
  console.log(`Exported to: ${outputPath}`);
} catch (error) {
  console.error('Error exporting database:', error);
  process.exit(1);
} finally {
  closeDb();
}
