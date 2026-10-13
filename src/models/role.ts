import { getDb } from '../db/index.js';
import { Role, RoleRow, toRole, RolePermission, RolePermissionRow } from './types.js';
import { v4 as uuidv4 } from 'uuid';

export interface CreateRoleInput {
  id?: string;
  name: string;
  description?: string | null;
  permissions?: string[];
}

export function createRole(input: CreateRoleInput): Role {
  const db = getDb();
  const id = input.id || uuidv4();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO roles (id, name, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(id, input.name, input.description ?? null, now, now);

  if (input.permissions && input.permissions.length > 0) {
    const permStmt = db.prepare(`
      INSERT INTO role_permissions (role_id, permission)
      VALUES (?, ?)
    `);
    for (const perm of input.permissions) {
      permStmt.run(id, perm);
    }
  }

  return getRoleById(id)!;
}

export function getRoleById(id: string): Role | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM roles WHERE id = ?');
  const row = stmt.get(id) as RoleRow | undefined;
  return row ? toRole(row) : null;
}

export function getRoleByName(name: string): Role | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM roles WHERE name = ?');
  const row = stmt.get(name) as RoleRow | undefined;
  return row ? toRole(row) : null;
}

export function getAllRoles(): Role[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM roles ORDER BY name');
  const rows = stmt.all() as RoleRow[];
  return rows.map(toRole);
}

export function getRolePermissions(roleId: string): string[] {
  const db = getDb();
  const stmt = db.prepare('SELECT permission FROM role_permissions WHERE role_id = ?');
  const rows = stmt.all(roleId) as { permission: string }[];
  return rows.map((r) => r.permission);
}

export function updateRolePermissions(roleId: string, permissions: string[]): void {
  const db = getDb();
  const deleteStmt = db.prepare('DELETE FROM role_permissions WHERE role_id = ?');
  const insertStmt = db.prepare('INSERT INTO role_permissions (role_id, permission) VALUES (?, ?)');

  const transaction = db.transaction(() => {
    deleteStmt.run(roleId);
    for (const perm of permissions) {
      insertStmt.run(roleId, perm);
    }
  });

  transaction();
}

export function deleteRole(id: string): boolean {
  const db = getDb();
  const stmt = db.prepare('DELETE FROM roles WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}
