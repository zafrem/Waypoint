import { FastifyRequest, FastifyReply } from 'fastify';
import { getValidSessionByToken } from '../../models/webSession.js';
import { getUserById } from '../../models/user.js';
import { getOrCreateUserPreferences } from '../../models/userPreferences.js';
import { User, UserPreferences } from '../../models/types.js';

const SESSION_COOKIE_NAME = 'waypoint_session';

declare module 'fastify' {
  interface FastifyRequest {
    user?: User;
    preferences?: UserPreferences;
  }
  interface FastifyReply {
    locals?: Record<string, unknown>;
  }
}

export function getSessionToken(request: FastifyRequest): string | undefined {
  return request.cookies[SESSION_COOKIE_NAME];
}

export function setSessionCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(SESSION_COOKIE_NAME, token, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE_NAME, {
    path: '/',
  });
}

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const token = getSessionToken(request);

  if (!token) {
    return reply.redirect('/auth/login');
  }

  const session = getValidSessionByToken(token);
  if (!session) {
    clearSessionCookie(reply);
    return reply.redirect('/auth/login');
  }

  const user = getUserById(session.userId);
  if (!user) {
    clearSessionCookie(reply);
    return reply.redirect('/auth/login');
  }

  request.user = user;
  const preferences = getOrCreateUserPreferences(user.id);
  request.preferences = preferences;
  reply.locals = { ...(reply.locals || {}), preferences, currentPath: request.url.split('?')[0] };
}

export async function optionalAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const token = getSessionToken(request);

  if (!token) {
    return;
  }

  const session = getValidSessionByToken(token);
  if (!session) {
    return;
  }

  const user = getUserById(session.userId);
  if (user) {
    request.user = user;
    const preferences = getOrCreateUserPreferences(user.id);
    request.preferences = preferences;
    reply.locals = { ...(reply.locals || {}), preferences, currentPath: request.url.split('?')[0] };
  }
}
