import type { Context } from 'hono';
import { Webhooks } from '@octokit/webhooks';
import { agentLabels, config } from '../config.js';
import {
  fetchIssue,
  addLabels,
  commentOnIssue,
  isAlreadyProcessed,
  formatApprovalComment,
} from './issues.js';
import { isApprovalComment, isApproverUser, isAwaitingApproval } from './approval.js';
import { runFixFlow, startApprovedFix } from './process-fix.js';
import { triageIssue, quickQualify, labelsForTriage } from '../triage/triage-issue.js';

const webhooks = new Webhooks({ secret: config.githubWebhookSecret() });

type IssuePayload = {
  action: string;
  issue?: { number: number };
  repository?: { full_name: string };
};

type IssueCommentPayload = {
  action: string;
  issue?: { number: number };
  comment?: {
    body?: string;
    user?: { login?: string; id?: number; type?: string };
  };
};

export async function handleGitHubWebhook(c: Context): Promise<Response> {
  const signature = c.req.header('x-hub-signature-256');
  const event = c.req.header('x-github-event');
  const deliveryId = c.req.header('x-github-delivery');
  const body = await c.req.text();

  if (!signature || !event) {
    return c.json({ error: 'Missing GitHub webhook headers' }, 400);
  }

  try {
    await webhooks.verify(body, signature);
  } catch {
    return c.json({ error: 'Invalid webhook signature' }, 401);
  }

  const payload = JSON.parse(body) as IssuePayload | IssueCommentPayload;
  console.log(`[webhook] event=${event} delivery=${deliveryId} action=${payload.action}`);

  if (event === 'issues' && (payload.action === 'opened' || payload.action === 'edited')) {
    const issueNumber = payload.issue?.number;
    if (issueNumber) {
      void processIssue(issueNumber).catch((err) => {
        console.error(`[webhook] failed issue #${issueNumber}:`, err);
      });
    }
  }

  if (event === 'issue_comment' && payload.action === 'created') {
    const commentPayload = payload as IssueCommentPayload;
    const issueNumber = commentPayload.issue?.number;
    const comment = commentPayload.comment;
    const login = comment?.user?.login;
    const userId = comment?.user?.id;
    const commentBody = comment?.body ?? '';

    if (issueNumber && login && comment?.user?.type !== 'Bot') {
      void processApprovalComment(issueNumber, login, userId, commentBody).catch((err) => {
        console.error(`[webhook] failed approval comment on #${issueNumber}:`, err);
      });
    }
  }

  if (event === 'ping') {
    return c.json({ ok: true, message: 'pong' });
  }

  return c.json({ ok: true, received: true });
}

async function processIssue(issueNumber: number): Promise<void> {
  const issue = await fetchIssue(issueNumber);

  if (isAlreadyProcessed(issue)) {
    console.log(`[process] skip #${issueNumber} — already labeled`);
    return;
  }

  const quick = quickQualify(issue);
  const triage = quick ?? (await triageIssue(issue));

  if (triage.status === 'needs_info') {
    await addLabels(issueNumber, labelsForTriage(triage, [agentLabels.needsInfo]));
    await commentOnIssue(issueNumber, triage.comment!);
    console.log(
      `[process] #${issueNumber} needs info${triage.typeLabel ? ` (${triage.typeLabel})` : ''}: ${triage.reason}`,
    );
    return;
  }

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

async function processApprovalComment(
  issueNumber: number,
  login: string,
  userId: number | undefined,
  commentBody: string,
): Promise<void> {
  const issue = await fetchIssue(issueNumber);

  if (!isAwaitingApproval(issue)) {
    return;
  }

  if (!(await isApproverUser(login, userId))) {
    console.log(`[process] skip approval comment on #${issueNumber} — ${login} is not an approver`);
    return;
  }

  if (!isApprovalComment(commentBody)) {
    console.log(`[process] skip approval comment on #${issueNumber} — no confirmation detected`);
    return;
  }

  await startApprovedFix(issueNumber, login);
}
