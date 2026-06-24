import type { Context } from 'hono';
import { Webhooks } from '@octokit/webhooks';
import { config } from '../config.js';
import {
  fetchIssue,
  isAlreadyProcessed,
  isWorkflowGeneratedComment,
  fetchIssueComments,
  formatIssueCommentsForAgent,
  type GitHubIssue,
} from './issues.js';
import {
  isApprovalComment,
  isApproverUser,
  isAwaitingApproval,
  isAwaitingInfo,
} from './approval.js';
import { startApprovedFix } from './process-fix.js';
import { handleTriageOutcome } from './process-triage.js';
import { triageIssue, quickQualify } from '../triage/triage-issue.js';

const webhooks = new Webhooks({ secret: config.githubWebhookSecret() });

const MIN_INFO_COMMENT_LENGTH = 20;

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
      void processIssueComment(issueNumber, login, userId, commentBody).catch((err) => {
        console.error(`[webhook] failed comment on #${issueNumber}:`, err);
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

  await handleTriageOutcome(issueNumber, issue, triage);
}

async function processIssueComment(
  issueNumber: number,
  login: string,
  userId: number | undefined,
  commentBody: string,
): Promise<void> {
  if (isWorkflowGeneratedComment(commentBody)) {
    console.log(`[process] skip comment on #${issueNumber} — workflow-generated comment`);
    return;
  }

  const issue = await fetchIssue(issueNumber);

  if (isAwaitingApproval(issue)) {
    await processApprovalComment(issueNumber, login, userId, commentBody);
    return;
  }

  if (isAwaitingInfo(issue)) {
    await processInfoComment(issueNumber, issue, commentBody);
    return;
  }

  console.log(`[process] skip comment on #${issueNumber} — not awaiting info or approval`);
}

async function processInfoComment(
  issueNumber: number,
  issue: GitHubIssue,
  commentBody: string,
): Promise<void> {
  if (commentBody.trim().length < MIN_INFO_COMMENT_LENGTH) {
    console.log(`[process] skip info comment on #${issueNumber} — too short to re-triage`);
    return;
  }

  const comments = await fetchIssueComments(issueNumber);
  const triage = await triageIssue(issue, formatIssueCommentsForAgent(comments));

  console.log(`[process] #${issueNumber} re-triaged from comment`);
  await handleTriageOutcome(issueNumber, issue, triage);
}

async function processApprovalComment(
  issueNumber: number,
  login: string,
  userId: number | undefined,
  commentBody: string,
): Promise<void> {
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
