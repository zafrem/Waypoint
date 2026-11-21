import test from 'node:test';
import assert from 'node:assert';
import { unlinkSync, existsSync } from 'fs';
import { closeDb, getDb } from '../db/index.js';
import { bootstrapAdmin, bootstrapFromEnv, needsBootstrap } from '../db/bootstrap.js';
import { getUserByEmail } from '../models/user.js';
import { buildUserContext } from '../services/context.js';

const DB = './waypoint-bootstrap-test.db';

test('First-run bootstrap creates the initial admin once', async (t) => {
  process.env.WAYPOINT_DB_PATH = DB;
  if (existsSync(DB)) unlinkSync(DB);
  closeDb();
  getDb(); // empty database, schema only

  await t.test('empty instance needs bootstrap; invalid email is rejected', () => {
    assert.strictEqual(needsBootstrap(), true);
    assert.throws(() => bootstrapAdmin({ email: 'nope' }), /valid admin email/);
  });

  await t.test('creates roles, a root organization and an admin who can build MCP context', () => {
    const result = bootstrapAdmin({ email: ' Boss@Example.com ', name: 'Boss', orgName: 'Globex' });
    assert.ok(result);
    assert.strictEqual(result.organization.name, 'Globex');
    assert.strictEqual(result.admin.email, 'boss@example.com');
    assert.strictEqual(result.admin.isAdmin, true);
    assert.strictEqual(getUserByEmail('boss@example.com')?.id, result.admin.id);
    assert.ok(buildUserContext(result.admin.id));
  });

  await t.test('is a no-op once a user exists, including via env', () => {
    assert.strictEqual(needsBootstrap(), false);
    assert.strictEqual(bootstrapAdmin({ email: 'second@example.com' }), null);
    process.env.WAYPOINT_ADMIN_EMAIL = 'third@example.com';
    assert.strictEqual(bootstrapFromEnv(), null);
    delete process.env.WAYPOINT_ADMIN_EMAIL;
    assert.strictEqual(getUserByEmail('second@example.com'), null);
  });

  closeDb();
  if (existsSync(DB)) unlinkSync(DB);
  for (const ext of ['-wal', '-shm']) if (existsSync(DB + ext)) unlinkSync(DB + ext);
});
