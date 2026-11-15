import { getDb } from '../db/index.js';
import { GrayArea, GrayAreaRow, GrayAreaStatus, toGrayArea } from './types.js';
import { v4 as uuidv4 } from 'uuid';

export interface RaiseGrayAreaInput {
  goalId: string;
  authorId: string;
  content: string;
  /** The participant whose plan the question is about; omit for a question about the goal itself. */
  planUserId?: string | null;
}

export function raiseGrayArea(input: RaiseGrayAreaInput): GrayArea {
  const content = input.content?.trim();
  if (!content) throw new Error('Describe what is unclear.');
  const db = getDb();
  const id = uuidv4();
  db.prepare(
    `INSERT INTO gray_areas (id, goal_id, plan_user_id, author_id, content, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, input.goalId, input.planUserId ?? null, input.authorId, content, new Date().toISOString());
  return getGrayAreaById(id)!;
}

export function getGrayAreaById(id: string): GrayArea | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM gray_areas WHERE id = ?').get(id) as GrayAreaRow | undefined;
  return row ? toGrayArea(row) : null;
}

export function getGrayAreasByGoalId(goalId: string, status?: GrayAreaStatus): GrayArea[] {
  const db = getDb();
  const rows = (
    status
      ? db.prepare('SELECT * FROM gray_areas WHERE goal_id = ? AND status = ? ORDER BY created_at').all(goalId, status)
      : db.prepare('SELECT * FROM gray_areas WHERE goal_id = ? ORDER BY created_at').all(goalId)
  ) as GrayAreaRow[];
  return rows.map(toGrayArea);
}

export function resolveGrayArea(id: string, resolvedBy: string, resolution: string): GrayArea | null {
  const text = resolution?.trim();
  if (!text) throw new Error('Write down how it was clarified.');
  const db = getDb();
  const changes = db
    .prepare(
      `UPDATE gray_areas SET status = 'resolved', resolution = ?, resolved_by = ?, resolved_at = ?
       WHERE id = ? AND status = 'open'`
    )
    .run(text, resolvedBy, new Date().toISOString(), id).changes;
  return changes > 0 ? getGrayAreaById(id) : null;
}
