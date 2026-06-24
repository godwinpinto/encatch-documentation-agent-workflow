import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workflowDir = path.dirname(fileURLToPath(import.meta.url));

/** Repo root is three levels above .encatch/workflow/src */
export const repoRoot = path.resolve(workflowDir, '../../..');
