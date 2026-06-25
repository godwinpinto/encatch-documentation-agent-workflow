#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';
import { readGithubAppPrivateKey } from './github-app-private-key.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workflowDir = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(workflowDir, '../..');
const envPath = path.join(workflowDir, '.env');

function loadEnvFile() {
  if (!existsSync(envPath)) {
    throw new Error(`Missing ${envPath}`);
  }

  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    const key = trimmed.slice(0, index);
    const value = trimmed.slice(index + 1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile();

const appId = process.env.GITHUB_APP_ID;
const owner = process.env.GITHUB_OWNER || 'godwinpinto';
const repo = process.env.GITHUB_REPO || 'encatch-documentation-agent-workflow';

if (!appId) {
  throw new Error('Set GITHUB_APP_ID in .encatch/workflow/.env');
}

const privateKey = readGithubAppPrivateKey(repoRoot);

const appOctokit = new Octokit({
  authStrategy: createAppAuth,
  auth: { appId, privateKey },
});

const { data: app } = await appOctokit.rest.apps.getAuthenticated();
const { data: installation } = await appOctokit.rest.apps.getRepoInstallation({ owner, repo });

console.log('GitHub App verification OK');
console.log(`  App: ${app.name} (${app.slug}[bot])`);
console.log(`  App ID: ${app.id}`);
console.log(`  Installation ID: ${installation.id}`);
console.log(`  Repo: ${owner}/${repo}`);

if (!process.env.GITHUB_APP_INSTALLATION_ID) {
  console.log(`\nOptional: add GITHUB_APP_INSTALLATION_ID=${installation.id} to .env`);
}
