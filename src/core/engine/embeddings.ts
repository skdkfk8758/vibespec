import type BetterSqlite3 from 'better-sqlite3';
import { createRequire } from 'node:module';

type Database = BetterSqlite3.Database;
const require = createRequire(import.meta.url);

let pipelineInstance: ((text: string, options?: Record<string, unknown>) => Promise<{ data: Float32Array; dims: number[] }>) | null = null;

/**
 * Try to load sqlite-vec extension into a better-sqlite3 database.
 * Returns true on success, false on failure (graceful).
 */
export function loadVec(db: Database): boolean {
  try {
    const sqliteVec = require('sqlite-vec');
    sqliteVec.load(db);
    return true;
  } catch {
    // sqlite-vec may not be installed on this platform
    return false;
  }
}

/**
 * Check if vec extension is available by attempting a query.
 */
export function isVecAvailable(db: Database): boolean {
  try {
    db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'vec_%'").all();
    return true;
  } catch {
    return false;
  }
}

/**
 * Initialize the transformer pipeline (lazy singleton).
 * Uses Xenova/all-MiniLM-L6-v2 for 384-dim embeddings.
 */
export async function initModel(): Promise<void> {
  if (pipelineInstance) return;
  const { pipeline } = await import('@xenova/transformers');
  pipelineInstance = await (pipeline as Function)('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
}

/**
 * Generate a 384-dimensional embedding from text.
 */
export async function generateEmbedding(text: string): Promise<Float32Array> {
  if (!pipelineInstance) {
    await initModel();
  }
  const output = await pipelineInstance!(text, { pooling: 'mean', normalize: true });
  return new Float32Array(output.data.slice(0, 384));
}

/**
 * Compute cosine similarity between two vectors.
 * Works with both Float32Array and number[].
 */
export function cosineSimilarity(a: Float32Array | number[], b: Float32Array | number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const ai = a[i];
    const bi = b[i];
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}

/**
 * Reset the pipeline singleton (for testing).
 * @internal
 */
export function _resetPipeline(): void {
  pipelineInstance = null;
}
