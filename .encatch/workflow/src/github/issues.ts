import { Octokit } from '@octokit/rest';
import { config, agentLabels } from '../config.js';

let octokit: Octokit | undefined;

export function getOctokit(): Octokit {
  if (!octokit) {
    octokit = new Octokit({ auth: config.githubToken() });
  }
  return octokit;
}

export type GitHubIssue = {
  number: number;
  title: string;
  body: string | null;
  labels: string[];
  html_url: string;
};

export async function fetchIssue(issueNumber: number): Promise<GitHubIssue> {
  const { data } = await getOctokit().issues.get({
    owner: config.githubOwner(),
    repo: config.githubRepo(),
    issue_number: issueNumber,
  });

  const labels = data.labels.map((label) =>
    typeof label === 'string' ? label : (label.name ?? ''),
  );

  return {
    number: data.number,
    title: data.title,
    body: data.body ?? null,
    labels,
    html_url: data.html_url,
  };
}

export async function addLabels(issueNumber: number, labels: string[]): Promise<void> {
  await getOctokit().issues.addLabels({
    owner: config.githubOwner(),
    repo: config.githubRepo(),
    issue_number: issueNumber,
    labels,
  });
}

export async function removeLabel(issueNumber: number, label: string): Promise<void> {
  try {
    await getOctokit().issues.removeLabel({
      owner: config.githubOwner(),
      repo: config.githubRepo(),
      issue_number: issueNumber,
      name: label,
    });
  } catch {
    // Label may not exist on the issue.
  }
}

export async function commentOnIssue(issueNumber: number, body: string): Promise<void> {
  await getOctokit().issues.createComment({
    owner: config.githubOwner(),
    repo: config.githubRepo(),
    issue_number: issueNumber,
    body,
  });
}

export function isAlreadyProcessed(issue: GitHubIssue): boolean {
  const skip: string[] = [
    agentLabels.inProgress,
    agentLabels.prOpened,
    agentLabels.needsApproval,
  ];
  return issue.labels.some((label) => skip.includes(label));
}

/** Resolve GitHub username or numeric user ID to a login for @mentions. */
export async function resolveApproverLogin(user: string): Promise<string | null> {
  const trimmed = user.trim().replace(/^@/, '');
  if (!trimmed) return null;

  if (/^\d+$/.test(trimmed)) {
    try {
      const { data } = await getOctokit().request('GET /user/{account_id}', {
        account_id: Number(trimmed),
      });
      return data.login ?? null;
    } catch {
      console.warn(`[github] could not resolve approver user id ${trimmed}`);
      return null;
    }
  }

  return trimmed;
}

export async function resolveApproverLogins(users: string[]): Promise<string[]> {
  const logins = await Promise.all(users.map(resolveApproverLogin));
  return [...new Set(logins.filter((login): login is string => login !== null))];
}

export async function formatApprovalComment(reason: string): Promise<string> {
  const approvers = config.githubUserApproval();
  const logins = await resolveApproverLogins(approvers);

  const intro =
    'This documentation fix looks complex and needs maintainer approval before the agent can proceed.';
  const reasonBlock = `**Reason:** ${reason}`;

  if (logins.length === 0) {
    return `${intro}\n\n${reasonBlock}\n\nNo approvers are configured. Set \`GITHUB_USER_APPROVAL\` in the workflow environment to ping reviewers.`;
  }

  const mentions = logins.map((login) => `@${login}`).join(' ');
  return `${intro}\n\n${reasonBlock}\n\n${mentions} — please approve or clarify how you'd like this handled. Reply with a comment such as **approved** or **go ahead** to start the fix agent.`;
}

export function formatIssueForAgent(issue: GitHubIssue): string {
  return `# Issue #${issue.number}: ${issue.title}

${issue.body ?? '(no description)'}

---
Repository: ${config.githubOwner()}/${config.githubRepo()}
Issue URL: ${issue.html_url}
`;
}
