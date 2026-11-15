import test from 'node:test';
import assert from 'node:assert';
import { setupTestDb, teardownTestDb } from './helpers.js';
import { GOAL_IDS, ORG_IDS, USER_IDS } from '../db/seed.js';
import { createGoal, deleteGoal } from '../models/goal.js';
import { addParticipant, getParticipant, getParticipantsByGoalId, removeParticipant, setPlan } from '../models/participant.js';
import { getGrayAreasByGoalId, raiseGrayArea, resolveGrayArea } from '../models/grayArea.js';
import { updateUser } from '../models/user.js';
import { buildUserContext, formatUserContext } from '../services/context.js';
import {
  getGoalPlans,
  raiseGrayAreaTool,
  resolveGrayAreaTool,
  updateMyPlan,
} from '../mcp/tools/goalPlans.js';
import { semanticSearch } from '../mcp/tools/semanticSearch.js';
import { searchCollaboratorGoals } from '../mcp/tools/searchCollaboratorGoals.js';
import { getParentGoals } from '../mcp/tools/getParentGoals.js';
import { createWebServer } from '../web/index.js';
import { createSession } from '../models/webSession.js';

const DEALS = GOAL_IDS.ENTERPRISE_DEALS;
const as = (userId: string) => {
  process.env.WAYPOINT_USER_ID = userId;
};
const cookie = (userId: string) => ({ cookie: `waypoint_session=${createSession(userId).token}` });
const form = { 'content-type': 'application/x-www-form-urlencoded' };
const body = (fields: Record<string, string>) => new URLSearchParams(fields).toString();

const SMB_PLAN = 'Route upsell-ready SMB customers';

test('Execution plans - model', async (t) => {
  setupTestDb();

  await t.test('the goal owner is a driver by default', () => {
    assert.strictEqual(getParticipant(DEALS, USER_IDS.ENTERPRISE_LEAD)!.role, 'driver');
  });

  await t.test('only participants have a plan, and an empty plan clears it', () => {
    assert.strictEqual(setPlan(DEALS, USER_IDS.JANE_SMITH, 'sneaky'), null);
    assert.strictEqual(getParticipant(DEALS, USER_IDS.JANE_SMITH), null);
    const cleared = setPlan(DEALS, USER_IDS.SMB_LEAD, '   ')!;
    assert.strictEqual(cleared.plan, null);
    setPlan(DEALS, USER_IDS.SMB_LEAD, `${SMB_PLAN} once they pass 200 seats.`);
  });

  await t.test('re-adding a participant changes the role but keeps the plan', () => {
    addParticipant(DEALS, USER_IDS.SMB_LEAD, 'driver');
    const p = getParticipant(DEALS, USER_IDS.SMB_LEAD)!;
    assert.strictEqual(p.role, 'driver');
    assert.match(p.plan!, /Route upsell-ready/);
    addParticipant(DEALS, USER_IDS.SMB_LEAD, 'contributor');
  });

  await t.test('gray areas open and can be resolved once', () => {
    const open = getGrayAreasByGoalId(DEALS, 'open');
    assert.strictEqual(open.length, 1);
    assert.strictEqual(open[0].planUserId, USER_IDS.SMB_LEAD);
    assert.throws(() => raiseGrayArea({ goalId: DEALS, authorId: USER_IDS.VP_SALES, content: '  ' }), /unclear/);
    const done = resolveGrayArea(open[0].id, USER_IDS.ENTERPRISE_LEAD, 'Only new logos count.')!;
    assert.strictEqual(done.status, 'resolved');
    assert.strictEqual(resolveGrayArea(open[0].id, USER_IDS.ENTERPRISE_LEAD, 'again'), null);
    assert.throws(() => resolveGrayArea(open[0].id, USER_IDS.ENTERPRISE_LEAD, ' '), /clarified/);
  });

  await t.test('deleting a goal removes its participants and gray areas', () => {
    const g = createGoal({ orgId: ORG_IDS.ENTERPRISE_SALES, ownerId: USER_IDS.ENTERPRISE_LEAD, title: 'Temp' });
    raiseGrayArea({ goalId: g.id, authorId: USER_IDS.ENTERPRISE_LEAD, content: 'q' });
    assert.ok(deleteGoal(g.id));
    assert.strictEqual(getParticipantsByGoalId(g.id).length, 0);
    assert.strictEqual(getGrayAreasByGoalId(g.id).length, 0);
  });

  teardownTestDb();
});

