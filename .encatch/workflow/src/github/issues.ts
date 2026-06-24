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
  const skip: string[] = [agentLabels.inProgress, agentLabels.prOpened];
  return issue.labels.some((label) => skip.includes(label));
}

export function formatIssueForAgent(issue: GitHubIssue): string {
  return `# Issue #${issue.number}: ${issue.title}

${issue.body ?? '(no description)'}

---
Repository: ${config.githubOwner()}/${config.githubRepo()}
Issue URL: ${issue.html_url}
`;
}
