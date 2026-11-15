import test from 'node:test';
import assert from 'node:assert';
import { setupTestDb, teardownTestDb } from './helpers.js';
import { ORG_IDS, USER_IDS } from '../db/seed.js';
import { createGoal, formatStandardsText, parseStandardsText, updateGoal } from '../models/goal.js';
import { getParticipant } from '../models/participant.js';
import { updateOrganization } from '../models/organization.js';
import { updateUser } from '../models/user.js';
import { buildUserContext, formatUserContext } from '../services/context.js';
import { lookupStandards } from '../mcp/tools/lookupStandards.js';
import { searchCollaboratorGoals } from '../mcp/tools/searchCollaboratorGoals.js';
import { semanticSearch } from '../mcp/tools/semanticSearch.js';
import { submitQuestion } from '../mcp/tools/submitQuestion.js';
import { createWebServer } from '../web/index.js';
import { createSession } from '../models/webSession.js';

const cookie = (userId: string) => ({ cookie: `waypoint_session=${createSession(userId).token}` });
const form = { 'content-type': 'application/x-www-form-urlencoded' };
const body = (fields: Record<string, string>) => new URLSearchParams(fields).toString();

test('Terminology & Coding Standards - parsing, inheritance, MCP tool, and Web UI', async (t) => {
  setupTestDb();

  await t.test('parseStandardsText supports both 3-column and 4-column (with identifier) formats', () => {
    const parsed = parseStandardsText(
      [
        'term | Member Serial | membersrl | Unique identifier for a customer, consisting of 8 to 16 digits.',
        'function | Validate Member Serial | isValidMemberSrl(membersrl) | Returns true if membersrl is 8-16 digits.',
        'template | PR template | Summary, test plan, risks',
      ].join('\n')
    );
    assert.strictEqual(parsed.length, 3);
    assert.deepStrictEqual(parsed[0], {
      type: 'term',
      name: 'Member Serial',
      identifier: 'membersrl',
      content: 'Unique identifier for a customer, consisting of 8 to 16 digits.',
    });
    assert.deepStrictEqual(parsed[1], {
      type: 'function',
      name: 'Validate Member Serial',
      identifier: 'isValidMemberSrl(membersrl)',
      content: 'Returns true if membersrl is 8-16 digits.',
    });
    assert.deepStrictEqual(parsed[2], {
      type: 'template',
      name: 'PR template',
      content: 'Summary, test plan, risks',
    });

    const formatted = formatStandardsText(JSON.stringify(parsed));
    assert.match(formatted, /term \| Member Serial \| membersrl \| Unique identifier/);
    assert.match(formatted, /template \| PR template \| Summary, test plan, risks/);
  });

  await t.test('organization and goal standards are inherited into user context', () => {
    updateOrganization(ORG_IDS.ENGINEERING, {
      standards: [
        {
          type: 'variable',
          name: 'Request Trace ID',
          identifier: 'trace_id',
          content: 'UUID v4 propagated across all internal RPC calls.',
        },
      ],
    });
    createGoal({
      orgId: ORG_IDS.PLATFORM_TEAM,
      ownerId: USER_IDS.PLATFORM_LEAD,
      title: 'Standardize Telemetry',
      standards: [
        {
          type: 'metadata',
          name: 'Service Region',
          identifier: 'svc_region',
          content: 'Lowercase cloud region code (e.g. ap-northeast-2).',
        },
      ],
    });

    // Jane Smith is in Platform Team -> Engineering -> Acme Corp
    const ctx = buildUserContext(USER_IDS.JANE_SMITH)!;
    const identifiers = ctx.standards.map((s) => s.identifier);
    assert.ok(identifiers.includes('membersrl'), 'inherits company-wide Member Serial (membersrl)');
    assert.ok(identifiers.includes('isValidMemberSrl(membersrl)'), 'inherits company-wide function');
    assert.ok(identifiers.includes('trace_id'), 'inherits department-level variable');
    assert.ok(identifiers.includes('svc_region'), 'includes team goal metadata standard');

    const text = formatUserContext(ctx);
    assert.match(text, /## Terminology & Coding Standards/);
    assert.match(text, /\*\*Member Serial\*\* \(`membersrl`\): Unique identifier for a customer/);
    assert.match(text, /\*\*Validate Member Serial\*\* \(`isValidMemberSrl\(membersrl\)`\)/);
    assert.match(text, /\*\*Request Trace ID\*\* \(`trace_id`\)/);
    assert.match(text, /\*\*Service Region\*\* \(`svc_region`\)/);
  });

  await t.test('lookup_standards tool filters by query (name, identifier, or description) and type', () => {
    process.env.WAYPOINT_USER_ID = USER_IDS.JANE_SMITH;

    const byIdentifier = lookupStandards({ query: 'membersrl' });
    assert.strictEqual(byIdentifier.success, true);
    assert.strictEqual(byIdentifier.data!.length, 2);

    const byType = lookupStandards({ type: 'function' });
    assert.strictEqual(byType.success, true);
    assert.strictEqual(byType.data!.length, 1);
    assert.strictEqual(byType.data![0].identifier, 'isValidMemberSrl(membersrl)');

    const byTermName = lookupStandards({ query: 'Member Serial', type: 'term' });
    assert.strictEqual(byTermName.success, true);
    assert.strictEqual(byTermName.data!.length, 1);
    assert.strictEqual(byTermName.data![0].identifier, 'membersrl');

    // Respects MCP disabled flag
    updateUser(USER_IDS.JANE_SMITH, { mcpDisabled: true });
    assert.deepStrictEqual(lookupStandards({ query: 'membersrl' }), {
      success: false,
      error: 'Not available.',
    });
    updateUser(USER_IDS.JANE_SMITH, { mcpDisabled: false });
  });

  await t.test('web UI allows admins to edit organization standards and renders them on the organization page', async () => {
    const server = await createWebServer();
    try {
      const admin = cookie(USER_IDS.ADMIN);
      const save = await server.inject({
        method: 'POST',
        url: `/organizations/${ORG_IDS.PRODUCT}`,
        headers: { ...admin, ...form },
        payload: body({
          name: 'Product Department',
          description: 'Defines product strategy',
          standards: 'term | Order Number | ordno | 12-character alphanumeric order key.',
        }),
      });
      assert.strictEqual(save.statusCode, 302);

      const view = await server.inject({
        method: 'GET',
        url: `/organizations/${ORG_IDS.PRODUCT}`,
        headers: cookie(USER_IDS.JANE_SMITH),
      });
      assert.strictEqual(view.statusCode, 200);
      assert.match(view.body, /Order Number/);
      assert.match(view.body, /<code>ordno<\/code>/);
      assert.match(view.body, /12-character alphanumeric order key/);
    } finally {
      await server.close();
    }
  });

  await t.test('search_collaborator_goals includes descendant orgs, semantic_search matches short keywords, and submit_question hides private goals', () => {
    // VP Engineering (org-engineering) searches child team goals (org-platform, org-frontend)
    process.env.WAYPOINT_USER_ID = USER_IDS.VP_ENGINEERING;
    const collab = searchCollaboratorGoals({ keyword: 'Infrastructure' });
    assert.strictEqual(collab.success, true);
    assert.ok(collab.data!.some((g) => g.title.includes('Infrastructure as Code')), 'VP Eng finds child org goal');

    // Executive (CEO) uses semantic_search with 3-char keyword ("SLA" / "IaC") found in keyResults
    process.env.WAYPOINT_USER_ID = USER_IDS.CEO;
    const sem = semanticSearch({ query: 'SLA' });
    assert.strictEqual(sem.success, true);
    assert.ok(sem.results!.some((r) => r.title.includes('Build World-Class Engineering')), '3-char keyword SLA matches keyResults');

    // Private goal in Product cannot be probed via submit_question by Platform Team member
    const privateGoal = createGoal({
      orgId: ORG_IDS.PRODUCT,
      ownerId: USER_IDS.VP_PRODUCT,
      title: 'Stealth Acquisition',
      visibility: 'private',
    });
    process.env.WAYPOINT_USER_ID = USER_IDS.JANE_SMITH;
    const q = submitQuestion({ goal_id: privateGoal.id, question: 'When does this launch?' });
    assert.strictEqual(q.success, false);
    assert.match(q.error!, /not found/);

    // Progress validation & owner participant backfill
    assert.throws(() => updateGoal(privateGoal.id, { progress: 150 }), /Progress must be a number between 0 and 100/);
    updateGoal(privateGoal.id, { ownerId: USER_IDS.UX_LEAD, progress: 50 });
    assert.strictEqual(getParticipant(privateGoal.id, USER_IDS.UX_LEAD)?.role, 'driver');
  });

  teardownTestDb();
});
