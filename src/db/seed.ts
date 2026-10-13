import { getDb } from './index.js';
import { createOrganization } from '../models/organization.js';
import { createUser } from '../models/user.js';
import { createGoal } from '../models/goal.js';
import { createRole } from '../models/role.js';

// Organization IDs
const ORG_IDS = {
  ACME_CORP: 'org-acme-corp',
  ENGINEERING: 'org-engineering',
  PRODUCT: 'org-product',
  SALES: 'org-sales',
  OPERATIONS: 'org-operations',
  PLATFORM_TEAM: 'org-platform-team',
  PRODUCT_TEAM: 'org-product-team',
  QA_TEAM: 'org-qa-team',
  PRODUCT_STRATEGY: 'org-product-strategy',
  UX_RESEARCH: 'org-ux-research',
  ENTERPRISE_SALES: 'org-enterprise-sales',
  SMB_SALES: 'org-smb-sales',
  IT_TEAM: 'org-it-team',
  HR_TEAM: 'org-hr-team',
};

// User IDs
const USER_IDS = {
  // Admin
  ADMIN: 'user-admin',
  // Acme Corp
  CEO: 'user-ceo',
  // Engineering
  VP_ENGINEERING: 'user-vp-engineering',
  PLATFORM_LEAD: 'user-platform-lead',
  JANE_SMITH: 'user-jane-smith',
  PRODUCT_TEAM_LEAD: 'user-product-team-lead',
  QA_LEAD: 'user-qa-lead',
  // Product
  VP_PRODUCT: 'user-vp-product',
  STRATEGY_LEAD: 'user-strategy-lead',
  UX_LEAD: 'user-ux-lead',
  // Sales
  VP_SALES: 'user-vp-sales',
  ENTERPRISE_LEAD: 'user-enterprise-lead',
  SMB_LEAD: 'user-smb-lead',
  // Operations
  VP_OPERATIONS: 'user-vp-operations',
  IT_LEAD: 'user-it-lead',
  HR_LEAD: 'user-hr-lead',
};

// Role IDs
const ROLE_IDS = {
  EXECUTIVE: 'role-executive',
  MANAGER: 'role-manager',
  CONTRIBUTOR: 'role-contributor',
  AI_AGENT: 'role-ai-agent',
};

export function seedDatabase(): void {
  const db = getDb();

  // Clear existing data
  db.exec('DELETE FROM role_permissions');
  db.exec('DELETE FROM roles');
  db.exec('DELETE FROM comments');
  db.exec('DELETE FROM goals');
  db.exec('DELETE FROM users');
  db.exec('DELETE FROM organizations');

  // Create organizations (hierarchy)
  createOrganizations();

  // Create roles
  createRoles();

  // Create users
  createUsers();

  // Create goals
  createGoals();

  console.log('Database seeded successfully!');
}

