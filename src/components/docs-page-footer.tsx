import { gitConfig } from '@/lib/shared';
import { openRaiseIssueForm } from '@/lib/encatch';
import { SuggestEditButton } from '@/components/suggest-edit-button';
import { MessageSquare, ThumbsDown, ThumbsUp } from 'lucide-react';

const buttonClassName =
  'inline-flex items-center gap-1.5 rounded-full border border-fd-border bg-transparent px-3 py-1.5 text-sm font-medium text-fd-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground';

type DocsPageFooterProps = {
  path: string;
};

function getIssueUrl(path: string) {
  const params = new URLSearchParams({
    title: `Docs feedback: ${path}`,
  });
  return `https://github.com/${gitConfig.user}/${gitConfig.repo}/issues/new?${params}`;
}

function handleRaiseIssue(path: string) {
  if (openRaiseIssueForm()) {
    return;
  }

  window.open(getIssueUrl(path), '_blank', 'noopener,noreferrer');
}

export function DocsPageFooter({ path }: DocsPageFooterProps) {
  return (
    <footer className="mt-12 pt-6 border-t border-fd-border">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <p className="text-sm text-fd-muted-foreground">Was this page helpful?</p>
          <div className="flex items-center gap-2">
            <button type="button" className={buttonClassName}>
              <ThumbsUp className="size-4" aria-hidden="true" />
              Yes
            </button>
            <button type="button" className={buttonClassName}>
              <ThumbsDown className="size-4" aria-hidden="true" />
              No
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SuggestEditButton path={path} />
          <button
            type="button"
            className={buttonClassName}
            onClick={() => handleRaiseIssue(path)}
          >
            <MessageSquare className="size-4" aria-hidden="true" />
            Raise an issue
          </button>
        </div>
      </div>
    </footer>
  );
}
