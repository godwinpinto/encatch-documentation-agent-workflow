import { config, agentLabels } from '../config.js';
import type { GitHubIssue } from './issues.js';
import { resolveApproverLogin } from './issues.js';

const APPROVAL_PATTERN =
  /\b(approved?|lgtm|go ahead|please proceed|proceed|looks good(?: to me)?|ship it|yes(?:,?\s+please)?|confirmed?|ok(?:ay)? to proceed)\b/i;

const REJECTION_PATTERN =
  /\b(not approved|don't proceed|do not proceed|no,?\s+don't|reject(ed)?|denied?)\b/i;

export function isApprovalComment(body: string): boolean {
  const text = body.trim();
  if (!text) return false;
  if (REJECTION_PATTERN.test(text)) return false;
  return APPROVAL_PATTERN.test(text);
}

export function isAwaitingApproval(issue: GitHubIssue): boolean {
  return (
    issue.labels.includes(agentLabels.needsApproval) &&
    !issue.labels.includes(agentLabels.inProgress) &&
    !issue.labels.includes(agentLabels.prOpened)
  );
}

export function isAwaitingInfo(issue: GitHubIssue): boolean {
  return (
    issue.labels.includes(agentLabels.needsInfo) &&
    !issue.labels.includes(agentLabels.inProgress) &&
    !issue.labels.includes(agentLabels.prOpened) &&
    !issue.labels.includes(agentLabels.needsApproval)
  );
}

export async function isApproverUser(login: string, userId?: number): Promise<boolean> {
  const configured = config.githubUserApproval();
  if (configured.length === 0) return false;

  for (const entry of configured) {
    const trimmed = entry.trim().replace(/^@/, '');
    if (/^\d+$/.test(trimmed) && userId !== undefined && Number(trimmed) === userId) {
      return true;
    }

    const resolved = await resolveApproverLogin(entry);
    if (resolved && resolved.toLowerCase() === login.toLowerCase()) {
      return true;
    }
  }

  return false;
}
