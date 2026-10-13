import { z } from 'zod';
import { getConfig } from '../../config/index.js';
import { getUserById } from '../../models/user.js';
import { getAllGoals } from '../../models/goal.js';
import { getOrganizationById } from '../../models/organization.js';
import { computeRelationship } from '../../rbac/relationships.js';
import { hasPermission } from '../../rbac/permissions.js';
import { Goal } from '../../models/types.js';

export const semanticSearchSchema = z.object({
  query: z.string().describe('The semantic search query (e.g., "goals related to platform stability")'),
});

export type SemanticSearchInput = z.infer<typeof semanticSearchSchema>;

export interface SemanticSearchResult {
  success: boolean;
  error?: string;
  results?: {
    goalId: string;
    title: string;
    orgName: string;
    score: number;
    description: string | null;
  }[];
}

/**
 * Simulates a Vector Database semantic search with role-based access control.
 */
export function semanticSearch(input: SemanticSearchInput): SemanticSearchResult {
  const config = getConfig();

  if (!config.userId) {
    return {
      success: false,
      error: 'NORTHSTAR_USER_ID environment variable is not set.',
    };
  }

  const user = getUserById(config.userId);
  if (!user) {
    return {
      success: false,
      error: `User with ID "${config.userId}" not found.`,
    };
  }

  // Check if user has general permission to perform vector search
  if (!hasPermission(user, 'SELF', 'vector:search')) {
    return {
      success: false,
      error: 'You do not have permission to use the semantic vector search tool.',
    };
  }

  const allGoals = getAllGoals();
  const results: SemanticSearchResult['results'] = [];

  // Simulate semantic matching
  const keywords = input.query.toLowerCase().split(/\s+/);
  
  for (const goal of allGoals) {
    // RBAC Check for each individual goal
    const relationship = computeRelationship(user.orgId, goal.orgId);
    if (!hasPermission(user, relationship, 'goal:read')) {
      continue;
    }

    // Visibility Check: 
    // - Own org goals are always visible
    // - Others must be public or team_only
    // - Admins see everything
    if (!user.isAdmin && goal.orgId !== user.orgId && goal.visibility === 'private') {
      continue;
    }

    // Simple keyword score simulation
    let score = 0;
    const content = `${goal.title} ${goal.description || ''}`.toLowerCase();
    
    for (const kw of keywords) {
      if (kw.length > 3 && content.includes(kw)) {
        score += 0.2;
      }
    }

    if (score > 0) {
      const org = getOrganizationById(goal.orgId);
      
      results.push({
        goalId: goal.id,
        title: goal.title,
        orgName: org?.name || 'Unknown',
        score: Math.min(score, 1.0),
        description: goal.description,
      });
    }
  }

  // Sort by score
  results.sort((a, b) => b.score - a.score);

  return {
    success: true,
    results: results.slice(0, 5), // Return top 5
  };
}
