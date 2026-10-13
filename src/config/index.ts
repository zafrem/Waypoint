export interface Config {
  userId: string | undefined;
  dbPath: string;
  webEnabled: boolean;
  webPort: number;
  webSessionSecret: string;
}

export function getConfig(): Config {
  return {
    userId: process.env.WAYPOINT_USER_ID,
    dbPath: process.env.WAYPOINT_DB_PATH || './waypoint.db',
    webEnabled: process.env.WAYPOINT_WEB_ENABLED !== 'false',
    webPort: parseInt(process.env.WAYPOINT_WEB_PORT || '3000', 10),
    webSessionSecret: process.env.WAYPOINT_SESSION_SECRET || 'change-me-in-production',
  };
}
