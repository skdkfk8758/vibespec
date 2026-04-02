import * as fs from 'node:fs';
import * as path from 'node:path';
import type { QAFinding } from '../types.js';

const SENSITIVE_PATTERNS = [/^\.env$/i, /^\.env\..+$/i, /secret/i, /credential/i, /\.key$/i, /\.pem$/i, /api[_-]?key/i];

export interface CodexPromptResult {
  prompt: string;
  included_files: string[];
  excluded_sensitive_files: string[];
  escalation?: { finding_id: string; reason: string };
}

export interface ErrorKBSearchResult { title: string; solution?: string; }
export interface ErrorKBClient { search(query: string): ErrorKBSearchResult[]; }

function isSensitiveFile(filePath: string): boolean {
  const normalized = path.normalize(filePath);
  const basename = path.basename(normalized);
  return SENSITIVE_PATTERNS.some((p) => p.test(basename)) ||
    normalized.split(path.sep).some((seg) => SENSITIVE_PATTERNS.some((p) => p.test(seg)));
}

export function buildCodexPrompt(finding: QAFinding, projectRoot: string, errorKB?: ErrorKBClient): CodexPromptResult {
  if (!finding.affected_files) {
    return { prompt: '', included_files: [], excluded_sensitive_files: [], escalation: { finding_id: finding.id, reason: 'Finding has no affected_files specified' } };
  }

  const files = finding.affected_files.split(',').map((f) => f.trim()).filter((f) => f.length > 0);
  const includedFiles: string[] = [];
  const excludedSensitiveFiles: string[] = [];
  const snippets: string[] = [];

  for (const file of files) {
    if (isSensitiveFile(file)) { excludedSensitiveFiles.push(file); continue; }
    const fullPath = path.resolve(projectRoot, file);
    if (!fs.existsSync(fullPath)) continue;
    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      includedFiles.push(file);
      snippets.push(`### ${file}\n\`\`\`\n${content}\n\`\`\``);
    } catch { continue; }
  }

  if (includedFiles.length === 0) {
    return { prompt: '', included_files: [], excluded_sensitive_files: excludedSensitiveFiles, escalation: { finding_id: finding.id, reason: 'None of the affected_files exist or all are sensitive' } };
  }

  const sections: string[] = [
    `## Bug Report\n**Title:** ${finding.title}\n**Severity:** ${finding.severity}\n**Category:** ${finding.category}`,
    `## Description\n${finding.description}`,
  ];
  if (finding.fix_suggestion) sections.push(`## Suggested Fix\n${finding.fix_suggestion}`);
  sections.push(`## Affected Files\n${snippets.join('\n\n')}`);

  if (errorKB) {
    try {
      const results = errorKB.search(finding.title);
      if (results.length > 0) sections.push(`## Previous Solutions (Error KB)\n${results.map((r) => `- **${r.title}**: ${r.solution ?? 'N/A'}`).join('\n')}`);
    } catch { /* error-kb is optional */ }
  }

  sections.push('## Instructions\nFix the bug described above. Only modify the affected files. Run tests after fixing.');
  return { prompt: sections.join('\n\n'), included_files: includedFiles, excluded_sensitive_files: excludedSensitiveFiles };
}
