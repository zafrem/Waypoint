import { UserContext, Organization, Goal, GoalWork, InheritedStandard, Standard } from '../models/types.js';
import { getGrayAreasByGoalId } from '../models/grayArea.js';
import { getParticipantsByGoalId, getParticipationsByUserId } from '../models/participant.js';
import { getUserById } from '../models/user.js';
import { getOrganizationById, getOrganizationPath } from '../models/organization.js';
import { canViewGoal } from './planAccess.js';
import {
  filterCurrentGoals,
  getGoalById,
  getGoalsByOrgId,
  getGoalsByOrgIds,
  parseStandards,
  periodLabel,
} from '../models/goal.js';
import { hasPermission } from '../rbac/permissions.js';

/**
 * Collect all standards (terms, variables, metadata fields, functions, templates, documents)
 * inherited along the user's organization hierarchy (root to leaf) and active goals.
 */
export function collectInheritedStandards(
  orgPath: Organization[],
  goals: Goal[]
): InheritedStandard[] {
  const result: InheritedStandard[] = [];
  const orgNameById = new Map(orgPath.map((o) => [o.id, o.name]));

  for (const org of orgPath) {
    for (const s of parseStandards(org.standards)) {
      result.push({
        ...s,
        sourceOrgId: org.id,
        sourceOrgName: org.name,
      });
    }
  }

  for (const goal of goals) {
    const sourceOrgName = orgNameById.get(goal.orgId) || getOrganizationById(goal.orgId)?.name || 'Unknown';
    for (const s of parseStandards(goal.standards)) {
      result.push({
        ...s,
        sourceOrgId: goal.orgId,
        sourceOrgName,
        sourceGoalId: goal.id,
        sourceGoalTitle: goal.title,
      });
    }
  }

  return result;
}

/**
 * Build a complete user context for the MCP resource.
 * This aggregates all relevant information for the AI assistant.
 */
export function buildUserContext(userId: string): UserContext | null {
  const user = getUserById(userId);
  if (!user) {
    return null;
  }

  const organization = getOrganizationById(user.orgId);
  if (!organization) {
    return null;
  }

  // Check if user has permission to access prompt input context
  // Relationship to self is always 'SELF'
  const hasPromptInput = hasPermission(user, 'SELF', 'prompt:input');

  // Get the full path from root to user's organization
  const orgPath = getOrganizationPath(user.orgId);

  // Get current goals (from user's organization)
  // Always allowed for own org
  // Only this year's / this quarter's goals (plus ongoing ones); past periods stay out of the context
  const currentGoals = filterCurrentGoals(getGoalsByOrgId(user.orgId));

  // Get parent goals (from all ancestor organizations)
  // ONLY include if user has prompt:input permission OR is an executive
  let parentGoals: Goal[] = [];
  if (hasPromptInput) {
    const parentOrgIds = orgPath
      .filter((org) => org.id !== user.orgId)
      .map((org) => org.id);
    parentGoals = filterCurrentGoals(getGoalsByOrgIds(parentOrgIds)).filter((g) =>
      canViewGoal(user, g)
    );
  }

  // Collect all AI guidelines from the org path (root to leaf)
  // Filter based on prompt:input permission
  const allowedOrgs = hasPromptInput ? orgPath : [organization];
  const guidelines = allowedOrgs
    .map((org) => org.aiGuidelines)
    .filter((g): g is string => g !== null && g.trim() !== '');

  const standards = collectInheritedStandards(allowedOrgs, [...parentGoals, ...currentGoals]);

  return {
    user,
    organization,
    orgPath,
    currentGoals,
    parentGoals,
    guidelines,
    standards,
    work: buildWork(user.id),
  };
}

/**
 * The goals this user works on, with the execution plans of everyone on the same goal and the
 * gray areas still open. Goals the user is not on contribute nothing here.
 */
function buildWork(userId: string): GoalWork[] {
  const goals: Goal[] = [];
  for (const p of getParticipationsByUserId(userId)) {
    const goal = getGoalById(p.goalId);
    if (goal) goals.push(goal);
  }
  return filterCurrentGoals(goals)
    .filter((goal) => goals.includes(goal))
    .map((goal) => ({
      goal,
      participants: getParticipantsByGoalId(goal.id).flatMap((p) => {
        const person = getUserById(p.userId);
        return person ? [{ user: person, role: p.role, plan: p.plan }] : [];
      }),
      openGrayAreas: getGrayAreasByGoalId(goal.id, 'open').map((g) => ({
        ...g,
        authorName: getUserById(g.authorId)?.name ?? 'Unknown',
        planUserName: g.planUserId ? (getUserById(g.planUserId)?.name ?? 'Unknown') : null,
      })),
    }));
}

/**
 * Format user context as a human-readable string for AI consumption.
 */
