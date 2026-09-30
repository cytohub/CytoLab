# syntax=docker/dockerfile:1

# CytoLab production image. The same image serves the web app and runs the
# database jobs (migrate, seed, nightly reset), so it keeps the full dependency
# tree, including the TypeScript runner those scripts use. See DEPLOY.md.

FROM node:22-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm install -g pnpm@10.33.0 && npm cache clean --force
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build && rm -rf .next/cache

FROM base AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    STORAGE_DIR=/app/.data/uploads
# Application files stay root-owned (read-only to the app); only the Next.js
# cache and local upload storage are writable by the unprivileged user.
COPY --from=build /app ./
RUN mkdir -p .next/cache .data/uploads && chown -R node:node .next/cache .data
USER node
EXPOSE 3000
CMD ["sh", "scripts/docker/start.sh"]
