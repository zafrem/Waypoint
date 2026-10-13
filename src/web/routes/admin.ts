import { FastifyInstance } from 'fastify';
import { adminMiddleware } from '../middleware/admin.js';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} from '../../models/user.js';
import {
  getAllOrganizations,
  getOrganizationById,
} from '../../models/organization.js';
import {
  getAllGoals,
  getGoalById,
  createGoal,
  updateGoal,
  deleteGoal,
  parseStandardsText,
} from '../../models/goal.js';
import { parseCSV, parseJSON, detectFormat, ImportResult } from '../services/personnelImport.js';
import { exportPersonnelToCSV, exportPersonnelToJSON } from '../services/personnelExport.js';

export async function adminRoutes(server: FastifyInstance): Promise<void> {
  // Apply admin middleware to all routes in this plugin
  server.addHook('preHandler', adminMiddleware);

  // Admin Dashboard
  server.get('/admin', async (request, reply) => {
    const users = getAllUsers();
    const organizations = getAllOrganizations();
    const goals = getAllGoals();

    const stats = {
      totalUsers: users.length,
      totalOrganizations: organizations.length,
      totalGoals: goals.length,
      adminUsers: users.filter((u) => u.isAdmin).length,
      leaderUsers: users.filter((u) => u.isLeader).length,
    };

    return reply.view('admin/index.ejs', {
      title: 'Admin Dashboard - NorthStar',
      user: request.user,
      currentPath: '/admin',
      stats,
    });
  });

  // Personnel List
  server.get('/admin/personnel', async (request, reply) => {
    const users = getAllUsers();
    const organizations = getAllOrganizations();
    const orgMap = new Map(organizations.map((org) => [org.id, org.name]));

    return reply.view('admin/personnel/index.ejs', {
      title: 'Personnel Management - NorthStar',
      user: request.user,
      currentPath: '/admin/personnel',
      users,
      orgMap,
    });
  });

  // Export Personnel
  server.get<{
    Querystring: { format?: 'csv' | 'json' };
  }>('/admin/personnel/export', async (request, reply) => {
    const { format } = request.query;
    const users = getAllUsers();
    
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `northstar-personnel-${timestamp}`;

    if (format === 'json') {
      const json = exportPersonnelToJSON(users);
      reply.header('Content-Type', 'application/json');
      reply.header('Content-Disposition', `attachment; filename="${filename}.json"`);
      return reply.send(json);
    } else {
      // Default to CSV
      const csv = exportPersonnelToCSV(users);
      reply.header('Content-Type', 'text/csv');
      reply.header('Content-Disposition', `attachment; filename="${filename}.csv"`);
      return reply.send(csv);
    }
  });

  // Add Personnel Form
  server.get('/admin/personnel/add', async (request, reply) => {
    const organizations = getAllOrganizations();

    return reply.view('admin/personnel/add.ejs', {
      title: 'Add Personnel - NorthStar',
      user: request.user,
      currentPath: '/admin/personnel',
      organizations,
      error: null,
    });
  });

  // Create Personnel
  server.post<{
    Body: {
      name: string;
      email: string;
      orgId: string;
      jobFunction?: string;
      isLeader?: string;
      isAdmin?: string;
    };
  }>('/admin/personnel', async (request, reply) => {
    const { name, email, orgId, jobFunction, isLeader, isAdmin } = request.body;
    const organizations = getAllOrganizations();

    if (!name?.trim() || !email?.trim() || !orgId) {
      return reply.view('admin/personnel/add.ejs', {
        title: 'Add Personnel - NorthStar',
        user: request.user,
        currentPath: '/admin/personnel',
        organizations,
        error: 'Name, email, and organization are required.',
      });
    }

    try {
      const newUser = createUser({
        name: name.trim(),
        email: email.trim(),
        orgId,
        jobFunction: jobFunction?.trim() || null,
        isLeader: isLeader === 'on',
        isAdmin: isAdmin === 'on',
      });

      return reply.redirect(`/admin/personnel/${newUser.id}/edit?success=Personnel created successfully`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create personnel';
      return reply.view('admin/personnel/add.ejs', {
        title: 'Add Personnel - NorthStar',
        user: request.user,
        currentPath: '/admin/personnel',
        organizations,
        error: message.includes('UNIQUE') ? 'Email already exists' : message,
      });
    }
  });

  // Import Personnel Form
  server.get('/admin/personnel/import', async (request, reply) => {
    return reply.view('admin/personnel/import.ejs', {
      title: 'Import Personnel - NorthStar',
      user: request.user,
      currentPath: '/admin/personnel',
      result: null,
      error: null,
    });
  });

  // Process Import
  server.post<{
    Body: {
      importData: string;
      format: 'csv' | 'json' | 'auto';
    };
  }>('/admin/personnel/import', async (request, reply) => {
    const { importData, format } = request.body;

    if (!importData?.trim()) {
      return reply.view('admin/personnel/import.ejs', {
        title: 'Import Personnel - NorthStar',
        user: request.user,
        currentPath: '/admin/personnel',
        result: null,
        error: 'Please provide data to import.',
      });
    }

    let detectedFormat = format;
    if (format === 'auto') {
      const detected = detectFormat(importData);
      if (!detected) {
        return reply.view('admin/personnel/import.ejs', {
          title: 'Import Personnel - NorthStar',
          user: request.user,
          currentPath: '/admin/personnel',
          result: null,
          error: 'Could not detect format. Please select CSV or JSON.',
        });
      }
      detectedFormat = detected;
    }

    let parseResult: ImportResult;
    if (detectedFormat === 'csv') {
      parseResult = parseCSV(importData);
    } else {
      parseResult = parseJSON(importData);
    }

    // Process successfully parsed users
    const created: string[] = [];
    const createErrors: { email: string; message: string }[] = [];

    for (const userData of parseResult.success) {
      try {
        const org = getOrganizationById(userData.orgId);
        if (!org) {
          createErrors.push({
            email: userData.email,
            message: `Organization not found: ${userData.orgId}`,
          });
          continue;
        }

        createUser({
          name: userData.name,
          email: userData.email,
          orgId: userData.orgId,
          jobFunction: userData.jobFunction || null,
          isLeader: userData.isLeader,
        });
        created.push(userData.email);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        createErrors.push({
          email: userData.email,
          message: message.includes('UNIQUE') ? 'Email already exists' : message,
        });
      }
    }

    return reply.view('admin/personnel/import.ejs', {
      title: 'Import Personnel - NorthStar',
      user: request.user,
      currentPath: '/admin/personnel',
      result: {
        created,
        parseErrors: parseResult.errors,
        createErrors,
      },
      error: null,
    });
  });

  // Edit Personnel Form
  server.get<{
    Params: { id: string };
    Querystring: { success?: string };
  }>('/admin/personnel/:id/edit', async (request, reply) => {
    const { id } = request.params;
    const { success } = request.query;
    const targetUser = getUserById(id);

    if (!targetUser) {
      return reply.status(404).view('layouts/error.ejs', {
        title: 'Not Found - NorthStar',
        user: request.user,
        message: 'Personnel not found',
      });
    }

    const organizations = getAllOrganizations();

    return reply.view('admin/personnel/edit.ejs', {
      title: `Edit ${targetUser.name} - NorthStar`,
      user: request.user,
      currentPath: '/admin/personnel',
      targetUser,
      organizations,
      error: null,
      success: success || null,
    });
  });

  // Update Personnel
  server.post<{
    Params: { id: string };
    Body: {
      name?: string;
      email?: string;
      jobFunction?: string;
      isLeader?: string;
      isAdmin?: string;
    };
  }>('/admin/personnel/:id', async (request, reply) => {
    const { id } = request.params;
    const { name, email, jobFunction, isLeader, isAdmin } = request.body;

    const targetUser = getUserById(id);
    if (!targetUser) {
      return reply.status(404).view('layouts/error.ejs', {
        title: 'Not Found - NorthStar',
        user: request.user,
        message: 'Personnel not found',
      });
    }

    try {
      updateUser(id, {
        name: name?.trim() || undefined,
        email: email?.trim() || undefined,
        jobFunction: jobFunction?.trim() || null,
        isLeader: isLeader === 'on',
        isAdmin: isAdmin === 'on',
      });

      return reply.redirect(`/admin/personnel/${id}/edit?success=Personnel updated successfully`);
    } catch (error: unknown) {
      const organizations = getAllOrganizations();
      const message = error instanceof Error ? error.message : 'Failed to update personnel';

      return reply.view('admin/personnel/edit.ejs', {
        title: `Edit ${targetUser.name} - NorthStar`,
        user: request.user,
        currentPath: '/admin/personnel',
        targetUser,
        organizations,
        error: message.includes('UNIQUE') ? 'Email already exists' : message,
        success: null,
      });
    }
  });

  // Delete Personnel
  server.post<{
    Params: { id: string };
  }>('/admin/personnel/:id/delete', async (request, reply) => {
    const { id } = request.params;

    // Prevent self-deletion
    if (id === request.user?.id) {
      return reply.redirect('/admin/personnel?error=Cannot delete yourself');
    }

    deleteUser(id);
    return reply.redirect('/admin/personnel?success=Personnel deleted successfully');
  });

  // Toggle Leader Status
  server.post<{
    Params: { id: string };
  }>('/admin/personnel/:id/toggle-leader', async (request, reply) => {
    const { id } = request.params;
    const targetUser = getUserById(id);

    if (!targetUser) {
      return reply.status(404).view('layouts/error.ejs', {
        title: 'Not Found - NorthStar',
        user: request.user,
        message: 'Personnel not found',
      });
    }

    updateUser(id, { isLeader: !targetUser.isLeader });
    return reply.redirect('/admin/personnel?success=Leader status updated');
  });

  // Goals List
  server.get<{
    Querystring: { orgId?: string };
  }>('/admin/goals', async (request, reply) => {
    const { orgId } = request.query;
    const goals = getAllGoals();
    const organizations = getAllOrganizations();
    const users = getAllUsers();

    const orgMap = new Map(organizations.map((org) => [org.id, org.name]));
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    const filteredGoals = orgId ? goals.filter((g) => g.orgId === orgId) : goals;

    return reply.view('admin/goals/index.ejs', {
      title: 'Goals Management - NorthStar',
      user: request.user,
      currentPath: '/admin/goals',
      goals: filteredGoals,
      organizations,
      orgMap,
      userMap,
      selectedOrgId: orgId || '',
    });
  });

  // Create Goal Form
  server.get('/admin/goals/create', async (request, reply) => {
    const organizations = getAllOrganizations();
    const users = getAllUsers();

    return reply.view('admin/goals/edit.ejs', {
      title: 'Create Goal - NorthStar',
      user: request.user,
      currentPath: '/admin/goals',
      goal: null,
      organizations,
      users,
      error: null,
      success: null,
    });
  });

  // Create Goal
  server.post<{
    Body: {
      title: string;
      description?: string;
      orgId: string;
      ownerId?: string;
      status?: string;
      progress?: string;
      visibility?: string;
      keyResults?: string;
      standards?: string;
    };
  }>('/admin/goals', async (request, reply) => {
    const { title, description, orgId, ownerId, status, progress, visibility, keyResults, standards } =
      request.body;

    const organizations = getAllOrganizations();
    const users = getAllUsers();

    if (!title?.trim() || !orgId) {
      return reply.view('admin/goals/edit.ejs', {
        title: 'Create Goal - NorthStar',
        user: request.user,
        currentPath: '/admin/goals',
        goal: null,
        organizations,
        users,
        error: 'Title and organization are required.',
        success: null,
      });
    }

    try {
      const keyResultsArray = keyResults
        ?.split('\n')
        .map((kr) => kr.trim())
        .filter((kr) => kr.length > 0);
      const standardsArray = parseStandardsText(standards);

      const newGoal = createGoal({
        title: title.trim(),
        description: description?.trim() || null,
        orgId,
        ownerId: ownerId || null,
        status: (status as 'not_started' | 'in_progress' | 'completed' | 'cancelled') || 'not_started',
        progress: parseInt(progress || '0', 10),
        visibility: (visibility as 'public' | 'private' | 'team_only') || 'public',
        keyResults: keyResultsArray?.length ? keyResultsArray : null,
        standards: standardsArray,
      });

      return reply.redirect(`/admin/goals/${newGoal.id}/edit?success=Goal created successfully`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create goal';
      return reply.view('admin/goals/edit.ejs', {
        title: 'Create Goal - NorthStar',
        user: request.user,
        currentPath: '/admin/goals',
        goal: null,
        organizations,
        users,
        error: message,
        success: null,
      });
    }
  });

  // Edit Goal Form
  server.get<{
    Params: { id: string };
    Querystring: { success?: string };
  }>('/admin/goals/:id/edit', async (request, reply) => {
    const { id } = request.params;
    const { success } = request.query;
    const goal = getGoalById(id);

    if (!goal) {
      return reply.status(404).view('layouts/error.ejs', {
        title: 'Not Found - NorthStar',
        user: request.user,
        message: 'Goal not found',
      });
    }

    const organizations = getAllOrganizations();
    const users = getAllUsers();

    return reply.view('admin/goals/edit.ejs', {
      title: `Edit Goal - NorthStar`,
      user: request.user,
      currentPath: '/admin/goals',
      goal,
      organizations,
      users,
      error: null,
      success: success || null,
    });
  });

  // Update Goal
  server.post<{
    Params: { id: string };
    Body: {
      title?: string;
      description?: string;
      status?: string;
      progress?: string;
      visibility?: string;
      keyResults?: string;
      standards?: string;
    };
  }>('/admin/goals/:id', async (request, reply) => {
    const { id } = request.params;
    const { title, description, status, progress, visibility, keyResults, standards } = request.body;

    const goal = getGoalById(id);
    if (!goal) {
      return reply.status(404).view('layouts/error.ejs', {
        title: 'Not Found - NorthStar',
        user: request.user,
        message: 'Goal not found',
      });
    }

    try {
      const keyResultsArray = keyResults
        ?.split('\n')
        .map((kr) => kr.trim())
        .filter((kr) => kr.length > 0);
      const standardsArray = parseStandardsText(standards);

      updateGoal(id, {
        title: title?.trim() || undefined,
        description: description?.trim() || null,
        status: status as 'not_started' | 'in_progress' | 'completed' | 'cancelled',
        progress: progress !== undefined ? parseInt(progress, 10) : undefined,
        visibility: visibility as 'public' | 'private' | 'team_only',
        keyResults: keyResultsArray?.length ? keyResultsArray : null,
        standards: standardsArray,
      });

      return reply.redirect(`/admin/goals/${id}/edit?success=Goal updated successfully`);
    } catch (error: unknown) {
      const organizations = getAllOrganizations();
      const users = getAllUsers();
      const message = error instanceof Error ? error.message : 'Failed to update goal';

      return reply.view('admin/goals/edit.ejs', {
        title: `Edit Goal - NorthStar`,
        user: request.user,
        currentPath: '/admin/goals',
        goal,
        organizations,
        users,
        error: message,
        success: null,
      });
    }
  });

  // Delete Goal
  server.post<{
    Params: { id: string };
  }>('/admin/goals/:id/delete', async (request, reply) => {
    const { id } = request.params;
    deleteGoal(id);
    return reply.redirect('/admin/goals?success=Goal deleted successfully');
  });
}
