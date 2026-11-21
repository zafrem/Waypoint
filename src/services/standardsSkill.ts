import { stringify as stringifyYaml } from 'yaml';
import { Goal, InheritedStandard, Organization, StandardType, User } from '../models/types.js';
import { filterCurrentGoals, getGoalsByOrgId, STANDARD_TYPES } from '../models/goal.js';
import { getOrganizationById, getOrganizationPath } from '../models/organization.js';
import { canViewGoal } from './planAccess.js';
import { collectInheritedStandards } from './context.js';

export interface StandardsSkill {
  /** Skill directory name, e.g. `acme-corp-terminology`. */
  name: string;
  /** Full SKILL.md contents (frontmatter + body). */
  content: string;
}

const TYPE_HEADINGS: Record<StandardType, string> = {
  term: 'Terms (ubiquitous language)',
  variable: 'Variables',
  metadata: 'Metadata fields',
  function: 'Functions',
  document: 'Documents',
  ui_element: 'UI elements',
  template: 'Templates',
};

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'org';
}

function toFideslangEntry(s: InheritedStandard): Record<string, string> {
  return {
    ...(s.identifier ? { fides_key: s.identifier } : {}),
    name: s.name,
    ...(s.content ? { description: s.content } : {}),
    ...(s.parentKey ? { parent_key: s.parentKey } : {}),
  };
}

/** One-line frontmatter value: collapse whitespace and quote so YAML stays valid. */
function yamlString(text: string): string {
  return JSON.stringify(text.replace(/\s+/g, ' ').trim());
}

/**
 * Render an organization's shared vocabulary (terms, variables, metadata fields, functions, ...)
 * as a Claude Code skill (SKILL.md). Standards are inherited root -> leaf along the organization
 * path, plus the organization's current goals that `viewer` may see. The standards themselves
 * are embedded as Fideslang-style YAML so the same text can be pasted back into Waypoint.
 */
export function buildStandardsSkill(orgId: string, viewer?: User | null): StandardsSkill | null {
  const org = getOrganizationById(orgId);
  if (!org) return null;

  const orgPath: Organization[] = getOrganizationPath(orgId);
  const goals: Goal[] = filterCurrentGoals(getGoalsByOrgId(orgId)).filter((g) => canViewGoal(viewer, g));
  const standards = collectInheritedStandards(orgPath, goals);

  const name = `${slugify(org.name)}-terminology`;
  const description =
    `Ubiquitous language for ${org.name}: standard terms, variable and metadata field names, and shared functions. ` +
    `Use when naming things, writing code or docs, or when a domain term or identifier is unclear, ` +
    `so wording stays consistent with the domain model.`;

  const lines: string[] = [
    '---',
    `name: ${name}`,
    `description: ${yamlString(description)}`,
    '---',
    '',
    `# ${org.name} terminology`,
    '',
    'This is the shared vocabulary (ubiquitous language) for this domain. Rules:',
    '',
    '- Use these terms exactly as written in code, comments, docs, and conversation; do not invent synonyms.',
    '- Use the `fides_key` as the identifier (variable, field, or function name) wherever one is given.',
    '- If something is not listed here, ask rather than guess, and propose the new term for addition.',
    '',
    `Scope: ${orgPath.map((o) => o.name).join(' > ')}. Broader (parent) organizations come first; later entries refine earlier ones.`,
    '',
  ];

  if (standards.length === 0) {
    lines.push('_No standards are defined yet._', '');
  }

  for (const type of STANDARD_TYPES) {
    const ofType = standards.filter((s) => s.type === type);
    if (ofType.length === 0) continue;
    lines.push(`## ${TYPE_HEADINGS[type]}`, '');
    for (const s of ofType) {
      const key = s.identifier ? ` (\`${s.identifier}\`)` : '';
      const source = s.sourceGoalTitle ? `goal "${s.sourceGoalTitle}"` : s.sourceOrgName;
      lines.push(`- **${s.name}**${key}: ${s.content || '-'} _[${source}]_`);
    }
    lines.push('');
  }

  if (standards.length > 0) {
    const grouped: Record<string, Record<string, string>[]> = {};
    for (const s of standards) (grouped[s.type] ??= []).push(toFideslangEntry(s));
    lines.push(
      '## Source (Fideslang YAML)',
      '',
      '```yaml',
      stringifyYaml(grouped, { lineWidth: 0 }).trimEnd(),
      '```',
      ''
    );
  }

  return { name, content: lines.join('\n') };
}
