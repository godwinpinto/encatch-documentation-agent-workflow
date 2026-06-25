import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { config } from './config.js';
import { getBotLogin } from './github/auth.js';
import { handleGitHubWebhook } from './github/webhook.js';
import { repoRoot } from './paths.js';

config.validateGitHubAuth();

const app = new Hono();

app.get('/health', async (c) =>
  c.json({
    ok: true,
    service: '@encatch/agentic-workflow',
    repoRoot,
    githubAuth: config.useGithubApp() ? 'github-app' : 'pat',
    bot: config.useGithubApp() ? await getBotLogin() : undefined,
  }),
);

app.post('/webhooks/github', handleGitHubWebhook);

const port = config.port();

console.log(`Encatch agentic workflow listening on http://localhost:${port}`);
console.log(`Repo root: ${repoRoot}`);
console.log(`GitHub auth: ${config.useGithubApp() ? 'GitHub App' : 'PAT'}`);
if (config.useGithubApp()) {
  void getBotLogin()
    .then((bot) => {
      if (bot) console.log(`GitHub bot: ${bot}`);
    })
    .catch((err) => {
      console.error('[startup] failed to resolve GitHub bot login:', err);
    });
}
console.log(`GitHub webhook: POST /webhooks/github`);

serve({ fetch: app.fetch, port });
