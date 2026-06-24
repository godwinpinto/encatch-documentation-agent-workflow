import { agentLabels } from '../config.js';
import type { TriageResult } from '../triage/triage-issue.js';
import { labelsForTriage } from '../triage/triage-issue.js';
import {
  addLabels,
  removeLabel,
  commentOnIssue,
  formatApprovalComment,
  type GitHubIssue,
} from './issues.js';
import { runFixFlow } from './process-fix.js';

export async function handleTriageOutcome(
  issueNumber: number,
  issue: GitHubIssue,
  triage: TriageResult,
): Promise<void> {
  if (triage.status === 'needs_info') {
    await addLabels(issueNumber, labelsForTriage(triage, [agentLabels.needsInfo]));
    await commentOnIssue(issueNumber, triage.comment!);
    console.log(
      `[process] #${issueNumber} needs info${triage.typeLabel ? ` (${triage.typeLabel})` : ''}: ${triage.reason}`,
    );
    return;
  }

  await removeLabel(issueNumber, agentLabels.needsInfo);

  if (triage.status === 'needs_approval') {
    await addLabels(issueNumber, labelsForTriage(triage, [agentLabels.needsApproval]));
    await commentOnIssue(issueNumber, await formatApprovalComment(triage.reason));
    console.log(
      `[process] #${issueNumber} needs approval${triage.typeLabel ? ` (${triage.typeLabel})` : ''}: ${triage.reason}`,
    );
    return;
  }

  await addLabels(
    issueNumber,
    labelsForTriage(triage, [agentLabels.qualified, agentLabels.inProgress]),
  );
  console.log(
    `[process] #${issueNumber} qualified (${triage.typeLabel ?? 'bug'}): ${triage.reason}`,
  );

  await runFixFlow(issueNumber, issue);
}
