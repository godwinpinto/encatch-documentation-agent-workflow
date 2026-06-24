import { config } from '../config.js';
import { getOctokit } from './auth.js';
import type { GitHubIssue } from './issues.js';

export async function findOpenPullRequestForBranch(branch: string): Promise<string | undefined> {
  const octokit = await getOctokit();
  const owner = config.githubOwner();
  const { data } = await octokit.pulls.list({
    owner,
    repo: config.githubRepo(),
    head: `${owner}:${branch}`,
    state: 'open',
  });

  return data[0]?.html_url;
}

export async function openFixPullRequest(
  issue: GitHubIssue,
  branch: string,
): Promise<string> {
  const existing = await findOpenPullRequestForBranch(branch);
  if (existing) {
    console.log(`[github] reusing open PR for ${branch}: ${existing}`);
    return existing;
  }

  const octokit = await getOctokit();
  const owner = config.githubOwner();
  const repo = config.githubRepo();

  const { data: pr } = await octokit.pulls.create({
    owner,
    repo,
    title: `fix(docs): resolve issue #${issue.number}`,
    head: branch,
    base: 'main',
    body: `Fixes #${issue.number}

Automated documentation fix for: ${issue.title}`,
  });

  console.log(`[github] opened PR #${pr.number}: ${pr.html_url}`);
  return pr.html_url;
}
