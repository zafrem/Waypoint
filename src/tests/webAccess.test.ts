import test from 'node:test';
import assert from 'node:assert';
import { setupTestDb, teardownTestDb } from './helpers.js';
import { createWebServer } from '../web/index.js';
import { createSession } from '../models/webSession.js';
import { USER_IDS, ORG_IDS } from '../db/seed.js';
import { getUserById, deleteUser } from '../models/user.js';
import { getOrganizationById } from '../models/organization.js';
import { createGoal, deleteGoal, getGoalById } from '../models/goal.js';
import { createComment } from '../models/comment.js';
import { exportToJson, importFromJson } from '../db/json-data.js';

const cookie = (userId: string) => ({ cookie: `waypoint_session=${createSession(userId).token}` });
const form = { 'content-type': 'application/x-www-form-urlencoded' };

test('Web UI - user and organization edit routes are admin-only', async (t) => {
  setupTestDb();
  const server = await createWebServer();
  const admin = cookie(USER_IDS.ADMIN);
  const jane = cookie(USER_IDS.JANE_SMITH); // a regular, non-admin user

  const userPath = `/users/${USER_IDS.CEO}`;
  const orgPath = `/organizations/${ORG_IDS.ENGINEERING}`;

  await t.test('anonymous requests are sent to the login page', async () => {
    for (const url of [`${userPath}/edit`, `${orgPath}/edit`]) {
      const res = await server.inject({ method: 'GET', url });
      assert.strictEqual(res.statusCode, 302, url);
      assert.match(String(res.headers.location), /\/auth\/login/);
    }
  });

  await t.test('non-admins cannot open the edit pages', async () => {
    for (const url of [`${userPath}/edit`, `${orgPath}/edit`]) {
      const res = await server.inject({ method: 'GET', url, headers: jane });
      assert.strictEqual(res.statusCode, 403, url);
    }
  });

  await t.test('non-admins cannot save changes, and nothing changes', async () => {
    const userBefore = getUserById(USER_IDS.CEO)!;
    const orgBefore = getOrganizationById(ORG_IDS.ENGINEERING)!;

    const u = await server.inject({
      method: 'POST', url: userPath, headers: { ...jane, ...form },
      payload: 'name=Hacked&email=hacked%40example.com&mcpDisabled=1',
    });
    const o = await server.inject({
      method: 'POST', url: orgPath, headers: { ...jane, ...form },
      payload: 'name=Hacked&mcpDisabled=1',
    });
    assert.strictEqual(u.statusCode, 403);
    assert.strictEqual(o.statusCode, 403);

    const userAfter = getUserById(USER_IDS.CEO)!;
    const orgAfter = getOrganizationById(ORG_IDS.ENGINEERING)!;
    assert.strictEqual(userAfter.name, userBefore.name);
    assert.strictEqual(userAfter.email, userBefore.email);
    assert.strictEqual(userAfter.mcpDisabled, false);
    assert.strictEqual(orgAfter.name, orgBefore.name);
    assert.strictEqual(orgAfter.mcpDisabled, false);
  });

  await t.test('non-admins can still browse, without Edit links', async () => {
    for (const url of ['/users', '/organizations', userPath, orgPath]) {
      const res = await server.inject({ method: 'GET', url, headers: jane });
      assert.strictEqual(res.statusCode, 200, url);
      assert.doesNotMatch(res.body, /\/edit"/, `${url} should not link to an edit page`);
    }
  });

  await t.test('admins can open the edit pages and see the links', async () => {
    for (const url of [`${userPath}/edit`, `${orgPath}/edit`]) {
      const res = await server.inject({ method: 'GET', url, headers: admin });
      assert.strictEqual(res.statusCode, 200, url);
      assert.match(res.body, /name="mcpDisabled"/);
    }
    const list = await server.inject({ method: 'GET', url: '/users', headers: admin });
    assert.match(list.body, /\/edit"/);
  });

  await t.test('admins can save changes, including the MCP flag', async () => {
    const u = await server.inject({
      method: 'POST', url: userPath, headers: { ...admin, ...form },
      payload: 'name=Alex+Johnson&email=alex.johnson%40acme.com&mcpDisabled=1',
    });
    const o = await server.inject({
      method: 'POST', url: orgPath, headers: { ...admin, ...form },
      payload: 'name=Engineering+Department&mcpDisabled=1',
    });
    assert.strictEqual(u.statusCode, 302);
    assert.strictEqual(o.statusCode, 302);
    assert.strictEqual(getUserById(USER_IDS.CEO)!.mcpDisabled, true);
    assert.strictEqual(getOrganizationById(ORG_IDS.ENGINEERING)!.mcpDisabled, true);

    // An unchecked box is simply absent from the form, which turns the flag off again.
    await server.inject({
      method: 'POST', url: userPath, headers: { ...admin, ...form },
      payload: 'name=Alex+Johnson&email=alex.johnson%40acme.com',
    });
    await server.inject({
      method: 'POST', url: orgPath, headers: { ...admin, ...form },
      payload: 'name=Engineering+Department',
    });
    assert.strictEqual(getUserById(USER_IDS.CEO)!.mcpDisabled, false);
    assert.strictEqual(getOrganizationById(ORG_IDS.ENGINEERING)!.mcpDisabled, false);
  });

  await t.test('settings modification is admin-only', async () => {
    const resNonAdmin = await server.inject({
      method: 'POST', url: '/settings', headers: { ...jane, ...form },
      payload: 'key=test_key&value=test_val',
    });
    assert.strictEqual(resNonAdmin.statusCode, 403);

    const resAdmin = await server.inject({
      method: 'POST', url: '/settings', headers: { ...admin, ...form },
      payload: 'key=test_key&value=test_val',
    });
    assert.strictEqual(resAdmin.statusCode, 302);
  });

  await t.test('admin goal edit page renders organization and owner names instead of Unknown', async () => {
    const g = createGoal({
      orgId: ORG_IDS.ENGINEERING,
      ownerId: USER_IDS.VP_ENGINEERING,
      title: 'Check Edit Labels',
    });
    const res = await server.inject({
      method: 'GET', url: `/admin/goals/${g.id}/edit`, headers: admin,
    });
    assert.strictEqual(res.statusCode, 200);
    assert.match(res.body, /Engineering Department/);
    assert.match(res.body, /Sarah Chen/);

    // Deleting a goal with comments succeeds without FK errors
    createComment({ goalId: g.id, authorId: USER_IDS.JANE_SMITH, content: 'A question?' });
    assert.strictEqual(deleteGoal(g.id), true);
    assert.strictEqual(getGoalById(g.id), null);
  });

  await t.test('deleting a user with goals, sessions, or participations succeeds without FK errors', () => {
    assert.strictEqual(deleteUser(USER_IDS.SMB_LEAD), true);
    assert.strictEqual(getUserById(USER_IDS.SMB_LEAD), null);
  });

  await t.test('invalid session cookie on /auth/login clears cookie and renders login instead of redirect loop', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/auth/login',
      headers: { cookie: 'waypoint_session=invalid_or_expired_token' },
    });
    assert.strictEqual(res.statusCode, 200);
    assert.match(res.body, /Sign in to continue/);
  });

  await t.test('exportToJson and importFromJson preserve roles, roleId, and organization standards', () => {
    const exported = exportToJson();
    assert.ok(exported.data.roles && exported.data.roles.length > 0);
    const ceoBefore = getUserById(USER_IDS.CEO)!;
    assert.strictEqual(ceoBefore.roleId, 'role-executive');

    // Re-import over existing DB (even with active web_sessions / user_preferences)
    importFromJson(exported, { clearExisting: true, preserveTimestamps: true });

    const ceoAfter = getUserById(USER_IDS.CEO)!;
    assert.strictEqual(ceoAfter.roleId, 'role-executive');
    const acmeAfter = getOrganizationById(ORG_IDS.ACME_CORP)!;
    assert.ok(acmeAfter.standards && acmeAfter.standards.includes('membersrl'));
  });

  await server.close();
  teardownTestDb();
});
