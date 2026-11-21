import { FastifyInstance } from 'fastify';
import { getAllAppSettings, setAppSetting, deleteAppSetting } from '../../models/appSettings.js';
import { getConfig } from '../../config/index.js';
import { SettingType } from '../../models/types.js';
import { exportToJson, importFromJson, JsonExport } from '../../db/json-data.js';
import { adminMiddleware } from '../middleware/admin.js';

export async function settingsRoutes(server: FastifyInstance): Promise<void> {
  server.get('/settings', async (request, reply) => {
    const settings = getAllAppSettings();
    const config = getConfig();

    return reply.view('settings/index.ejs', {
      title: 'App Settings - Waypoint',
      user: request.user,
      currentPath: '/settings',
      settings,
      config: {
        dbPath: config.dbPath,
        webPort: config.webPort,
        webEnabled: config.webEnabled,
      },
    });
  });

  server.post<{
    Body: {
      key: string;
      value: string;
      description?: string;
      type?: SettingType;
    };
  }>('/settings', { preHandler: adminMiddleware }, async (request, reply) => {
    const { key, value, description, type } = request.body;

    if (!key || !value) {
      return reply.redirect('/settings?error=Key and value are required');
    }

    setAppSetting({
      key: key.trim(),
      value: value.trim(),
      description: description?.trim() || null,
      type: type || 'string',
    });

    return reply.redirect('/settings?success=Setting saved');
  });

  server.post<{
    Body: { key: string };
  }>('/settings/delete', { preHandler: adminMiddleware }, async (request, reply) => {
    const { key } = request.body;

    if (key) {
      deleteAppSetting(key);
    }

    return reply.redirect('/settings?success=Setting deleted');
  });

  // Full data backup, shareable with another Waypoint instance.
  server.get('/settings/export', { preHandler: adminMiddleware }, async (_request, reply) => {
    const stamp = new Date().toISOString().slice(0, 10);
    return reply
      .header('content-type', 'application/json; charset=utf-8')
      .header('content-disposition', `attachment; filename="waypoint-data-${stamp}.json"`)
      .send(JSON.stringify(exportToJson(), null, 2));
  });

  // Replaces ALL data with an uploaded export (the whole import runs in one transaction).
  server.post<{ Body: JsonExport }>(
    '/settings/import',
    { preHandler: adminMiddleware, bodyLimit: 32 * 1024 * 1024 },
    async (request, reply) => {
      const data = request.body;
      if (!data || typeof data !== 'object' || !data.data || !Array.isArray(data.data.organizations) || !Array.isArray(data.data.users)) {
        return reply.status(400).send({ error: 'Not a Waypoint export file.' });
      }
      // Importing clears every session, so make sure someone can still log in as an admin afterwards.
      if (!data.data.users.some((u) => u.isAdmin)) {
        return reply.status(400).send({ error: 'The file contains no admin user; importing it would lock everyone out.' });
      }
      try {
        importFromJson(data);
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : 'Import failed' });
      }
      return reply.send({ ok: true });
    }
  );
}
