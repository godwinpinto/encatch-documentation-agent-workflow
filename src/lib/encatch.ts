import { _encatch, type Theme } from '@encatch/web-sdk';

export const encatchConfig = {
  apiKey: import.meta.env.VITE_ENCATCH_API_KEY,
  apiBaseUrl: import.meta.env.VITE_ENCATCH_API_BASE_URL,
  webHost: import.meta.env.VITE_ENCATCH_WEB_HOST,
  raiseIssueFormSlug: import.meta.env.VITE_ENCATCH_RAISE_ISSUE_FORM_SLUG ?? 'raise-an-issue',
  suggestEditFormSlug: import.meta.env.VITE_ENCATCH_SUGGEST_EDIT_FORM_SLUG ?? 'suggest-an-edit',
  pageUrlQuestionSlug: 'page_url',
  documentationUrlQuestionSlug: 'documentation_url',
  selectedTextQuestionSlug: 'selected_text',
  improvementSuggestionQuestionSlug: 'improvement_suggestion',
} as const;

let initialized = false;

export function isEncatchConfigured() {
  return Boolean(encatchConfig.apiKey);
}

export function initEncatch() {
  if (initialized || typeof window === 'undefined' || !encatchConfig.apiKey) {
    return;
  }

  _encatch.init(encatchConfig.apiKey, {
    theme: 'system',
    ...(encatchConfig.apiBaseUrl ? { apiBaseUrl: encatchConfig.apiBaseUrl } : {}),
    ...(encatchConfig.webHost ? { webHost: encatchConfig.webHost } : {}),
  });
  initialized = true;
}

function toEncatchTheme(theme: string | undefined): Theme {
  if (theme === 'light' || theme === 'dark' || theme === 'system') {
    return theme;
  }

  return 'system';
}

export function syncEncatchTheme(theme: string | undefined) {
  if (!encatchConfig.apiKey || typeof window === 'undefined') {
    return;
  }

  initEncatch();
  _encatch.setTheme(toEncatchTheme(theme));
}

export function openRaiseIssueForm(pageUrl?: string) {
  if (!encatchConfig.apiKey || typeof window === 'undefined') {
    return false;
  }

  initEncatch();

  const url = pageUrl ?? window.location.href;
  _encatch.addToResponse(encatchConfig.pageUrlQuestionSlug, url);
  _encatch.showForm(encatchConfig.raiseIssueFormSlug, { reset: 'always' });

  return true;
}

type SuggestEditFormInput = {
  pageUrl?: string;
  selectedText?: string;
  improvementSuggestion?: string;
};

export function openSuggestEditForm({
  pageUrl,
  selectedText,
  improvementSuggestion,
}: SuggestEditFormInput = {}) {
  if (!encatchConfig.apiKey || typeof window === 'undefined') {
    return false;
  }

  initEncatch();

  const url = pageUrl ?? window.location.href;
  _encatch.addToResponse(encatchConfig.documentationUrlQuestionSlug, url);

  if (selectedText) {
    _encatch.addToResponse(encatchConfig.selectedTextQuestionSlug, selectedText);
  }

  if (improvementSuggestion) {
    _encatch.addToResponse(encatchConfig.improvementSuggestionQuestionSlug, improvementSuggestion);
  }

  _encatch.showForm(encatchConfig.suggestEditFormSlug, { reset: 'always' });

  return true;
}
