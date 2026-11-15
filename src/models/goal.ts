import { getDb } from '../db/index.js';
import { Goal, GoalPeriodType, GoalRow, GoalStatus, GoalVisibility, Standard, StandardType, toGoal } from './types.js';
import { addParticipant } from './participant.js';
import { v4 as uuidv4 } from 'uuid';

export interface CreateGoalInput {
  id?: string;
  orgId: string;
  ownerId?: string | null;
  title: string;
  description?: string | null;
  keyResults?: string[] | null;
  standards?: Standard[] | null;
  periodType?: GoalPeriodType | null;
  period?: string | null;
  parentGoalId?: string | null;
  status?: GoalStatus;
  progress?: number;
  visibility?: GoalVisibility;
}

export interface UpdateGoalInput {
  ownerId?: string | null;
  title?: string;
  description?: string | null;
  keyResults?: string[] | null;
  standards?: Standard[] | null;
  periodType?: GoalPeriodType | null;
  period?: string | null;
  parentGoalId?: string | null;
  status?: GoalStatus;
  progress?: number;
  visibility?: GoalVisibility;
}

function validateProgress(progress: number | undefined): number {
  if (progress === undefined) return 0;
  if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
    throw new Error('Progress must be a number between 0 and 100.');
  }
  return Math.round(progress);
}

