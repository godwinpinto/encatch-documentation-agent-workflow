# Encatch Agentic Workflow

Sample Fumadocs + TanStack Start documentation site with a **local Cursor agent workflow** that triages GitHub issues and opens doc fix PRs.

Future Encatch feedback widgets on the docs site will create GitHub issues; this workflow picks them up automatically.

## Structure

```
encatch-agentic-workflow/
├── content/docs/              # MDX documentation (what the agent edits)
├── src/                       # TanStack Start + Fumadocs app
└── .encatch/
    └── workflow/              # GitHub webhook + local Cursor agent
```

## Quick start — docs site

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Quick start — agent workflow

```bash
cp .encatch/workflow/.env.example .encatch/workflow/.env
# Edit .encatch/workflow/.env with CURSOR_API_KEY, GITHUB_TOKEN, GITHUB_WEBHOOK_SECRET

pnpm workflow:dev
```

Expose port `8787` (or your `PORT`) and register a GitHub webhook:

- **URL:** `https://your-host/webhooks/github`
- **Events:** Issues
- **Secret:** same as `GITHUB_WEBHOOK_SECRET`

## How it works

1. GitHub sends `issues.opened` / `issues.edited` to the workflow service.
2. Quick rules + a Cursor agent triage the issue (`qualified` vs `needs_info`).
3. Qualified issues trigger a local agent that branches, fixes docs, and opens a PR.
4. Labels track state: `agent:needs-info`, `agent:qualified`, `agent:in-progress`, `agent:pr-opened`.

See [Agentic Workflow](/docs/agentic-workflow) in the docs site for details.

## Environment

| Variable | Where | Purpose |
| --- | --- | --- |
| `CURSOR_API_KEY` | `.encatch/workflow/.env` | Cursor API key |
| `GITHUB_TOKEN` | `.encatch/workflow/.env` | GitHub API access |
| `GITHUB_WEBHOOK_SECRET` | `.encatch/workflow/.env` | Webhook signature verification |

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Docs dev server |
| `pnpm build` | Build docs site |
| `pnpm workflow:dev` | Workflow service with hot reload |
| `pnpm workflow:start` | Workflow service (production) |
