import { agentLabels } from '../config.js';
import { fixIssue } from '../agent/fix-issue.js';
import {
  fetchIssue,
  addLabels,
  removeLabel,
  commentOnIssue,
  type GitHubIssue,
} from './issues.js';

export async function runFixFlow(issueNumber: number, issue: GitHubIssue): Promise<void> {
  const fix = await fixIssue(issue);

  if (fix.status === 'finished') {
    await addLabels(issueNumber, [agentLabels.prOpened]);
  }

  await commentOnIssue(
    issueNumber,
    fix.status === 'finished'
      ? fix.prUrl
        ? `Agent completed the fix run (\`${fix.runId}\`). Pull request: ${fix.prUrl}`
        : `Agent completed the fix run (\`${fix.runId}\`). Please review the linked pull request.`
      : `Agent fix run failed (\`${fix.runId}\`). A maintainer will follow up manually.`,
  );

  console.log(`[process] #${issueNumber} fix status=${fix.status}`);
}

export async function startApprovedFix(
  issueNumber: number,
  approverLogin: string,
): Promise<void> {
  const issue = await fetchIssue(issueNumber);

  await removeLabel(issueNumber, agentLabels.needsApproval);
  await addLabels(issueNumber, [agentLabels.qualified, agentLabels.inProgress]);

  await commentOnIssue(
    issueNumber,
    `Approval received from @${approverLogin}. Starting the fix agent now.`,
  );

  console.log(`[process] #${issueNumber} approved by ${approverLogin}, starting fix`);
  await runFixFlow(issueNumber, issue);
}
