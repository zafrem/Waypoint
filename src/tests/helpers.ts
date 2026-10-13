import { closeDb, getDb } from '../db/index.js';
import { seedDatabase } from '../db/seed.js';
import { resolve } from 'path';
import { unlinkSync, existsSync } from 'fs';
import Database from 'better-sqlite3';

const TEST_DB_PATH = './northstar-test.db';

export function setupTestDb(): Database.Database {
  // Use a separate test database file
  process.env.NORTHSTAR_DB_PATH = TEST_DB_PATH;
  
  // Ensure we start with a fresh DB
  if (existsSync(TEST_DB_PATH)) {
    unlinkSync(TEST_DB_PATH);
  }
  
  closeDb(); // Reset the cached db instance
  const db = getDb(); // This will create the new test DB and run schema
  seedDatabase(); // Populate with test data
  
  return db;
}

export function teardownTestDb() {
  closeDb();
  if (existsSync(TEST_DB_PATH)) {
    unlinkSync(TEST_DB_PATH);
  }
}
