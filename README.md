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

## Available Scripts

| Script | Description |
|--------|-------------|
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

