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
- The fix agent is instructed to create `fix/issue-{n}` branches and open PRs via git/gh.

## Testing webhooks locally

```bash
# Terminal 1
pnpm dev

# Terminal 2 — expose with ngrok, cloudflared, etc.
ngrok http 8787
```

Register the ngrok URL + `/webhooks/github` in your GitHub repo webhook settings.
