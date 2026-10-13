import { FastifyInstance } from 'fastify';
import {
  getAllOrganizations,
  getOrganizationById,
  updateOrganization,
} from '../../models/organization.js';
import { getUsersByOrgId } from '../../models/user.js';
import { getGoalsByOrgId } from '../../models/goal.js';
import { getOrganizationMcpStatus } from '../../services/mcpAccess.js';

export async function organizationsRoutes(server: FastifyInstance): Promise<void> {
  server.get('/organizations', async (request, reply) => {
    const organizations = getAllOrganizations();

    const mcpStatus = new Map(organizations.map((o) => [o.id, getOrganizationMcpStatus(o)]));

    return reply.view('organizations/index.ejs', {
      title: 'Organizations - Waypoint',
      user: request.user,
      organizations,
      mcpStatus,
    });
  });

  server.get<{
    Params: { id: string };
  }>('/organizations/:id', async (request, reply) => {
    const { id } = request.params;
    const organization = getOrganizationById(id);

    if (!organization) {
      return reply.status(404).view('layouts/error.ejs', {
        title: 'Not Found - Waypoint',
        user: request.user,
        message: 'Organization not found',
      });
    }

    const users = getUsersByOrgId(id);
    const goals = getGoalsByOrgId(id);

    return reply.view('organizations/view.ejs', {
      title: `${organization.name} - Waypoint`,
      user: request.user,
      organization,
      users,
      goals,
      mcpStatus: getOrganizationMcpStatus(organization),
    });
  });

  server.get<{
    Params: { id: string };
  }>('/organizations/:id/edit', async (request, reply) => {
    const { id } = request.params;
    const organization = getOrganizationById(id);

    if (!organization) {
      return reply.status(404).view('layouts/error.ejs', {
        title: 'Not Found - Waypoint',
        user: request.user,
        message: 'Organization not found',
      });
    }

    return reply.view('organizations/edit.ejs', {
      title: `Edit ${organization.name} - Waypoint`,
      user: request.user,
      organization,
    });
  });

  server.post<{
    Params: { id: string };
    Body: {
      name?: string;
      description?: string;
      aiGuidelines?: string;
      mcpDisabled?: string;
    };
  }>('/organizations/:id', async (request, reply) => {
    const { id } = request.params;
    const { name, description, aiGuidelines, mcpDisabled } = request.body;

    const organization = getOrganizationById(id);
    if (!organization) {
      return reply.status(404).view('layouts/error.ejs', {
        title: 'Not Found - Waypoint',
        user: request.user,
        message: 'Organization not found',
      });
    }

    updateOrganization(id, {
      name: name?.trim() || undefined,
      description: description?.trim() || undefined,
      aiGuidelines: aiGuidelines?.trim() || undefined,
      // Only admins may change MCP access; ignore the field for everyone else.
      mcpDisabled: request.user?.isAdmin ? mcpDisabled === '1' : undefined,
    });

    return reply.redirect(`/organizations/${id}?success=Organization updated`);
  });
}
