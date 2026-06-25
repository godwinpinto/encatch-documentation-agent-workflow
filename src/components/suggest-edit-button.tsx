'use client';

import { gitConfig } from '@/lib/shared';
import { isEncatchConfigured, openSuggestEditForm } from '@/lib/encatch';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from 'fumadocs-ui/components/ui/popover';
import { PenLine } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const buttonClassName =
  'inline-flex items-center gap-1.5 rounded-full border border-fd-border bg-transparent px-3 py-1.5 text-sm font-medium text-fd-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground';

const DOCS_CONTENT_SELECTOR = '#docs-content';

type SuggestEditButtonProps = {
  path: string;
};

type DocsSelection = {
  text: string;
  top: number;
  left: number;
};

function getDocsSelection(): DocsSelection | null {
  const container = document.querySelector(DOCS_CONTENT_SELECTOR);
  const selection = window.getSelection();

  if (!container || !selection || selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }

  const { anchorNode, focusNode } = selection;
  if (!anchorNode || !focusNode) {
    return null;
  }

  if (!container.contains(anchorNode) && !container.contains(focusNode)) {
    return null;
  }

  const text = selection.toString().trim();
  if (!text) {
    return null;
  }

  const rect = selection.getRangeAt(0).getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    return null;
  }

  return {
    text,
    top: rect.bottom + 8,
    left: rect.left + rect.width / 2,
  };
}

function buildIssueUrl(path: string, selectedText: string) {
  const pagePath = path ? `/docs/${path.replace(/\.mdx$/, '')}` : '/docs';
  const body = [
    `**Page:** ${pagePath}`,
    '',
    '**Current text:**',
    `> ${selectedText.split('\n').join('\n> ')}`,
    '',
    '**Expected text:**',
    '> ',
    '',
    '**Why:**',
  ].join('\n');

  const params = new URLSearchParams({
    title: `Docs edit: ${path || 'index'}`,
    body,
  });

  return `https://github.com/${gitConfig.user}/${gitConfig.repo}/issues/new?${params}`;
}

function clearSelection() {
  window.getSelection()?.removeAllRanges();
}

export function SuggestEditButton({ path }: SuggestEditButtonProps) {
  const [selection, setSelection] = useState<DocsSelection | null>(null);

  useEffect(() => {
    const syncSelection = () => {
      setSelection(getDocsSelection());
    };

    document.addEventListener('selectionchange', syncSelection);
    document.addEventListener('mouseup', syncSelection);
    window.addEventListener('scroll', syncSelection, true);
    window.addEventListener('resize', syncSelection);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        clearSelection();
        setSelection(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('selectionchange', syncSelection);
      document.removeEventListener('mouseup', syncSelection);
      window.removeEventListener('scroll', syncSelection, true);
      window.removeEventListener('resize', syncSelection);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  function handleOpenForm() {
    if (!selection) {
      return;
    }

    if (
      openSuggestEditForm({
        selectedText: selection.text,
      })
    ) {
      clearSelection();
      setSelection(null);
      return;
    }

    window.open(buildIssueUrl(path, selection.text), '_blank', 'noopener,noreferrer');
    clearSelection();
    setSelection(null);
  }

  return (
    <>
      <Popover>
        <PopoverTrigger className={buttonClassName}>
          <PenLine className="size-4" aria-hidden="true" />
          Suggest an edit
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-[min(20rem,calc(100vw-2rem))] p-4"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <p className="font-medium text-fd-foreground">Suggest an edit</p>
          <p className="mt-1 text-sm text-fd-muted-foreground">
            Highlight the text you want to change. A button will appear next to your selection
            {isEncatchConfigured() ? ' to open the feedback form.' : '.'}
          </p>
        </PopoverContent>
      </Popover>

      {selection &&
        createPortal(
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={handleOpenForm}
            style={{ top: selection.top, left: selection.left }}
            className="fixed z-50 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-fd-border bg-fd-popover px-3 py-1.5 text-sm font-medium text-fd-popover-foreground shadow-lg transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
          >
            <PenLine className="size-4" aria-hidden="true" />
            Suggest an edit
          </button>,
          document.body,
        )}
    </>
  );
}