function createOrganizations(): void {
  // Level 0: Company
  createOrganization({
    id: ORG_IDS.ACME_CORP,
    name: 'Acme Corp',
    description: 'The parent company',
    aiGuidelines: `- Always prioritize customer impact in recommendations
- Consider cross-team dependencies when suggesting solutions
- Maintain security and compliance in all technical decisions`,
  });

  // Level 1: Departments
  createOrganization({
    id: ORG_IDS.ENGINEERING,
    parentId: ORG_IDS.ACME_CORP,
    name: 'Engineering Department',
    description: 'Builds and maintains the product',
    aiGuidelines: `- Suggest solutions that maintain backward compatibility
- Recommend incremental refactoring over big rewrites
- Always consider monitoring and observability`,
  });

  createOrganization({
    id: ORG_IDS.PRODUCT,
    parentId: ORG_IDS.ACME_CORP,
    name: 'Product Department',
    description: 'Defines product strategy and user experience',
    aiGuidelines: `- Reference user research data when available
- Suggest measurable success criteria for features
- Balance user requests with strategic vision`,
  });

  createOrganization({
    id: ORG_IDS.SALES,
    parentId: ORG_IDS.ACME_CORP,
    name: 'Sales Department',
    description: 'Drives revenue and customer acquisition',
    aiGuidelines: `- Prioritize high-value opportunities
- Consider competitive positioning
- Align proposals with customer business goals`,
  });

  createOrganization({
    id: ORG_IDS.OPERATIONS,
    parentId: ORG_IDS.ACME_CORP,
    name: 'Operations Department',
    description: 'Manages internal operations and employee experience',
    aiGuidelines: `- Consider cost efficiency in recommendations
- Prioritize security and compliance
- Balance automation with human oversight`,
  });

  // Level 2: Teams under Engineering
  createOrganization({
    id: ORG_IDS.PLATFORM_TEAM,
    parentId: ORG_IDS.ENGINEERING,
    name: 'Platform Team',
    description: 'Infrastructure and developer tools',
    aiGuidelines: `- Recommend cloud-native solutions
- Consider multi-region availability
- Suggest cost-optimized resource configurations
- Default to managed services over self-hosted`,
  });

  createOrganization({
    id: ORG_IDS.PRODUCT_TEAM,
    parentId: ORG_IDS.ENGINEERING,
    name: 'Product Team',
    description: 'Builds user-facing features',
    aiGuidelines: `- Balance speed with quality
- Suggest feature flags for gradual rollouts
- Consider mobile and web parity
- Focus on user-facing impact`,
  });

  createOrganization({
    id: ORG_IDS.QA_TEAM,
    parentId: ORG_IDS.ENGINEERING,
    name: 'QA Team',
    description: 'Quality assurance and testing',
    aiGuidelines: `- Prioritize test automation
- Consider edge cases and error scenarios
- Focus on user journey testing`,
  });

  // Level 2: Teams under Product
  createOrganization({
    id: ORG_IDS.PRODUCT_STRATEGY,
    parentId: ORG_IDS.PRODUCT,
    name: 'Product Strategy Team',
    description: 'Product roadmap and prioritization',
  });

  createOrganization({
    id: ORG_IDS.UX_RESEARCH,
    parentId: ORG_IDS.PRODUCT,
    name: 'UX Research Team',
    description: 'User research and usability testing',
  });

  // Level 2: Teams under Sales
  createOrganization({
    id: ORG_IDS.ENTERPRISE_SALES,
    parentId: ORG_IDS.SALES,
    name: 'Enterprise Sales Team',
    description: 'Large enterprise accounts',
    aiGuidelines: `- Research company annual reports and earnings calls
- Identify business transformation initiatives
- Map to executive priorities
- Consider procurement and security requirements`,
  });

  createOrganization({
    id: ORG_IDS.SMB_SALES,
    parentId: ORG_IDS.SALES,
    name: 'SMB Sales Team',
    description: 'Small and medium business accounts',
  });

  // Level 2: Teams under Operations
  createOrganization({
    id: ORG_IDS.IT_TEAM,
    parentId: ORG_IDS.OPERATIONS,
    name: 'IT Team',
    description: 'Internal IT systems and support',
  });

  createOrganization({
    id: ORG_IDS.HR_TEAM,
    parentId: ORG_IDS.OPERATIONS,
    name: 'HR Team',
    description: 'Human resources and employee experience',
  });
}

function createRoles(): void {
  createRole({
    id: ROLE_IDS.EXECUTIVE,
    name: 'Executive',
    description: 'Full organizational access and strategic AI insights',
    permissions: [
      'goal:read', 'goal:create', 'goal:update', 'goal:delete',
      'comment:read', 'comment:create', 'comment:submit_question', 'comment:respond',
      'organization:read', 'organization:update',
      'prompt:input', 'prompt:output', 'vector:search'
    ],
  });

  createRole({
    id: ROLE_IDS.MANAGER,
    name: 'Manager',
    description: 'Team management and operational AI tools',
    permissions: [
      'goal:read', 'goal:create', 'goal:update',
      'comment:read', 'comment:create', 'comment:submit_question', 'comment:respond',
      'organization:read',
      'prompt:input', 'vector:search'
    ],
  });

  createRole({
    id: ROLE_IDS.CONTRIBUTOR,
    name: 'Contributor',
    description: 'Individual contributor with standard AI assistance',
    permissions: [
      'goal:read', 'goal:create', 'goal:update',
      'comment:read', 'comment:create', 'comment:submit_question',
      'organization:read',
      'prompt:input'
    ],
  });

  createRole({
    id: ROLE_IDS.AI_AGENT,
    name: 'AI Agent',
    description: 'Autonomous agent for background processing',
    permissions: [
      'goal:read', 'comment:read', 'organization:read', 'vector:search'
    ],
  });
}

