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
    console.log('Loaded data from waypoint-data.json');
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
    // Sort organizations so parents come before children
    const sortedOrgs = sortOrgsByHierarchy(data.data.organizations);

    const insertOrg = database.prepare(`
      INSERT INTO organizations (id, parent_id, name, description, ai_guidelines, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const org of sortedOrgs) {
      insertOrg.run(org.id, org.parentId, org.name, org.description, org.aiGuidelines, org.createdAt, org.updatedAt);
    }

    const insertUser = database.prepare(`
      INSERT INTO users (id, org_id, role_id, name, email, job_function, is_admin, is_leader, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const user of data.data.users) {
      insertUser.run(user.id, user.orgId, user.roleId || null, user.name, user.email, user.jobFunction, user.isAdmin ? 1 : 0, user.isLeader ? 1 : 0, user.createdAt, user.updatedAt);
    }

    const insertGoal = database.prepare(`
      INSERT INTO goals (id, org_id, owner_id, title, description, key_results, standards, status, progress, visibility, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const goal of data.data.goals) {
      insertGoal.run(goal.id, goal.orgId, goal.ownerId, goal.title, goal.description, goal.keyResults, goal.standards ?? null, goal.status, goal.progress, goal.visibility, goal.createdAt, goal.updatedAt);
    }

    const insertComment = database.prepare(`
      INSERT INTO comments (id, goal_id, author_id, content, type, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const comment of data.data.comments) {
      insertComment.run(comment.id, comment.goalId, comment.authorId, comment.content, comment.type, comment.status, comment.createdAt, comment.updatedAt);
    }
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
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
