import { Agent } from '@cursor/sdk';
import { config } from '../config.js';
import { repoRoot } from '../paths.js';
import type { GitHubIssue } from '../github/issues.js';
import { formatIssueForAgent } from '../github/issues.js';

export type TriageResult =
  | { status: 'qualified'; reason: string }
  | { status: 'needs_info'; reason: string; comment: string };

const TRIAGE_PROMPT = `You triage documentation GitHub issues for a Fumadocs + TanStack Start docs repo.

Reply with JSON only, no markdown fences:
{"status":"qualified"|"needs_info","reason":"...","comment":"..."}

Rules:
- "qualified" when the issue names a page/section and gives clear before/after or a concrete fix (typo, wrong code, broken link).
- "needs_info" when the report is vague, subjective without examples, or missing page URL/context.
- "comment" is the GitHub comment to post when needs_info (friendly, specific questions). Empty string if qualified.

Issue:
`;

export async function triageIssue(issue: GitHubIssue): Promise<TriageResult> {
  const prompt = TRIAGE_PROMPT + formatIssueForAgent(issue);

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
      reason?: string;
      comment?: string;
    };

    if (parsed.status === 'qualified') {
      return {
        status: 'qualified',
        reason: parsed.reason ?? 'Issue looks actionable',
      };
    }

    return {
      status: 'needs_info',
      reason: parsed.reason ?? 'More context needed',
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
        'Thanks! Which doc page is affected? Please share the URL or path (e.g. `/docs/agentic-workflow`), what it says now, and what it should say.',
    };
  }

  return null;
}
