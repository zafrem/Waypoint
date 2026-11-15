import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { isConfiguredUserMcpDisabled } from '../services/mcpAccess.js';

import { CURRENT_USER_RESOURCE_URI, getCurrentUserResource } from './resources/currentUser.js';
import {
  ASK_WITH_CONTEXT_PROMPT_NAME,
  getAskWithContextPrompt,
} from './prompts/askWithContext.js';
import {
  getParentGoals,
  getParentGoalsSchema,
} from './tools/getParentGoals.js';
import {
  searchCollaboratorGoals,
  searchCollaboratorGoalsSchema,
} from './tools/searchCollaboratorGoals.js';
import {
  submitQuestion,
  submitQuestionSchema,
} from './tools/submitQuestion.js';
import {
  semanticSearch,
  semanticSearchSchema,
} from './tools/semanticSearch.js';

import {
  getGoalPlans,
  getGoalPlansSchema,
  raiseGrayAreaSchema,
  raiseGrayAreaTool,
  resolveGrayAreaSchema,
  resolveGrayAreaTool,
  updateMyPlan,
  updateMyPlanSchema,
} from './tools/goalPlans.js';
import {
  lookupStandards,
  lookupStandardsSchema,
} from './tools/lookupStandards.js';

export function createMcpServer(): Server {
  const server = new Server(
    {
      name: 'waypoint',
      version: '1.0.0',
    },
    {
      capabilities: {
        resources: {},
        tools: {},
        prompts: {},
      },
    }
  );

  // Register resource handlers
  // When MCP access is disabled for the configured user (or their organization), the server
  // advertises nothing and rejects direct calls as if the resource, prompt or tool did not exist.
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    if (isConfiguredUserMcpDisabled()) return { resources: [] };
    return {
      resources: [
        {
          uri: CURRENT_USER_RESOURCE_URI,
          name: 'Current User Context',
          description:
            'Provides context about the current user including their organization, goals, and AI guidelines.',
          mimeType: 'text/markdown',
        },
      ],
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    if (uri === CURRENT_USER_RESOURCE_URI && !isConfiguredUserMcpDisabled()) {
      const resource = getCurrentUserResource();
      if (!resource) {
        throw new Error('Failed to get current user resource');
      }
      return {
        contents: [resource],
      };
    }

    throw new Error(`Unknown resource: ${uri}`);
  });

  // Register prompt handlers
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    if (isConfiguredUserMcpDisabled()) return { prompts: [] };
    return {
      prompts: [
        {
          name: ASK_WITH_CONTEXT_PROMPT_NAME,
          description:
            'Ask a question with the current user\'s organizational context (goals, guidelines, hierarchy) automatically attached.',
          arguments: [
            {
              name: 'question',
              description: 'The question to ask (optional)',
              required: false,
            },
          ],
        },
      ],
    };
  });

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === ASK_WITH_CONTEXT_PROMPT_NAME && !isConfiguredUserMcpDisabled()) {
      return getAskWithContextPrompt(args);
    }

    throw new Error(`Unknown prompt: ${name}`);
  });

  // Register tool handlers
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    if (isConfiguredUserMcpDisabled()) return { tools: [] };
    return {
      tools: [
        {
          name: 'get_parent_goals',
          description:
            'Get goals from parent organizations in the hierarchy. Use this to understand strategic context and alignment.',
          inputSchema: {
            type: 'object',
            properties: {
              org_id: {
                type: 'string',
                description: 'The organization ID to get parent goals for',
              },
              include_past_periods: {
                type: 'boolean',
                description:
                  'Also include goals from other years/quarters (default: current period only)',
              },
            },
            required: ['org_id'],
          },
        },
        {
          name: 'search_collaborator_goals',
          description:
            'Search for goals from collaborator organizations (siblings, parents, ancestors). Use this to find alignment opportunities and understand cross-team dependencies.',
          inputSchema: {
            type: 'object',
            properties: {
              keyword: {
                type: 'string',
                description: 'Keyword to search for in goal titles and descriptions',
              },
              include_past_periods: {
                type: 'boolean',
                description:
                  'Also include goals from other years/quarters (default: current period only)',
              },
            },
            required: ['keyword'],
          },
        },
        {
          name: 'get_goal_plans',
          description:
            "Get everyone's execution plans and the gray areas (unclear points) for a goal you work on. Plans are only shared with the people working on the same goal.",
          inputSchema: {
            type: 'object',
            properties: {
              goal_id: { type: 'string', description: 'The ID of a goal you work on' },
            },
            required: ['goal_id'],
          },
        },
        {
          name: 'update_my_plan',
          description:
            'Write or update your own execution plan for a goal you work on: what you will do and how you read its key results. Leaders set objectives; the people doing the work write the plans.',
          inputSchema: {
            type: 'object',
            properties: {
              goal_id: { type: 'string', description: 'The ID of a goal you work on' },
              plan: { type: 'string', description: 'Your execution plan for the goal' },
            },
            required: ['goal_id', 'plan'],
          },
        },
        {
          name: 'raise_gray_area',
          description:
            "Flag something unclear in a goal or a teammate's plan so the group can clarify it. Visible only to the people working on the goal.",
          inputSchema: {
            type: 'object',
            properties: {
              goal_id: { type: 'string', description: 'The ID of a goal you work on' },
              question: { type: 'string', description: 'What is unclear or ambiguous' },
              plan_user_id: {
                type: 'string',
                description: 'User ID of the teammate whose plan this is about (omit if about the goal itself)',
              },
            },
            required: ['goal_id', 'question'],
          },
        },
        {
          name: 'resolve_gray_area',
          description: 'Record how an open gray area was clarified.',
          inputSchema: {
            type: 'object',
            properties: {
              gray_area_id: { type: 'string', description: 'The ID of the open gray area' },
              resolution: { type: 'string', description: 'How it was clarified' },
            },
            required: ['gray_area_id', 'resolution'],
          },
        },
        {
          name: 'submit_question',
          description:
            'Submit a question about a goal from another organization. Use this to clarify dependencies or seek alignment.',
          inputSchema: {
            type: 'object',
            properties: {
              goal_id: {
                type: 'string',
                description: 'The ID of the goal to submit a question about',
              },
              question: {
                type: 'string',
                description: 'The question to submit',
              },
            },
            required: ['goal_id', 'question'],
          },
        },
        {
          name: 'semantic_search',
          description:
            'Perform a semantic vector search across organizational goals to find alignment and context. Requires specialized permissions.',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'The semantic search query',
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'lookup_standards',
          description:
            'Look up standard term definitions, variable/metadata field names (e.g. membersrl), and common functions that everyone in your organization and active goals must follow.',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description:
                  'Optional keyword to search by term name, standard identifier (e.g. "membersrl"), or description',
              },
              type: {
                type: 'string',
                enum: ['document', 'term', 'variable', 'metadata', 'function', 'ui_element', 'template'],
                description: 'Optional filter by standard type',
              },
            },
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (isConfiguredUserMcpDisabled()) {
      throw new Error(`Unknown tool: ${name}`);
    }

    switch (name) {
      case 'get_parent_goals': {
        const input = getParentGoalsSchema.parse(args);
        const result = getParentGoals(input);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'search_collaborator_goals': {
        const input = searchCollaboratorGoalsSchema.parse(args);
        const result = searchCollaboratorGoals(input);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'get_goal_plans':
      case 'update_my_plan':
      case 'raise_gray_area':
      case 'resolve_gray_area': {
        const result =
          name === 'get_goal_plans'
            ? getGoalPlans(getGoalPlansSchema.parse(args))
            : name === 'update_my_plan'
              ? updateMyPlan(updateMyPlanSchema.parse(args))
              : name === 'raise_gray_area'
                ? raiseGrayAreaTool(raiseGrayAreaSchema.parse(args))
                : resolveGrayAreaTool(resolveGrayAreaSchema.parse(args));
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'submit_question': {
        const input = submitQuestionSchema.parse(args);
        const result = submitQuestion(input);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'semantic_search': {
        const input = semanticSearchSchema.parse(args);
        const result = semanticSearch(input);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'lookup_standards': {
        const input = lookupStandardsSchema.parse(args ?? {});
        const result = lookupStandards(input);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });

  return server;
}

export async function startMcpServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    await server.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await server.close();
    process.exit(0);
  });
}
