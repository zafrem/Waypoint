import { z } from 'zod';
import { getConfig } from '../../config/index.js';
import { getUserById } from '../../models/user.js';
import { getGoalById } from '../../models/goal.js';
import { createComment } from '../../models/comment.js';
import { computeRelationship } from '../../rbac/relationships.js';
import { hasPermission } from '../../rbac/permissions.js';

export const submitQuestionSchema = z.object({
  goal_id: z.string().describe('The ID of the goal to submit a question about'),
  question: z.string().describe('The question to submit'),
});

export type SubmitQuestionInput = z.infer<typeof submitQuestionSchema>;

export interface SubmitQuestionResult {
  success: boolean;
  error?: string;
  data?: {
    commentId: string;
    goalId: string;
    question: string;
    status: string;
  };
}

export function submitQuestion(input: SubmitQuestionInput): SubmitQuestionResult {
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

  const goal = getGoalById(input.goal_id);
  if (!goal) {
    return {
      success: false,
      error: `Goal with ID "${input.goal_id}" not found.`,
    };
  }

  // Check permission to submit a question
  const relationship = computeRelationship(user.orgId, goal.orgId);
  const canSubmitQuestion = hasPermission(user, relationship, 'comment:submit_question');

  if (!canSubmitQuestion) {
    return {
      success: false,
      error: `You don't have permission to submit questions on goals from this organization. Your relationship to the goal's organization: ${relationship}`,
    };
  }

  // Create the question comment
  const comment = createComment({
    goalId: input.goal_id,
    authorId: config.userId,
    content: input.question,
    type: 'question',
    status: 'pending',
  });

  return {
    success: true,
    data: {
      commentId: comment.id,
      goalId: comment.goalId,
      question: comment.content,
      status: comment.status,
    },
  };
}
