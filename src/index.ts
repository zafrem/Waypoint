import { getDb, closeDb } from './db/index.js';
import { startMcpServer } from './mcp/index.js';
import { startWebServer } from './web/index.js';
import { bootstrapFromEnv, needsBootstrap } from './db/bootstrap.js';
import { getConfig } from './config/index.js';

async function main(): Promise<void> {
  const config = getConfig();

  // Initialize database
  getDb();

  // First run: create the initial admin from WAYPOINT_ADMIN_EMAIL (no-op once any user exists)
  const created = bootstrapFromEnv();
  if (created) {
    console.error(`Created initial admin ${created.admin.email} (user id ${created.admin.id}) in "${created.organization.name}".`);
  } else if (config.webEnabled && needsBootstrap()) {
    console.error('No users yet. Set WAYPOINT_ADMIN_EMAIL (and restart) or run `npm run init -- --email you@example.com`.');
  }
  if (config.webEnabled && config.webSessionSecret === 'change-me-in-production' && config.webHost !== '127.0.0.1') {
    console.error('WARNING: WAYPOINT_SESSION_SECRET is the default value. Set a long random secret.');
  }

  // Start web server (if enabled) — writes to stderr so stdout remains clean for MCP stdio JSON-RPC
  if (config.webEnabled) {
    await startWebServer();
  }

  // Start MCP server (stdio); disabled in web-only deployments such as the Docker image
  if (config.mcpEnabled) {
    await startMcpServer();
  } else if (!config.webEnabled) {
    throw new Error('Both the web UI and the MCP server are disabled; nothing to run.');
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  closeDb();
  process.exit(1);
});
