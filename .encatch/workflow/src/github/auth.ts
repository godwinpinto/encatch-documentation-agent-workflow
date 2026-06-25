import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';
import { config, readGithubAppPrivateKey } from '../config.js';

let octokitPromise: Promise<Octokit> | undefined;
let installationIdPromise: Promise<number> | undefined;

async function resolveInstallationId(appOctokit: Octokit): Promise<number> {
  const configured = config.githubAppInstallationId();
  if (configured) {
    return Number(configured);
  }

  const { data } = await appOctokit.rest.apps.getRepoInstallation({
    owner: config.githubOwner(),
    repo: config.githubRepo(),
  });

  return data.id;
}

async function getInstallationId(): Promise<number> {
  if (!installationIdPromise) {
    installationIdPromise = (async () => {
      const appOctokit = new Octokit({
        authStrategy: createAppAuth,
        auth: {
          appId: config.githubAppId(),
          privateKey: readGithubAppPrivateKey(),
        },
      });
      return resolveInstallationId(appOctokit);
    })();
  }

  return installationIdPromise;
}

async function createOctokit(): Promise<Octokit> {
  if (!config.useGithubApp()) {
    return new Octokit({ auth: config.githubPat() });
  }

  const installationId = await getInstallationId();

  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: config.githubAppId(),
      privateKey: readGithubAppPrivateKey(),
      installationId,
    },
  });
}

export async function getOctokit(): Promise<Octokit> {
  if (!octokitPromise) {
    octokitPromise = createOctokit();
  }
  return octokitPromise;
}

/** Token for git/gh in agent worktrees (installation token or PAT). */
export async function getGitHubAuthToken(): Promise<string> {
  if (!config.useGithubApp()) {
    return config.githubPat();
  }

  const auth = createAppAuth({
    appId: config.githubAppId(),
    privateKey: readGithubAppPrivateKey(),
    installationId: await getInstallationId(),
  });
  const { token } = await auth({ type: 'installation' });
  return token;
}

export async function getBotLogin(): Promise<string | undefined> {
  if (!config.useGithubApp()) {
    return undefined;
  }

  const appOctokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: config.githubAppId(),
      privateKey: readGithubAppPrivateKey(),
    },
  });
  const { data } = await appOctokit.rest.apps.getAuthenticated();
  if (!data) return undefined;
  return `${data.slug}[bot]`;
}

let botGitIdentityPromise: Promise<{ name: string; email: string }> | undefined;

/** Git author identity for commits created in agent worktrees. */
export async function getBotGitIdentity(): Promise<{ name: string; email: string }> {
  if (!config.useGithubApp()) {
    return {
      name: config.githubOwner(),
      email: `${config.githubOwner()}@users.noreply.github.com`,
    };
  }

  if (!botGitIdentityPromise) {
    botGitIdentityPromise = (async () => {
      const appOctokit = new Octokit({
        authStrategy: createAppAuth,
        auth: {
          appId: config.githubAppId(),
          privateKey: readGithubAppPrivateKey(),
        },
      });
      const { data } = await appOctokit.rest.apps.getAuthenticated();
      return {
        name: `${data.slug}[bot]`,
        email: `${config.githubAppId()}+${data.slug}@users.noreply.github.com`,
      };
    })();
  }

  return botGitIdentityPromise;
}
