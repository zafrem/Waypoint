import { FastifyInstance } from 'fastify';
import { getAllUsers, getUserById, updateUser } from '../../models/user.js';
import { getOrganizationById, getAllOrganizations } from '../../models/organization.js';
import { getGoalsByOwnerId } from '../../models/goal.js';
import { getAllRoles, getRoleById } from '../../models/role.js';
import { getUserMcpStatus } from '../../services/mcpAccess.js';
import { canViewGoal } from '../../services/planAccess.js';
import { adminMiddleware } from '../middleware/admin.js';

export async function usersRoutes(server: FastifyInstance): Promise<void> {
  server.get('/users', async (request, reply) => {
    const users = getAllUsers();
    const organizations = getAllOrganizations();
    const roles = getAllRoles();

    // Create maps for display
    const orgMap = new Map(organizations.map((org) => [org.id, org.name]));
    const roleMap = new Map(roles.map((role) => [role.id, role.name]));

    const mcpStatus = new Map(users.map((u) => [u.id, getUserMcpStatus(u)]));

    return reply.view('users/index.ejs', {
      title: 'Users - Waypoint',
      user: request.user,
      users,
      mcpStatus,
      orgMap,
      roleMap,
    });
  });

  server.get<{
    Params: { id: string };
  }>('/users/:id', async (request, reply) => {
    const { id } = request.params;
    const targetUser = getUserById(id);

    if (!targetUser) {
      return reply.status(404).view('layouts/error.ejs', {
        title: 'Not Found - Waypoint',
        user: request.user,
        message: 'User not found',
      });
    }

    const organization = getOrganizationById(targetUser.orgId);
    const goals = getGoalsByOwnerId(id).filter((g) => canViewGoal(request.user, g));
    const role = targetUser.roleId ? getRoleById(targetUser.roleId) : null;

    return reply.view('users/view.ejs', {
      title: `${targetUser.name} - Waypoint`,
      user: request.user,
      targetUser,
      organization,
      goals,
      role,
      mcpStatus: getUserMcpStatus(targetUser),
    });
  });

  server.get<{
    Params: { id: string };
  }>('/users/:id/edit', { preHandler: adminMiddleware }, async (request, reply) => {
    const { id } = request.params;
    const targetUser = getUserById(id);

    if (!targetUser) {
      return reply.status(404).view('layouts/error.ejs', {
        title: 'Not Found - Waypoint',
        user: request.user,
        message: 'User not found',
      });
    }

    const organizations = getAllOrganizations();
    const roles = getAllRoles();

    return reply.view('users/edit.ejs', {
      title: `Edit ${targetUser.name} - Waypoint`,
      user: request.user,
      targetUser,
      organizations,
      roles,
      error: null,
    });
  });

  server.post<{
    Params: { id: string };
    Body: {
      name?: string;
      email?: string;
      jobFunction?: string;
      roleId?: string;
      mcpDisabled?: string;
    };
  }>('/users/:id', { preHandler: adminMiddleware }, async (request, reply) => {
    const { id } = request.params;
    const { name, email, jobFunction, roleId, mcpDisabled } = request.body;

    const targetUser = getUserById(id);
    if (!targetUser) {
      return reply.status(404).view('layouts/error.ejs', {
        title: 'Not Found - Waypoint',
        user: request.user,
        message: 'User not found',
      });
    }

    try {
      updateUser(id, {
        name: name?.trim() || undefined,
        email: email?.trim() || undefined,
        jobFunction: jobFunction?.trim() || undefined,
        roleId: roleId !== undefined ? roleId || null : targetUser.roleId,
        mcpDisabled: mcpDisabled === '1',
      });

      return reply.redirect(`/users/${id}?success=User updated`);
    } catch (error: unknown) {
      const organizations = getAllOrganizations();
      const roles = getAllRoles();
      const message = error instanceof Error ? error.message : 'Failed to update user';
      return reply.view('users/edit.ejs', {
        title: `Edit ${targetUser.name} - Waypoint`,
        user: request.user,
        targetUser,
        organizations,
        roles,
        error: message.includes('UNIQUE') ? 'Email already exists' : message,
      });
    }
  });
}
