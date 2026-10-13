import test from 'node:test';
import assert from 'node:assert';
import Database from 'better-sqlite3';
import { existsSync, unlinkSync } from 'fs';
import { setupTestDb, teardownTestDb } from './helpers.js';
import { closeDb, getDb } from '../db/index.js';
import { USER_IDS, ORG_IDS } from '../db/seed.js';
import { updateUser, getUserById } from '../models/user.js';
import { updateOrganization, getOrganizationById } from '../models/organization.js';
import { getCurrentUserResource } from '../mcp/resources/currentUser.js';
import { getAskWithContextPrompt } from '../mcp/prompts/askWithContext.js';
import { getParentGoals } from '../mcp/tools/getParentGoals.js';
import { searchCollaboratorGoals } from '../mcp/tools/searchCollaboratorGoals.js';
import { semanticSearch } from '../mcp/tools/semanticSearch.js';
import { submitQuestion } from '../mcp/tools/submitQuestion.js';
import { getGoalsByOrgId } from '../models/goal.js';
import { getUserMcpStatus, getOrganizationMcpStatus } from '../services/mcpAccess.js';
import { createMcpServer } from '../mcp/index.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { CURRENT_USER_RESOURCE_URI } from '../mcp/resources/currentUser.js';

async function connectClient() {
  const server = createMcpServer();
  const client = new Client({ name: 'test', version: '1.0.0' });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  return { client, close: () => client.close() };
}

function callAllTools(userId: string) {
  process.env.WAYPOINT_USER_ID = userId;
  const goal = getGoalsByOrgId(ORG_IDS.ACME_CORP)[0];
  return {
    parent: getParentGoals({ org_id: ORG_IDS.PLATFORM_TEAM }),
    search: searchCollaboratorGoals({ keyword: 'engineering' }),
    semantic: semanticSearch({ query: 'market leadership' }),
    question: submitQuestion({ goal_id: goal.id, question: 'Does this affect us?' }),
  };
}

