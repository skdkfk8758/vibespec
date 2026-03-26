import * as fs from 'node:fs';
import * as path from 'node:path';
import { generateId } from '../utils.js';
import type {
  ErrorEntry,
  ErrorKBStats,
  ErrorSeverity,
  ErrorStatus,
  NewErrorEntry,
} from '../types.js';

export interface SearchOptions {
  tags?: string[];
  severity?: ErrorSeverity;
}

export interface UpdatePatch {
  severity?: ErrorSeverity;
  status?: ErrorStatus;
  occurrences?: number;
  last_seen?: string;
  tags?: string[];
}

interface FrontmatterData {
  title: string;
  severity: ErrorSeverity;
  tags: string[];
  status: ErrorStatus;
  occurrences: number;
  first_seen: string;
  last_seen: string;
  [key: string]: unknown;
}

const VALID_SEVERITIES = new Set<string>(['critical', 'high', 'medium', 'low']);
const VALID_STATUSES = new Set<string>(['open', 'resolved', 'recurring', 'wontfix']);
const VALID_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export function parseFrontmatter(raw: string): { meta: FrontmatterData; body: string } {
  const defaultMeta: FrontmatterData = {
    title: '',
    severity: 'medium',
    tags: [],
    status: 'open',
    occurrences: 0,
    first_seen: '',
    last_seen: '',
  };

  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { meta: defaultMeta, body: raw };
  }

  const yamlBlock = match[1];
  const body = match[2];
  const meta = { ...defaultMeta };

  for (const line of yamlBlock.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();

    if (key === 'title') {
      meta.title = value;
    } else if (key === 'severity') {
      if (VALID_SEVERITIES.has(value)) meta.severity = value as ErrorSeverity;
    } else if (key === 'status') {
      if (VALID_STATUSES.has(value)) meta.status = value as ErrorStatus;
    } else if (key === 'occurrences') {
      meta.occurrences = parseInt(value, 10) || 0;
    } else if (key === 'first_seen') {
      meta.first_seen = value;
    } else if (key === 'last_seen') {
      meta.last_seen = value;
    } else if (key === 'tags') {
      const bracketMatch = value.match(/^\[(.*)\]$/);
      if (bracketMatch) {
        meta.tags = bracketMatch[1]
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t.length > 0);
      } else if (value === '' || value === '[]') {
        meta.tags = [];
      }
    }
  }

  return { meta, body };
}

export function serializeFrontmatter(meta: FrontmatterData): string {
  const tagsStr = meta.tags.length > 0 ? `[${meta.tags.join(', ')}]` : '[]';
  const lines = [
    '---',
    `title: ${meta.title}`,
    `severity: ${meta.severity}`,
    `tags: ${tagsStr}`,
    `status: ${meta.status}`,
    `occurrences: ${meta.occurrences}`,
    `first_seen: ${meta.first_seen}`,
    `last_seen: ${meta.last_seen}`,
    '---',
  ];
  return lines.join('\n');
}

export class ErrorKBEngine {
  private kbRoot: string;
  private errorsDir: string;

  constructor(projectRoot: string) {
    this.kbRoot = path.join(projectRoot, '.claude', 'error-kb');
    this.errorsDir = path.join(this.kbRoot, 'errors');
    fs.mkdirSync(this.errorsDir, { recursive: true });
  }

  private resolveFilePath(id: string): string | null {
    if (!VALID_ID_PATTERN.test(id)) return null;
    return path.join(this.errorsDir, `${id}.md`);
  }

  add(newEntry: NewErrorEntry): ErrorEntry {
    const id = generateId();
    const now = new Date().toISOString();

    const meta: FrontmatterData = {
      title: newEntry.title,
      severity: newEntry.severity,
      tags: newEntry.tags,
      status: 'open',
      occurrences: 1,
      first_seen: now,
      last_seen: now,
    };

    let body = '\n';
    if (newEntry.cause) {
      body += `## Cause\n\n${newEntry.cause}\n\n`;
    }
    if (newEntry.solution) {
      body += `## Solution\n\n${newEntry.solution}\n\n`;
    }

    const content = serializeFrontmatter(meta) + '\n' + body;
    const filePath = path.join(this.errorsDir, `${id}.md`);
    fs.writeFileSync(filePath, content, 'utf-8');

    this.updateIndex();

    return this.toErrorEntry(id, meta, body);
  }

