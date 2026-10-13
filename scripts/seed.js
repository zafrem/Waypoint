#!/usr/bin/env node

import { seedDatabase } from '../dist/db/seed.js';
import { closeDb } from '../dist/db/index.js';

console.log('Seeding Waypoint database...');

try {
  seedDatabase();
  console.log('Done!');
} catch (error) {
  console.error('Error seeding database:', error);
  process.exit(1);
} finally {
  closeDb();
}
