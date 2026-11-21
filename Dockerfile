FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production \
    WAYPOINT_DB_PATH=/data/waypoint.db \
    WAYPOINT_WEB_HOST=0.0.0.0 \
    WAYPOINT_WEB_PORT=3000 \
    WAYPOINT_MCP_ENABLED=false
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY public ./public
COPY scripts ./scripts
RUN mkdir /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000
CMD ["node", "dist/index.js"]
