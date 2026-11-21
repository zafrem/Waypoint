<p align="center">
  <img src="images/Logo.png" alt="Waypoint Logo" width="200">
</p>

# Waypoint

Define the organization's goals hierarchically and inject them into AI assistants through Model Context Protocol (MCP) to ensure that individual work aligns with the organization's direction.

## The Purpose Behind the Development

"I've been experimenting with 'Vibe coding' lately, and it’s fascinating how the same task can yield such different results depending on who's doing it. It made me wonder: even within the same organization, does everyone actually need different context to execute the same request? But surely, the organization's goals should be aligned, right? That train of thought led me to build this tool. I'm still testing its effectiveness, but the concept started there."

## Same Question, Different Answers

The same question gets a different, better-fitting answer depending on who asks, because each person's assistant receives their own team's goals and guidelines along with the company's.

> **"We're launching a new reporting dashboard next month. What should our plan be?"**

| Who | What the assistant steers toward | Driven by (seed data) |
|-----|----------------------------------|-----------------------|
| No context | Define scope, build an MVP, test, launch, iterate | Nothing, so the answer is generic |
| **Mike Williams**, Platform Team lead | Infrastructure as code on managed services, multi-region availability and cost estimate, monitoring and alerts before launch, backward-compatible APIs | Goal *Infrastructure as Code*; guidelines "default to managed services", "consider multi-region availability", "always consider monitoring and observability" |
| **David Lee**, Product Team lead | Feature flag with gradual rollout, web and mobile parity, a user-facing success metric, fit into the weekly release cadence | Goals *Feature Velocity*, *Code Quality*; guidelines "suggest feature flags for gradual rollouts", "consider mobile and web parity" |
| **Amanda White**, Enterprise Sales lead | Position it for multi-year strategic accounts, map it to Fortune 500 executive priorities, prepare security and procurement material before demos | Goals *Strategic Accounts*, *Expansion Revenue*; guidelines "map to executive priorities", "consider procurement and security requirements" |

These answers are illustrative: they are written by hand to show how the context steers a response, not captured from a model. The goals and guidelines are the real sample data created by `npm run seed`. Everyone also receives the company-wide guidelines, such as "always prioritize customer impact" and "maintain security and compliance in all technical decisions". To see exactly what an assistant receives, run the server as each user (`WAYPOINT_USER_ID=user-platform-lead`, `user-product-team-lead`, `user-enterprise-lead`) and read `waypoint://context/current_user`.

## Installation

```bash
# Clone the repository
git clone https://github.com/zafrem/Waypoint.git
cd Waypoint

# Install dependencies
npm install

# Build the project
npm run build

# Seed the database with example data
npm run seed
```

> **Run `npm install` first.** The build needs the TypeScript compiler (`tsc`), which is installed as a dev dependency. Without it, `npm run build` fails with `sh: tsc: command not found`. Run `npm install` again after pulling changes that touch `package.json`.

## Configuration

Create a `.env` file based on `.env.example`:

```bash
# User ID for the current session (required)
WAYPOINT_USER_ID=user-jane-smith

# Database file path (optional, defaults to ./waypoint.db)
WAYPOINT_DB_PATH=./waypoint.db
```

## Usage

### Starting the Server

```bash
WAYPOINT_USER_ID=user-jane-smith npm start
```

### Using with Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "waypoint": {
      "command": "node",
      "args": ["/path/to/Waypoint/dist/index.js"],
      "env": {
        "WAYPOINT_USER_ID": "user-jane-smith"
      }
    }
  }
}
```

### Using with Google Gemini

For Gemini clients that support MCP (like Gemini Developer API or compatible tools), use the standard server configuration:

```json
{
  "mcpServers": {
    "waypoint": {
      "command": "node",
      "args": ["/path/to/Waypoint/dist/index.js"],
      "env": {
        "WAYPOINT_USER_ID": "user-jane-smith"
      }
    }
  }
}
```

### Testing with MCP Inspector

```bash
WAYPOINT_USER_ID=user-jane-smith npx @modelcontextprotocol/inspector node dist/index.js
```

## Screenshots

The web UI for managing organizations, users, goals and settings (shown with the seeded sample data).

| | |
|---|---|
| <img src="images/waypoint_dashboard.jpg" alt="Dashboard"><br><b>Dashboard</b><br>Totals and the expandable organization hierarchy, with each team’s leader and goal counts. | <img src="images/waypoint_organizations.jpg" alt="Organizations"><br><b>Organizations</b><br>Every organization in the tree, with its description and quick links to view or edit. |
| <img src="images/waypoint_users.jpg" alt="Users"><br><b>Users</b><br>All users with their organization and system role. | <img src="images/waypoint_admin_dashboard.jpg" alt="Admin dashboard"><br><b>Admin dashboard</b><br>Quick actions to add or import personnel and to create and manage goals. |
| <img src="images/waypoint_app_settings.jpg" alt="App settings"><br><b>App settings</b><br>Server configuration and custom application-wide settings. | <img src="images/waypoint_preferences.jpg" alt="User preferences"><br><b>User preferences</b><br>Theme, default goal visibility, locale, timezone and notifications. |

## MCP Resources & Tools

### Resource

| URI | Description |
|-----|-------------|
| `waypoint://context/current_user` | Returns user context with goals and AI guidelines |

### Tools

