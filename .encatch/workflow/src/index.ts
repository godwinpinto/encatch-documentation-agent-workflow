import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { config } from './config.js';
import { handleGitHubWebhook } from './github/webhook.js';
import { repoRoot } from './paths.js';

const app = new Hono();

app.get('/health', (c) =>
  c.json({
    ok: true,
    service: '@encatch/agentic-workflow',
    repoRoot,
  }),
);

app.post('/webhooks/github', handleGitHubWebhook);

const port = config.port();

console.log(`Encatch agentic workflow listening on http://localhost:${port}`);
console.log(`Repo root: ${repoRoot}`);
console.log(`GitHub webhook: POST /webhooks/github`);

serve({ fetch: app.fetch, port });
