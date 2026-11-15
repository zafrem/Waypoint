import { getDb } from '../db/index.js';
import { User, UserRow, toUser } from './types.js';
import { v4 as uuidv4 } from 'uuid';

export interface CreateUserInput {
  id?: string;
  orgId: string;
  roleId?: string | null;
  name: string;
  email: string;
  jobFunction?: string | null;
  isAdmin?: boolean;
  isLeader?: boolean;
  mcpDisabled?: boolean;
}

export interface UpdateUserInput {
  roleId?: string | null;
  name?: string;
  email?: string;
  jobFunction?: string | null;
  isAdmin?: boolean;
  isLeader?: boolean;
  mcpDisabled?: boolean;
}

export function createUser(input: CreateUserInput): User {
  const db = getDb();
  const id = input.id || uuidv4();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO users (id, org_id, role_id, name, email, job_function, is_admin, is_leader, mcp_disabled, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    input.orgId,
    input.roleId ?? null,
    input.name,
    input.email,
    input.jobFunction ?? null,
    input.isAdmin ? 1 : 0,
    input.isLeader ? 1 : 0,
    input.mcpDisabled ? 1 : 0,
    now,
    now
  );

  return getUserById(id)!;
}

export function getUserById(id: string): User | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
  const row = stmt.get(id) as UserRow | undefined;
  return row ? toUser(row) : null;
}

export function getUserByEmail(email: string): User | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
  const row = stmt.get(email) as UserRow | undefined;
  return row ? toUser(row) : null;
}

export function getUsersByOrgId(orgId: string): User[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM users WHERE org_id = ? ORDER BY name');
  const rows = stmt.all(orgId) as UserRow[];
  return rows.map(toUser);
}

export function getAllUsers(): User[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM users ORDER BY name');
  const rows = stmt.all() as UserRow[];
  return rows.map(toUser);
}

export function updateUser(id: string, input: UpdateUserInput): User | null {
  const db = getDb();
  const existing = getUserById(id);
  if (!existing) return null;

  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  if (input.roleId !== undefined) {
    updates.push('role_id = ?');
    values.push(input.roleId);
  }
  if (input.name !== undefined) {
    updates.push('name = ?');
    values.push(input.name);
  }
  if (input.email !== undefined) {
    updates.push('email = ?');
    values.push(input.email);
  }
  if (input.jobFunction !== undefined) {
    updates.push('job_function = ?');
    values.push(input.jobFunction);
  }
  if (input.isAdmin !== undefined) {
    updates.push('is_admin = ?');
    values.push(input.isAdmin ? 1 : 0);
  }
  if (input.isLeader !== undefined) {
    updates.push('is_leader = ?');
    values.push(input.isLeader ? 1 : 0);
  }
  if (input.mcpDisabled !== undefined) {
    updates.push('mcp_disabled = ?');
    values.push(input.mcpDisabled ? 1 : 0);
  }

  if (updates.length === 0) return existing;

  updates.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  const stmt = db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`);
  stmt.run(...values);

  return getUserById(id);
}

export function deleteUser(id: string): boolean {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM web_sessions WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM user_preferences WHERE user_id = ?').run(id);
    db.prepare('UPDATE gray_areas SET resolved_by = NULL WHERE resolved_by = ?').run(id);
    db.prepare('UPDATE gray_areas SET plan_user_id = NULL WHERE plan_user_id = ?').run(id);
    db.prepare('DELETE FROM gray_areas WHERE author_id = ?').run(id);
    db.prepare('DELETE FROM goal_participants WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM comments WHERE author_id = ?').run(id);
    db.prepare('UPDATE goals SET owner_id = NULL WHERE owner_id = ?').run(id);
    return db.prepare('DELETE FROM users WHERE id = ?').run(id).changes > 0;
  });
  return tx();
}
