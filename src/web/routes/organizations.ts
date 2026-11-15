import { FastifyInstance } from 'fastify';
import {
  getAllOrganizations,
  getOrganizationById,
  updateOrganization,
} from '../../models/organization.js';
import { getUsersByOrgId } from '../../models/user.js';
import {
  formatStandardsText,
  getGoalsByOrgId,
  parseStandards,
  parseStandardsText,
} from '../../models/goal.js';
import { getOrganizationMcpStatus } from '../../services/mcpAccess.js';
import { canViewGoal } from '../../services/planAccess.js';
import { adminMiddleware } from '../middleware/admin.js';

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
    const goals = getGoalsByOrgId(id).filter((g) => canViewGoal(request.user, g));

    return reply.view('organizations/view.ejs', {
      title: `${organization.name} - Waypoint`,
      user: request.user,
      organization,
      standards: parseStandards(organization.standards),
      users,
      goals,
      mcpStatus: getOrganizationMcpStatus(organization),
    });
  });

  server.get<{
    Params: { id: string };
  }>('/organizations/:id/edit', { preHandler: adminMiddleware }, async (request, reply) => {
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
      standardsText: formatStandardsText(organization.standards),
      error: null,
    });
  });

  server.post<{
    Params: { id: string };
    Body: {
      name?: string;
      description?: string;
      aiGuidelines?: string;
      standards?: string;
      mcpDisabled?: string;
    };
  }>('/organizations/:id', { preHandler: adminMiddleware }, async (request, reply) => {
    const { id } = request.params;
    const { name, description, aiGuidelines, standards, mcpDisabled } = request.body;

    const organization = getOrganizationById(id);
    if (!organization) {
      return reply.status(404).view('layouts/error.ejs', {
        title: 'Not Found - Waypoint',
        user: request.user,
        message: 'Organization not found',
      });
    }

    try {
      const standardsArray = standards !== undefined ? parseStandardsText(standards) : undefined;
      updateOrganization(id, {
        name: name?.trim() || undefined,
        description: description?.trim() || undefined,
        aiGuidelines: aiGuidelines?.trim() || undefined,
        ...(standardsArray !== undefined ? { standards: standardsArray } : {}),
        mcpDisabled: mcpDisabled === '1',
      });

      return reply.redirect(`/organizations/${id}?success=Organization updated`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update organization';
      return reply.view('organizations/edit.ejs', {
        title: `Edit ${organization.name} - Waypoint`,
        user: request.user,
        organization,
        standardsText: standards ?? formatStandardsText(organization.standards),
        error: message,
      });
    }
  });
}
