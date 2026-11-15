import { getDb } from '../db/index.js';
import {
  GoalParticipant,
  GoalParticipantRow,
  ParticipantRole,
  toGoalParticipant,
} from './types.js';

export const PARTICIPANT_ROLES: ParticipantRole[] = ['driver', 'contributor', 'reviewer'];

/** Adds a person to a goal, or changes their role if they are already on it (their plan is kept). */
export function addParticipant(
  goalId: string,
  userId: string,
  role: ParticipantRole = 'contributor'
): GoalParticipant {
  if (!PARTICIPANT_ROLES.includes(role)) {
    throw new Error(`Unknown role "${role}" (use ${PARTICIPANT_ROLES.join(', ')}).`);
  }
  const db = getDb();
  db.prepare(
    `INSERT INTO goal_participants (goal_id, user_id, role, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (goal_id, user_id) DO UPDATE SET role = excluded.role`
  ).run(goalId, userId, role, new Date().toISOString());
  return getParticipant(goalId, userId)!;
}

export function removeParticipant(goalId: string, userId: string): boolean {
  const db = getDb();
  return db.prepare('DELETE FROM goal_participants WHERE goal_id = ? AND user_id = ?').run(goalId, userId).changes > 0;
}

export function getParticipant(goalId: string, userId: string): GoalParticipant | null {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM goal_participants WHERE goal_id = ? AND user_id = ?')
    .get(goalId, userId) as GoalParticipantRow | undefined;
  return row ? toGoalParticipant(row) : null;
}

export function getParticipantsByGoalId(goalId: string): GoalParticipant[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM goal_participants WHERE goal_id = ? ORDER BY created_at, user_id')
    .all(goalId) as GoalParticipantRow[];
  return rows.map(toGoalParticipant);
}

export function getParticipationsByUserId(userId: string): GoalParticipant[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM goal_participants WHERE user_id = ? ORDER BY created_at')
    .all(userId) as GoalParticipantRow[];
  return rows.map(toGoalParticipant);
}

/** Saves the person's own plan. Only an existing participant has one; returns null otherwise. */
export function setPlan(goalId: string, userId: string, plan: string | null): GoalParticipant | null {
  const db = getDb();
  const text = plan?.trim() || null;
  const changes = db
    .prepare('UPDATE goal_participants SET plan = ?, plan_updated_at = ? WHERE goal_id = ? AND user_id = ?')
    .run(text, text ? new Date().toISOString() : null, goalId, userId).changes;
  return changes > 0 ? getParticipant(goalId, userId) : null;
}
