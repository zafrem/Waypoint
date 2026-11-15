import test from 'node:test';
import assert from 'node:assert';
import { existsSync, unlinkSync } from 'fs';
import Database from 'better-sqlite3';
import { closeDb, getDb } from '../db/index.js';
import { setupTestDb, teardownTestDb } from './helpers.js';
import { GOAL_IDS, ORG_IDS, USER_IDS } from '../db/seed.js';
import {
  createGoal,
  currentPeriods,
  deleteGoal,
  filterCurrentGoals,
  getGoalById,
  getGoalsByOrgId,
  updateGoal,
} from '../models/goal.js';
import { createWebServer } from '../web/index.js';
import { createSession } from '../models/webSession.js';
import { buildUserContext, formatUserContext } from '../services/context.js';
import { getParentGoals } from '../mcp/tools/getParentGoals.js';
import { searchCollaboratorGoals } from '../mcp/tools/searchCollaboratorGoals.js';

const { year, quarter } = currentPeriods();

test('Goal periods - validation and parent link', async (t) => {
  setupTestDb();
  const base = { orgId: ORG_IDS.ENTERPRISE_SALES };

  await t.test('annual and quarterly goals can be created; parent link is optional', () => {
    const annual = createGoal({ ...base, title: 'A', periodType: 'annual', period: '2031' });
    const withParent = createGoal({ ...base, title: 'Q', periodType: 'quarterly', period: '2031-q2', parentGoalId: annual.id });
    const standalone = createGoal({ ...base, title: 'Q2', periodType: 'quarterly', period: '2031-Q2' });
    assert.strictEqual(withParent.period, '2031-Q2', 'period is normalised to upper case');
    assert.strictEqual(withParent.parentGoalId, annual.id);
    assert.strictEqual(standalone.parentGoalId, null);
  });

  await t.test('goals without a period stay ongoing', () => {
    const g = createGoal({ ...base, title: 'Ongoing' });
    assert.strictEqual(g.periodType, null);
    assert.strictEqual(g.period, null);
  });

  await t.test('malformed or inconsistent periods are rejected', () => {
    assert.throws(() => createGoal({ ...base, title: 'x', periodType: 'annual', period: '2026-Q1' }), /year/);
    assert.throws(() => createGoal({ ...base, title: 'x', periodType: 'quarterly', period: '2026' }), /2026-Q3/);
    assert.throws(() => createGoal({ ...base, title: 'x', periodType: 'quarterly', period: '2026-Q5' }), /2026-Q3/);
    assert.throws(() => createGoal({ ...base, title: 'x', periodType: 'annual' }), /needs a period/);
    assert.throws(() => createGoal({ ...base, title: 'x', period: '2026' }), /period type/);
  });

  await t.test('parent must be an existing annual goal and only quarterly goals can have one', () => {
    const quarterly = createGoal({ ...base, title: 'Q', periodType: 'quarterly', period: '2031-Q1' });
    assert.throws(
      () => createGoal({ ...base, title: 'x', periodType: 'quarterly', period: '2031-Q2', parentGoalId: quarterly.id }),
      /not an annual goal/
    );
    assert.throws(
      () => createGoal({ ...base, title: 'x', periodType: 'quarterly', period: '2031-Q2', parentGoalId: 'nope' }),
      /not found/
    );
    assert.throws(
      () => createGoal({ ...base, title: 'x', periodType: 'annual', period: '2031', parentGoalId: GOAL_IDS.MARKET_LEADERSHIP }),
      /Only quarterly/
    );
    assert.throws(() => updateGoal(quarterly.id, { parentGoalId: quarterly.id }), /not an annual goal|itself/);
  });

  await t.test('updates keep fields that are not mentioned and can clear the parent', () => {
    const g = createGoal({ ...base, title: 'U', periodType: 'quarterly', period: '2031-Q3', parentGoalId: GOAL_IDS.MARKET_LEADERSHIP });
    assert.strictEqual(updateGoal(g.id, { title: 'U2' })!.parentGoalId, GOAL_IDS.MARKET_LEADERSHIP);
    assert.strictEqual(updateGoal(g.id, { parentGoalId: null })!.parentGoalId, null);
    assert.strictEqual(getGoalById(g.id)!.period, '2031-Q3');
  });

  await t.test('deleting or retyping an annual goal unlinks its quarterly goals', () => {
    const a1 = createGoal({ ...base, title: 'A1', periodType: 'annual', period: '2032' });
    const a2 = createGoal({ ...base, title: 'A2', periodType: 'annual', period: '2032' });
    const q1 = createGoal({ ...base, title: 'Q1', periodType: 'quarterly', period: '2032-Q1', parentGoalId: a1.id });
    const q2 = createGoal({ ...base, title: 'Q2', periodType: 'quarterly', period: '2032-Q1', parentGoalId: a2.id });
    assert.ok(deleteGoal(a1.id));
    assert.strictEqual(getGoalById(q1.id)!.parentGoalId, null);
    updateGoal(a2.id, { periodType: 'quarterly', period: '2032-Q1' });
    assert.strictEqual(getGoalById(q2.id)!.parentGoalId, null);
  });

  teardownTestDb();
});