export function formatUserContext(context: UserContext): string {
  const parts: string[] = [];

  // User info
  parts.push(`## User Profile`);
  parts.push(`- **Name:** ${context.user.name}`);
  parts.push(`- **Email:** ${context.user.email}`);
  if (context.user.jobFunction) {
    parts.push(`- **Role:** ${context.user.jobFunction}`);
  }
  parts.push('');

  // Organization hierarchy
  parts.push(`## Organization`);
  parts.push(`- **Current Team:** ${context.organization.name}`);
  if (context.organization.description) {
    parts.push(`- **Description:** ${context.organization.description}`);
  }
  const pathNames = context.orgPath.map((o) => o.name).join(' → ');
  parts.push(`- **Hierarchy:** ${pathNames}`);
  parts.push('');

  // Current goals
  if (context.currentGoals.length > 0) {
    parts.push(`## Current Team Goals`);
    for (const goal of context.currentGoals) {
      parts.push(formatGoal(goal, context.organization.name));
    }
    parts.push('');
  }

  // Parent goals (strategic context)
  if (context.parentGoals.length > 0) {
    parts.push(`## Strategic Context (Parent Goals)`);

    // Group by org for better readability
    const goalsByOrg = new Map<string, Goal[]>();
    for (const goal of context.parentGoals) {
      const orgGoals = goalsByOrg.get(goal.orgId) || [];
      orgGoals.push(goal);
      goalsByOrg.set(goal.orgId, orgGoals);
    }

    // Display in hierarchy order (root to leaf, excluding user's org)
    for (const org of context.orgPath) {
      if (org.id === context.organization.id) continue;
      const orgGoals = goalsByOrg.get(org.id);
      if (orgGoals && orgGoals.length > 0) {
        parts.push(`\n### ${org.name}`);
        for (const goal of orgGoals) {
          parts.push(formatGoal(goal, org.name));
        }
      }
    }
    parts.push('');
  }

  // Execution plans for the goals this user works on
  if (context.work.length > 0) {
    parts.push(`## Goals You Work On`);
    parts.push(
      `Leaders set the objective; the people doing the work write the execution plans. ` +
        `Plans are shared only with the others working on the same goal.`
    );
    for (const w of context.work) {
      const label = periodLabel(w.goal);
      parts.push(`\n### ${w.goal.title}${label ? ` (${label})` : ''}`);
      const mine = w.participants.find((p) => p.user.id === context.user.id);
      parts.push(`- **Your role:** ${mine?.role ?? 'participant'}`);
      parts.push(
        mine?.plan
          ? `- **Your plan:** ${mine.plan}`
          : `- **Your plan:** not written yet (use update_my_plan to add one)`
      );
      const others = w.participants.filter((p) => p.user.id !== context.user.id);
      if (others.length > 0) {
        parts.push(`- **Others' plans:**`);
        for (const p of others) {
          parts.push(`  - ${p.user.name} (${p.role}): ${p.plan ?? 'no plan yet'}`);
        }
      }
      if (w.openGrayAreas.length > 0) {
        parts.push(`- **Open gray areas** (unclear, not yet clarified):`);
        for (const g of w.openGrayAreas) {
          const about = g.planUserName ? `${g.planUserName}'s plan` : 'the goal';
          parts.push(`  - [${g.id}] About ${about}, raised by ${g.authorName}: ${g.content}`);
        }
      }
    }
    parts.push('');
  }

  // Terminology & Coding Standards (inherited from organizations and goals)
  if (context.standards && context.standards.length > 0) {
    parts.push(`## Terminology & Coding Standards`);
    parts.push(
      `Everyone working with this data and codebase must follow these standard term definitions, variable/metadata field names, and functions:`
    );
    parts.push('');
    for (const s of context.standards) {
      const idBadge = s.identifier ? ` (\`${s.identifier}\`)` : '';
      const source = s.sourceGoalTitle
        ? `${s.sourceOrgName} · ${s.sourceGoalTitle}`
        : s.sourceOrgName;
      parts.push(
        `- [${s.type}] **${s.name}**${idBadge}${s.content ? `: ${s.content}` : ''} *(from ${source})*`
      );
    }
    parts.push('');
  }

  // AI Guidelines
  if (context.guidelines.length > 0) {
    parts.push(`## AI Guidelines`);
    parts.push(`The following guidelines should inform all recommendations:`);
    parts.push('');
    const orgsWithGuidelines = context.orgPath.filter(
      (org) => org.aiGuidelines !== null && org.aiGuidelines.trim() !== ''
    );
    for (let i = 0; i < context.guidelines.length; i++) {
      const org = orgsWithGuidelines[i] ?? context.organization;
      parts.push(`### ${org.name}`);
      parts.push(context.guidelines[i]);
      parts.push('');
    }
  }

  return parts.join('\n');
}

function formatGoal(goal: Goal, orgName: string): string {
  const lines: string[] = [];
  const statusEmoji = getStatusEmoji(goal.status);

  const label = periodLabel(goal);
  lines.push(`- ${statusEmoji} **${goal.title}** (${label ? `${label}, ` : ''}${goal.progress}%)`);

  if (goal.parentGoalId) {
    const parent = getGoalById(goal.parentGoalId);
    if (parent) lines.push(`  - Supports annual goal: **${parent.title}** (${parent.period})`);
  }

  if (goal.description) {
    lines.push(`  - ${goal.description}`);
  }

  if (goal.keyResults) {
    try {
      const keyResults = JSON.parse(goal.keyResults) as string[];
      if (keyResults.length > 0) {
        lines.push(`  - Key Results:`);
        for (const kr of keyResults) {
          lines.push(`    - ${kr}`);
        }
      }
    } catch {
      // Ignore JSON parse errors
    }
  }

  const standards = parseStandards(goal.standards);
  if (standards.length > 0) {
    lines.push(`  - Standards:`);
    for (const s of standards) {
      const idBadge = s.identifier ? ` (\`${s.identifier}\`)` : '';
      lines.push(`    - [${s.type}] **${s.name}**${idBadge}${s.content ? `: ${s.content}` : ''}`);
    }
  }

  return lines.join('\n');
}

function getStatusEmoji(status: string): string {
  switch (status) {
    case 'completed':
      return '✅';
    case 'in_progress':
      return '🔄';
    case 'cancelled':
      return '❌';
    default:
      return '⬜';
  }
}
