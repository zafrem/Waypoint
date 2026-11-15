import { getDb, closeDb } from './db/index.js';
import { startMcpServer } from './mcp/index.js';
import { startWebServer } from './web/index.js';
import { getConfig } from './config/index.js';

async function main(): Promise<void> {
  const config = getConfig();

  // Initialize database
  getDb();

  // Start web server (if enabled) — writes to stderr so stdout remains clean for MCP stdio JSON-RPC
  if (config.webEnabled) {
    await startWebServer();
  }

  // Start MCP server
  await startMcpServer();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  closeDb();
  process.exit(1);
});