export function createGoal(input: CreateGoalInput): Goal {
  const db = getDb();
  const id = input.id || uuidv4();
  const now = new Date().toISOString();
  const progress = validateProgress(input.progress);
  const { periodType, period, parentGoalId } = validatePeriod(id, {
    periodType: input.periodType,
    period: input.period,
    parentGoalId: input.parentGoalId,
  });

  const stmt = db.prepare(`
    INSERT INTO goals (id, org_id, owner_id, title, description, key_results, standards, period_type, period, parent_goal_id, status, progress, visibility, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    input.orgId,
    input.ownerId ?? null,
    input.title,
    input.description ?? null,
    input.keyResults ? JSON.stringify(input.keyResults) : null,
    input.standards?.length ? JSON.stringify(input.standards) : null,
    periodType,
    period,
    parentGoalId,
    input.status ?? 'not_started',
    progress,
    input.visibility ?? 'public',
    now,
    now
  );

  // The owner is accountable for the goal, so they work on it (and see the plans) by default.
  if (input.ownerId) addParticipant(id, input.ownerId, 'driver');

  return getGoalById(id)!;
}

export function getGoalById(id: string): Goal | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM goals WHERE id = ?');
  const row = stmt.get(id) as GoalRow | undefined;
  return row ? toGoal(row) : null;
}

export function getAllGoals(): Goal[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM goals ORDER BY created_at DESC');
  const rows = stmt.all() as GoalRow[];
  return rows.map(toGoal);
}

export function getGoalsByOrgId(orgId: string): Goal[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM goals WHERE org_id = ? ORDER BY created_at DESC');
  const rows = stmt.all(orgId) as GoalRow[];
  return rows.map(toGoal);
}

export function getGoalsByOwnerId(ownerId: string): Goal[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM goals WHERE owner_id = ? ORDER BY created_at DESC');
  const rows = stmt.all(ownerId) as GoalRow[];
  return rows.map(toGoal);
}

export function getGoalsByOrgIds(orgIds: string[]): Goal[] {
  if (orgIds.length === 0) return [];
  const db = getDb();
  const placeholders = orgIds.map(() => '?').join(', ');
  const stmt = db.prepare(
    `SELECT * FROM goals WHERE org_id IN (${placeholders}) ORDER BY created_at DESC`
  );
  const rows = stmt.all(...orgIds) as GoalRow[];
  return rows.map(toGoal);
}

export function searchGoals(keyword: string, orgIds?: string[]): Goal[] {
  const db = getDb();
  const searchTerm = `%${keyword}%`;

  let sql = `
    SELECT * FROM goals
    WHERE (title LIKE ? OR description LIKE ?)
  `;
  const params: string[] = [searchTerm, searchTerm];

  if (orgIds && orgIds.length > 0) {
    const placeholders = orgIds.map(() => '?').join(', ');
    sql += ` AND org_id IN (${placeholders})`;
    params.push(...orgIds);
  }

  sql += ' ORDER BY created_at DESC';

  const stmt = db.prepare(sql);
  const rows = stmt.all(...params) as GoalRow[];
  return rows.map(toGoal);
}

export function getVisibleGoals(orgIds: string[]): Goal[] {
  if (orgIds.length === 0) return [];
  const db = getDb();
  const placeholders = orgIds.map(() => '?').join(', ');
  const stmt = db.prepare(`
    SELECT * FROM goals
    WHERE org_id IN (${placeholders})
    AND visibility IN ('public', 'team_only')
    ORDER BY created_at DESC
  `);
  const rows = stmt.all(...orgIds) as GoalRow[];
  return rows.map(toGoal);
}

export function updateGoal(id: string, input: UpdateGoalInput): Goal | null {
  const db = getDb();
  const existing = getGoalById(id);
  if (!existing) return null;

  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  if (input.ownerId !== undefined) {
    updates.push('owner_id = ?');
    values.push(input.ownerId);
  }
  if (input.title !== undefined) {
    updates.push('title = ?');
    values.push(input.title);
  }
  if (input.description !== undefined) {
    updates.push('description = ?');
    values.push(input.description);
  }
  if (input.keyResults !== undefined) {
    updates.push('key_results = ?');
    values.push(input.keyResults ? JSON.stringify(input.keyResults) : null);
  }
  if (input.standards !== undefined) {
    updates.push('standards = ?');
    values.push(input.standards?.length ? JSON.stringify(input.standards) : null);
  }
  if (
    input.periodType !== undefined ||
    input.period !== undefined ||
    input.parentGoalId !== undefined
  ) {
    const merged = validatePeriod(id, {
      periodType: input.periodType !== undefined ? input.periodType : existing.periodType,
      period: input.period !== undefined ? input.period : existing.period,
      parentGoalId: input.parentGoalId !== undefined ? input.parentGoalId : existing.parentGoalId,
    });
    if (existing.periodType === 'annual' && merged.periodType !== 'annual') {
      db.prepare('UPDATE goals SET parent_goal_id = NULL WHERE parent_goal_id = ?').run(id);
    }
    updates.push('period_type = ?', 'period = ?', 'parent_goal_id = ?');
    values.push(merged.periodType, merged.period, merged.parentGoalId);
  }
  if (input.status !== undefined) {
    updates.push('status = ?');
    values.push(input.status);
  }
  if (input.progress !== undefined) {
    updates.push('progress = ?');
    values.push(validateProgress(input.progress));
  }
  if (input.visibility !== undefined) {
    updates.push('visibility = ?');
    values.push(input.visibility);
  }

  if (updates.length === 0) return existing;

  updates.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  const stmt = db.prepare(`UPDATE goals SET ${updates.join(', ')} WHERE id = ?`);
  stmt.run(...values);

  if (input.ownerId) {
    addParticipant(id, input.ownerId, 'driver');
  }

  return getGoalById(id);
}

export function deleteGoal(id: string): boolean {
  const db = getDb();
  const tx = db.transaction(() => {
    // Quarterly goals outlive the annual goal they supported; they just lose the link.
    db.prepare('UPDATE goals SET parent_goal_id = NULL WHERE parent_goal_id = ?').run(id);
    db.prepare('DELETE FROM comments WHERE goal_id = ?').run(id);
    db.prepare('DELETE FROM gray_areas WHERE goal_id = ?').run(id);
    db.prepare('DELETE FROM goal_participants WHERE goal_id = ?').run(id);
    return db.prepare('DELETE FROM goals WHERE id = ?').run(id).changes > 0;
  });
  return tx();
}

export const STANDARD_TYPES: StandardType[] = [
  'document',
  'term',
  'variable',
  'metadata',
  'function',
  'ui_element',
  'template',
];

export function parseStandards(json: string | null | undefined): Standard[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * One standard per line:
 * - 3 columns: `type | name | content`
 * - 4 columns: `type | name | identifier | content`
 *   (e.g., `term | Member Serial | membersrl | Unique identifier for a customer, consisting of 8 to 16 digits.`)
 * Throws on an unknown type or missing name.
 */
export function parseStandardsText(text: string | undefined): Standard[] {
  const standards: Standard[] = [];
  for (const line of (text ?? '').split('\n')) {
    if (!line.trim()) continue;
    const parts = line.split('|').map((part) => part.trim());
    const type = parts[0];
    const name = parts[1];
    if (!STANDARD_TYPES.includes(type as StandardType)) {
      throw new Error(`Unknown standard type "${type}" (use ${STANDARD_TYPES.join(', ')}).`);
    }
    if (!name) {
      throw new Error(`Standard "${line.trim()}" is missing a name.`);
    }
    if (parts.length >= 4) {
      const identifier = parts[2] || null;
      const content = parts.slice(3).join(' | ').trim();
      standards.push({
        type: type as StandardType,
        name,
        ...(identifier ? { identifier } : {}),
        content,
      });
    } else {
      const content = parts.slice(2).join(' | ').trim();
      standards.push({ type: type as StandardType, name, content });
    }
  }
  return standards;
}

export function formatStandardsText(json: string | null | undefined): string {
  return parseStandards(json)
    .map((s) =>
      s.identifier
        ? `${s.type} | ${s.name} | ${s.identifier} | ${s.content}`
        : `${s.type} | ${s.name} | ${s.content}`
    )
    .join('\n');
}

const ANNUAL_PERIOD = /^\d{4}$/;
const QUARTERLY_PERIOD = /^\d{4}-Q[1-4]$/;

interface PeriodFields {
  periodType: GoalPeriodType | null;
  period: string | null;
  parentGoalId: string | null;
}

/** Normalises and checks the period fields. Throws on a malformed period or an invalid parent. */
function validatePeriod(
  goalId: string,
  input: { periodType?: GoalPeriodType | null; period?: string | null; parentGoalId?: string | null }
): PeriodFields {
  const periodType = input.periodType || null;
  const period = input.period?.trim().toUpperCase() || null;
  const parentGoalId = input.parentGoalId || null;

  if (!periodType) {
    if (period) throw new Error('Choose a period type (annual or quarterly) for this period.');
    if (parentGoalId) throw new Error('Only quarterly goals can support an annual goal.');
    return { periodType: null, period: null, parentGoalId: null };
  }
  if (periodType !== 'annual' && periodType !== 'quarterly') {
    throw new Error(`Unknown period type "${periodType}" (use annual or quarterly).`);
  }
  if (!period) {
    throw new Error(`A ${periodType} goal needs a period, e.g. ${periodType === 'annual' ? '2026' : '2026-Q3'}.`);
  }
  if (periodType === 'annual' && !ANNUAL_PERIOD.test(period)) {
    throw new Error(`Annual period "${period}" must be a year such as 2026.`);
  }
  if (periodType === 'quarterly' && !QUARTERLY_PERIOD.test(period)) {
    throw new Error(`Quarterly period "${period}" must look like 2026-Q3.`);
  }
  if (parentGoalId) {
    if (periodType !== 'quarterly') throw new Error('Only quarterly goals can support an annual goal.');
    if (parentGoalId === goalId) throw new Error('A goal cannot support itself.');
    const parent = getGoalById(parentGoalId);
    if (!parent) throw new Error(`Annual goal "${parentGoalId}" not found.`);
    if (parent.periodType !== 'annual') throw new Error(`"${parent.title}" is not an annual goal.`);
  }
  return { periodType, period, parentGoalId };
}

/** Period of `date`, e.g. `{ year: '2026', quarter: '2026-Q3' }`. */
export function currentPeriods(date: Date = new Date()): { year: string; quarter: string } {
  const year = String(date.getFullYear());
  return { year, quarter: `${year}-Q${Math.floor(date.getMonth() / 3) + 1}` };
}

/** Goals with no period are ongoing and always count as current. */
export function isCurrentGoal(goal: Goal, date: Date = new Date()): boolean {
  if (!goal.periodType || !goal.period) return true;
  const { year, quarter } = currentPeriods(date);
  return goal.periodType === 'annual' ? goal.period === year : goal.period === quarter;
}

/**
 * Drops goals from other periods, but keeps an annual goal that a kept quarterly goal supports
 * so the "supports" link never points at something hidden.
 */
export function filterCurrentGoals(goals: Goal[], date: Date = new Date()): Goal[] {
  const current = goals.filter((g) => isCurrentGoal(g, date));
  const keptIds = new Set(current.map((g) => g.id));
  const supported = new Set(current.map((g) => g.parentGoalId).filter((id): id is string => !!id));
  const result = goals.filter((g) => keptIds.has(g.id) || supported.has(g.id));
  const resultIds = new Set(result.map((g) => g.id));
  for (const parentId of supported) {
    if (!resultIds.has(parentId)) {
      const parent = getGoalById(parentId);
      if (parent) {
        result.push(parent);
        resultIds.add(parentId);
      }
    }
  }
  return result;
}

export function periodLabel(goal: Pick<Goal, 'periodType' | 'period'>): string | null {
  if (!goal.periodType || !goal.period) return null;
  return goal.periodType === 'annual' ? `${goal.period} annual` : goal.period;
}
