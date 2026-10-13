# Waypoint Architecture

## Overview

Waypoint is an MCP server that provides organizational goal context to AI assistants. It enables:

- **Goal Hierarchy**: Define company, department, and team-level goals with key results
- **AI Guidelines**: Specify guidelines at each organizational level that inform AI recommendations
- **Cross-Team Visibility**: Search and explore goals from collaborator teams
- **Strategic Alignment**: Ensure individual contributions align with organizational objectives

## Project Structure

```
waypoint/
├── src/
│   ├── index.ts                 # Entry point
│   ├── config/                  # Configuration
│   ├── db/                      # Database layer
│   │   ├── index.ts             # Connection management
│   │   ├── schema.ts            # SQL schema
│   │   └── seed.ts              # Seed data
│   ├── models/                  # Data models
│   │   ├── types.ts             # TypeScript interfaces
│   │   ├── organization.ts      # Organization CRUD
│   │   ├── user.ts              # User CRUD
│   │   ├── goal.ts              # Goal CRUD
│   │   └── comment.ts           # Comment CRUD
│   ├── rbac/                    # Role-based access control
│   │   ├── relationships.ts     # Org relationship computation
│   │   └── permissions.ts       # Permission matrix
│   ├── mcp/                     # MCP server
│   │   ├── index.ts             # Server setup
│   │   ├── resources/           # MCP resources
│   │   └── tools/               # MCP tools
│   └── services/                # Business logic
│       └── context.ts           # User context aggregation
├── scripts/
│   └── seed.js                  # Database seeding script
├── package.json
└── tsconfig.json
```

## Tech Stack

- **Runtime:** Node.js with TypeScript (ES modules)
- **Database:** SQLite with better-sqlite3
- **MCP:** @modelcontextprotocol/sdk
- **Web Framework:** Fastify
- **Templating:** EJS
- **Frontend:** Vanilla CSS (CSS Variables), Alpine.js (layout), Plain JS
- **Validation:** Zod
- **Auth (MVP):** Environment variable for user ID

## Database Schema

### Organizations

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key |
| parent_id | TEXT | Reference to parent organization |
| name | TEXT | Organization name |
| description | TEXT | Organization description |
| ai_guidelines | TEXT | AI guidelines for this org level |
| created_at | TEXT | Creation timestamp |
| updated_at | TEXT | Last update timestamp |

### Users

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key |
| org_id | TEXT | Reference to organization |
| name | TEXT | User name |
| email | TEXT | User email (unique) |
| job_function | TEXT | User's role/title |
| created_at | TEXT | Creation timestamp |
| updated_at | TEXT | Last update timestamp |

### Goals

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key |
| org_id | TEXT | Reference to organization |
| owner_id | TEXT | Reference to goal owner |
| title | TEXT | Goal title |
| description | TEXT | Goal description |
| key_results | TEXT | JSON array of key results |
| status | TEXT | not_started, in_progress, completed, cancelled |
| progress | INTEGER | 0-100 percentage |
| visibility | TEXT | public, private, team_only |
| created_at | TEXT | Creation timestamp |
| updated_at | TEXT | Last update timestamp |

### Comments

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key |
| goal_id | TEXT | Reference to goal |
| author_id | TEXT | Reference to author |
| content | TEXT | Comment content |
| type | TEXT | question, response, note |
| status | TEXT | pending, answered, closed |
| created_at | TEXT | Creation timestamp |
| updated_at | TEXT | Last update timestamp |

## RBAC Permission Matrix

| Relationship | Goals | Comments | Organization |
|-------------|-------|----------|--------------|
| SELF | Full CRUD | Full CRUD | Read, Update |
| PARENT | Read | Submit questions | Read |
| CHILD | Read | Read, Respond | Read |
| SIBLING | Read (visible) | Submit questions | Read |
| ANCESTOR | Read | Read | Read |
| DESCENDANT | Read | Read | Read |
| NONE | No access | No access | No access |

### Relationship Definitions

- **SELF**: Same organization as the user
- **PARENT**: User's organization is a direct child of target
- **CHILD**: User's organization is a direct parent of target
- **SIBLING**: User and target share the same parent organization
- **ANCESTOR**: Target is an ancestor (grandparent, etc.) of user's org
- **DESCENDANT**: Target is a descendant (grandchild, etc.) of user's org
- **NONE**: No hierarchical relationship

## MCP Resources

### `waypoint://context/current_user`

Returns the current user's context including:

- User profile (name, email, role)
- Organization hierarchy
- Current team goals with progress
- Parent/strategic goals for alignment
- AI guidelines from all organizational levels

Example output:

```markdown
## User Profile
- **Name:** Jane Smith
- **Email:** jane.smith@acme.com
- **Role:** Platform Engineer

## Organization
- **Current Team:** Platform Team
- **Hierarchy:** Acme Corp → Engineering Department → Platform Team

## Current Team Goals
- 🔄 **Infrastructure as Code** (65%)
  - Key Results:
    - 100% IaC coverage
    - Terraform for all cloud resources
    - Self-service infrastructure

## Strategic Context (Parent Goals)
### Engineering Department
- 🔄 **Zero-Downtime Deployments** (70%)

### Acme Corp
- 🔄 **Build World-Class Engineering** (60%)

## AI Guidelines
### Acme Corp
- Always prioritize customer impact in recommendations
- Consider cross-team dependencies when suggesting solutions

### Engineering Department
- Suggest solutions that maintain backward compatibility
- Always consider monitoring and observability

### Platform Team
- Recommend cloud-native solutions
- Consider multi-region availability
```

## MCP Tools

### `get_parent_goals`

Get goals from parent organizations in the hierarchy for strategic context.

**Input:**
```json
{
  "org_id": "org-platform-team"
}
```

**Output:**
```json
{
  "success": true,
  "data": [
    {
      "organization": { "id": "org-acme-corp", "name": "Acme Corp" },
      "goals": [
        {
          "id": "goal-1",
          "title": "Build World-Class Engineering",
          "status": "in_progress",
          "progress": 60
        }
      ]
    }
  ]
}
```

### `search_collaborator_goals`

Search for goals from collaborator organizations (siblings, parents, ancestors).

**Input:**
```json
{
  "keyword": "infrastructure"
}
```

**Output:**
```json
{
  "success": true,
  "data": [
    {
      "id": "goal-123",
      "title": "Infrastructure as Code",
      "organization": { "id": "org-platform-team", "name": "Platform Team" }
    }
  ]
}
```

### `submit_question`

Submit a question about a goal from another organization.

**Input:**
```json
{
  "goal_id": "goal-123",
  "question": "What's the timeline for the Terraform migration?"
}
```

**Output:**
```json
{
  "success": true,
  "data": {
    "commentId": "comment-456",
    "goalId": "goal-123",
    "question": "What's the timeline for the Terraform migration?",
    "status": "pending"
  }
}
```

## Related Documentation

- [Example Hierarchy](example-hierarchy.md)
- [Sequence Diagrams](sequence-diagrams.md)
