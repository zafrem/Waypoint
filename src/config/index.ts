export interface Config {
  userId: string | undefined;
  dbPath: string;
  webEnabled: boolean;
  webHost: string;
  webPort: number;
  mcpEnabled: boolean;
  webSessionSecret: string;
}

export function getConfig(): Config {
  return {
    userId: process.env.WAYPOINT_USER_ID,
    dbPath: process.env.WAYPOINT_DB_PATH || './waypoint.db',
    webEnabled: process.env.WAYPOINT_WEB_ENABLED !== 'false',
    // Loopback by default: login is email-only, so do not expose it unless you front it with auth.
    webHost: process.env.WAYPOINT_WEB_HOST || '127.0.0.1',
    webPort: parseInt(process.env.WAYPOINT_WEB_PORT || '3000', 10),
    mcpEnabled: process.env.WAYPOINT_MCP_ENABLED !== 'false',
    webSessionSecret: process.env.WAYPOINT_SESSION_SECRET || 'change-me-in-production',
  };
}
