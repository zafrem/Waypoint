import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getGoalById, parseStandards, periodLabel } from '../../models/goal.js';
import { getAllUsers, getUserById } from '../../models/user.js';
import { getOrganizationById } from '../../models/organization.js';
import {
  PARTICIPANT_ROLES,
  addParticipant,
  getParticipant,
  getParticipantsByGoalId,
  removeParticipant,
  setPlan,
} from '../../models/participant.js';
import { getGrayAreaById, getGrayAreasByGoalId, raiseGrayArea, resolveGrayArea } from '../../models/grayArea.js';
import { Goal, ParticipantRole } from '../../models/types.js';
import { canDiscussPlans, canManageParticipants, canViewGoal, canViewPlans } from '../../services/planAccess.js';
import { esc } from '../services/escape.js';

function notFound(request: FastifyRequest, reply: FastifyReply) {
  return reply.status(404).view('layouts/error.ejs', {
    title: 'Not Found - Waypoint',
    user: request.user,
    message: 'Goal not found',
  });
}

function forbidden(request: FastifyRequest, reply: FastifyReply) {
  return reply.status(403).view('layouts/error.ejs', {
    title: 'Access Denied - Waypoint',
    user: request.user,
    message: 'You do not have permission to do this on this goal.',
  });
}

const back = (goalId: string, kind: 'success' | 'error', message: string) =>
  `/goals/${goalId}?${kind}=${encodeURIComponent(message)}`;

export async function goalsRoutes(server: FastifyInstance): Promise<void> {
  // The objective is visible like any goal; the plans below it only to the people working on it.
  const loadGoal = (request: FastifyRequest<{ Params: { id: string } }>): Goal | null => {
    const goal = getGoalById(request.params.id);
    if (!goal || !request.user) return null;
    return canViewGoal(request.user, goal) ? goal : null;
  };

  server.get<{
    Params: { id: string };
    Querystring: { success?: string; error?: string };
  }>('/goals/:id', async (request, reply) => {
    const goal = loadGoal(request);
    if (!goal) return notFound(request, reply);
    const user = request.user!;

    const showPlans = canViewPlans(user, goal);
    const participants = showPlans
      ? getParticipantsByGoalId(goal.id).flatMap((p) => {
          const person = getUserById(p.userId);
          return person ? [{ ...p, name: person.name }] : [];
        })
      : [];
    const names = new Map(getAllUsers().map((u) => [u.id, u.name]));

    return reply.view('goals/view.ejs', {
      title: `${goal.title} - Waypoint`,
      user,
      goal,
      standards: parseStandards(goal.standards),
      esc,
      periodLabel: periodLabel(goal),
      orgName: getOrganizationById(goal.orgId)?.name ?? 'Unknown',
      ownerName: goal.ownerId ? names.get(goal.ownerId) ?? 'Unknown' : null,
      showPlans,
      canDiscuss: canDiscussPlans(user, goal),
      canManage: canManageParticipants(user, goal),
      participants,
      grayAreas: showPlans ? getGrayAreasByGoalId(goal.id) : [],
      names,
      people: canManageParticipants(user, goal) ? getAllUsers() : [],
      roles: PARTICIPANT_ROLES,
      success: request.query.success || null,
      error: request.query.error || null,
    });
  });

  // Each person writes their own plan.
  server.post<{ Params: { id: string }; Body: { plan?: string } }>('/goals/:id/plan', async (request, reply) => {
    const goal = loadGoal(request);
    if (!goal) return notFound(request, reply);
    const user = request.user!;
    if (!getParticipant(goal.id, user.id)) return forbidden(request, reply);
    setPlan(goal.id, user.id, request.body.plan ?? '');
    return reply.redirect(back(goal.id, 'success', 'Plan saved'));
  });

  server.post<{ Params: { id: string }; Body: { content?: string; planUserId?: string } }>(
    '/goals/:id/gray-areas',
    async (request, reply) => {
      const goal = loadGoal(request);
      if (!goal) return notFound(request, reply);
      if (!canDiscussPlans(request.user!, goal)) return forbidden(request, reply);
      const planUserId = request.body.planUserId || null;
      if (planUserId && !getParticipant(goal.id, planUserId)) {
        return reply.redirect(back(goal.id, 'error', 'That person has no plan on this goal.'));
      }
      try {
        raiseGrayArea({
          goalId: goal.id,
          authorId: request.user!.id,
          content: request.body.content ?? '',
          planUserId,
        });
      } catch (e) {
        return reply.redirect(back(goal.id, 'error', e instanceof Error ? e.message : 'Failed'));
      }
      return reply.redirect(back(goal.id, 'success', 'Gray area raised'));
    }
  );

  server.post<{ Params: { id: string; grayId: string }; Body: { resolution?: string } }>(
    '/goals/:id/gray-areas/:grayId/resolve',
    async (request, reply) => {
      const goal = loadGoal(request);
      if (!goal) return notFound(request, reply);
      if (!canDiscussPlans(request.user!, goal)) return forbidden(request, reply);
      const gray = getGrayAreaById(request.params.grayId);
      if (!gray || gray.goalId !== goal.id) return notFound(request, reply);
      try {
        resolveGrayArea(gray.id, request.user!.id, request.body.resolution ?? '');
      } catch (e) {
        return reply.redirect(back(goal.id, 'error', e instanceof Error ? e.message : 'Failed'));
      }
      return reply.redirect(back(goal.id, 'success', 'Gray area resolved'));
    }
  );

  // The goal owner (or an admin) decides who works on the goal.
  server.post<{ Params: { id: string }; Body: { userId?: string; role?: string } }>(
    '/goals/:id/participants',
    async (request, reply) => {
      const goal = loadGoal(request);
      if (!goal) return notFound(request, reply);
      if (!canManageParticipants(request.user!, goal)) return forbidden(request, reply);
      const { userId, role } = request.body;
      if (!userId || !getUserById(userId)) return reply.redirect(back(goal.id, 'error', 'Choose a person.'));
      try {
        addParticipant(goal.id, userId, (role as ParticipantRole) || 'contributor');
      } catch (e) {
        return reply.redirect(back(goal.id, 'error', e instanceof Error ? e.message : 'Failed'));
      }
      return reply.redirect(back(goal.id, 'success', 'Participant saved'));
    }
  );

  server.post<{ Params: { id: string; userId: string } }>(
    '/goals/:id/participants/:userId/remove',
    async (request, reply) => {
      const goal = loadGoal(request);
      if (!goal) return notFound(request, reply);
      if (!canManageParticipants(request.user!, goal)) return forbidden(request, reply);
      if (request.params.userId === goal.ownerId) {
        return reply.redirect(back(goal.id, 'error', 'The goal owner always works on the goal.'));
      }
      removeParticipant(goal.id, request.params.userId);
      return reply.redirect(back(goal.id, 'success', 'Participant removed'));
    }
  );
}