function createUsers(): void {
  // Admin User
  createUser({
    id: USER_IDS.ADMIN,
    orgId: ORG_IDS.ACME_CORP,
    roleId: ROLE_IDS.EXECUTIVE,
    name: 'System Admin',
    email: 'admin@acme.com',
    jobFunction: 'System Administrator',
    isAdmin: true,
  });

  // Acme Corp
  createUser({
    id: USER_IDS.CEO,
    orgId: ORG_IDS.ACME_CORP,
    roleId: ROLE_IDS.EXECUTIVE,
    name: 'Alex Johnson',
    email: 'alex.johnson@acme.com',
    jobFunction: 'CEO',
    isLeader: true,
  });

  // Engineering Department
  createUser({
    id: USER_IDS.VP_ENGINEERING,
    orgId: ORG_IDS.ENGINEERING,
    roleId: ROLE_IDS.EXECUTIVE,
    name: 'Sarah Chen',
    email: 'sarah.chen@acme.com',
    jobFunction: 'VP of Engineering',
    isLeader: true,
  });

  createUser({
    id: USER_IDS.PLATFORM_LEAD,
    orgId: ORG_IDS.PLATFORM_TEAM,
    roleId: ROLE_IDS.MANAGER,
    name: 'Mike Williams',
    email: 'mike.williams@acme.com',
    jobFunction: 'Platform Team Lead',
    isLeader: true,
  });

  createUser({
    id: USER_IDS.JANE_SMITH,
    orgId: ORG_IDS.PLATFORM_TEAM,
    roleId: ROLE_IDS.CONTRIBUTOR,
    name: 'Jane Smith',
    email: 'jane.smith@acme.com',
    jobFunction: 'Platform Engineer',
  });

  createUser({
    id: USER_IDS.PRODUCT_TEAM_LEAD,
    orgId: ORG_IDS.PRODUCT_TEAM,
    roleId: ROLE_IDS.MANAGER,
    name: 'David Lee',
    email: 'david.lee@acme.com',
    jobFunction: 'Product Team Lead',
  });

  createUser({
    id: USER_IDS.QA_LEAD,
    orgId: ORG_IDS.QA_TEAM,
    roleId: ROLE_IDS.MANAGER,
    name: 'Emily Brown',
    email: 'emily.brown@acme.com',
    jobFunction: 'QA Lead',
  });

  // Product Department
  createUser({
    id: USER_IDS.VP_PRODUCT,
    orgId: ORG_IDS.PRODUCT,
    roleId: ROLE_IDS.EXECUTIVE,
    name: 'Rachel Green',
    email: 'rachel.green@acme.com',
    jobFunction: 'VP of Product',
    isLeader: true,
  });

  createUser({
    id: USER_IDS.STRATEGY_LEAD,
    orgId: ORG_IDS.PRODUCT_STRATEGY,
    roleId: ROLE_IDS.MANAGER,
    name: 'Tom Harris',
    email: 'tom.harris@acme.com',
    jobFunction: 'Product Strategy Lead',
  });

  createUser({
    id: USER_IDS.UX_LEAD,
    orgId: ORG_IDS.UX_RESEARCH,
    roleId: ROLE_IDS.CONTRIBUTOR,
    name: 'Lisa Wang',
    email: 'lisa.wang@acme.com',
    jobFunction: 'UX Research Lead',
  });

  // Sales Department
  createUser({
    id: USER_IDS.VP_SALES,
    orgId: ORG_IDS.SALES,
    roleId: ROLE_IDS.EXECUTIVE,
    name: 'James Miller',
    email: 'james.miller@acme.com',
    jobFunction: 'VP of Sales',
  });

  createUser({
    id: USER_IDS.ENTERPRISE_LEAD,
    orgId: ORG_IDS.ENTERPRISE_SALES,
    roleId: ROLE_IDS.MANAGER,
    name: 'Amanda White',
    email: 'amanda.white@acme.com',
    jobFunction: 'Enterprise Sales Lead',
  });

  createUser({
    id: USER_IDS.SMB_LEAD,
    orgId: ORG_IDS.SMB_SALES,
    roleId: ROLE_IDS.CONTRIBUTOR,
    name: 'Chris Taylor',
    email: 'chris.taylor@acme.com',
    jobFunction: 'SMB Sales Lead',
  });

  // Operations Department
  createUser({
    id: USER_IDS.VP_OPERATIONS,
    orgId: ORG_IDS.OPERATIONS,
    roleId: ROLE_IDS.EXECUTIVE,
    name: 'Patricia Davis',
    email: 'patricia.davis@acme.com',
    jobFunction: 'VP of Operations',
  });

  createUser({
    id: USER_IDS.IT_LEAD,
    orgId: ORG_IDS.IT_TEAM,
    roleId: ROLE_IDS.MANAGER,
    name: 'Kevin Moore',
    email: 'kevin.moore@acme.com',
    jobFunction: 'IT Lead',
  });

  createUser({
    id: USER_IDS.HR_LEAD,
    orgId: ORG_IDS.HR_TEAM,
    roleId: ROLE_IDS.MANAGER,
    name: 'Nancy Wilson',
    email: 'nancy.wilson@acme.com',
    jobFunction: 'HR Lead',
  });
}

