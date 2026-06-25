import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { promisify } from 'node:util';
import {
  agentWorkspaceForIssue,
  agentWorkspacesDir,
  fixBranchForIssue,
  repoRoot,
} from '../paths.js';
import { config } from '../config.js';
import { getBotGitIdentity, getGitHubAuthToken } from '../github/auth.js';

const execFileAsync = promisify(execFile);

async function git(
  cwd: string,
  args: string[],
  options?: { config?: Record<string, string> },
): Promise<string> {
  const gitArgs: string[] = [];
  if (options?.config) {
    for (const [key, value] of Object.entries(options.config)) {
      gitArgs.push('-c', `${key}=${value}`);
    }
  }
  gitArgs.push(...args);

  const { stdout } = await execFileAsync('git', gitArgs, {
    cwd,
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout.trim();
}

async function ensureMainCheckout(): Promise<void> {
  const current = await git(repoRoot, ['branch', '--show-current']);
  if (current !== 'main') {
    console.log(`[workspace] switching primary checkout from ${current} to main`);
    await git(repoRoot, ['checkout', 'main']);
  }
}

/** Remove a per-issue worktree and its local fix branch. */
export async function removeAgentWorkspace(issueNumber: number): Promise<void> {
  const cwd = agentWorkspaceForIssue(issueNumber);
  const branch = fixBranchForIssue(issueNumber);

  if (existsSync(cwd)) {
    try {
      await git(repoRoot, ['worktree', 'remove', '--force', cwd]);
    } catch {
      await rm(cwd, { recursive: true, force: true });
    }
  }

  try {
    await git(repoRoot, ['branch', '-D', branch]);
  } catch {
    // Branch may be checked out in the primary tree or only exist on remote.
  }

  try {
    await git(repoRoot, ['worktree', 'prune']);
  } catch {
    // Best-effort cleanup.
  }
}

/** Create an isolated worktree on fix/issue-{n} from latest origin/main. */
export async function prepareAgentWorkspace(
  issueNumber: number,
): Promise<{ cwd: string; branch: string }> {
  const cwd = agentWorkspaceForIssue(issueNumber);
  const branch = fixBranchForIssue(issueNumber);

  await ensureMainCheckout();
  await removeAgentWorkspace(issueNumber);

  await git(repoRoot, ['fetch', 'origin', 'main']);
  await git(repoRoot, ['worktree', 'add', '-B', branch, cwd, 'origin/main']);

  const identity = await getBotGitIdentity();
  // --worktree keeps bot identity scoped to this worktree (shared .git/config otherwise).
  await git(cwd, ['config', '--worktree', 'user.name', identity.name]);
  await git(cwd, ['config', '--worktree', 'user.email', identity.email]);

  console.log(`[workspace] prepared ${cwd} on ${branch}`);
  return { cwd, branch };
}

/** Push the fix branch using workflow GitHub auth (App or PAT). */
export async function pushFixBranch(cwd: string, branch: string): Promise<void> {
  const token = await getGitHubAuthToken();
  const owner = config.githubOwner();
  const repo = config.githubRepo();
  const remoteUrl = `https://x-access-token:${token}@github.com/${owner}/${repo}.git`;
  await git(cwd, ['rev-parse', 'HEAD']);
  // -c avoids persisting the app token into the shared origin remote URL.
  await git(cwd, ['push', '-u', 'origin', branch], {
    config: { 'remote.origin.url': remoteUrl },
  });
  console.log(`[workspace] pushed ${branch}`);
}

/** Delete local worktree copy after a successful push (remote branch + PR remain). */
export async function cleanupAgentWorkspaceAfterPush(issueNumber: number): Promise<void> {
  await removeAgentWorkspace(issueNumber);
  console.log(`[workspace] removed local copy for issue #${issueNumber}`);
}

export { agentWorkspacesDir };
