import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync } from 'node:child_process';
import type { CodexDetectResult } from '../types.js';

const CODEX_PLUGIN_PATH = '.claude/plugins/marketplaces/openai-codex/plugins/codex';
const CODEX_AGENT_FILE = 'agents/codex-rescue.md';
const CODEX_COMPANION_FILE = 'scripts/codex-companion.mjs';

export class CodexDetector {
  private cache: CodexDetectResult | null = null;

  detect(): CodexDetectResult {
    if (this.cache) return this.cache;
    try {
      const result = this.performDetection();
      this.cache = result;
      return result;
    } catch {
      const fallback: CodexDetectResult = { available: false, authenticated: false };
      this.cache = fallback;
      console.warn('[codex-detect] Detection failed, returning unavailable');
      return fallback;
    }
  }

  clearCache(): void { this.cache = null; }

  private performDetection(): CodexDetectResult {
    const pluginPath = path.join(os.homedir(), CODEX_PLUGIN_PATH);
    if (!fs.existsSync(pluginPath)) return { available: false, authenticated: false };
    if (!fs.existsSync(path.join(pluginPath, CODEX_AGENT_FILE))) return { available: false, authenticated: false };
    try { fs.accessSync(path.join(pluginPath, CODEX_COMPANION_FILE), fs.constants.R_OK); } catch { return { available: false, authenticated: false }; }
    return { available: true, authenticated: this.checkAuthentication(), plugin_path: pluginPath };
  }

  private checkAuthentication(): boolean {
    try {
      const output = execSync('codex setup --status', { encoding: 'utf-8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] });
      const lower = output.toLowerCase();
      return lower.includes('authenticated') || lower.includes('ready') || lower.includes('ok');
    } catch {
      try { return fs.existsSync(path.join(os.homedir(), '.codex', 'auth.json')); } catch { return false; }
    }
  }
}
