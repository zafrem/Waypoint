import { UserContext, Organization, Goal } from '../models/types.js';
import { getUserById } from '../models/user.js';
import { getOrganizationById, getOrganizationPath } from '../models/organization.js';
import { getGoalsByOrgId, getGoalsByOrgIds, parseStandards } from '../models/goal.js';

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

  // Get the full path from root to user's organization
  const orgPath = getOrganizationPath(user.orgId);

  // Get current goals (from user's organization)
  const currentGoals = getGoalsByOrgId(user.orgId);

  // Get parent goals (from all ancestor organizations)
  const parentOrgIds = orgPath
    .filter((org) => org.id !== user.orgId)
    .map((org) => org.id);
  const parentGoals = getGoalsByOrgIds(parentOrgIds);

  // Collect all AI guidelines from the org path (root to leaf)
  const guidelines = orgPath
    .map((org) => org.aiGuidelines)
    .filter((g): g is string => g !== null && g.trim() !== '');

  return {
    user,
    organization,
    orgPath,
    currentGoals,
    parentGoals,
    guidelines,
  };
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

  // AI Guidelines
  if (context.guidelines.length > 0) {
    parts.push(`## AI Guidelines`);
    parts.push(`The following guidelines should inform all recommendations:`);
    parts.push('');
    for (let i = 0; i < context.guidelines.length; i++) {
      const org = context.orgPath[i];
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

  lines.push(`- ${statusEmoji} **${goal.title}** (${goal.progress}%)`);

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
      lines.push(`    - [${s.type}] **${s.name}**${s.content ? `: ${s.content}` : ''}`);
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
