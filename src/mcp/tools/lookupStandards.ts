import { z } from 'zod';
import { isMcpDisabled } from '../../services/mcpAccess.js';
import { getConfig } from '../../config/index.js';
import { getUserById } from '../../models/user.js';
import { buildUserContext } from '../../services/context.js';
import { InheritedStandard, StandardType } from '../../models/types.js';
import { STANDARD_TYPES } from '../../models/goal.js';

export const lookupStandardsSchema = z.object({
  query: z
    .string()
    .optional()
    .describe(
      'Optional keyword to search by term name, standard identifier (e.g. "membersrl"), or description. Omit to list all applicable standards.'
    ),
  type: z
    .enum(STANDARD_TYPES as [StandardType, ...StandardType[]])
    .optional()
    .describe('Optional filter by standard type (term, variable, metadata, function, document, ui_element, template)'),
});

export type LookupStandardsInput = z.infer<typeof lookupStandardsSchema>;

export interface LookupStandardsResult {
  success: boolean;
  error?: string;
  data?: InheritedStandard[];
}

export function lookupStandards(input: LookupStandardsInput): LookupStandardsResult {
  const config = getConfig();
  if (!config.userId) {
    return {
      success: false,
      error: 'WAYPOINT_USER_ID environment variable is not set.',
    };
  }

  const user = getUserById(config.userId);
  if (!user) {
    return {
      success: false,
      error: `User with ID "${config.userId}" not found.`,
    };
  }

  if (isMcpDisabled(user)) {
    return {
      success: false,
      error: 'Not available.',
    };
  }

  const context = buildUserContext(user.id);
  if (!context) {
    return {
      success: false,
      error: 'Failed to build user context.',
    };
  }

  let matches = context.standards;

  if (input.type) {
    matches = matches.filter((s) => s.type === input.type);
  }

  if (input.query?.trim()) {
    const q = input.query.trim().toLowerCase();
    matches = matches.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.identifier && s.identifier.toLowerCase().includes(q)) ||
        s.content.toLowerCase().includes(q)
    );
  }

  return {
    success: true,
    data: matches,
  };
}
