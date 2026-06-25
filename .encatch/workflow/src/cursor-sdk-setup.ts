import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workflowRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(workflowRoot, 'package.json'));

function findPackageRoot(startDir: string, packageName: string): string | undefined {
  let dir = startDir;
  while (dir !== path.dirname(dir)) {
    const pkgPath = path.join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { name?: string };
        if (pkg.name === packageName) return dir;
      } catch {
        // Ignore malformed package.json files.
      }
    }
    dir = path.dirname(dir);
  }
  return undefined;
}

function resolveBundledRipgrep(): string | undefined {
  const fromEnv = process.env.CURSOR_RIPGREP_PATH?.trim();
  if (fromEnv && path.isAbsolute(fromEnv) && existsSync(fromEnv)) {
    return fromEnv;
  }

  const platform =
    process.platform === 'win32' ? 'win32' : process.platform === 'darwin' ? 'darwin' : 'linux';
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  const exe = platform === 'win32' ? 'rg.exe' : 'rg';

  let sdkRoot: string | undefined;
  try {
    sdkRoot = findPackageRoot(path.dirname(require.resolve('@cursor/sdk')), '@cursor/sdk');
  } catch {
    return undefined;
  }

  if (!sdkRoot) return undefined;

  const cursorScope = path.dirname(sdkRoot);
  const candidates = [
    path.join(cursorScope, `sdk-${platform}-${arch}`, 'bin', exe),
    path.join(sdkRoot, 'node_modules', '@cursor', `sdk-${platform}-${arch}`, 'bin', exe),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  return undefined;
}

let configured = false;

/** Configure bundled ripgrep before importing `@cursor/sdk` local agents. */
export function setupCursorSdkRuntime(): void {
  if (configured) return;
  configured = true;

  const rgPath = resolveBundledRipgrep();
  if (!rgPath) {
    console.warn(
      '[cursor-sdk] bundled ripgrep not found; set CURSOR_RIPGREP_PATH to suppress ignore-mapping errors',
    );
    return;
  }

  process.env.CURSOR_RIPGREP_PATH = rgPath;

  const rgDir = path.dirname(rgPath);
  const pathEntries = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean);
  if (!pathEntries.includes(rgDir)) {
    process.env.PATH = `${rgDir}${path.delimiter}${process.env.PATH ?? ''}`;
  }
}

setupCursorSdkRuntime();