  show(id: string): ErrorEntry | null {
    const filePath = this.resolveFilePath(id);
    if (!filePath || !fs.existsSync(filePath)) {
      return null;
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const { meta, body } = parseFrontmatter(raw);

    return this.toErrorEntry(id, meta, body);
  }

  search(query: string, opts?: SearchOptions): ErrorEntry[] {
    const files = this.listErrorFiles();
    const results: ErrorEntry[] = [];

    for (const file of files) {
      const id = path.basename(file, '.md');
      const entry = this.show(id);
      if (!entry) continue;

      if (opts?.tags && opts.tags.length > 0) {
        const hasMatchingTag = opts.tags.some((t) => entry.tags.includes(t));
        if (!hasMatchingTag) continue;
      }

      if (opts?.severity && entry.severity !== opts.severity) {
        continue;
      }

      if (query && query.length > 0) {
        const searchable = `${entry.title} ${entry.content}`.toLowerCase();
        if (!searchable.includes(query.toLowerCase())) {
          continue;
        }
      }

      results.push(entry);
    }

    return results;
  }

  delete(id: string): boolean {
    const filePath = this.resolveFilePath(id);
    if (!filePath || !fs.existsSync(filePath)) return false;
    fs.unlinkSync(filePath);
    this.updateIndex();
    return true;
  }

  update(id: string, patch: UpdatePatch): void {
    const filePath = this.resolveFilePath(id);
    if (!filePath || !fs.existsSync(filePath)) return;

    const raw = fs.readFileSync(filePath, 'utf-8');
    const { meta, body } = parseFrontmatter(raw);

    if (patch.severity !== undefined) meta.severity = patch.severity;
    if (patch.status !== undefined) meta.status = patch.status;
    if (patch.occurrences !== undefined) meta.occurrences = patch.occurrences;
    if (patch.last_seen !== undefined) meta.last_seen = patch.last_seen;
    if (patch.tags !== undefined) meta.tags = patch.tags;

    const content = serializeFrontmatter(meta) + '\n' + body;
    fs.writeFileSync(filePath, content, 'utf-8');

    this.updateIndex();
  }

  recordOccurrence(id: string, context: string): void {
    const filePath = this.resolveFilePath(id);
    if (!filePath || !fs.existsSync(filePath)) return;

    const raw = fs.readFileSync(filePath, 'utf-8');
    const { meta, body } = parseFrontmatter(raw);

    meta.occurrences += 1;
    meta.last_seen = new Date().toISOString();

    let updatedBody = body;
    const historyEntry = `- ${meta.last_seen}: ${context}`;
    const historyIdx = updatedBody.lastIndexOf('## History');

    if (historyIdx !== -1) {
      const headerEnd = updatedBody.indexOf('\n', historyIdx);
      if (headerEnd !== -1) {
        updatedBody =
          updatedBody.slice(0, headerEnd + 1) +
          historyEntry + '\n' +
          updatedBody.slice(headerEnd + 1);
      }
    } else {
      updatedBody = updatedBody.trimEnd() + '\n\n## History\n' + historyEntry + '\n';
    }

    const content = serializeFrontmatter(meta) + '\n' + updatedBody;
    fs.writeFileSync(filePath, content, 'utf-8');

    this.updateIndex();
  }

  getStats(): ErrorKBStats {
    const files = this.listErrorFiles();
    const stats: ErrorKBStats = {
      total: 0,
      by_severity: { critical: 0, high: 0, medium: 0, low: 0 },
      by_status: { open: 0, resolved: 0, recurring: 0, wontfix: 0 },
      top_recurring: [],
    };

    const entries: Array<{ id: string; title: string; occurrences: number }> = [];
    for (const file of files) {
      const id = path.basename(file, '.md');
      const raw = fs.readFileSync(file, 'utf-8');
      const { meta } = parseFrontmatter(raw);

      stats.total++;
      stats.by_severity[meta.severity]++;
      stats.by_status[meta.status]++;
      entries.push({ id, title: meta.title, occurrences: meta.occurrences });
    }

    stats.top_recurring = entries
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, 10);

    return stats;
  }

  private toErrorEntry(id: string, meta: FrontmatterData, body: string): ErrorEntry {
    return {
      id,
      title: meta.title,
      severity: meta.severity,
      tags: meta.tags,
      status: meta.status,
      occurrences: meta.occurrences,
      first_seen: meta.first_seen,
      last_seen: meta.last_seen,
      content: body,
    };
  }

  listErrorFiles(): string[] {
    if (!fs.existsSync(this.errorsDir)) return [];
    return fs
      .readdirSync(this.errorsDir)
      .filter((f) => f.endsWith('.md') && f !== '_index.md')
      .map((f) => path.join(this.errorsDir, f));
  }

  private updateIndex(): void {
    const stats = this.getStats();
    const lines = [
      '# Error Knowledge Base Index',
      '',
      `Total: ${stats.total}`,
      '',
      '## By Severity',
      `- Critical: ${stats.by_severity.critical}`,
      `- High: ${stats.by_severity.high}`,
      `- Medium: ${stats.by_severity.medium}`,
      `- Low: ${stats.by_severity.low}`,
      '',
      '## By Status',
      `- Open: ${stats.by_status.open}`,
      `- Resolved: ${stats.by_status.resolved}`,
      `- Recurring: ${stats.by_status.recurring}`,
      `- Won't Fix: ${stats.by_status.wontfix}`,
      '',
    ];

    if (stats.top_recurring.length > 0) {
      lines.push('## Top Recurring');
      for (const entry of stats.top_recurring.slice(0, 10)) {
        lines.push(`- ${entry.title} (${entry.occurrences}x)`);
      }
      lines.push('');
    }

    const indexPath = path.join(this.kbRoot, '_index.md');
    fs.writeFileSync(indexPath, lines.join('\n'), 'utf-8');
  }

}
