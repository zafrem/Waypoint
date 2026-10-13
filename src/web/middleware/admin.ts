import { FastifyRequest, FastifyReply } from 'fastify';

export async function adminMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!request.user) {
    return reply.redirect('/auth/login');
  }

  if (!request.user.isAdmin) {
    return reply.status(403).view('layouts/error.ejs', {
      title: 'Access Denied - Waypoint',
      user: request.user,
      message: 'You do not have permission to access this page.',
    });
  }
}
