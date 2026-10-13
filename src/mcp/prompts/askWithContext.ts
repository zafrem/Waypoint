import { getCurrentUserResource } from '../resources/currentUser.js';

export const ASK_WITH_CONTEXT_PROMPT_NAME = 'ask_with_context';

export function getAskWithContextPrompt(args?: Record<string, unknown>) {
  const resource = getCurrentUserResource();
  const context = resource ? resource.text : 'Context not available.';
  const hasContext = context.trim() !== '';
  
  const question = args?.question ? String(args.question) : '';

  return {
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: hasContext
            ? `Use the following organizational context to answer my question.\n\n${context}\n\n${question ? `Question: ${question}` : 'How can I help you today regarding your goals?'}`
            : question,
        },
      },
    ],
  };
}
