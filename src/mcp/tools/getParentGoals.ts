import { z } from 'zod';
import { isConfiguredUserMcpDisabled } from '../../services/mcpAccess.js';
import { canViewGoal } from '../../services/planAccess.js';
import { getConfig } from '../../config/index.js';
import { getUserById } from '../../models/user.js';
import { getOrganizationById, getOrganizationPath } from '../../models/organization.js';
import { filterCurrentGoals, getGoalsByOrgIds, periodLabel } from '../../models/goal.js';
import { Goal, Organization } from '../../models/types.js';

export const getParentGoalsSchema = z.object({
  org_id: z.string().describe('The organization ID to get parent goals for'),
  include_past_periods: z
    .boolean()
    .optional()
    .describe('Also include goals from other years/quarters (default: current period only)'),
});

export type GetParentGoalsInput = z.infer<typeof getParentGoalsSchema>;

export interface ParentGoalResult {
  organization: {
    id: string;
    name: string;
  };
  goals: Array<{
    id: string;
    title: string;
    description: string | null;
    keyResults: string[];
    status: string;
    progress: number;
    period: string | null;
    supportsGoalId: string | null;
  }>;
}

export interface GetParentGoalsResult {
  success: boolean;
  error?: string;
  data?: ParentGoalResult[];
}

export function getParentGoals(input: GetParentGoalsInput): GetParentGoalsResult {
  if (isConfiguredUserMcpDisabled()) {
    return {
      success: false,
      error: 'Not available.',
    };
  }

  const org = getOrganizationById(input.org_id);

  if (!org) {
    return {
      success: false,
      error: `Organization with ID "${input.org_id}" not found.`,
    };
  }

  // Get the full path from root to this organization
  const orgPath = getOrganizationPath(input.org_id);

  // Exclude the current organization to get only parents/ancestors
  const parentOrgs = orgPath.filter((o) => o.id !== input.org_id);

  if (parentOrgs.length === 0) {
    return {
      success: true,
      data: [],
    };
  }

  // Get goals for all parent organizations
  const config = getConfig();
  const user = config.userId ? getUserById(config.userId) : null;
  const parentOrgIds = parentOrgs.map((o) => o.id);
  const allGoals = getGoalsByOrgIds(parentOrgIds).filter((g) => canViewGoal(user, g));
  const goals = input.include_past_periods ? allGoals : filterCurrentGoals(allGoals);

  // Group goals by organization
  const goalsByOrg = new Map<string, Goal[]>();
  for (const goal of goals) {
    const orgGoals = goalsByOrg.get(goal.orgId) || [];
    orgGoals.push(goal);
    goalsByOrg.set(goal.orgId, orgGoals);
  }

  // Build result in hierarchy order (root to leaf)
  const result: ParentGoalResult[] = parentOrgs.map((parentOrg) => {
    const orgGoals = goalsByOrg.get(parentOrg.id) || [];
    return {
      organization: {
        id: parentOrg.id,
        name: parentOrg.name,
      },
      goals: orgGoals.map((g) => ({
        id: g.id,
        title: g.title,
        description: g.description,
        keyResults: parseKeyResults(g.keyResults),
        status: g.status,
        progress: g.progress,
        period: periodLabel(g),
        supportsGoalId: g.parentGoalId,
      })),
    };
  });

  return {
    success: true,
    data: result,
  };
}

function parseKeyResults(keyResultsJson: string | null): string[] {
  if (!keyResultsJson) return [];
  try {
    const parsed = JSON.parse(keyResultsJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
