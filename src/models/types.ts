// Enums
export type GoalStatus = 'not_started' | 'in_progress' | 'completed' | 'cancelled';
export type GoalPeriodType = 'annual' | 'quarterly';
export type ParticipantRole = 'driver' | 'contributor' | 'reviewer';
export type GrayAreaStatus = 'open' | 'resolved';
export type GoalVisibility = 'public' | 'private' | 'team_only';
export type CommentType = 'question' | 'response' | 'note';
export type CommentStatus = 'pending' | 'answered' | 'closed';
export type SettingType = 'string' | 'number' | 'boolean' | 'json';
export type Theme = 'light' | 'dark' | 'system';

export type OrgRelationship =
  | 'SELF'
  | 'PARENT'
  | 'CHILD'
  | 'SIBLING'
  | 'ANCESTOR'
  | 'DESCENDANT'
  | 'NONE';

// Core entities
export interface Organization {
  id: string;
  parentId: string | null;
  name: string;
  description: string | null;
  aiGuidelines: string | null;
  standards: string | null; // JSON string of Standard[]
  mcpDisabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  orgId: string;
  roleId: string | null;
  name: string;
  email: string;
  jobFunction: string | null;
  isAdmin: boolean;
  isLeader: boolean;
  mcpDisabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type StandardType =
  | 'document'
  | 'term'
  | 'variable'
  | 'metadata'
  | 'function'
  | 'ui_element'
  | 'template';

export interface Standard {
  type: StandardType;
  name: string;
  /** Standard identifier, variable/metadata field name, or function signature (e.g., `membersrl`). */
  identifier?: string | null;
  content: string;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RolePermission {
  roleId: string;
  permission: string;
}

export interface Goal {
  id: string;
  orgId: string;
  ownerId: string | null;
  title: string;
  description: string | null;
  keyResults: string | null; // JSON string of key results
  standards: string | null; // JSON string of Standard[]
  periodType: GoalPeriodType | null; // null = ongoing, no period
  period: string | null; // '2026' (annual) or '2026-Q3' (quarterly)
  parentGoalId: string | null; // annual goal a quarterly goal supports
  status: GoalStatus;
  progress: number;
  visibility: GoalVisibility;
  createdAt: string;
  updatedAt: string;
}

export interface GoalParticipant {
  goalId: string;
  userId: string;
  role: ParticipantRole;
  plan: string | null;
  planUpdatedAt: string | null;
  createdAt: string;
}

export interface GrayArea {
  id: string;
  goalId: string;
  planUserId: string | null; // null = about the goal itself, not one person's plan
  authorId: string;
  content: string;
  status: GrayAreaStatus;
  resolution: string | null;
  resolvedBy: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface Comment {
  id: string;
  goalId: string;
  authorId: string;
  content: string;
  type: CommentType;
  status: CommentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AppSetting {
  key: string;
  value: string;
  description: string | null;
  type: SettingType;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  id: string;
  userId: string;
  theme: Theme;
  defaultGoalVisibility: GoalVisibility;
  notificationsEnabled: boolean;
  locale: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface WebSession {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
}

// Database row types (snake_case from SQLite)
export interface OrganizationRow {
  id: string;
  parent_id: string | null;
  name: string;
  description: string | null;
  ai_guidelines: string | null;
  standards?: string | null;
  mcp_disabled: number;
  created_at: string;
  updated_at: string;
}

export interface UserRow {
  id: string;
  org_id: string;
  role_id: string | null;
  name: string;
  email: string;
  job_function: string | null;
  is_admin: number;
  is_leader: number;
  mcp_disabled: number;
  created_at: string;
  updated_at: string;
}

export interface RoleRow {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface RolePermissionRow {
  role_id: string;
  permission: string;
}

export interface GoalRow {
  id: string;
  org_id: string;
  owner_id: string | null;
  title: string;
  description: string | null;
  key_results: string | null;
  standards: string | null;
  period_type: GoalPeriodType | null;
  period: string | null;
  parent_goal_id: string | null;
  status: GoalStatus;
  progress: number;
  visibility: GoalVisibility;
  created_at: string;
  updated_at: string;
}

export interface GoalParticipantRow {
  goal_id: string;
  user_id: string;
  role: ParticipantRole;
  plan: string | null;
  plan_updated_at: string | null;
  created_at: string;
}

export interface GrayAreaRow {
  id: string;
  goal_id: string;
  plan_user_id: string | null;
  author_id: string;
  content: string;
  status: GrayAreaStatus;
  resolution: string | null;
  resolved_by: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface CommentRow {
  id: string;
  goal_id: string;
  author_id: string;
  content: string;
  type: CommentType;
  status: CommentStatus;
  created_at: string;
  updated_at: string;
}

export interface AppSettingRow {
  key: string;
  value: string;
  description: string | null;
  type: SettingType;
  created_at: string;
  updated_at: string;
}

export interface UserPreferencesRow {
  id: string;
  user_id: string;
  theme: Theme;
  default_goal_visibility: GoalVisibility;
  notifications_enabled: number;
  locale: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface WebSessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
}

// Conversion functions
export function toOrganization(row: OrganizationRow): Organization {
  return {
    id: row.id,
    parentId: row.parent_id,
    name: row.name,
    description: row.description,
    aiGuidelines: row.ai_guidelines,
    standards: row.standards ?? null,
    mcpDisabled: row.mcp_disabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toUser(row: UserRow): User {
  return {
    id: row.id,
    orgId: row.org_id,
    roleId: row.role_id,
    name: row.name,
    email: row.email,
    jobFunction: row.job_function,
    isAdmin: row.is_admin === 1,
    isLeader: row.is_leader === 1,
    mcpDisabled: row.mcp_disabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toRole(row: RoleRow): Role {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toGoal(row: GoalRow): Goal {
  return {
    id: row.id,
    orgId: row.org_id,
    ownerId: row.owner_id,
    title: row.title,
    description: row.description,
    keyResults: row.key_results,
    standards: row.standards,
    periodType: row.period_type,
    period: row.period,
    parentGoalId: row.parent_goal_id,
    status: row.status,
    progress: row.progress,
    visibility: row.visibility,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toGoalParticipant(row: GoalParticipantRow): GoalParticipant {
  return {
    goalId: row.goal_id,
    userId: row.user_id,
    role: row.role,
    plan: row.plan,
    planUpdatedAt: row.plan_updated_at,
    createdAt: row.created_at,
  };
}

export function toGrayArea(row: GrayAreaRow): GrayArea {
  return {
    id: row.id,
    goalId: row.goal_id,
    planUserId: row.plan_user_id,
    authorId: row.author_id,
    content: row.content,
    status: row.status,
    resolution: row.resolution,
    resolvedBy: row.resolved_by,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

export function toComment(row: CommentRow): Comment {
  return {
    id: row.id,
    goalId: row.goal_id,
    authorId: row.author_id,
    content: row.content,
    type: row.type,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toAppSetting(row: AppSettingRow): AppSetting {
  return {
    key: row.key,
    value: row.value,
    description: row.description,
    type: row.type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toUserPreferences(row: UserPreferencesRow): UserPreferences {
  return {
    id: row.id,
    userId: row.user_id,
    theme: row.theme,
    defaultGoalVisibility: row.default_goal_visibility,
    notificationsEnabled: row.notifications_enabled === 1,
    locale: row.locale,
    timezone: row.timezone,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toWebSession(row: WebSessionRow): WebSession {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

// Context types for MCP resources
export interface InheritedStandard extends Standard {
  sourceOrgId: string;
  sourceOrgName: string;
  sourceGoalId?: string;
  sourceGoalTitle?: string;
}

export interface UserContext {
  user: User;
  organization: Organization;
  orgPath: Organization[]; // Path from root to user's org
  currentGoals: Goal[];
  parentGoals: Goal[];
  guidelines: string[];
  standards: InheritedStandard[];
  work: GoalWork[];
}

/** A goal the user works on, with everyone's plans and the open gray areas. */
export interface GoalWork {
  goal: Goal;
  participants: Array<{ user: User; role: ParticipantRole; plan: string | null }>;
  openGrayAreas: Array<GrayArea & { authorName: string; planUserName: string | null }>;
}
