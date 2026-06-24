import { Agent } from '@cursor/sdk';
import { config, issueTypeLabels, type IssueTypeLabel } from '../config.js';
import { repoRoot } from '../paths.js';
import type { GitHubIssue } from '../github/issues.js';
import { formatIssueForAgent } from '../github/issues.js';

export type TriageResult = {
  status: 'qualified' | 'needs_info' | 'needs_approval';
  reason: string;
  typeLabel?: IssueTypeLabel;
  comment?: string;
};

const TRIAGE_PROMPT = `You triage documentation GitHub issues for a Fumadocs + TanStack Start docs repo.

Reply with JSON only, no markdown fences:
{"status":"qualified"|"needs_info"|"needs_approval","type":"bug"|"feature","reason":"...","comment":"..."}

Rules:
- "qualified" when the issue names a page/section and gives a small, clear fix (typo, wrong code, broken link, single sentence correction).
- "needs_info" when the report is vague, subjective without examples, or missing page URL/context. Check issue comments too — a thread may contain the missing details.
- "needs_approval" when the issue is understandable but too complex for an automated doc fix (large rewrites, many pages, structural doc changes, unclear scope, or risky edits). Do not auto-fix these.
- "type" "bug" for corrections to existing docs (typo, grammar, broken link, wrong/outdated text).
- "type" "feature" for new or expanded documentation (new page, new section, missing topic coverage).
- "comment" is the GitHub comment to post when needs_info (friendly, specific questions). Empty string for qualified or needs_approval.

Issue:
`;

export async function triageIssue(
  issue: GitHubIssue,
  extraContext = '',
): Promise<TriageResult> {
  const prompt = TRIAGE_PROMPT + formatIssueForAgent(issue) + extraContext;

  const result = await Agent.prompt(prompt, {
    apiKey: config.cursorApiKey(),
    model: { id: config.agentModel() },
    local: { cwd: repoRoot, settingSources: [] },
  });

  if (result.status === 'error') {
    throw new Error(`Triage agent failed: ${result.id}`);
  }

  const text = extractText(result.result);
  return parseTriageJson(text);
}

function extractText(result: unknown): string {
  if (typeof result === 'string') return result;
  if (result && typeof result === 'object' && 'text' in result) {
    return String((result as { text: unknown }).text);
  }
  return JSON.stringify(result);
}

function parseTypeLabel(value: unknown): IssueTypeLabel | undefined {
  if (value === issueTypeLabels.bug || value === issueTypeLabels.feature) {
    return value;
  }
  return undefined;
}

function parseTriageJson(text: string): TriageResult {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    return {
      status: 'needs_info',
      reason: 'Could not parse triage response',
      comment:
        'Thanks for the report. Please include the doc page URL, the current text, and what it should say instead so we can fix it.',
    };
  }

  try {
    const parsed = JSON.parse(match[0]) as {
      status?: string;
      type?: string;
      reason?: string;
      comment?: string;
    };

    const typeLabel = parseTypeLabel(parsed.type);

    if (parsed.status === 'qualified') {
      return {
        status: 'qualified',
        reason: parsed.reason ?? 'Issue looks actionable',
        typeLabel: typeLabel ?? issueTypeLabels.bug,
      };
    }

    if (parsed.status === 'needs_approval') {
      return {
        status: 'needs_approval',
        reason: parsed.reason ?? 'Issue requires maintainer approval',
        typeLabel,
      };
    }

    return {
      status: 'needs_info',
      reason: parsed.reason ?? 'More context needed',
      typeLabel,
      comment:
        parsed.comment ??
        'Thanks for the report. Please include the doc page path, current text, and expected correction.',
    };
  } catch {
    return {
      status: 'needs_info',
      reason: 'Invalid triage JSON',
      comment:
        'Thanks for the report. Please include the doc page URL, the current text, and what it should say instead.',
    };
  }
}

/** Fast rule-based pre-check before calling the agent. */
export function quickQualify(issue: GitHubIssue): TriageResult | null {
  const body = (issue.body ?? '').toLowerCase();
  const hasPageHint = /\/docs\/|page:|https?:\/\//.test(body);
  const isVeryShort = body.trim().length < 40;

  if (isVeryShort && !hasPageHint) {
    return {
      status: 'needs_info',
      reason: 'Issue too short and missing page context',
      comment:
        'Thanks! Which doc page is affected? Please share the URL or path (e.g. `/docs/agentic-workflow`), what it says now, and what it should say. You can reply in a comment on this issue.',
    };
  }

  return null;
}

export function labelsForTriage(triage: TriageResult, agentLabelNames: string[]): string[] {
  return [...(triage.typeLabel ? [triage.typeLabel] : []), ...agentLabelNames];
}
