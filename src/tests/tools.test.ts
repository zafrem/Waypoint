import test from 'node:test';
import assert from 'node:assert';
import { setupTestDb, teardownTestDb } from './helpers.js';
import { semanticSearch } from '../mcp/tools/semanticSearch.js';
import { USER_IDS, ORG_IDS, ROLE_IDS } from '../db/seed.js';
import { createGoal } from '../models/goal.js';
import { updateUser } from '../models/user.js';

test('MCP Tools - Semantic Search Security', async (t) => {
  setupTestDb();

  await t.test('Executive should be allowed to search all goals', () => {
    process.env.NORTHSTAR_USER_ID = USER_IDS.CEO;
    const result = semanticSearch({ query: 'market leadership' });
    assert.strictEqual(result.success, true);
    assert.ok(result.results!.length > 0);
  });

  await t.test('Contributor should be denied if role lacks vector:search', () => {
    process.env.NORTHSTAR_USER_ID = USER_IDS.JANE_SMITH;
    const result = semanticSearch({ query: 'any' });
    assert.strictEqual(result.success, false);
    assert.match(result.error!, /permission/);
  });

  await t.test('Search results should filter out unauthorized goals', () => {
    // Create a private goal in HR for CEO
    createGoal({
      orgId: ORG_IDS.HR_TEAM,
      ownerId: USER_IDS.HR_LEAD,
      title: 'Secret HR Goal',
      description: 'Confidential project',
      visibility: 'private'
    });

    // Jane (Platform Team) should NOT see HR goals
    process.env.NORTHSTAR_USER_ID = USER_IDS.JANE_SMITH;
    
    // Temporarily give Jane permission to search to test filtering
    updateUser(USER_IDS.JANE_SMITH, { roleId: 'role-executive' }); // Give her exec role for this test
    
    const result = semanticSearch({ query: 'secret' });
    const hasSecret = result.results?.some(r => r.title.includes('Secret'));
    assert.strictEqual(hasSecret, false, 'Contributor should not see private goals from other teams even with search permission');
  });

  teardownTestDb();
});