test('Execution plans - only people on the same goal see them', async (t) => {
  setupTestDb();

  await t.test('participants see each other’s plans and the open gray areas in their context', () => {
    const text = formatUserContext(buildUserContext(USER_IDS.SMB_LEAD)!);
    assert.match(text, /Goals You Work On/);
    assert.match(text, /Close 10 Enterprise Deals/);
    assert.match(text, /Your plan:\*\* Route upsell-ready/);
    assert.match(text, /Focus on the 15 accounts/);
    assert.match(text, /count toward the 10 enterprise deals/);
  });

  await t.test('someone not on the goal gets none of it in their context', () => {
    for (const id of [USER_IDS.JANE_SMITH, USER_IDS.HR_LEAD, USER_IDS.CEO]) {
      const text = formatUserContext(buildUserContext(id)!);
      assert.doesNotMatch(text, /Focus on the 15 accounts/, id);
      assert.doesNotMatch(text, /Route upsell-ready/, id);
      assert.doesNotMatch(text, /count toward the 10 enterprise deals/, id);
    }
  });

  await t.test('get_goal_plans: participants and admins read; others get "not found"', () => {
    as(USER_IDS.VP_SALES);
    const ok = getGoalPlans({ goal_id: DEALS });
    assert.strictEqual(ok.success, true);
    assert.match(JSON.stringify(ok.data), /Focus on the 15 accounts/);

    as(USER_IDS.ADMIN);
    assert.strictEqual(getGoalPlans({ goal_id: DEALS }).success, true);

    as(USER_IDS.JANE_SMITH);
    const denied = getGoalPlans({ goal_id: DEALS });
    const missing = getGoalPlans({ goal_id: 'no-such-goal' });
    assert.strictEqual(denied.success, false);
    assert.strictEqual(denied.error, `Goal with ID "${DEALS}" not found.`);
    assert.strictEqual(missing.error, 'Goal with ID "no-such-goal" not found.');
    assert.doesNotMatch(JSON.stringify(denied), /Focus on the 15/);
  });

  await t.test('no other tool leaks plan text to someone outside the goal', () => {
    updateUser(USER_IDS.JANE_SMITH, { roleId: 'role-executive' }); // allow search tools to run
    as(USER_IDS.JANE_SMITH);
    const outputs = [
      JSON.stringify(semanticSearch({ query: 'enterprise deals' })),
      JSON.stringify(searchCollaboratorGoals({ keyword: 'Enterprise', include_past_periods: true })),
      JSON.stringify(getParentGoals({ org_id: ORG_IDS.ENTERPRISE_SALES, include_past_periods: true })),
    ];
    for (const out of outputs) {
      assert.doesNotMatch(out, /Focus on the 15 accounts|Route upsell-ready|count toward the 10/);
    }
  });

  await t.test('update_my_plan, raise_gray_area, resolve_gray_area need participation', () => {
    as(USER_IDS.JANE_SMITH);
    assert.strictEqual(updateMyPlan({ goal_id: DEALS, plan: 'x' }).success, false);
    assert.strictEqual(raiseGrayAreaTool({ goal_id: DEALS, question: 'x' }).success, false);
    const open = getGrayAreasByGoalId(DEALS, 'open')[0];
    assert.strictEqual(resolveGrayAreaTool({ gray_area_id: open.id, resolution: 'x' }).success, false);
    assert.strictEqual(getGrayAreasByGoalId(DEALS, 'open').length, 1, 'nothing changed');

    as(USER_IDS.SMB_LEAD);
    assert.strictEqual(updateMyPlan({ goal_id: DEALS, plan: 'Updated SMB plan' }).success, true);
    assert.strictEqual(getParticipant(DEALS, USER_IDS.SMB_LEAD)!.plan, 'Updated SMB plan');
    const raised = raiseGrayAreaTool({ goal_id: DEALS, question: 'Who owns renewals?', plan_user_id: USER_IDS.ENTERPRISE_LEAD });
    assert.strictEqual(raised.success, true);
    assert.strictEqual(raiseGrayAreaTool({ goal_id: DEALS, question: 'x', plan_user_id: USER_IDS.HR_LEAD }).success, false);
    assert.strictEqual(resolveGrayAreaTool({ gray_area_id: open.id, resolution: 'Only new logos.' }).success, true);
    assert.strictEqual(resolveGrayAreaTool({ gray_area_id: open.id, resolution: 'again' }).success, false);
  });

  await t.test('a removed participant loses access', () => {
    removeParticipant(DEALS, USER_IDS.SMB_LEAD);
    as(USER_IDS.SMB_LEAD);
    assert.strictEqual(getGoalPlans({ goal_id: DEALS }).success, false);
    assert.doesNotMatch(formatUserContext(buildUserContext(USER_IDS.SMB_LEAD)!), /Focus on the 15 accounts/);
  });

  await t.test('a user with MCP disabled gets nothing from the plan tools', () => {
    updateUser(USER_IDS.ENTERPRISE_LEAD, { mcpDisabled: true });
    as(USER_IDS.ENTERPRISE_LEAD);
    assert.deepStrictEqual(getGoalPlans({ goal_id: DEALS }), { success: false, error: 'Not available.' });
    updateUser(USER_IDS.ENTERPRISE_LEAD, { mcpDisabled: false });
  });

  teardownTestDb();
});

