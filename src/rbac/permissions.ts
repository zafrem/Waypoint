import { OrgRelationship, User } from '../models/types.js';
import { getRolePermissions } from '../models/role.js';

export type Action =
  | 'goal:read'
  | 'goal:create'
  | 'goal:update'
  | 'goal:delete'
  | 'comment:read'
  | 'comment:create'
  | 'comment:submit_question'
  | 'comment:respond'
  | 'organization:read'
  | 'organization:update'
  | 'prompt:input'      // Access to sensitive context in input prompts
  | 'prompt:output'     // Access to strategic AI analysis outputs
  | 'vector:search';     // Access to semantic vector database search

/**
 * Permission matrix defining what actions are allowed for each relationship type.
 *
 * | Relationship | Goals           | Comments                    | Organization    |
 * |-------------|-----------------|-----------------------------|-----------------
 * | SELF        | Full CRUD       | Full CRUD                   | Read, Update    |
 * | PARENT      | Read            | Submit questions            | Read            |
 * | CHILD       | Read            | Read, Respond               | Read            |
 * | ANCESTOR    | Read            | Read                        | Read            |
 * | DESCENDANT  | Read            | Read                        | Read            |
 * | SIBLING     | Read (visible)  | Submit questions            | Read            |
 * | NONE        | No access       | No access                   | No access       |
 */
const PERMISSION_MATRIX: Record<OrgRelationship, Set<Action>> = {
  SELF: new Set([
    'goal:read',
    'goal:create',
    'goal:update',
    'goal:delete',
    'comment:read',
    'comment:create',
    'comment:submit_question',
    'comment:respond',
    'organization:read',
    'organization:update',
  ]),
  PARENT: new Set([
    'goal:read',
    'comment:submit_question',
    'organization:read',
  ]),
  CHILD: new Set([
    'goal:read',
    'comment:read',
    'comment:respond',
    'organization:read',
  ]),
  ANCESTOR: new Set([
    'goal:read',
    'comment:read',
    'organization:read',
  ]),
  DESCENDANT: new Set([
    'goal:read',
    'comment:read',
    'organization:read',
  ]),
  SIBLING: new Set([
    'goal:read',
    'comment:submit_question',
    'organization:read',
  ]),
  NONE: new Set(),
};

/**
 * Check if a given relationship allows a specific action.
 */
export function hasOrgPermission(relationship: OrgRelationship, action: Action): boolean {
  return PERMISSION_MATRIX[relationship]?.has(action) ?? false;
}

/**
 * Check if a user has a specific role-based permission.
 */
export function hasRolePermission(user: User, action: Action): boolean {
  if (user.isAdmin) return true;
  if (!user.roleId) return false;

  const permissions = getRolePermissions(user.roleId);
  return permissions.includes(action);
}

/**
 * Combined permission check: considers both organizational relationship and user role.
 */
export function hasPermission(
  user: User,
  relationship: OrgRelationship,
  action: Action
): boolean {
  // Check role-based permission first (mandatory for specific actions)
  if (['prompt:input', 'prompt:output', 'vector:search'].includes(action)) {
    return hasRolePermission(user, action);
  }

  // For other actions, check both relationship and role
  return hasOrgPermission(relationship, action) || hasRolePermission(user, action);
}

/**
 * Get all allowed actions for a given relationship.
 */
export function getAllowedActions(relationship: OrgRelationship): Action[] {
  return Array.from(PERMISSION_MATRIX[relationship]);
}

/**
 * Check multiple permissions at once.
 */
export function hasAllPermissions(
  user: User,
  relationship: OrgRelationship,
  actions: Action[]
): boolean {
  return actions.every((action) => hasPermission(user, relationship, action));
}

/**
 * Check if any of the specified permissions are granted.
 */
export function hasAnyPermission(
  user: User,
  relationship: OrgRelationship,
  actions: Action[]
): boolean {
  return actions.some((action) => hasPermission(user, relationship, action));
}
