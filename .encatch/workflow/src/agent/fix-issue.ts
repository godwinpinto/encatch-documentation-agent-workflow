import { Agent, CursorAgentError } from '@cursor/sdk';
import { config } from '../config.js';
import { repoRoot } from '../paths.js';
import type { GitHubIssue } from '../github/issues.js';
import { formatIssueForAgent } from '../github/issues.js';

const FIX_PROMPT_PREFIX = `You are fixing documentation in a Fumadocs + TanStack Start repo (encatch-agentic-workflow).

Tasks:
1. Create a git branch named \`fix/issue-{number}\` from main.
2. Make the minimal doc change required by the issue (content/docs/, MDX, links, code samples).
3. Commit with message: "fix(docs): resolve issue #{number}".
4. Push the branch and open a pull request that references "Fixes #{number}".

Only change files required for this issue. Do not refactor unrelated content.

Issue:
`;

export type FixResult = {
  runId: string;
  status: 'finished' | 'error';
  summary?: string;
};

export async function fixIssue(issue: GitHubIssue): Promise<FixResult> {
  const prompt =
    FIX_PROMPT_PREFIX.replaceAll('{number}', String(issue.number)) +
    formatIssueForAgent(issue);

  try {
    await using agent = await Agent.create({
      apiKey: config.cursorApiKey(),
      model: { id: config.agentModel() },
      local: { cwd: repoRoot, settingSources: [] },
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

    return {
      runId: result.id,
      status: result.status === 'finished' ? 'finished' : 'error',
      summary: result.status === 'finished' ? 'Agent completed fix run' : 'Agent run failed',
    };
  } catch (err) {
    if (err instanceof CursorAgentError) {
      throw new Error(`Fix agent startup failed: ${err.message} (retryable=${err.isRetryable})`);
    }
    throw err;
  }
}
