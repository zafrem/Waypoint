import test from 'node:test';
import assert from 'node:assert';
import { setupTestDb, teardownTestDb } from './helpers.js';
import { hasPermission } from '../rbac/permissions.js';
import { getUserById } from '../models/user.js';
import { USER_IDS } from '../db/seed.js';


test('RBAC - Permission Logic', async (t) => {
  setupTestDb();

  await t.test('Executive should have full prompt access', () => {
    const ceo = getUserById(USER_IDS.CEO)!;
    assert.strictEqual(hasPermission(ceo, 'SELF', 'prompt:input'), true);
    assert.strictEqual(hasPermission(ceo, 'SELF', 'prompt:output'), true);
    assert.strictEqual(hasPermission(ceo, 'SELF', 'vector:search'), true);
  });

  await t.test('Contributor should have limited prompt access', () => {
    const jane = getUserById(USER_IDS.JANE_SMITH)!;
    assert.strictEqual(hasPermission(jane, 'SELF', 'prompt:input'), true);
    assert.strictEqual(hasPermission(jane, 'SELF', 'prompt:output'), false);
    assert.strictEqual(hasPermission(jane, 'SELF', 'vector:search'), false);
  });

  await t.test('Admin should bypass all checks', () => {
    const admin = getUserById(USER_IDS.ADMIN)!;
    assert.strictEqual(hasPermission(admin, 'NONE', 'prompt:output'), true);
    assert.strictEqual(hasPermission(admin, 'NONE', 'vector:search'), true);
  });

  await t.test('Relationship-based goals access', () => {
    const jane = getUserById(USER_IDS.JANE_SMITH)!;
    // Jane is in Platform Team (Child of Engineering)
    // SELF access to goals
    assert.strictEqual(hasPermission(jane, 'SELF', 'goal:read'), true);
    // PARENT access to goals
    assert.strictEqual(hasPermission(jane, 'PARENT', 'goal:read'), true);
  });

  teardownTestDb();
});
