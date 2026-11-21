# Waypoint

Define your organization's goals hierarchically and give them to AI assistants through the Model Context Protocol (MCP), so individual work stays aligned with the organization's direction. Also holds shared terminology and coding standards, exportable as a Claude Code skill.

Source, docs and releases: https://github.com/zafrem/Waypoint

## Quick start

```bash
docker run -d --name waypoint -p 3000:3000 \
  -e WAYPOINT_ADMIN_EMAIL=you@example.com \
  -e WAYPOINT_SESSION_SECRET=$(openssl rand -hex 32) \
  -v waypoint-data:/data \
  zafrem/waypoint:latest
```

Open http://localhost:3000 and log in with the admin email. The initial admin is created on first start only, while the database has no users.

Or use docker compose: https://github.com/zafrem/Waypoint/blob/main/docker-compose.yml

## Security

Login is **email-only (no password)**. Do not expose the port to untrusted networks; put it behind a VPN or an authenticating reverse proxy. Always set a long random `WAYPOINT_SESSION_SECRET`.

## Using it as an MCP server

The container runs the web UI only. Attach an MCP client by running the stdio server inside it:

```bash
docker exec -i -e WAYPOINT_MCP_ENABLED=true -e WAYPOINT_WEB_ENABLED=false \
  -e WAYPOINT_USER_ID=<user id> waypoint node dist/index.js
```

## Configuration

| Variable | Purpose |
|----------|---------|
| `WAYPOINT_ADMIN_EMAIL` | Creates the initial admin on first start |
| `WAYPOINT_ADMIN_NAME`, `WAYPOINT_ORG_NAME` | Admin name and root organization name |
| `WAYPOINT_SESSION_SECRET` | Session secret (required, long random value) |
| `WAYPOINT_DB_PATH` | Defaults to `/data/waypoint.db` (mount a volume at `/data`) |

Tags: `latest` and one per release (e.g. `0.1.0`). Platforms: `linux/amd64`, `linux/arm64`.
