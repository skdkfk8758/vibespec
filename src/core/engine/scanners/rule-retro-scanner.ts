import * as fs from 'node:fs';
import * as path from 'node:path';
import picomatch from 'picomatch';
import { generateId } from '../../utils.js';
import type { GCFinding, GCScanner } from '../../types.js';
import { escapeRegex, searchFileForViolations } from './scanner-utils.js';

const RULES_DIR = '.claude/rules';
const MAX_MATCHING_FILES_WARNING = 500;

interface ParsedRule {
  ruleId: string | null;
  appliesWhen: string[];
  patterns: RegExp[];
}

/**
 * Parse a rule markdown file and extract:
 * - Rule-ID from frontmatter
 * - Applies-When glob patterns from frontmatter
 * - NEVER DO patterns from body
 */
function parseRuleFile(content: string): ParsedRule {
  const result: ParsedRule = {
    ruleId: null,
    appliesWhen: [],
    patterns: [],
  };

  // Extract frontmatter between --- delimiters
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (frontmatterMatch) {
    const frontmatter = frontmatterMatch[1];

    // Extract Rule-ID
    const ruleIdMatch = frontmatter.match(/^Rule-ID:\s*(.+)$/m);
    if (ruleIdMatch) {
      result.ruleId = ruleIdMatch[1].trim();
    }

    // Extract Applies-When (also supports "Applies When" without hyphen)
    const appliesWhenMatch = frontmatter.match(/^Applies[-\s]When:\s*(.+)$/im);
    if (appliesWhenMatch) {
      const raw = appliesWhenMatch[1].trim();
      // May be comma-separated or single value
      result.appliesWhen = raw.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }

  // Extract NEVER DO patterns from the body
  const lines = content.split('\n');
  for (const line of lines) {
    const neverDoMatch = line.match(/^NEVER\s+DO:\s*(.+)$/i);
    if (neverDoMatch) {
      const patternStr = neverDoMatch[1].trim();
      try {
        // Escape special regex chars except those that might already be regex
        // Treat as literal string search
        result.patterns.push(new RegExp(escapeRegex(patternStr)));
      } catch {
        // Skip invalid patterns
      }
    }
  }

  return result;
}

/**
 * Check if a file path matches any of the given glob patterns.
 */
function matchesAnyGlob(filePath: string, globs: string[]): boolean {
  if (globs.length === 0) return false;
  const normalized = filePath.replace(/\\/g, '/');
  return globs.some((glob) => picomatch(glob)(normalized));
}

export class RuleRetroScanner implements GCScanner {
  readonly name = 'RuleRetroScanner';

  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  async scan(files: string[]): Promise<GCFinding[]> {
    const rulesDir = path.join(this.projectRoot, RULES_DIR);

    // AC04: Return empty array if rules dir does not exist
    if (!fs.existsSync(rulesDir)) {
      return [];
    }

    // Read rule files
    let ruleFiles: string[];
    try {
      ruleFiles = fs
        .readdirSync(rulesDir)
        .filter((f) => f.endsWith('.md'))
        .map((f) => path.join(rulesDir, f));
    } catch {
      return [];
    }

    // AC04: No rule files → empty array
    if (ruleFiles.length === 0) {
      return [];
    }

    const findings: GCFinding[] = [];
    const scanId = generateId();

    for (const ruleFile of ruleFiles) {
      let content: string;
      try {
        content = fs.readFileSync(ruleFile, 'utf-8');
      } catch {
        continue;
      }

      const parsed = parseRuleFile(content);

      // Skip rules with no applicable globs or no patterns
      if (parsed.appliesWhen.length === 0 || parsed.patterns.length === 0) {
        continue;
      }

      // Filter files matching this rule's globs
      const matchingFiles = files.filter((f) => matchesAnyGlob(f, parsed.appliesWhen));

      // AC03: Warn if too many matching files
      if (matchingFiles.length > MAX_MATCHING_FILES_WARNING) {
        console.warn(
          `[RuleRetroScanner] Rule "${parsed.ruleId ?? ruleFile}" matches ${matchingFiles.length} files (>${MAX_MATCHING_FILES_WARNING}). Consider narrowing the Applies-When glob.`
        );
      }

      // Scan each matching file
      for (const filePath of matchingFiles) {
        const violations = searchFileForViolations(filePath, parsed.patterns);

        for (const violation of violations) {
          // AC01, AC02: Build GCFinding
          const finding: GCFinding = {
            id: generateId(),
            scan_id: scanId,
            category: 'RULE_VIOLATION',
            severity: 'medium',
            safety_level: 'SAFE',
            file_path: filePath,
            line_start: violation.lineStart,
            line_end: violation.lineEnd,
            rule_source: 'SELF_IMPROVE',
            rule_id: parsed.ruleId,
            description: `Rule violation: pattern "${violation.pattern.source}" matched in file`,
            suggested_fix: null,
            status: 'detected',
            resolved_at: null,
          };
          findings.push(finding);
        }
      }
    }

    return findings;
  }
}