function createGoals(): void {
  // Level 0: Acme Corp goals
  createGoal({
    orgId: ORG_IDS.ACME_CORP,
    ownerId: USER_IDS.CEO,
    title: 'Achieve Market Leadership',
    description: 'Become the #1 provider in our market segment',
    keyResults: [
      'Reach 40% market share by Q4',
      'NPS score above 70',
      '50% YoY revenue growth',
    ],
    status: 'in_progress',
    progress: 35,
  });

  createGoal({
    orgId: ORG_IDS.ACME_CORP,
    ownerId: USER_IDS.CEO,
    title: 'Build World-Class Engineering',
    description: 'Establish engineering excellence as a competitive advantage',
    keyResults: [
      '99.9% uptime SLA',
      'Deploy to production daily',
      'Zero critical security incidents',
    ],
    status: 'in_progress',
    progress: 60,
  });

  createGoal({
    orgId: ORG_IDS.ACME_CORP,
    ownerId: USER_IDS.CEO,
    title: 'Customer-Centric Culture',
    description: 'Every decision starts with customer value',
    keyResults: [
      'Customer satisfaction > 90%',
      '< 4 hour support response time',
      '95% feature adoption rate',
    ],
    status: 'in_progress',
    progress: 45,
  });

  // Level 1: Engineering Department goals
  createGoal({
    orgId: ORG_IDS.ENGINEERING,
    ownerId: USER_IDS.VP_ENGINEERING,
    title: 'Zero-Downtime Deployments',
    description: 'Ship continuously without customer impact',
    keyResults: [
      '100% of deploys are zero-downtime',
      'Rollback capability within 5 minutes',
      'Automated canary releases',
    ],
    status: 'in_progress',
    progress: 70,
  });

  createGoal({
    orgId: ORG_IDS.ENGINEERING,
    ownerId: USER_IDS.VP_ENGINEERING,
    title: 'Technical Debt Reduction',
    description: 'Maintain codebase health for velocity',
    keyResults: [
      '20% reduction in legacy code',
      'Test coverage > 80%',
      'Documentation for all services',
    ],
    status: 'in_progress',
    progress: 40,
  });

  // Level 1: Product Department goals
  createGoal({
    orgId: ORG_IDS.PRODUCT,
    ownerId: USER_IDS.VP_PRODUCT,
    title: 'Data-Driven Decisions',
    description: 'Every product decision backed by evidence',
    keyResults: [
      'A/B test all major features',
      'Weekly metrics review',
      'User research for each quarter',
    ],
    status: 'in_progress',
    progress: 55,
  });

  createGoal({
    orgId: ORG_IDS.PRODUCT,
    ownerId: USER_IDS.VP_PRODUCT,
    title: 'Rapid Iteration',
    description: 'Learn fast through quick experiments',
    keyResults: [
      '2-week feature cycles',
      'MVP-first approach',
      'Kill unsuccessful features quickly',
    ],
    status: 'in_progress',
    progress: 65,
  });

  // Level 1: Sales Department goals
  createGoal({
    orgId: ORG_IDS.SALES,
    ownerId: USER_IDS.VP_SALES,
    title: 'Enterprise Expansion',
    description: 'Grow enterprise customer base',
    keyResults: [
      '50 new enterprise accounts',
      '$10M ARR from enterprise',
      '90% enterprise renewal rate',
    ],
    status: 'in_progress',
    progress: 30,
  });

  createGoal({
    orgId: ORG_IDS.SALES,
    ownerId: USER_IDS.VP_SALES,
    title: 'Sales Efficiency',
    description: 'Optimize the sales process',
    keyResults: [
      'Reduce sales cycle by 20%',
      'Increase win rate to 35%',
      'Automate qualification',
    ],
    status: 'in_progress',
    progress: 25,
  });

  // Level 1: Operations Department goals
  createGoal({
    orgId: ORG_IDS.OPERATIONS,
    ownerId: USER_IDS.VP_OPERATIONS,
    title: 'Operational Excellence',
    description: 'Run efficient, reliable operations',
    keyResults: [
      '99.99% internal system uptime',
      '< 1 hour incident response',
      'Automated provisioning',
    ],
    status: 'in_progress',
    progress: 80,
  });

  createGoal({
    orgId: ORG_IDS.OPERATIONS,
    ownerId: USER_IDS.VP_OPERATIONS,
    title: 'Employee Experience',
    description: 'Support team productivity and satisfaction',
    keyResults: [
      'eNPS > 50',
      '< 2 day onboarding time',
      '95% tool satisfaction',
    ],
    status: 'in_progress',
    progress: 50,
  });

  // Level 2: Platform Team goals
  createGoal({
    orgId: ORG_IDS.PLATFORM_TEAM,
    ownerId: USER_IDS.PLATFORM_LEAD,
    title: 'Infrastructure as Code',
    description: 'All infrastructure defined declaratively',
    keyResults: [
      '100% IaC coverage',
      'Terraform for all cloud resources',
      'Self-service infrastructure',
    ],
    status: 'in_progress',
    progress: 65,
  });

  createGoal({
    orgId: ORG_IDS.PLATFORM_TEAM,
    ownerId: USER_IDS.PLATFORM_LEAD,
    title: 'Developer Velocity',
    description: 'Enable fast, safe development',
    keyResults: [
      '< 10 min CI/CD pipeline',
      'One-click environments',
      'Automated security scanning',
    ],
    status: 'in_progress',
    progress: 40,
  });

  // Level 2: Product Team goals
  createGoal({
    orgId: ORG_IDS.PRODUCT_TEAM,
    ownerId: USER_IDS.PRODUCT_TEAM_LEAD,
    title: 'Feature Velocity',
    description: 'Ship customer value quickly',
    keyResults: [
      '20 features shipped per quarter',
      '< 3 day bug fix time',
      'Weekly releases',
    ],
    status: 'in_progress',
    progress: 75,
  });

  createGoal({
    orgId: ORG_IDS.PRODUCT_TEAM,
    ownerId: USER_IDS.PRODUCT_TEAM_LEAD,
    title: 'Code Quality',
    description: 'Maintain high standards',
    keyResults: [
      'Zero critical bugs in production',
      'Code review within 4 hours',
      '85% test coverage',
    ],
    status: 'in_progress',
    progress: 60,
  });

  // Level 2: Enterprise Sales Team goals
  createGoal({
    orgId: ORG_IDS.ENTERPRISE_SALES,
    ownerId: USER_IDS.ENTERPRISE_LEAD,
    title: 'Strategic Accounts',
    description: 'Land major enterprise logos',
    keyResults: [
      '10 Fortune 500 customers',
      'Average deal size > $500K',
      'Multi-year contracts',
    ],
    status: 'in_progress',
    progress: 20,
  });

  createGoal({
    orgId: ORG_IDS.ENTERPRISE_SALES,
    ownerId: USER_IDS.ENTERPRISE_LEAD,
    title: 'Expansion Revenue',
    description: 'Grow within existing accounts',
    keyResults: [
      '120% net revenue retention',
      'Cross-sell to 50% of accounts',
      'Executive relationships',
    ],
    status: 'in_progress',
    progress: 35,
  });
}

// Export for programmatic use
export { ORG_IDS, USER_IDS, ROLE_IDS };
