import { existsSync, readFileSync, writeFileSync } from 'fs';
import { getDb } from './index.js';
import {
  Organization,
  User,
  Goal,
  Comment,
  OrganizationRow,
  UserRow,
  GoalRow,
  CommentRow,
  toOrganization,
  toUser,
  toGoal,
  toComment,
} from '../models/types.js';

export interface JsonExport {
  version: string;
  exportedAt: string;
  data: {
    organizations: Organization[];
    users: User[];
    goals: Goal[];
    comments: Comment[];
  };
}

export interface ImportOptions {
  clearExisting?: boolean;
  preserveTimestamps?: boolean;
}

const DEFAULT_IMPORT_OPTIONS: ImportOptions = {
  clearExisting: true,
  preserveTimestamps: true,
};

/**
 * Export all data from the database to JSON format
 */
export function exportToJson(): JsonExport {
  const db = getDb();

  const orgRows = db.prepare('SELECT * FROM organizations ORDER BY created_at').all() as OrganizationRow[];
  const userRows = db.prepare('SELECT * FROM users ORDER BY created_at').all() as UserRow[];
  const goalRows = db.prepare('SELECT * FROM goals ORDER BY created_at').all() as GoalRow[];
  const commentRows = db.prepare('SELECT * FROM comments ORDER BY created_at').all() as CommentRow[];

  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    data: {
      organizations: orgRows.map(toOrganization),
      users: userRows.map(toUser),
      goals: goalRows.map(toGoal),
      comments: commentRows.map(toComment),
    },
  };
}

/**
 * Import data from JSON into the database
 */
export function importFromJson(data: JsonExport, options?: ImportOptions): void {
  const opts = { ...DEFAULT_IMPORT_OPTIONS, ...options };
  const db = getDb();

  // Validate version
  if (!data.version || !data.version.startsWith('1.')) {
    throw new Error(`Unsupported JSON export version: ${data.version}`);
  }

  // Start transaction
  const transaction = db.transaction(() => {
    if (opts.clearExisting) {
      // Clear tables in reverse FK order
      db.prepare('DELETE FROM comments').run();
      db.prepare('DELETE FROM goals').run();
      db.prepare('DELETE FROM users').run();
      db.prepare('DELETE FROM organizations').run();
    }

    // Import organizations (sorted so parents come before children)
    const sortedOrgs = sortOrganizationsByHierarchy(data.data.organizations);
    const insertOrg = db.prepare(`
      INSERT INTO organizations (id, parent_id, name, description, ai_guidelines, mcp_disabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const org of sortedOrgs) {
      const now = new Date().toISOString();
      insertOrg.run(
        org.id,
        org.parentId,
        org.name,
        org.description,
        org.aiGuidelines,
        org.mcpDisabled ? 1 : 0,
        opts.preserveTimestamps ? org.createdAt : now,
        opts.preserveTimestamps ? org.updatedAt : now
      );
    }

    // Import users
    const insertUser = db.prepare(`
      INSERT INTO users (id, org_id, name, email, job_function, is_admin, is_leader, mcp_disabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const user of data.data.users) {
      const now = new Date().toISOString();
      insertUser.run(
        user.id,
        user.orgId,
        user.name,
        user.email,
        user.jobFunction,
        user.isAdmin ? 1 : 0,
        user.isLeader ? 1 : 0,
        user.mcpDisabled ? 1 : 0,
        opts.preserveTimestamps ? user.createdAt : now,
        opts.preserveTimestamps ? user.updatedAt : now
      );
    }

    // Import goals
    const insertGoal = db.prepare(`
      INSERT INTO goals (id, org_id, owner_id, title, description, key_results, standards, status, progress, visibility, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const goal of data.data.goals) {
      const now = new Date().toISOString();
      insertGoal.run(
        goal.id,
        goal.orgId,
        goal.ownerId,
        goal.title,
        goal.description,
        goal.keyResults,
        goal.standards ?? null,
        goal.status,
        goal.progress,
        goal.visibility,
        opts.preserveTimestamps ? goal.createdAt : now,
        opts.preserveTimestamps ? goal.updatedAt : now
      );
    }

    // Import comments
    const insertComment = db.prepare(`
      INSERT INTO comments (id, goal_id, author_id, content, type, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const comment of data.data.comments) {
      const now = new Date().toISOString();
      insertComment.run(
        comment.id,
        comment.goalId,
        comment.authorId,
        comment.content,
        comment.type,
        comment.status,
        opts.preserveTimestamps ? comment.createdAt : now,
        opts.preserveTimestamps ? comment.updatedAt : now
      );
    }
  });

  transaction();
}

/**
 * Load and import data from a JSON file
 */
export function loadFromJsonFile(filePath: string): void {
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content) as JsonExport;
  importFromJson(data);
}

/**
 * Export data and save to a JSON file
 */
export function saveToJsonFile(filePath: string): void {
  const data = exportToJson();
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Check if the database is empty (no organizations)
 */
export function isDatabaseEmpty(): boolean {
  const db = getDb();
  const result = db.prepare('SELECT COUNT(*) as count FROM organizations').get() as { count: number };
  return result.count === 0;
}

/**
 * Auto-load data from JSON file if database is empty
 */
export function autoLoadFromJson(filePath: string): boolean {
  if (!existsSync(filePath)) {
    return false;
  }

  if (!isDatabaseEmpty()) {
    return false;
  }

  loadFromJsonFile(filePath);
  return true;
}

/**
 * Sort organizations so that parent orgs come before their children
 */
function sortOrganizationsByHierarchy(orgs: Organization[]): Organization[] {
  const result: Organization[] = [];
  const remaining = [...orgs];
  const addedIds = new Set<string>();

  // First, add all root organizations (no parent)
  for (let i = remaining.length - 1; i >= 0; i--) {
    if (remaining[i].parentId === null) {
      result.push(remaining[i]);
      addedIds.add(remaining[i].id);
      remaining.splice(i, 1);
    }
  }

  // Then iteratively add orgs whose parents have been added
  while (remaining.length > 0) {
    let addedAny = false;
    for (let i = remaining.length - 1; i >= 0; i--) {
      const parentId = remaining[i].parentId;
      if (parentId !== null && addedIds.has(parentId)) {
        result.push(remaining[i]);
        addedIds.add(remaining[i].id);
        remaining.splice(i, 1);
        addedAny = true;
      }
    }

    // If we couldn't add any, there might be orphan orgs or circular refs
    if (!addedAny && remaining.length > 0) {
      // Add remaining orgs anyway (they may have invalid parent refs)
      result.push(...remaining);
      break;
    }
  }

  return result;
}
