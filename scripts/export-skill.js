#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { getOrganizationByName, getOrganizationById } from '../dist/models/organization.js';
import { buildStandardsSkill } from '../dist/services/standardsSkill.js';
import { closeDb } from '../dist/db/index.js';

// Usage: npm run export:skill -- <organization name or id> [skills dir (default .claude/skills)]
const [orgArg, dirArg] = process.argv.slice(2);
if (!orgArg) {
  console.error('Usage: npm run export:skill -- <organization name or id> [skills dir]');
  process.exit(1);
}

try {
  const org = getOrganizationByName(orgArg) ?? getOrganizationById(orgArg);
  if (!org) throw new Error(`Organization "${orgArg}" not found`);
  const skill = buildStandardsSkill(org.id);
  const dir = resolve(process.cwd(), dirArg ?? '.claude/skills', skill.name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'SKILL.md'), skill.content);
  console.log(`Wrote ${resolve(dir, 'SKILL.md')}`);
} catch (error) {
  console.error('Error exporting skill:', error.message);
  process.exit(1);
} finally {
  closeDb();
}
