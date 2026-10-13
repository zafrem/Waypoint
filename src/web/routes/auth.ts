import { FastifyInstance } from 'fastify';
import { getUserByEmail } from '../../models/user.js';
import { createSession, deleteSessionByToken } from '../../models/webSession.js';
import { setSessionCookie, clearSessionCookie, getSessionToken } from '../middleware/auth.js';

export async function authRoutes(server: FastifyInstance): Promise<void> {
  server.get('/auth/login', async (request, reply) => {
    const token = getSessionToken(request);
    if (token) {
      // Already logged in, redirect to dashboard
      return reply.redirect('/');
    }

    return reply.view('auth/login.ejs', {
      title: 'Login - Waypoint',
      error: null,
    });
  });

  server.post<{
    Body: { email: string };
  }>('/auth/login', async (request, reply) => {
    const { email } = request.body;

    if (!email || typeof email !== 'string') {
      return reply.view('auth/login.ejs', {
        title: 'Login - Waypoint',
        error: 'Please enter your email address',
      });
    }

    const user = getUserByEmail(email.trim().toLowerCase());

    if (!user) {
      return reply.view('auth/login.ejs', {
        title: 'Login - Waypoint',
        error: 'No user found with that email address',
      });
    }

    const { token } = createSession(user.id);
    setSessionCookie(reply, token);

    return reply.redirect('/');
  });

  server.get('/auth/logout', async (request, reply) => {
    const token = getSessionToken(request);
    if (token) {
      deleteSessionByToken(token);
      clearSessionCookie(reply);
    }

    return reply.redirect('/auth/login');
  });

  server.post('/auth/logout', async (request, reply) => {
    const token = getSessionToken(request);
    if (token) {
      deleteSessionByToken(token);
      clearSessionCookie(reply);
    }

    return reply.redirect('/auth/login');
  });
}
