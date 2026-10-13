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
}

export interface UpdateUserInput {
  roleId?: string | null;
  name?: string;
  email?: string;
  jobFunction?: string | null;
  isAdmin?: boolean;
  isLeader?: boolean;
}

export function createUser(input: CreateUserInput): User {
  const db = getDb();
  const id = input.id || uuidv4();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO users (id, org_id, role_id, name, email, job_function, is_admin, is_leader, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
  const stmt = db.prepare('DELETE FROM users WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}
