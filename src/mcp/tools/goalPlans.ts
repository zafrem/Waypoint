import { z } from 'zod';
import { isMcpDisabled } from '../../services/mcpAccess.js';
import { canDiscussPlans, canViewPlans } from '../../services/planAccess.js';
import { getConfig } from '../../config/index.js';
import { getUserById } from '../../models/user.js';
import { getGoalById } from '../../models/goal.js';
import { getParticipant, getParticipantsByGoalId, setPlan } from '../../models/participant.js';
import {
  getGrayAreaById,
  getGrayAreasByGoalId,
  raiseGrayArea,
  resolveGrayArea,
} from '../../models/grayArea.js';
import { Goal, User } from '../../models/types.js';

export const getGoalPlansSchema = z.object({
  goal_id: z.string().describe('The ID of a goal you work on'),
});

export const updateMyPlanSchema = z.object({
  goal_id: z.string().describe('The ID of a goal you work on'),
  plan: z.string().describe('Your execution plan for the goal: what you will do and how you read the key results'),
});

export const raiseGrayAreaSchema = z.object({
  goal_id: z.string().describe('The ID of a goal you work on'),
  question: z.string().describe('What is unclear or ambiguous'),
  plan_user_id: z
    .string()
    .optional()
    .describe("The user ID of the teammate whose plan the question is about (omit if it is about the goal itself)"),
});

export const resolveGrayAreaSchema = z.object({
  gray_area_id: z.string().describe('The ID of the open gray area'),
  resolution: z.string().describe('How the question was clarified'),
});

export interface PlanToolResult {
  success: boolean;
  error?: string;
  data?: unknown;
}

type Acting = { user: User } | { error: string };

function actingUser(): Acting {
  const config = getConfig();
  if (!config.userId) return { error: 'WAYPOINT_USER_ID environment variable is not set.' };
  const user = getUserById(config.userId);
  if (!user) return { error: `User with ID "${config.userId}" not found.` };
  if (isMcpDisabled(user)) return { error: 'Not available.' };
  return { user };
}

/** A goal the user may see plans for. Anyone else gets the same answer as for a goal that does not exist. */
function goalFor(user: User, goalId: string, allowed: (u: User, g: Goal) => boolean): Goal | null {
  const goal = getGoalById(goalId);
  return goal && allowed(user, goal) ? goal : null;
}

const notFound = (goalId: string): PlanToolResult => ({
  success: false,
  error: `Goal with ID "${goalId}" not found.`,
});

export function getGoalPlans(input: z.infer<typeof getGoalPlansSchema>): PlanToolResult {
  const acting = actingUser();
  if ('error' in acting) return { success: false, error: acting.error };
  const goal = goalFor(acting.user, input.goal_id, canViewPlans);
  if (!goal) return notFound(input.goal_id);

  return {
    success: true,
    data: {
      goal: { id: goal.id, title: goal.title, description: goal.description },
      plans: getParticipantsByGoalId(goal.id).map((p) => ({
        userId: p.userId,
        name: getUserById(p.userId)?.name ?? 'Unknown',
        role: p.role,
        plan: p.plan,
        updatedAt: p.planUpdatedAt,
      })),
      grayAreas: getGrayAreasByGoalId(goal.id).map((g) => ({
        id: g.id,
        status: g.status,
        question: g.content,
        aboutPlanOf: g.planUserId,
        raisedBy: getUserById(g.authorId)?.name ?? 'Unknown',
        resolution: g.resolution,
      })),
    },
  };
}

export function updateMyPlan(input: z.infer<typeof updateMyPlanSchema>): PlanToolResult {
  const acting = actingUser();
  if ('error' in acting) return { success: false, error: acting.error };
  const goal = goalFor(acting.user, input.goal_id, canDiscussPlans);
  if (!goal || !getParticipant(goal.id, acting.user.id)) return notFound(input.goal_id);

  const saved = setPlan(goal.id, acting.user.id, input.plan);
  return { success: true, data: { goalId: goal.id, plan: saved?.plan ?? null, updatedAt: saved?.planUpdatedAt ?? null } };
}

export function raiseGrayAreaTool(input: z.infer<typeof raiseGrayAreaSchema>): PlanToolResult {
  const acting = actingUser();
  if ('error' in acting) return { success: false, error: acting.error };
  const goal = goalFor(acting.user, input.goal_id, canDiscussPlans);
  if (!goal) return notFound(input.goal_id);
  if (input.plan_user_id && !getParticipant(goal.id, input.plan_user_id)) {
    return { success: false, error: 'That user has no plan on this goal.' };
  }
  try {
    const gray = raiseGrayArea({
      goalId: goal.id,
      authorId: acting.user.id,
      content: input.question,
      planUserId: input.plan_user_id ?? null,
    });
    return { success: true, data: { id: gray.id, goalId: goal.id, status: gray.status } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to raise gray area.' };
  }
}

export function resolveGrayAreaTool(input: z.infer<typeof resolveGrayAreaSchema>): PlanToolResult {
  const acting = actingUser();
  if ('error' in acting) return { success: false, error: acting.error };
  const gray = getGrayAreaById(input.gray_area_id);
  const goal = gray ? goalFor(acting.user, gray.goalId, canDiscussPlans) : null;
  if (!gray || !goal) return { success: false, error: `Gray area with ID "${input.gray_area_id}" not found.` };
  try {
    const resolved = resolveGrayArea(gray.id, acting.user.id, input.resolution);
    if (!resolved) return { success: false, error: 'This gray area is already resolved.' };
    return { success: true, data: { id: resolved.id, status: resolved.status } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to resolve gray area.' };
  }
}
