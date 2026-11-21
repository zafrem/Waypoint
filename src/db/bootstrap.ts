import { getDb } from './index.js';
import { createOrganization, getRootOrganizations } from '../models/organization.js';
import { createUser } from '../models/user.js';
import { createRoles, ROLE_IDS } from './seed.js';
import { Organization, User } from '../models/types.js';

export interface BootstrapInput {
  email: string;
  name?: string;
  orgName?: string;
}

export interface BootstrapResult {
  organization: Organization;
  admin: User;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** True when no user exists yet, i.e. the instance still needs its first admin. */
export function needsBootstrap(): boolean {
  const row = getDb().prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number };
  return row.count === 0;
}

/**
 * First-run setup: default roles, a root organization, and the initial admin.
 * Does nothing (returns null) once any user exists, so it can never be used to add
 * an admin to a running instance.
 */
export function bootstrapAdmin(input: BootstrapInput): BootstrapResult | null {
  const email = input.email?.trim().toLowerCase();
  if (!email || !EMAIL.test(email)) {
    throw new Error('A valid admin email address is required.');
  }
  if (!needsBootstrap()) return null;

  const db = getDb();
  return db.transaction(() => {
    const noRoles = (db.prepare('SELECT COUNT(*) AS count FROM roles').get() as { count: number }).count === 0;
    if (noRoles) createRoles();

    const organization =
      getRootOrganizations()[0] ??
      createOrganization({ name: input.orgName?.trim() || 'My Organization', description: 'Root organization' });

    const admin = createUser({
      orgId: organization.id,
      roleId: ROLE_IDS.EXECUTIVE,
      name: input.name?.trim() || 'Administrator',
      email,
      jobFunction: 'System Administrator',
      isAdmin: true,
      isLeader: true,
    });
    return { organization, admin };
  })();
}

/** Bootstrap from WAYPOINT_ADMIN_EMAIL / _NAME / WAYPOINT_ORG_NAME when the instance is empty. */
export function bootstrapFromEnv(): BootstrapResult | null {
  const email = process.env.WAYPOINT_ADMIN_EMAIL;
  if (!email || !needsBootstrap()) return null;
  return bootstrapAdmin({
    email,
    name: process.env.WAYPOINT_ADMIN_NAME,
    orgName: process.env.WAYPOINT_ORG_NAME,
  });
}
