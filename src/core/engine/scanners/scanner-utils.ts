import * as fs from 'node:fs';

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function searchFileForViolations(
  filePath: string,
  patterns: RegExp[],
): Array<{ lineStart: number; lineEnd: number; pattern: RegExp }> {
  const results: Array<{ lineStart: number; lineEnd: number; pattern: RegExp }> = [];

  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return results;
  }

  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const pattern of patterns) {
      if (pattern.test(lines[i])) {
        results.push({ lineStart: i + 1, lineEnd: i + 1, pattern });
      }
    }
  }

  return results;
}
