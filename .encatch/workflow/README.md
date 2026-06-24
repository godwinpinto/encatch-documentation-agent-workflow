# @encatch/agentic-workflow

Local Cursor agent service at `.encatch/workflow/`. Triages GitHub issues and opens documentation fix PRs.

## Setup

```bash
cp .env.example .env
pnpm install
pnpm dev
```

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Health check |
| `POST` | `/webhooks/github` | GitHub issue webhooks |

## Flow

```
issues.opened / issues.edited
  → quickQualify (rules)
  → triageIssue (Agent.prompt)
  → fixIssue (Agent.create + stream + wait)
  → comment + labels on GitHub issue
```

## Local agent notes

- Model defaults to `composer-2.5` (override with `AGENT_MODEL`).
- `settingSources: []` — inline config only, no ambient Cursor settings.
- Fix runs use an isolated git worktree under `.encatch/workflow/agent-workspaces/issue-{n}/` (branch `fix/issue-{n}` from `origin/main`). After a successful push, the local worktree and local fix branch are removed; the remote branch and PR remain for manual review.
- The primary repo checkout stays on `main`.

## Testing webhooks locally

```bash
# Terminal 1
pnpm dev

# Terminal 2 — expose with ngrok, cloudflared, etc.
ngrok http 8787
```

Register the ngrok URL + `/webhooks/github` in your GitHub repo webhook settings.
