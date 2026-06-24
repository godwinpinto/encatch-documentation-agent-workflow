import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workflowDir = path.dirname(fileURLToPath(import.meta.url));

/** Repo root is three levels above .encatch/workflow/src */
export const repoRoot = path.resolve(workflowDir, '../../..');

/** Ephemeral git worktrees for fix runs (removed after push). */
export const agentWorkspacesDir = path.resolve(workflowDir, '../agent-workspaces');

export function agentWorkspaceForIssue(issueNumber: number): string {
  return path.join(agentWorkspacesDir, `issue-${issueNumber}`);
}

export function fixBranchForIssue(issueNumber: number): string {
  return `fix/issue-${issueNumber}`;
}
