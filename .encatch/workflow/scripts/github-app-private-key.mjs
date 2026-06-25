import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const DEFAULT_GITHUB_APP_PRIVATE_KEY_PATH = '.encatch/workflow/github-app.private-key.pem';

export function resolveGithubAppPrivateKeyPath(repoRoot) {
  const configured =
    process.env.GITHUB_APP_PRIVATE_KEY_PATH?.trim() || DEFAULT_GITHUB_APP_PRIVATE_KEY_PATH;
  return path.isAbsolute(configured) ? configured : path.resolve(repoRoot, configured);
}

/** PEM from GITHUB_APP_PRIVATE_KEY (env) or GITHUB_APP_PRIVATE_KEY_PATH (file). Env takes precedence. */
export function readGithubAppPrivateKey(repoRoot) {
  const inline = process.env.GITHUB_APP_PRIVATE_KEY?.trim();
  if (inline) {
    return inline.replace(/\\n/g, '\n');
  }

  const keyPath = resolveGithubAppPrivateKeyPath(repoRoot);
  if (!existsSync(keyPath)) {
    throw new Error(
      `GitHub App private key not found at ${keyPath}. Set GITHUB_APP_PRIVATE_KEY or GITHUB_APP_PRIVATE_KEY_PATH.`,
    );
  }

  return readFileSync(keyPath, 'utf8');
}