test('MCP access control - disabling per user and organization', async (t) => {
  setupTestDb();

  await t.test('is enabled by default', () => {
    process.env.WAYPOINT_USER_ID = USER_IDS.PLATFORM_LEAD;
    const resource = getCurrentUserResource()!;
    assert.strictEqual(resource.mimeType, 'text/markdown');
    assert.match(resource.text, /Developer Velocity/);
    assert.strictEqual(getUserById(USER_IDS.PLATFORM_LEAD)!.mcpDisabled, false);
    assert.strictEqual(getOrganizationById(ORG_IDS.ENGINEERING)!.mcpDisabled, false);
  });

  await t.test('a disabled user gets no context and every tool refuses', () => {
    updateUser(USER_IDS.PLATFORM_LEAD, { mcpDisabled: true });
    process.env.WAYPOINT_USER_ID = USER_IDS.PLATFORM_LEAD;

    // No context at all, and no explanation either.
    assert.strictEqual(getCurrentUserResource()!.text, '');

    const prompt = getAskWithContextPrompt({ question: 'hi' });
    assert.strictEqual(prompt.messages[0].content.text, 'hi');

    for (const [name, result] of Object.entries(callAllTools(USER_IDS.PLATFORM_LEAD))) {
      assert.strictEqual(result.success, false, `${name} should refuse`);
      assert.strictEqual(result.error, 'Not available.', name);
    }
    assert.strictEqual(getUserMcpStatus(getUserById(USER_IDS.PLATFORM_LEAD)!).disabled, true);
  });

  await t.test('other users are unaffected', () => {
    process.env.WAYPOINT_USER_ID = USER_IDS.JANE_SMITH;
    assert.match(getCurrentUserResource()!.text, /Developer Velocity/);
    const result = callAllTools(USER_IDS.CEO);
    assert.strictEqual(result.semantic.success, true);
    assert.strictEqual(result.parent.success, true);
  });

  await t.test('re-enabling restores access', () => {
    updateUser(USER_IDS.PLATFORM_LEAD, { mcpDisabled: false });
    process.env.WAYPOINT_USER_ID = USER_IDS.PLATFORM_LEAD;
    assert.match(getCurrentUserResource()!.text, /Developer Velocity/);
  });

  await t.test('disabling an organization disables its users and sub-organizations', () => {
    updateOrganization(ORG_IDS.ENGINEERING, { mcpDisabled: true });

    // Platform Team is a child of Engineering; neither it nor Jane has a flag of its own.
    assert.strictEqual(getOrganizationById(ORG_IDS.PLATFORM_TEAM)!.mcpDisabled, false);
    assert.strictEqual(getUserById(USER_IDS.JANE_SMITH)!.mcpDisabled, false);

    process.env.WAYPOINT_USER_ID = USER_IDS.JANE_SMITH;
    assert.strictEqual(getCurrentUserResource()!.text, '');

    for (const [name, result] of Object.entries(callAllTools(USER_IDS.JANE_SMITH))) {
      assert.strictEqual(result.success, false, `${name} should refuse`);
      assert.strictEqual(result.error, 'Not available.', name);
    }

    const status = getOrganizationMcpStatus(getOrganizationById(ORG_IDS.PLATFORM_TEAM)!);
    assert.deepStrictEqual(status, { disabled: true, source: 'inherited', orgName: 'Engineering Department' });
  });

  await t.test('users outside the disabled organization are unaffected', () => {
    // Acme Corp (parent) and Sales (sibling) stay enabled.
    process.env.WAYPOINT_USER_ID = USER_IDS.CEO;
    assert.match(getCurrentUserResource()!.text, /Market Leadership/);
    process.env.WAYPOINT_USER_ID = USER_IDS.ENTERPRISE_LEAD;
    assert.match(getCurrentUserResource()!.text, /Strategic Accounts/);
    assert.strictEqual(
      getOrganizationMcpStatus(getOrganizationById(ORG_IDS.ACME_CORP)!).disabled,
      false
    );
  });

  await t.test('over the protocol: a disabled user is offered nothing and calls fail as unknown', async () => {
    process.env.WAYPOINT_USER_ID = USER_IDS.JANE_SMITH; // Engineering is still disabled here
    const { client, close } = await connectClient();
    try {
      assert.deepStrictEqual((await client.listResources()).resources, []);
      assert.deepStrictEqual((await client.listPrompts()).prompts, []);
      assert.deepStrictEqual((await client.listTools()).tools, []);
      await assert.rejects(client.readResource({ uri: CURRENT_USER_RESOURCE_URI }), /Unknown resource/);
      await assert.rejects(client.getPrompt({ name: 'ask_with_context' }), /Unknown prompt/);
      await assert.rejects(
        client.callTool({ name: 'search_collaborator_goals', arguments: { keyword: 'x' } }),
        /Unknown tool/
      );
    } finally {
      await close();
    }
  });

  await t.test('over the protocol: an enabled user still gets everything', async () => {
    process.env.WAYPOINT_USER_ID = USER_IDS.CEO;
    const { client, close } = await connectClient();
    try {
      assert.strictEqual((await client.listResources()).resources.length, 1);
      assert.strictEqual((await client.listPrompts()).prompts.length, 1);
      assert.strictEqual((await client.listTools()).tools.length, 4);
      const read = await client.readResource({ uri: CURRENT_USER_RESOURCE_URI });
      assert.match(JSON.stringify(read.contents[0]), /Market Leadership/);
    } finally {
      await close();
    }
  });

  await t.test('access follows the flag without restarting the server', async () => {
    process.env.WAYPOINT_USER_ID = USER_IDS.CEO;
    const { client, close } = await connectClient();
    try {
      assert.strictEqual((await client.listTools()).tools.length, 4);
      updateUser(USER_IDS.CEO, { mcpDisabled: true });
      assert.deepStrictEqual((await client.listTools()).tools, []);
      updateUser(USER_IDS.CEO, { mcpDisabled: false });
      assert.strictEqual((await client.listTools()).tools.length, 4);
    } finally {
      await close();
    }
  });

  await t.test('re-enabling the organization restores its users', () => {
    updateOrganization(ORG_IDS.ENGINEERING, { mcpDisabled: false });
    process.env.WAYPOINT_USER_ID = USER_IDS.JANE_SMITH;
    assert.match(getCurrentUserResource()!.text, /Developer Velocity/);
  });

  teardownTestDb();
});

test('MCP access control - existing databases gain the mcp_disabled columns', () => {
  const path = './waypoint-migration-test.db';
  if (existsSync(path)) unlinkSync(path);

  // Build a database as an older version would have: no mcp_disabled columns.
  const old = new Database(path);
  old.exec(`
    CREATE TABLE organizations (id TEXT PRIMARY KEY, parent_id TEXT, name TEXT NOT NULL, description TEXT, ai_guidelines TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE users (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, role_id TEXT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, job_function TEXT, is_admin INTEGER NOT NULL DEFAULT 0, is_leader INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
    INSERT INTO organizations (id, name) VALUES ('o1', 'Old Org');
    INSERT INTO users (id, org_id, name, email) VALUES ('u1', 'o1', 'Old User', 'old@example.com');
  `);
  old.close();

  try {
    process.env.WAYPOINT_DB_PATH = path;
    closeDb();
    getDb();
    assert.strictEqual(getOrganizationById('o1')!.mcpDisabled, false);
    assert.strictEqual(getUserById('u1')!.mcpDisabled, false);
    updateUser('u1', { mcpDisabled: true });
    assert.strictEqual(getUserById('u1')!.mcpDisabled, true);
  } finally {
    closeDb();
    for (const f of [path, `${path}-wal`, `${path}-shm`]) if (existsSync(f)) unlinkSync(f);
  }
});
