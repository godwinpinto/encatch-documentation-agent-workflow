#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workflowDir = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(workflowDir, '../..');
const envPath = path.join(workflowDir, '.env');

function loadEnv() {
  if (!existsSync(envPath)) return {};
  return Object.fromEntries(
    readFileSync(envPath, 'utf8')
      .split('\n')
      .filter((line) => line.trim() && !line.startsWith('#'))
      .map((line) => {
        const index = line.indexOf('=');
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
}

function upsertEnv(key, value) {
  const lines = existsSync(envPath) ? readFileSync(envPath, 'utf8').split('\n') : [];
  const prefix = `${key}=`;
  let found = false;
  const next = lines.map((line) => {
    if (line.startsWith(prefix)) {
      found = true;
      return `${prefix}${value}`;
    }
    return line;
  });
  if (!found) next.push(`${prefix}${value}`);
  writeFileSync(envPath, `${next.filter((line, i, arr) => !(i === arr.length - 1 && line === '')).join('\n')}\n`);
}

const env = loadEnv();
const owner = process.env.GITHUB_OWNER || env.GITHUB_OWNER || 'godwinpinto';
const repo = process.env.GITHUB_REPO || env.GITHUB_REPO || 'encatch-documentation-agent-workflow';
const webhookUrl =
  process.env.WEBHOOK_URL ||
  env.WEBHOOK_URL ||
  'https://YOUR-NGROK-URL.ngrok-free.app/webhooks/github';
const webhookSecret =
  process.env.GITHUB_WEBHOOK_SECRET || env.GITHUB_WEBHOOK_SECRET || randomBytes(32).toString('hex');

upsertEnv('GITHUB_WEBHOOK_SECRET', webhookSecret);
upsertEnv('GITHUB_OWNER', owner);
upsertEnv('GITHUB_REPO', repo);

const registerUrl = new URL('https://github.com/settings/apps/new');
registerUrl.searchParams.set('name', 'encatch-docs-agent');
registerUrl.searchParams.set('description', 'Encatch documentation triage and fix agent');
registerUrl.searchParams.set('url', 'http://localhost:8787');
registerUrl.searchParams.set('public', '0');
registerUrl.searchParams.set('hook_attributes[url]', webhookUrl);
registerUrl.searchParams.set('hook_attributes[active]', '1');
registerUrl.searchParams.set('hook_attributes[secret]', webhookSecret);
registerUrl.searchParams.set('default_permissions[issues]', 'write');
registerUrl.searchParams.set('default_permissions[contents]', 'write');
registerUrl.searchParams.set('default_permissions[pull_requests]', 'write');
registerUrl.searchParams.set('default_permissions[metadata]', 'read');
registerUrl.searchParams.append('default_events[]', 'issues');
registerUrl.searchParams.append('default_events[]', 'issue_comment');

console.log('\nEncatch GitHub App setup\n');
console.log('1) Open this URL to create the app (fields are pre-filled):');
console.log(`\n${registerUrl.toString()}\n`);
console.log('2) After creating the app:');
console.log('   - Generate and download a private key (.pem)');
console.log(`   - Save it to: ${path.join(workflowDir, 'github-app.private-key.pem')}`);
console.log('     or set GITHUB_APP_PRIVATE_KEY in .env (inline PEM, \\n for newlines)');
console.log(`   - Install the app on: ${owner}/${repo}`);
console.log('3) Add to .encatch/workflow/.env:');
console.log('   GITHUB_APP_ID=<App ID from GitHub>');
console.log('   # remove or comment out GITHUB_TOKEN once app mode works');
console.log('4) Verify: pnpm verify:github-app\n');
console.log(`Saved GITHUB_WEBHOOK_SECRET to ${envPath}`);

try {
  execSync(`open ${JSON.stringify(registerUrl.toString())}`, { stdio: 'ignore' });
} catch {
  // Non-macOS or open unavailable — URL is printed above.
}