test('Execution plans - web page', async (t) => {
  setupTestDb();
  const server = await createWebServer();
  const page = (userId: string) => server.inject({ method: 'GET', url: `/goals/${DEALS}`, headers: cookie(userId) });

  await t.test('participants and admins see the plans; others see only the objective', async () => {
    for (const id of [USER_IDS.SMB_LEAD, USER_IDS.VP_SALES, USER_IDS.ADMIN]) {
      const res = await page(id);
      assert.strictEqual(res.statusCode, 200, id);
      assert.match(res.body, /Focus on the 15 accounts/, id);
    }
    const jane = await page(USER_IDS.JANE_SMITH);
    assert.strictEqual(jane.statusCode, 200);
    assert.match(jane.body, /Close 10 Enterprise Deals/);
    assert.doesNotMatch(jane.body, /Focus on the 15 accounts|Route upsell-ready|count toward the 10/);
    assert.match(jane.body, /shared only with the people working on this goal/);
  });

  await t.test('a participant edits only their own plan', async () => {
    const own = await server.inject({
      method: 'POST', url: `/goals/${DEALS}/plan`, headers: { ...cookie(USER_IDS.SMB_LEAD), ...form },
      payload: body({ plan: 'New plan <script>alert(1)</script>' }),
    });
    assert.strictEqual(own.statusCode, 302);
    assert.strictEqual(getParticipant(DEALS, USER_IDS.SMB_LEAD)!.plan, 'New plan <script>alert(1)</script>');
    assert.strictEqual(getParticipant(DEALS, USER_IDS.ENTERPRISE_LEAD)!.plan?.slice(0, 5), 'Focus', 'others untouched');

    const outsider = await server.inject({
      method: 'POST', url: `/goals/${DEALS}/plan`, headers: { ...cookie(USER_IDS.JANE_SMITH), ...form },
      payload: body({ plan: 'hijack' }),
    });
    assert.strictEqual(outsider.statusCode, 403);
    assert.strictEqual(getParticipant(DEALS, USER_IDS.JANE_SMITH), null);
  });

  await t.test('plan text is escaped in the page', async () => {
    const res = await page(USER_IDS.ENTERPRISE_LEAD);
    assert.doesNotMatch(res.body, /<script>alert\(1\)<\/script>/);
    assert.match(res.body, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  });

  await t.test('gray areas: participants raise and resolve, outsiders cannot', async () => {
    const outsider = await server.inject({
      method: 'POST', url: `/goals/${DEALS}/gray-areas`, headers: { ...cookie(USER_IDS.JANE_SMITH), ...form },
      payload: body({ content: 'hi' }),
    });
    assert.strictEqual(outsider.statusCode, 403);

    const before = getGrayAreasByGoalId(DEALS).length;
    const raise = await server.inject({
      method: 'POST', url: `/goals/${DEALS}/gray-areas`, headers: { ...cookie(USER_IDS.ENTERPRISE_LEAD), ...form },
      payload: body({ content: 'Is the $2M gross or net?' }),
    });
    assert.strictEqual(raise.statusCode, 302);
    assert.strictEqual(getGrayAreasByGoalId(DEALS).length, before + 1);

    const target = getGrayAreasByGoalId(DEALS, 'open')[0];
    const noPerm = await server.inject({
      method: 'POST', url: `/goals/${DEALS}/gray-areas/${target.id}/resolve`, headers: { ...cookie(USER_IDS.JANE_SMITH), ...form },
      payload: body({ resolution: 'x' }),
    });
    assert.strictEqual(noPerm.statusCode, 403);
    const res = await server.inject({
      method: 'POST', url: `/goals/${DEALS}/gray-areas/${target.id}/resolve`, headers: { ...cookie(USER_IDS.VP_SALES), ...form },
      payload: body({ resolution: 'Net.' }),
    });
    assert.strictEqual(res.statusCode, 302);
    assert.strictEqual(getGrayAreasByGoalId(DEALS, 'open').some((g) => g.id === target.id), false);
  });

  await t.test('only the owner or an admin manages participants', async () => {
    const post = (userId: string) =>
      server.inject({
        method: 'POST', url: `/goals/${DEALS}/participants`, headers: { ...cookie(userId), ...form },
        payload: body({ userId: USER_IDS.QA_LEAD, role: 'contributor' }),
      });
    assert.strictEqual((await post(USER_IDS.SMB_LEAD)).statusCode, 403);
    assert.strictEqual(getParticipant(DEALS, USER_IDS.QA_LEAD), null);
    assert.strictEqual((await post(USER_IDS.ENTERPRISE_LEAD)).statusCode, 302);
    assert.ok(getParticipant(DEALS, USER_IDS.QA_LEAD));

    const removeOwner = await server.inject({
      method: 'POST', url: `/goals/${DEALS}/participants/${USER_IDS.ENTERPRISE_LEAD}/remove`,
      headers: { ...cookie(USER_IDS.ADMIN), ...form },
    });
    assert.match(String(removeOwner.headers.location), /error=/);
    assert.ok(getParticipant(DEALS, USER_IDS.ENTERPRISE_LEAD), 'owner stays');
  });

  await server.close();
  teardownTestDb();
});