test('Goal periods - only the current period is shown by default', async (t) => {
  setupTestDb();

  await t.test('filterCurrentGoals works for a given date', () => {
    const goals = getGoalsByOrgId(ORG_IDS.ENTERPRISE_SALES);
    const later = filterCurrentGoals(goals, new Date(year + 1 + '-02-10T12:00:00'));
    assert.ok(!later.some((g) => g.period === quarter), 'this quarter is hidden a year later');
    assert.ok(later.some((g) => !g.period), 'ongoing goals always stay');
  });

  await t.test('context lists current goals, links them to the annual goal, and hides past quarters', () => {
    const context = buildUserContext(USER_IDS.ENTERPRISE_LEAD)!;
    const titles = context.currentGoals.map((g) => g.title);
    assert.ok(titles.includes('Close 10 Enterprise Deals This Quarter'));
    assert.ok(titles.includes('Refresh Sales Onboarding Playbook'));
    assert.ok(!titles.includes('Launch Partner Referral Pilot'), 'past quarter hidden');
    const text = formatUserContext(context);
    assert.match(text, new RegExp(`Supports annual goal: \\*\\*Achieve Market Leadership\\*\\* \\(${year}\\)`));
    assert.match(text, new RegExp(`${quarter}, 40%`));
  });

  await t.test('tools hide past quarters unless asked', () => {
    process.env.WAYPOINT_USER_ID = USER_IDS.ENTERPRISE_LEAD;
    const hidden = searchCollaboratorGoals({ keyword: 'Referral Pilot' });
    assert.strictEqual(hidden.data!.length, 0);
    const shown = searchCollaboratorGoals({ keyword: 'Referral Pilot', include_past_periods: true });
    assert.strictEqual(shown.data!.length, 1);
    assert.strictEqual(shown.data![0].supportsGoalId, GOAL_IDS.MARKET_LEADERSHIP);

    const parents = getParentGoals({ org_id: ORG_IDS.ENTERPRISE_SALES });
    const acme = parents.data!.find((p) => p.organization.id === ORG_IDS.ACME_CORP)!;
    assert.strictEqual(acme.goals.find((g) => g.id === GOAL_IDS.MARKET_LEADERSHIP)!.period, `${year} annual`);
  });

  teardownTestDb();
});

test('Goal periods - existing databases gain the period columns', () => {
  const path = './waypoint-period-migration-test.db';
  if (existsSync(path)) unlinkSync(path);

  const old = new Database(path);
  old.exec(`
    CREATE TABLE organizations (id TEXT PRIMARY KEY, parent_id TEXT, name TEXT NOT NULL, description TEXT, ai_guidelines TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE goals (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, owner_id TEXT, title TEXT NOT NULL, description TEXT, key_results TEXT, standards TEXT, status TEXT NOT NULL DEFAULT 'not_started', progress INTEGER NOT NULL DEFAULT 0, visibility TEXT NOT NULL DEFAULT 'public', created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
    INSERT INTO organizations (id, name) VALUES ('o1', 'Old Org');
    INSERT INTO goals (id, org_id, title) VALUES ('g1', 'o1', 'Old goal');
  `);
  old.close();

  try {
    process.env.WAYPOINT_DB_PATH = path;
    closeDb();
    getDb();
    const old = getGoalById('g1')!;
    assert.strictEqual(old.period, null);
    assert.strictEqual(old.parentGoalId, null);
    const annual = createGoal({ orgId: 'o1', title: 'New', periodType: 'annual', period: '2026' });
    assert.strictEqual(updateGoal('g1', { periodType: 'quarterly', period: '2026-Q1', parentGoalId: annual.id })!.parentGoalId, annual.id);
  } finally {
    closeDb();
    for (const f of [path, `${path}-wal`, `${path}-shm`]) if (existsSync(f)) unlinkSync(f);
  }
});

test('Goal periods - admin goal form and list', async (t) => {
  setupTestDb();
  const server = await createWebServer();
  const headers = {
    cookie: `waypoint_session=${createSession(USER_IDS.ADMIN).token}`,
    'content-type': 'application/x-www-form-urlencoded',
  };
  const body = (fields: Record<string, string>) => new URLSearchParams(fields).toString();

  await t.test('creating a quarterly goal with an annual parent through the form', async () => {
    const res = await server.inject({
      method: 'POST', url: '/admin/goals', headers,
      payload: body({
        title: 'Form Quarterly', orgId: ORG_IDS.ENGINEERING, periodType: 'quarterly',
        period: '2027-Q1', parentGoalId: GOAL_IDS.MARKET_LEADERSHIP,
      }),
    });
    assert.strictEqual(res.statusCode, 302);
    const created = getGoalsByOrgId(ORG_IDS.ENGINEERING).find((g) => g.title === 'Form Quarterly')!;
    assert.strictEqual(created.period, '2027-Q1');
    assert.strictEqual(created.parentGoalId, GOAL_IDS.MARKET_LEADERSHIP);
  });

  await t.test('a bad period shows an error and creates nothing', async () => {
    const res = await server.inject({
      method: 'POST', url: '/admin/goals', headers,
      payload: body({ title: 'Bad Period', orgId: ORG_IDS.ENGINEERING, periodType: 'quarterly', period: 'Q3' }),
    });
    assert.strictEqual(res.statusCode, 200);
    assert.match(res.body, /must look like 2026-Q3/);
    assert.ok(!getGoalsByOrgId(ORG_IDS.ENGINEERING).some((g) => g.title === 'Bad Period'));
  });

  await t.test('the form offers annual goals and the list can be filtered by period', async () => {
    const formPage = await server.inject({ method: 'GET', url: '/admin/goals/create', headers });
    assert.match(formPage.body, new RegExp(`${year} - Achieve Market Leadership`));

    const list = await server.inject({ method: 'GET', url: `/admin/goals?period=${quarter}`, headers });
    assert.match(list.body, /Close 10 Enterprise Deals This Quarter/);
    assert.match(list.body, /supports: Achieve Market Leadership/);
    assert.doesNotMatch(list.body, /Launch Partner Referral Pilot/);
  });

  await server.close();
  teardownTestDb();
});
