import type { Context } from 'hono';
import { Webhooks } from '@octokit/webhooks';
import { config, agentLabels } from '../config.js';
import {
  fetchIssue,
  addLabels,
  commentOnIssue,
  isAlreadyProcessed,
} from '../github/issues.js';
import { triageIssue, quickQualify } from '../triage/triage-issue.js';
import { fixIssue } from '../agent/fix-issue.js';

const webhooks = new Webhooks({ secret: config.githubWebhookSecret() });

type IssuePayload = {
  action: string;
  issue?: { number: number };
  repository?: { full_name: string };
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

  const payload = JSON.parse(body) as IssuePayload;
  console.log(`[webhook] event=${event} delivery=${deliveryId} action=${payload.action}`);

  if (event === 'issues' && (payload.action === 'opened' || payload.action === 'edited')) {
    const issueNumber = payload.issue?.number;
    if (issueNumber) {
      // Process async — respond quickly to GitHub.
      void processIssue(issueNumber).catch((err) => {
        console.error(`[webhook] failed issue #${issueNumber}:`, err);
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
    await addLabels(issueNumber, [agentLabels.needsInfo]);
    await commentOnIssue(issueNumber, triage.comment);
    console.log(`[process] #${issueNumber} needs info: ${triage.reason}`);
    return;
  }

  await addLabels(issueNumber, [agentLabels.qualified, agentLabels.inProgress]);
  console.log(`[process] #${issueNumber} qualified: ${triage.reason}`);

  const fix = await fixIssue(issue);

  if (fix.status === 'finished') {
    await addLabels(issueNumber, [agentLabels.prOpened]);
  }

  await commentOnIssue(
    issueNumber,
    fix.status === 'finished'
      ? `Agent completed the fix run (\`${fix.runId}\`). Please review the linked pull request.`
      : `Agent fix run failed (\`${fix.runId}\`). A maintainer will follow up manually.`,
  );

  console.log(`[process] #${issueNumber} fix status=${fix.status}`);
}
