# Build from repo root:
#   docker build -f .encatch/workflow/Dockerfile -t encatch-agentic-workflow .
#
# Run (pass secrets via env or --env-file):
#   docker run -p 8787:8787 --env-file .encatch/workflow/.env encatch-agentic-workflow

FROM node:22-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

# git: worktrees, fetch, push. ca-certificates: HTTPS to GitHub + Cursor API.
RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY .encatch/workflow/package.json ./.encatch/workflow/

RUN pnpm install --frozen-lockfile --filter @encatch/agentic-workflow... --ignore-scripts

FROM base AS runner

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/.encatch/workflow/node_modules ./.encatch/workflow/node_modules
COPY . .

RUN chmod +x .encatch/workflow/docker-entrypoint.sh \
  && git config --global --add safe.directory /app

ENV NODE_ENV=production
ENV PORT=8787

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

WORKDIR /app
ENTRYPOINT ["./.encatch/workflow/docker-entrypoint.sh"]
