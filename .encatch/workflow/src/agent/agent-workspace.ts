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
import { getGitHubAuthToken } from '../github/auth.js';

const execFileAsync = promisify(execFile);

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, {
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

  const token = await getGitHubAuthToken();
  await git(cwd, ['config', 'http.extraHeader', `Authorization: Bearer ${token}`]);

  console.log(`[workspace] prepared ${cwd} on ${branch}`);
  return { cwd, branch };
}

/** Delete local worktree copy after a successful push (remote branch + PR remain). */
export async function cleanupAgentWorkspaceAfterPush(issueNumber: number): Promise<void> {
  await removeAgentWorkspace(issueNumber);
  console.log(`[workspace] removed local copy for issue #${issueNumber}`);
}

export { agentWorkspacesDir };
