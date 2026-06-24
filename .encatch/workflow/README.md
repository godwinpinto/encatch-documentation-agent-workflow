# @encatch/agentic-workflow

Local Cursor agent service at `.encatch/workflow/`. Triages GitHub issues and opens documentation fix PRs.

## GitHub App setup (recommended)

Acts as a bot (`encatch-docs-agent[bot]`) instead of your personal account.

```bash
cp .env.example .env
pnpm install

# Pre-fill app registration URL + webhook secret
WEBHOOK_URL=https://YOUR-NGROK-URL.ngrok-free.app/webhooks/github pnpm setup:github-app

# After creating the app in GitHub, saving the .pem, and installing on the repo:
#   GITHUB_APP_ID=123456
#   (remove GITHUB_TOKEN)
pnpm verify:github-app
pnpm dev
```

**App permissions:** Issues (write), Contents (write), Pull requests (write), Metadata (read)

**Webhook events:** Issues, Issue comments

When using a GitHub App, configure the webhook on the **app** (not a separate repo webhook). Remove any old repo-level webhook to avoid duplicate deliveries.

## Personal access token (local fallback)

If `GITHUB_APP_ID` is unset, the workflow uses `GITHUB_TOKEN` and acts as that user.

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
- Fix runs use an isolated git worktree under `.encatch/workflow/agent-workspaces/issue-{n}/` (branch `fix/issue-{n}` from `origin/main`). The agent commits locally; the workflow pushes the branch and opens the PR as the GitHub App bot. After a successful push, the local worktree and local fix branch are removed; the remote branch and PR remain for manual review.
- The primary repo checkout stays on `main`.
- Triage also applies GitHub **`bug`** or **`feature`** labels (create them under repo Settings → Labels).
- Complex issues get **`agent:needs-approval`** and ping users listed in `GITHUB_USER_APPROVAL`. An approver comments **approved** / **go ahead** / **lgtm** to start the fix.
- **`agent:needs-info`** issues re-triage when someone adds a follow-up comment with more detail (20+ characters).
- GitHub webhook must subscribe to **Issues** and **Issue comments**.

## Testing webhooks locally

```bash
# Terminal 1
pnpm dev

# Terminal 2 — expose with ngrok, cloudflared, etc.
ngrok http 8787
```

Register the ngrok URL + `/webhooks/github` in your GitHub repo webhook settings.
