import Fastify, { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyView from '@fastify/view';
import fastifyFormbody from '@fastify/formbody';
import fastifyCookie from '@fastify/cookie';
import ejs from 'ejs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getConfig } from '../config/index.js';
import { registerRoutes } from './routes/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function createWebServer(): Promise<FastifyInstance> {
  const config = getConfig();

  const server = Fastify({
    logger: true,
  });

  // Register plugins
  await server.register(fastifyCookie, {
    secret: config.webSessionSecret,
  });

  await server.register(fastifyFormbody);

  // Static files - resolve to project root public folder
  // __dirname in dist is dist/web, so we go up 2 levels to reach project root
  const publicPath = path.resolve(__dirname, '../../public');
  await server.register(fastifyStatic, {
    root: publicPath,
    prefix: '/public/',
  });

  // EJS templates - views are in src/web/views (not compiled to dist)
  const viewsPath = path.resolve(__dirname, '../../src/web/views');
  await server.register(fastifyView, {
    engine: { ejs },
    root: viewsPath,
    defaultContext: {
      title: 'Waypoint',
    },
  });

  // Register routes
  await registerRoutes(server);

  return server;
}

export async function startWebServer(): Promise<void> {
  const config = getConfig();

  if (!config.webEnabled) {
    console.log('Web UI is disabled');
    return;
  }

  try {
    const server = await createWebServer();
    await server.listen({ port: config.webPort, host: '0.0.0.0' });
    console.log(`Web UI available at http://localhost:${config.webPort}`);
  } catch (error) {
    console.error('Failed to start web server:', error);
    throw error;
  }
}
