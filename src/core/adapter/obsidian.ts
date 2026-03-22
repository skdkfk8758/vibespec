import { execSync } from 'node:child_process';
import type { ObsidianSearchResult, TagInfo } from '../types.js';

let cachedAvailability: boolean | null = null;

export function resetAvailabilityCache(): void {
  cachedAvailability = null;
}

export class ObsidianAdapter {
  static isAvailable(): boolean {
    if (cachedAvailability !== null) {
      return cachedAvailability;
    }

    try {
      execSync('obsidian --version', { stdio: 'pipe' });
      cachedAvailability = true;
    } catch {
      cachedAvailability = false;
    }

    return cachedAvailability;
  }

  search(query: string, _format = 'json'): ObsidianSearchResult[] {
    try {
      const output = execSync(`obsidian search query="${query}" format=json`, {
        encoding: 'utf-8',
        stdio: 'pipe',
      });
      return JSON.parse(output) as ObsidianSearchResult[];
    } catch {
      return [];
    }
  }

  setProperty(file: string, name: string, value: string): void {
    try {
      execSync(`obsidian property:set file="${file}" name="${name}" value="${value}"`, {
        stdio: 'pipe',
      });
    } catch {
      // silently ignore
    }
  }

  append(file: string, content: string): void {
    try {
      execSync(`obsidian append file="${file}" content="${content}"`, {
        stdio: 'pipe',
      });
    } catch {
      // silently ignore
    }
  }

  getTags(): TagInfo[] {
    try {
      const output = execSync('obsidian tags format=json', {
        encoding: 'utf-8',
        stdio: 'pipe',
      });
      return JSON.parse(output) as TagInfo[];
    } catch {
      return [];
    }
  }
}
