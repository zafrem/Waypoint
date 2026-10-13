import { getConfig } from '../../config/index.js';
import { buildUserContext, formatUserContext } from '../../services/context.js';
import { getUserById } from '../../models/user.js';
import { isMcpDisabled } from '../../services/mcpAccess.js';

export const CURRENT_USER_RESOURCE_URI = 'waypoint://context/current_user';

export interface ResourceContent {
  uri: string;
  mimeType: string;
  text: string;
}

export function getCurrentUserResource(): ResourceContent | null {
  const config = getConfig();

  if (!config.userId) {
    return {
      uri: CURRENT_USER_RESOURCE_URI,
      mimeType: 'text/plain',
      text: 'Error: WAYPOINT_USER_ID environment variable is not set.',
    };
  }

  const user = getUserById(config.userId);
  if (user && isMcpDisabled(user)) {
    return {
      uri: CURRENT_USER_RESOURCE_URI,
      mimeType: 'text/plain',
      text: '',
    };
  }

  const context = buildUserContext(config.userId);

  if (!context) {
    return {
      uri: CURRENT_USER_RESOURCE_URI,
      mimeType: 'text/plain',
      text: `Error: User with ID "${config.userId}" not found.`,
    };
  }

  return {
    uri: CURRENT_USER_RESOURCE_URI,
    mimeType: 'text/markdown',
    text: formatUserContext(context),
  };
}
