import { getDb } from '../db/index.js';
import {
  Organization,
  OrganizationRow,
  toOrganization,
} from './types.js';
import { v4 as uuidv4 } from 'uuid';

export interface CreateOrganizationInput {
  id?: string;
  parentId?: string | null;
  name: string;
  description?: string | null;
  aiGuidelines?: string | null;
  mcpDisabled?: boolean;
}

export interface UpdateOrganizationInput {
  name?: string;
  description?: string | null;
  aiGuidelines?: string | null;
  mcpDisabled?: boolean;
}

export function createOrganization(input: CreateOrganizationInput): Organization {
  const db = getDb();
  const id = input.id || uuidv4();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO organizations (id, parent_id, name, description, ai_guidelines, mcp_disabled, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    input.parentId ?? null,
    input.name,
    input.description ?? null,
    input.aiGuidelines ?? null,
    input.mcpDisabled ? 1 : 0,
    now,
    now
  );

  return getOrganizationById(id)!;
}

export function getOrganizationById(id: string): Organization | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM organizations WHERE id = ?');
  const row = stmt.get(id) as OrganizationRow | undefined;
  return row ? toOrganization(row) : null;
}

export function getAllOrganizations(): Organization[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM organizations ORDER BY name');
  const rows = stmt.all() as OrganizationRow[];
  return rows.map(toOrganization);
}

export function getOrganizationByName(name: string): Organization | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM organizations WHERE name = ?');
  const row = stmt.get(name) as OrganizationRow | undefined;
  return row ? toOrganization(row) : null;
}

export function getChildOrganizations(parentId: string): Organization[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM organizations WHERE parent_id = ? ORDER BY name');
  const rows = stmt.all(parentId) as OrganizationRow[];
  return rows.map(toOrganization);
}

export function getRootOrganizations(): Organization[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM organizations WHERE parent_id IS NULL ORDER BY name');
  const rows = stmt.all() as OrganizationRow[];
  return rows.map(toOrganization);
}

export function getOrganizationPath(orgId: string): Organization[] {
  const path: Organization[] = [];
  let current = getOrganizationById(orgId);

  while (current) {
    path.unshift(current);
    current = current.parentId ? getOrganizationById(current.parentId) : null;
  }

  return path;
}

export function getAllDescendants(orgId: string): Organization[] {
  const descendants: Organization[] = [];
  const queue = getChildOrganizations(orgId);

  while (queue.length > 0) {
    const org = queue.shift()!;
    descendants.push(org);
    queue.push(...getChildOrganizations(org.id));
  }

  return descendants;
}

export function updateOrganization(
  id: string,
  input: UpdateOrganizationInput
): Organization | null {
  const db = getDb();
  const existing = getOrganizationById(id);
  if (!existing) return null;

  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  if (input.name !== undefined) {
    updates.push('name = ?');
    values.push(input.name);
  }
  if (input.description !== undefined) {
    updates.push('description = ?');
    values.push(input.description);
  }
  if (input.aiGuidelines !== undefined) {
    updates.push('ai_guidelines = ?');
    values.push(input.aiGuidelines);
  }
  if (input.mcpDisabled !== undefined) {
    updates.push('mcp_disabled = ?');
    values.push(input.mcpDisabled ? 1 : 0);
  }

  if (updates.length === 0) return existing;

  updates.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  const stmt = db.prepare(`UPDATE organizations SET ${updates.join(', ')} WHERE id = ?`);
  stmt.run(...values);

  return getOrganizationById(id);
}

export function deleteOrganization(id: string): boolean {
  const db = getDb();
  const stmt = db.prepare('DELETE FROM organizations WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}
