import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.js';
import { authRoutes } from './auth.js';
import { dashboardRoutes } from './dashboard.js';
import { settingsRoutes } from './settings.js';
import { preferencesRoutes } from './preferences.js';
import { organizationsRoutes } from './organizations.js';
import { usersRoutes } from './users.js';
import { goalsRoutes } from './goals.js';
import { adminRoutes } from './admin.js';

export async function registerRoutes(server: FastifyInstance): Promise<void> {
  // Public routes (no auth required)
  await server.register(authRoutes);

  // Protected routes (auth required)
  await server.register(async (protectedServer) => {
    protectedServer.addHook('preHandler', authMiddleware);

    await protectedServer.register(dashboardRoutes);
    await protectedServer.register(settingsRoutes);
    await protectedServer.register(preferencesRoutes);
    await protectedServer.register(organizationsRoutes);
    await protectedServer.register(usersRoutes);
    await protectedServer.register(goalsRoutes);
    await protectedServer.register(adminRoutes);
  });
}
