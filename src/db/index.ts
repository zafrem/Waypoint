import Database from 'better-sqlite3';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { getConfig } from '../config/index.js';
import { schema } from './schema.js';

let db: Database.Database | null = null;
let autoLoadAttempted = false;

export function getDb(): Database.Database {
  if (!db) {
    const config = getConfig();
    db = new Database(config.dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initializeSchema();
    tryAutoLoadFromJson();
  }
  return db;
}

function tryAutoLoadFromJson(): void {
  if (autoLoadAttempted || !db) return;
  autoLoadAttempted = true;

  const jsonPath = resolve(process.cwd(), 'waypoint-data.json');
  if (!existsSync(jsonPath)) return;

  // Check if database is empty
  const result = db.prepare('SELECT COUNT(*) as count FROM organizations').get() as { count: number };
  if (result.count > 0) return;

  // Import from JSON file (inline to avoid circular dependency)
  try {
    const content = readFileSync(jsonPath, 'utf-8');
    const data = JSON.parse(content);

    importJsonData(db, data);
    console.error('Loaded data from waypoint-data.json');
  } catch (error) {
    console.error('Failed to auto-load from waypoint-data.json:', error);
  }
}

// Inline import logic to avoid circular dependency with json-data.ts
function importJsonData(database: Database.Database, data: any): void {
  if (!data.version || !data.version.startsWith('1.')) {
    throw new Error(`Unsupported JSON export version: ${data.version}`);
  }

  const transaction = database.transaction(() => {
    for (const r of data.data.roles ?? []) {
      database
        .prepare('INSERT OR IGNORE INTO roles (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run(r.id, r.name, r.description ?? null, r.createdAt, r.updatedAt);
      for (const perm of r.permissions ?? []) {
        database
          .prepare('INSERT OR IGNORE INTO role_permissions (role_id, permission) VALUES (?, ?)')
          .run(r.id, perm);
      }
    }

    // Sort organizations so parents come before children
    const sortedOrgs = sortOrgsByHierarchy(data.data.organizations);

    const insertOrg = database.prepare(`
      INSERT INTO organizations (id, parent_id, name, description, ai_guidelines, standards, mcp_disabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const org of sortedOrgs) {
      insertOrg.run(org.id, org.parentId, org.name, org.description, org.aiGuidelines, org.standards ?? null, org.mcpDisabled ? 1 : 0, org.createdAt, org.updatedAt);
    }

    const existingRoles = new Set(
      (database.prepare('SELECT id FROM roles').all() as { id: string }[]).map((r) => r.id)
    );
    const insertUser = database.prepare(`
      INSERT INTO users (id, org_id, role_id, name, email, job_function, is_admin, is_leader, mcp_disabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const user of data.data.users) {
      const roleId = user.roleId && existingRoles.has(user.roleId) ? user.roleId : null;
      insertUser.run(user.id, user.orgId, roleId, user.name, user.email, user.jobFunction, user.isAdmin ? 1 : 0, user.isLeader ? 1 : 0, user.mcpDisabled ? 1 : 0, user.createdAt, user.updatedAt);
    }

    const insertGoal = database.prepare(`
      INSERT INTO goals (id, org_id, owner_id, title, description, key_results, standards, period_type, period, parent_goal_id, status, progress, visibility, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const goalsParentsFirst = [...data.data.goals].sort(
      (a: any, b: any) => Number(!!a.parentGoalId) - Number(!!b.parentGoalId)
    );
    for (const goal of goalsParentsFirst) {
      insertGoal.run(goal.id, goal.orgId, goal.ownerId, goal.title, goal.description, goal.keyResults, goal.standards ?? null, goal.periodType ?? null, goal.period ?? null, goal.parentGoalId ?? null, goal.status, goal.progress, goal.visibility, goal.createdAt, goal.updatedAt);
    }

    const insertComment = database.prepare(`
      INSERT INTO comments (id, goal_id, author_id, content, type, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const comment of data.data.comments) {
      insertComment.run(comment.id, comment.goalId, comment.authorId, comment.content, comment.type, comment.status, comment.createdAt, comment.updatedAt);
    }

    const insertParticipant = database.prepare(`
      INSERT INTO goal_participants (goal_id, user_id, role, plan, plan_updated_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const p of data.data.participants ?? []) {
      insertParticipant.run(p.goalId, p.userId, p.role, p.plan, p.planUpdatedAt, p.createdAt);
    }
    const insertGrayArea = database.prepare(`
      INSERT INTO gray_areas (id, goal_id, plan_user_id, author_id, content, status, resolution, resolved_by, created_at, resolved_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const g of data.data.grayAreas ?? []) {
      insertGrayArea.run(g.id, g.goalId, g.planUserId, g.authorId, g.content, g.status, g.resolution, g.resolvedBy, g.createdAt, g.resolvedAt);
    }
    database.exec(`
      INSERT OR IGNORE INTO goal_participants (goal_id, user_id, role)
      SELECT id, owner_id, 'driver' FROM goals WHERE owner_id IS NOT NULL
    `);
  });

  transaction();
}

function sortOrgsByHierarchy(orgs: any[]): any[] {
  const result: any[] = [];
  const remaining = [...orgs];
  const addedIds = new Set<string>();

  // First add root orgs
  for (let i = remaining.length - 1; i >= 0; i--) {
    if (remaining[i].parentId === null) {
      result.push(remaining[i]);
      addedIds.add(remaining[i].id);
      remaining.splice(i, 1);
    }
  }

  // Then add children iteratively
  while (remaining.length > 0) {
    let addedAny = false;
    for (let i = remaining.length - 1; i >= 0; i--) {
      if (remaining[i].parentId && addedIds.has(remaining[i].parentId)) {
        result.push(remaining[i]);
        addedIds.add(remaining[i].id);
        remaining.splice(i, 1);
        addedAny = true;
      }
    }
    if (!addedAny && remaining.length > 0) {
      result.push(...remaining);
      break;
    }
  }

  return result;
}

function initializeSchema(): void {
  if (!db) return;
  db.exec(schema);

  // Schema has no migrations: add columns introduced after a db was first created.
  const goalColumns = db.prepare('PRAGMA table_info(goals)').all() as { name: string }[];
  if (!goalColumns.some((c) => c.name === 'standards')) {
    db.exec('ALTER TABLE goals ADD COLUMN standards TEXT');
  }
  if (!goalColumns.some((c) => c.name === 'period_type')) {
    db.exec("ALTER TABLE goals ADD COLUMN period_type TEXT CHECK (period_type IN ('annual', 'quarterly'))");
    db.exec('ALTER TABLE goals ADD COLUMN period TEXT');
    db.exec('ALTER TABLE goals ADD COLUMN parent_goal_id TEXT REFERENCES goals(id)');
  }
  // Goal owners work on their goals: give goals that predate participants an owner row.
  db.exec(`
    INSERT OR IGNORE INTO goal_participants (goal_id, user_id, role)
    SELECT id, owner_id, 'driver' FROM goals WHERE owner_id IS NOT NULL
  `);
  for (const table of ['organizations', 'users']) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (!columns.some((c) => c.name === 'mcp_disabled')) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN mcp_disabled INTEGER NOT NULL DEFAULT 0`);
    }
    if (table === 'organizations' && !columns.some((c) => c.name === 'standards')) {
      db.exec('ALTER TABLE organizations ADD COLUMN standards TEXT');
    }
  }
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
