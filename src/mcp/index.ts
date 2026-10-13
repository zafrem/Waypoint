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

export function createMcpServer(): Server {
  const server = new Server(
    {
      name: 'northstar',
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
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
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

    if (uri === CURRENT_USER_RESOURCE_URI) {
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

    if (name === ASK_WITH_CONTEXT_PROMPT_NAME) {
      return getAskWithContextPrompt(args);
    }

    throw new Error(`Unknown prompt: ${name}`);
  });

  // Register tool handlers
  server.setRequestHandler(ListToolsRequestSchema, async () => {
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
            },
            required: ['keyword'],
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
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

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
