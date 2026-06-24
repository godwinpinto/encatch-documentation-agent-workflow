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

export const config = {
  cursorApiKey: () => required('CURSOR_API_KEY'),
  githubToken: () => required('GITHUB_TOKEN'),
  githubWebhookSecret: () => required('GITHUB_WEBHOOK_SECRET'),
  port: () => Number(optional('PORT', '8787')),
  githubOwner: () => optional('GITHUB_OWNER', 'encatch'),
  githubRepo: () => optional('GITHUB_REPO', 'encatch-agentic-workflow'),
  agentModel: () => optional('AGENT_MODEL', 'composer-2.5'),
  /** Comma-separated GitHub usernames or numeric user IDs to ping for complex fixes. */
  githubUserApproval: () => csvList('GITHUB_USER_APPROVAL'),
};

export const agentLabels = {
  needsInfo: 'agent:needs-info',
  needsApproval: 'agent:needs-approval',
  qualified: 'agent:qualified',
  inProgress: 'agent:in-progress',
  prOpened: 'agent:pr-opened',
} as const;

/** GitHub issue type labels applied during triage (must exist on the repo). */
export const issueTypeLabels = {
  bug: 'bug',
  feature: 'feature',
} as const;

export type IssueTypeLabel = (typeof issueTypeLabels)[keyof typeof issueTypeLabels];
