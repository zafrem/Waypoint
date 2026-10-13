import { FastifyInstance } from 'fastify';
import { getAllAppSettings, setAppSetting, deleteAppSetting } from '../../models/appSettings.js';
import { getConfig } from '../../config/index.js';
import { SettingType } from '../../models/types.js';

export async function settingsRoutes(server: FastifyInstance): Promise<void> {
  server.get('/settings', async (request, reply) => {
    const settings = getAllAppSettings();
    const config = getConfig();

    return reply.view('settings/index.ejs', {
      title: 'App Settings - Waypoint',
      user: request.user,
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
  }>('/settings', async (request, reply) => {
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
  }>('/settings/delete', async (request, reply) => {
    const { key } = request.body;

    if (key) {
      deleteAppSetting(key);
    }

    return reply.redirect('/settings?success=Setting deleted');
  });
}
