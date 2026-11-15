import { OrgRelationship } from '../models/types.js';
import { getAllDescendants, getChildOrganizations, getOrganizationById, getOrganizationPath } from '../models/organization.js';

/**
 * Compute the relationship between two organizations.
 *
 * Relationships:
 * - SELF: Same organization
 * - PARENT: userOrg is a direct child of targetOrg
 * - CHILD: userOrg is a direct parent of targetOrg
 * - ANCESTOR: targetOrg is an ancestor (not direct parent) of userOrg
 * - DESCENDANT: targetOrg is a descendant (not direct child) of userOrg
 * - SIBLING: userOrg and targetOrg share the same parent
 * - NONE: No relationship found
 */
export function computeRelationship(
  userOrgId: string,
  targetOrgId: string
): OrgRelationship {
  // Same organization
  if (userOrgId === targetOrgId) {
    return 'SELF';
  }

  const userOrg = getOrganizationById(userOrgId);
  const targetOrg = getOrganizationById(targetOrgId);

  if (!userOrg || !targetOrg) {
    return 'NONE';
  }

  // Check if targetOrg is user's direct parent
  if (userOrg.parentId === targetOrgId) {
    return 'PARENT';
  }

  // Check if targetOrg is user's direct child
  if (targetOrg.parentId === userOrgId) {
    return 'CHILD';
  }

  // Check if they're siblings (same parent)
  if (
    userOrg.parentId &&
    targetOrg.parentId &&
    userOrg.parentId === targetOrg.parentId
  ) {
    return 'SIBLING';
  }

  // Get full path from root to user's org
  const userPath = getOrganizationPath(userOrgId);
  const userPathIds = new Set(userPath.map((o) => o.id));

  // Check if targetOrg is an ancestor (in user's path)
  if (userPathIds.has(targetOrgId)) {
    return 'ANCESTOR';
  }

  // Get full path from root to target's org
  const targetPath = getOrganizationPath(targetOrgId);
  const targetPathIds = new Set(targetPath.map((o) => o.id));

  // Check if targetOrg is a descendant (user is in target's path)
  if (targetPathIds.has(userOrgId)) {
    return 'DESCENDANT';
  }

  return 'NONE';
}

/**
 * Get all organization IDs that a user can access based on their org membership.
 * This includes:
 * - Their own organization (SELF)
 * - All ancestors up to root (PARENT, ANCESTOR)
 * - All descendants (CHILD, DESCENDANT)
 * - All siblings (SIBLING)
 */
export function getAccessibleOrgIds(userOrgId: string): string[] {
  const orgIds = new Set<string>();
  const userOrg = getOrganizationById(userOrgId);

  if (!userOrg) {
    return [];
  }

  // Add self
  orgIds.add(userOrgId);

  // Add all ancestors (parent, grandparent, etc.)
  const path = getOrganizationPath(userOrgId);
  for (const org of path) {
    orgIds.add(org.id);
  }

  // Add all descendants (children, grandchildren, etc.)
  const descendants = getAllDescendants(userOrgId);
  for (const org of descendants) {
    orgIds.add(org.id);
  }

  // Add siblings (orgs with same parent)
  if (userOrg.parentId) {
    const siblings = getSiblingOrgIds(userOrgId);
    for (const siblingId of siblings) {
      orgIds.add(siblingId);
    }
  }

  return Array.from(orgIds);
}

/**
 * Get sibling organization IDs (same parent, excluding self)
 */
export function getSiblingOrgIds(orgId: string): string[] {
  const org = getOrganizationById(orgId);
  if (!org || !org.parentId) {
    return [];
  }

  const siblings = getChildOrganizations(org.parentId);
  return siblings.filter((s) => s.id !== orgId).map((s) => s.id);
}

/**
 * Check if user's org is an ancestor of target org
 */
export function isAncestorOf(userOrgId: string, targetOrgId: string): boolean {
  const targetPath = getOrganizationPath(targetOrgId);
  return targetPath.some((org) => org.id === userOrgId);
}

/**
 * Check if user's org is a descendant of target org
 */
export function isDescendantOf(userOrgId: string, targetOrgId: string): boolean {
  const userPath = getOrganizationPath(userOrgId);
  return userPath.some((org) => org.id === targetOrgId);
}
