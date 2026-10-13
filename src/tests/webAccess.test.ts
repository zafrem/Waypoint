import test from 'node:test';
import assert from 'node:assert';
import { setupTestDb, teardownTestDb } from './helpers.js';
import { createWebServer } from '../web/index.js';
import { createSession } from '../models/webSession.js';
import { USER_IDS, ORG_IDS } from '../db/seed.js';
import { getUserById } from '../models/user.js';
import { getOrganizationById } from '../models/organization.js';

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

  await server.close();
  teardownTestDb();
});