| Tool | Description |
|------|-------------|
| `get_parent_goals` | Get goals from parent organizations for strategic context |
| `search_collaborator_goals` | Search goals across accessible organizations |
| `submit_question` | Submit a question about a goal from another team |
| `semantic_search` | Search goals across the organization for a topic, limited by your role and goal visibility (requires the `vector:search` permission) |
| `get_goal_plans` | Everyone's execution plans and the gray areas for a goal you work on |
| `update_my_plan` | Write or update your own execution plan for a goal you work on |
| `raise_gray_area` | Flag something unclear in a goal or a teammate's plan |
| `resolve_gray_area` | Record how a gray area was clarified |
| `lookup_standards` | Look up standard term definitions, variable/metadata field names (e.g. `membersrl`), and common functions |

## Terminology and Coding Standards

Organizations and goals can define shared **terminology, standard variable/metadata field names, and common functions** so every team and AI assistant follows the exact same conventions:

- Enter standards as YAML in the [Fideslang](https://ethyca.github.io/fideslang/) style: a top-level key per type, each holding a list of entries with `fides_key` (the identifier), `name`, `description`, and an optional `parent_key`:
  - Supported types: `term`, `variable`, `metadata`, `function`, `document`, `ui_element`, `template`.
  - Example:
    ```yaml
    term:
      - fides_key: membersrl
        name: Member Serial
        description: Unique identifier for a customer, consisting of 8 to 16 digits.
    function:
      - fides_key: isValidMemberSrl(membersrl)
        name: Validate Member Serial
        description: Returns true if membersrl is an 8-16 digit string.
    ```
- **Inherited down the hierarchy:** Standards defined on a parent organization (such as `Acme Corp`) or parent goals automatically flow into every child team's `waypoint://context/current_user` context and can be queried via the `lookup_standards` MCP tool.

### Use as a skill (no MCP needed)

The same vocabulary can be exported as a [Claude Code skill](https://docs.claude.com/en/docs/claude-code/skills) (`SKILL.md`: a glossary plus the Fideslang YAML source), so assistants load it without the MCP server:

- Web: **Download Skill** on an organization's page (`/organizations/<id>/skill`).
- CLI: `npm run export:skill -- "<organization name or id>" [skills dir]` writes `.claude/skills/<org>-terminology/SKILL.md`.

Standards are inherited from the organization's parents plus its current goals, so a team's skill includes company-wide terms.

## Quarterly and Annual Goals

A goal can be tagged with a period, so annual and quarterly OKRs live side by side:

- **Annual** goals use a year as the period (`2026`). **Quarterly** goals use `2026-Q3`.
- A quarterly goal can optionally support an annual goal ("Supports annual goal: ..."). Leave it empty for quarterly work that does not map to an annual goal.
- Goals with no period are ongoing and always shown.
- By default the MCP context and tools only include the **current year's and current quarter's** goals (plus any annual goal a current quarterly goal supports), so past quarters do not crowd the context. `get_parent_goals` and `search_collaborator_goals` accept `include_past_periods: true` to look further back.

Set the period in the admin UI under **Goals** (create or edit); the goals list can be filtered by period.

## Execution Plans and Gray Areas

Leaders define only the **objective** (title, description, key results). The people doing the work write the **execution plans**:

- A goal has **participants**, each with a role (`driver`, `contributor` or `reviewer`). The goal owner is a driver automatically. The owner or an admin adds and removes participants on the goal page (`/goals/<id>`).
- Each participant writes **their own plan** for the goal, on the goal page or with `update_my_plan`. Nobody edits someone else's plan.
- Anyone working on the goal can flag a **gray area**: something unclear in the goal or in a teammate's plan. Anyone on the goal can mark it resolved with a note on how it was clarified, so ambiguities are cleared up together rather than guessed at.
- **Plans are visible only to the people working on that goal** (plus admins). To everyone else the goal shows just the objective, and the MCP tools answer "not found" exactly as they would for a goal that does not exist. For goals you work on, the `current_user` context includes your plan, your teammates' plans and the open gray areas.

## Disabling MCP Access

Admins can switch off the MCP side (the `waypoint://context/current_user` resource, the `ask_with_context` prompt and all tools) for a single user or for a whole organization. Web login is not affected.

- Tick **Disable MCP access** on a user's or an organization's edit page (admins only).
- Disabling an organization also disables every user in it and in all of its sub-organizations. Disabling Engineering Department also covers the Platform, Product and QA teams.
- For a disabled user the MCP server simply does nothing: it lists no resource, no prompt and no tools, and any direct call fails as if it didn't exist. No notice or explanation is shown, and `ask_with_context` passes the question through without any context.
- The check runs on every request, so changing the flag takes effect without restarting the server.
- The user and organization lists show an **MCP off** badge, or **MCP off (inherited)** when it comes from a parent organization.
- The flag is included in `npm run export` / `npm run import`. Existing databases get the new columns automatically on the next start.

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm install` | Install dependencies (run this first, and again whenever `package.json` changes) |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run start` | Start the MCP server |
| `npm run dev` | Build and start in one command |
| `npm run seed` | Populate database with example data |

## Sample Users

After running `npm run seed`, the following users are available:

| User ID | Name | Organization |
|---------|------|--------------|
| `user-jane-smith` | Jane Smith | Platform Team |
| `user-ceo` | Alex Johnson | Acme Corp |
| `user-vp-engineering` | Sarah Chen | Engineering Department |
| `user-platform-lead` | Mike Williams | Platform Team |
| `user-product-team-lead` | David Lee | Product Team |
| `user-enterprise-lead` | Amanda White | Enterprise Sales Team |

## Documentation

- [Architecture](docs/architecture/README.md)
- [Example Hierarchy](docs/architecture/example-hierarchy.md)

