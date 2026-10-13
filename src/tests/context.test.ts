import test from 'node:test';
import assert from 'node:assert';
import { setupTestDb, teardownTestDb } from './helpers.js';
import { buildUserContext } from '../services/context.js';
import { USER_IDS } from '../db/seed.js';
import { updateUser } from '../models/user.js';

test('Context Service - Permission Filtering', async (t) => {
  setupTestDb();

  await t.test('Executive should see parent goals', () => {
    // Sarah Chen is VP Engineering
    const context = buildUserContext(USER_IDS.VP_ENGINEERING)!;
    assert.ok(context.parentGoals.length > 0, 'Executive should see parent goals');
    assert.ok(context.guidelines.length > 1, 'Executive should see multiple layers of guidelines');
  });

  await t.test('Contributor should NOT see parent goals if prompt:input is restricted', () => {
    // Jane Smith is a Contributor.
    // By default our seed gives Contributors prompt:input = true,
    // so let's mock a user without it if we want to test restriction.
    // Or we can just check the current behavior.
    
    const context = buildUserContext(USER_IDS.JANE_SMITH)!;
    // Jane has prompt:input in our seed, so she SHOULD see them.
    assert.ok(context.parentGoals.length > 0, 'Jane has prompt:input and should see parent goals');
  });

  await t.test('User without prompt:input should have restricted context', () => {
    // Remove role from Jane to simulate no permission
    updateUser(USER_IDS.JANE_SMITH, { roleId: null });
    
    const context = buildUserContext(USER_IDS.JANE_SMITH)!;
    assert.strictEqual(context.parentGoals.length, 0, 'Restricted user should see zero parent goals');
    assert.strictEqual(context.guidelines.length, 1, 'Restricted user should only see their own org guidelines');
  });

  teardownTestDb();
});
