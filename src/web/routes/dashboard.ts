import { FastifyInstance } from 'fastify';
import { getAllOrganizations } from '../../models/organization.js';
import { getAllUsers } from '../../models/user.js';
import { getAllGoals } from '../../models/goal.js';
import { Organization } from '../../models/types.js';

interface OrgNode {
  id: string;
  name: string;
  leader: { id: string; name: string; jobFunction: string | null } | null;
  goalCount: number;
  activeGoalCount: number;
  children: OrgNode[];
}

function buildOrgTree(
  organizations: Organization[],
  users: { id: string; orgId: string; name: string; jobFunction: string | null; isLeader: boolean }[],
  goals: { orgId: string; status: string }[]
): OrgNode[] {
  const orgMap = new Map<string, OrgNode>();

  // Create nodes for all organizations
  for (const org of organizations) {
    const orgGoals = goals.filter(g => g.orgId === org.id);
    const leader = users.find(u => u.orgId === org.id && u.isLeader);

    orgMap.set(org.id, {
      id: org.id,
      name: org.name,
      leader: leader ? { id: leader.id, name: leader.name, jobFunction: leader.jobFunction } : null,
      goalCount: orgGoals.length,
      activeGoalCount: orgGoals.filter(g => g.status === 'in_progress').length,
      children: [],
    });
  }

  // Build tree structure
  const roots: OrgNode[] = [];
  for (const org of organizations) {
    const node = orgMap.get(org.id)!;
    if (org.parentId && orgMap.has(org.parentId)) {
      orgMap.get(org.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export async function dashboardRoutes(server: FastifyInstance): Promise<void> {
  server.get('/', async (request, reply) => {
    const organizations = getAllOrganizations();
    const users = getAllUsers();
    const goals = getAllGoals();

    const orgTree = buildOrgTree(organizations, users, goals);

    return reply.view('dashboard.ejs', {
      title: 'Dashboard - Waypoint',
      user: request.user,
      currentPath: '/',
      stats: {
        organizations: organizations.length,
        users: users.length,
        goals: goals.length,
        activeGoals: goals.filter((g) => g.status === 'in_progress').length,
      },
      orgTree: JSON.stringify(orgTree),
    });
  });
}
