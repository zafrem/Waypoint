import { Goal, User } from '../models/types.js';
import { getParticipant } from '../models/participant.js';

/**
 * Who may see and change execution plans. Plans are shared only among the people working on the
 * same goal: its participants (the owner is one) plus admins. Every plan read goes through here.
 */
export function isParticipant(user: User, goal: Goal): boolean {
  return goal.ownerId === user.id || getParticipant(goal.id, user.id) !== null;
}

export function canViewPlans(user: User, goal: Goal): boolean {
  return user.isAdmin || isParticipant(user, goal);
}

/** Raising and resolving gray areas is for the people working on the goal, not for admin viewers. */
export function canDiscussPlans(user: User, goal: Goal): boolean {
  return isParticipant(user, goal);
}

export function canManageParticipants(user: User, goal: Goal): boolean {
  return user.isAdmin || goal.ownerId === user.id;
}

/**
 * Who may see a goal's objective. Private goals are restricted to the goal's own organization,
 * its participants, and admins.
 */
export function canViewGoal(user: User | undefined | null, goal: Goal): boolean {
  if (goal.visibility !== 'private') return true;
  if (!user) return false;
  return goal.orgId === user.orgId || canViewPlans(user, goal);
}
