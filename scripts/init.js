#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { bootstrapAdmin } from '../dist/db/bootstrap.js';
import { getDb, closeDb } from '../dist/db/index.js';

// Usage: npm run init -- --email you@example.com [--name "Your Name"] [--org "Company"]
const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    name: { type: 'string' },
    org: { type: 'string' },
  },
});

if (!values.email) {
  console.error('Usage: npm run init -- --email you@example.com [--name "Your Name"] [--org "Company"]');
  process.exit(1);
}

try {
  getDb();
  const result = bootstrapAdmin({ email: values.email, name: values.name, orgName: values.org });
  if (!result) {
    console.error('This database already has users; init only works on an empty instance.');
    process.exit(1);
  }
  console.log(`Created organization "${result.organization.name}" and admin ${result.admin.email}.`);
  console.log(`Admin user id (for WAYPOINT_USER_ID): ${result.admin.id}`);
  console.log('Start with `npm start`, open http://localhost:3000 and log in with that email.');
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
} finally {
  closeDb();
}
