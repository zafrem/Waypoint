import { Organization, User } from '../models/types.js';
import { getOrganizationPath } from '../models/organization.js';
import { getUserById } from '../models/user.js';
import { getConfig } from '../config/index.js';

export type McpStatus =
  | { disabled: false }
  | { disabled: true; source: 'self' | 'inherited'; orgName?: string };

const ENABLED: McpStatus = { disabled: false };

function inheritedFrom(path: Organization[]): McpStatus {
  const blocking = path.find((org) => org.mcpDisabled);
  return blocking ? { disabled: true, source: 'inherited', orgName: blocking.name } : ENABLED;
}

/**
 * A user is disabled by their own flag, or by the flag on their organization or any ancestor.
 */
export function getUserMcpStatus(user: User): McpStatus {
  if (user.mcpDisabled) {
    return { disabled: true, source: 'self' };
  }
  return inheritedFrom(getOrganizationPath(user.orgId));
}

/**
 * An organization is disabled by its own flag or by any ancestor's.
 */
export function getOrganizationMcpStatus(org: Organization): McpStatus {
  const path = getOrganizationPath(org.id);
  if (org.mcpDisabled) {
    return { disabled: true, source: 'self' };
  }
  return inheritedFrom(path.filter((o) => o.id !== org.id));
}

/**
 * True when MCP access is disabled for this user (by their own flag or an organization above them).
 */
export function isMcpDisabled(user: User): boolean {
  return getUserMcpStatus(user).disabled;
}

/**
 * True when the user this server runs as (WAYPOINT_USER_ID) has MCP access disabled.
 * With no configured or unknown user there is nothing to disable, so this is false.
 */
export function isConfiguredUserMcpDisabled(): boolean {
  const { userId } = getConfig();
  const user = userId ? getUserById(userId) : null;
  return user ? isMcpDisabled(user) : false;
}
