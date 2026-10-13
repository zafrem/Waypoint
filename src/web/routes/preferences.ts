import { FastifyInstance } from 'fastify';
import { getOrCreateUserPreferences, updateUserPreferences } from '../../models/userPreferences.js';
import { Theme, GoalVisibility } from '../../models/types.js';

export async function preferencesRoutes(server: FastifyInstance): Promise<void> {
  server.get('/preferences', async (request, reply) => {
    const preferences = getOrCreateUserPreferences(request.user!.id);

    return reply.view('preferences/index.ejs', {
      title: 'User Preferences - Waypoint',
      user: request.user,
      preferences,
    });
  });

  server.post<{
    Body: {
      theme?: Theme;
      defaultGoalVisibility?: GoalVisibility;
      notificationsEnabled?: string;
      locale?: string;
      timezone?: string;
    };
  }>('/preferences', async (request, reply) => {
    const { theme, defaultGoalVisibility, notificationsEnabled, locale, timezone } = request.body;

    updateUserPreferences(request.user!.id, {
      theme: theme as Theme,
      defaultGoalVisibility: defaultGoalVisibility as GoalVisibility,
      notificationsEnabled: notificationsEnabled === 'on' || notificationsEnabled === '1',
      locale,
      timezone,
    });

    return reply.redirect('/preferences?success=Preferences saved');
  });
}
