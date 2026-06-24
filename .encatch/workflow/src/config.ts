import { existsSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './paths.js';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}

function csvList(name: string): string[] {
  return optional(name, '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function requireGitHubAuthConfig(): void {
  const useApp = Boolean(optional('GITHUB_APP_ID', ''));
  if (useApp) {
    const keyPath = path.resolve(repoRoot, optional('GITHUB_APP_PRIVATE_KEY_PATH', '.encatch/workflow/github-app.private-key.pem'));
    if (!process.env.GITHUB_APP_PRIVATE_KEY?.trim() && !existsSync(keyPath)) {
      throw new Error(
        'GitHub App mode requires GITHUB_APP_PRIVATE_KEY or GITHUB_APP_PRIVATE_KEY_PATH',
      );
    }
    return;
  }

  if (!process.env.GITHUB_TOKEN?.trim()) {
    throw new Error('Missing GITHUB_TOKEN (or configure GitHub App env vars instead)');
  }
}

export const config = {
  cursorApiKey: () => required('CURSOR_API_KEY'),
  githubWebhookSecret: () => required('GITHUB_WEBHOOK_SECRET'),
  port: () => Number(optional('PORT', '8787')),
  githubOwner: () => optional('GITHUB_OWNER', 'encatch'),
  githubRepo: () => optional('GITHUB_REPO', 'encatch-agentic-workflow'),
  agentModel: () => optional('AGENT_MODEL', 'composer-2.5'),
  githubUserApproval: () => csvList('GITHUB_USER_APPROVAL'),

  useGithubApp: () => Boolean(optional('GITHUB_APP_ID', '')),
  githubAppId: () => required('GITHUB_APP_ID'),
  githubAppInstallationId: () => optional('GITHUB_APP_INSTALLATION_ID', ''),
  githubAppPrivateKeyPath: () =>
    optional('GITHUB_APP_PRIVATE_KEY_PATH', '.encatch/workflow/github-app.private-key.pem'),
  githubPat: () => required('GITHUB_TOKEN'),

  /** Call once at startup to validate GitHub auth configuration. */
  validateGitHubAuth: () => requireGitHubAuthConfig(),
};

export const agentLabels = {
  needsInfo: 'agent:needs-info',
  needsApproval: 'agent:needs-approval',
  qualified: 'agent:qualified',
  inProgress: 'agent:in-progress',
  prOpened: 'agent:pr-opened',
} as const;

export const issueTypeLabels = {
  bug: 'bug',
  feature: 'feature',
} as const;

export type IssueTypeLabel = (typeof issueTypeLabels)[keyof typeof issueTypeLabels];
