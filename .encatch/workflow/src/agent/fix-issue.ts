import { Agent, CursorAgentError } from '@cursor/sdk';
import { config } from '../config.js';
import type { GitHubIssue } from '../github/issues.js';
import { formatIssueForAgent } from '../github/issues.js';
import { openFixPullRequest } from '../github/pull-requests.js';
import {
  cleanupAgentWorkspaceAfterPush,
  prepareAgentWorkspace,
  pushFixBranch,
} from './agent-workspace.js';

const FIX_PROMPT_PREFIX = `You are fixing documentation in a Fumadocs + TanStack Start repo (encatch-agentic-workflow).

This run uses an isolated git worktree already checked out on branch \`fix/issue-{number}\` (from latest origin/main).

Tasks:
1. Make the minimal doc change required by the issue (content/docs/, MDX, links, code samples).
2. Commit with message: "fix(docs): resolve issue #{number}".

Do not push, open pull requests, or run \`gh\`. The workflow pushes the branch and opens the PR after you finish.

Do not run git checkout or create branches. Only change files required for this issue.

Issue:
`;

export type FixResult = {
  runId: string;
  status: 'finished' | 'error';
  summary?: string;
  prUrl?: string;
};

export async function fixIssue(issue: GitHubIssue): Promise<FixResult> {
  const prompt =
    FIX_PROMPT_PREFIX.replaceAll('{number}', String(issue.number)) +
    formatIssueForAgent(issue);

  let workspace: { cwd: string; branch: string } | undefined;

  try {
    workspace = await prepareAgentWorkspace(issue.number);

    await using agent = await Agent.create({
      apiKey: config.cursorApiKey(),
      model: { id: config.agentModel() },
      local: { cwd: workspace.cwd, settingSources: [] },
    });

    const run = await agent.send(prompt);
    console.log(`[fix] agent=${agent.agentId} run=${run.id} issue=#${issue.number}`);

    for await (const event of run.stream()) {
      if (event.type === 'assistant') {
        for (const block of event.message.content) {
          if (block.type === 'text') {
            process.stdout.write(block.text);
          }
        }
      }
    }

    const result = await run.wait();

    if (result.status === 'finished') {
      await pushFixBranch(workspace.cwd, workspace.branch);
      const prUrl = await openFixPullRequest(issue, workspace.branch);
      await cleanupAgentWorkspaceAfterPush(issue.number);
      workspace = undefined;

      return {
        runId: result.id,
        status: 'finished',
        summary: 'Agent completed fix run',
        prUrl,
      };
    }

    return {
      runId: result.id,
      status: 'error',
      summary: 'Agent run failed',
    };
  } catch (err) {
    if (workspace) {
      console.log(
        `[workspace] keeping ${workspace.cwd} for issue #${issue.number} after failed run`,
      );
    }
    if (err instanceof CursorAgentError) {
      throw new Error(`Fix agent startup failed: ${err.message} (retryable=${err.isRetryable})`);
    }
    throw err;
  }
}
