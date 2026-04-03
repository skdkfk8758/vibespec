import * as fs from 'node:fs';
import * as path from 'node:path';
import { generateId } from '../../utils.js';
import type { GCFinding, GCScanner } from '../../types.js';
import { escapeRegex, searchFileForViolations } from './scanner-utils.js';

const POLICY_FILE = 'POLICY.md';

interface PolicyRule {
  ruleId: string;
  pattern: RegExp;
  description: string;
}

/**
 * Extract machine-verifiable rules from POLICY.md content.
 * Rules are extracted from:
 * 1. Bullet items containing "금지" keyword with backtick-quoted patterns
 * 2. Code block contents adjacent to "금지" headings/bullets
 *
 * Natural language-only items (no extractable pattern) are skipped.
 */
function extractPolicyRules(content: string): PolicyRule[] {
  const rules: PolicyRule[] = [];
  let ruleCounter = 0;

  // Strategy 1: Bullet items with "금지" keyword and backtick patterns
  // Matches: "- **금지**: `pattern`..." or "- 금지: pattern..."
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();

    // Check if line contains "금지" keyword (forbidden)
    if (!/금지/.test(trimmed)) continue;

    // Extract backtick-quoted patterns from the line
    const backtickMatches = trimmed.matchAll(/`([^`]+)`/g);
    for (const match of backtickMatches) {
      const patternStr = match[1].trim();
      if (!patternStr || patternStr.length < 2) continue;

      try {
        const regex = new RegExp(escapeRegex(patternStr));
        ruleCounter++;
        rules.push({
          ruleId: `policy-rule-${ruleCounter}`,
          pattern: regex,
          description: `POLICY.md 금지 패턴: ${patternStr}`,
        });
      } catch {
        // Skip invalid patterns
      }
    }

    // Also extract plain text after "금지:" if no backtick patterns found
    // Pattern: "- 금지: someword" — extract the word after the colon
    const plainMatch = trimmed.match(/금지[^:：]*[:：]\s*([^\s(`（,]+)/);
    if (plainMatch && !trimmed.includes('`')) {
      const patternStr = plainMatch[1].trim().replace(/[.,;]$/, '');
      if (patternStr && patternStr.length >= 2) {
        try {
          const regex = new RegExp(escapeRegex(patternStr));
          ruleCounter++;
          rules.push({
            ruleId: `policy-rule-${ruleCounter}`,
            pattern: regex,
            description: `POLICY.md 금지 패턴: ${patternStr}`,
          });
        } catch {
          // Skip invalid patterns
        }
      }
    }
  }

  // Strategy 2: Code blocks — extract literal patterns from code blocks
  // that appear in sections with "금지" context
  const codeBlockRegex = /```[^\n]*\n([\s\S]*?)```/g;
  let codeMatch: RegExpExecArray | null;

  while ((codeMatch = codeBlockRegex.exec(content)) !== null) {
    const blockStart = codeMatch.index;
    // Look at the preceding 300 chars for "금지" context
    const preceding = content.slice(Math.max(0, blockStart - 300), blockStart);
    if (!/금지/.test(preceding)) continue;

    const blockContent = codeMatch[1];
    const blockLines = blockContent.split('\n').filter((l) => l.trim().length > 0);

    for (const blockLine of blockLines) {
      const trimmedLine = blockLine.trim();
      if (trimmedLine.length < 2) continue;

      try {
        const regex = new RegExp(escapeRegex(trimmedLine));
        ruleCounter++;
        rules.push({
          ruleId: `policy-rule-${ruleCounter}`,
          pattern: regex,
          description: `POLICY.md 코드블록 금지 패턴: ${trimmedLine}`,
        });
      } catch {
        // Skip
      }
    }
  }

  return rules;
}

export class PolicyScanner implements GCScanner {
  readonly name = 'PolicyScanner';
  private readonly projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  async scan(files: string[]): Promise<GCFinding[]> {
    const policyPath = path.join(this.projectRoot, POLICY_FILE);

    // AC02: POLICY.md 미존재 시 경고 + 빈 결과 반환
    if (!fs.existsSync(policyPath)) {
      console.warn(`[PolicyScanner] POLICY.md not found at: ${policyPath}`);
      return [];
    }

    let policyContent: string;
    try {
      policyContent = fs.readFileSync(policyPath, 'utf-8');
    } catch {
      console.warn(`[PolicyScanner] Failed to read POLICY.md at: ${policyPath}`);
      return [];
    }

    // AC01/AC03: Extract machine-verifiable rules, skip natural language
    const rules = extractPolicyRules(policyContent);

    if (rules.length === 0 || files.length === 0) {
      return [];
    }

    const findings: GCFinding[] = [];

    for (const filePath of files) {
      const violations = searchFileForViolations(filePath, rules.map((r) => r.pattern));

      for (const violation of violations) {
        // Find matching rule for this violation
        const matchedRule = rules.find((r) => r.pattern.test(
          fs.readFileSync(filePath, 'utf-8').split('\n')[violation.lineStart - 1] ?? ''
        ));

        // AC04: category=POLICY_VIOLATION, rule_source=POLICY
        const finding: GCFinding = {
          id: generateId(),
          scan_id: '',
          category: 'POLICY_VIOLATION',
          severity: 'medium',
          safety_level: 'SAFE',
          file_path: filePath,
          line_start: violation.lineStart,
          line_end: violation.lineEnd,
          rule_source: 'POLICY',
          rule_id: matchedRule?.ruleId ?? null,
          description: matchedRule?.description ?? 'POLICY.md 규칙 위반',
          suggested_fix: null,
          status: 'detected',
          resolved_at: null,
        };

        findings.push(finding);
      }
    }

    return findings;
  }
}
