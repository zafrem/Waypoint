import { z } from 'zod';
import { getConfig } from '../../config/index.js';
import { getUserById } from '../../models/user.js';
import { getOrganizationById } from '../../models/organization.js';
import { searchGoals, getVisibleGoals } from '../../models/goal.js';
import { getAccessibleOrgIds } from '../../rbac/relationships.js';
import { Goal } from '../../models/types.js';

export const searchCollaboratorGoalsSchema = z.object({
  keyword: z.string().describe('Keyword to search for in goal titles and descriptions'),
});

export type SearchCollaboratorGoalsInput = z.infer<typeof searchCollaboratorGoalsSchema>;

export interface CollaboratorGoalResult {
  id: string;
  title: string;
  description: string | null;
  keyResults: string[];
  status: string;
  progress: number;
  organization: {
    id: string;
    name: string;
  };
}

export interface SearchCollaboratorGoalsResult {
  success: boolean;
  error?: string;
  data?: CollaboratorGoalResult[];
}

export function searchCollaboratorGoals(
  input: SearchCollaboratorGoalsInput
): SearchCollaboratorGoalsResult {
  const config = getConfig();

  if (!config.userId) {
    return {
      success: false,
      error: 'WAYPOINT_USER_ID environment variable is not set.',
    };
  }

  const user = getUserById(config.userId);
  if (!user) {
    return {
      success: false,
      error: `User with ID "${config.userId}" not found.`,
    };
  }

  // Get all organization IDs the user can access
  const accessibleOrgIds = getAccessibleOrgIds(user.orgId);

  if (accessibleOrgIds.length === 0) {
    return {
      success: true,
      data: [],
    };
  }

  // Search for goals matching the keyword within accessible organizations
  const goals = searchGoals(input.keyword, accessibleOrgIds);

  // Filter to only show visible goals (public or team_only)
  // User's own org goals are always visible
  const visibleGoals = goals.filter((goal) => {
    if (goal.orgId === user.orgId) return true;
    return goal.visibility === 'public' || goal.visibility === 'team_only';
  });

  // Build result with organization info
  const result: CollaboratorGoalResult[] = visibleGoals.map((goal) => {
    const org = getOrganizationById(goal.orgId);
    return {
      id: goal.id,
      title: goal.title,
      description: goal.description,
      keyResults: parseKeyResults(goal.keyResults),
      status: goal.status,
      progress: goal.progress,
      organization: {
        id: goal.orgId,
        name: org?.name || 'Unknown',
      },
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
