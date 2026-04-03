import * as fs from 'node:fs';
import { generateId } from '../../utils.js';
import type { GCFinding, GCScanner } from '../../types.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Read file lines. Returns null if file cannot be read.
 */
function readLines(filePath: string): string[] | null {
  try {
    return fs.readFileSync(filePath, 'utf-8').split('\n');
  } catch {
    return null;
  }
}

/**
 * Strip single-line comments and normalize whitespace for comparison.
 */
function normalizeForDup(line: string): string {
  // Remove single-line // comments
  const stripped = line.replace(/\/\/.*$/, '');
  // Collapse whitespace
  return stripped.trim().replace(/\s+/g, ' ');
}

/**
 * Find all function extents in the file.
 * Returns array of { name, bodyStart (line of opening {), bodyEnd (line of closing }) }
 * Line numbers are 1-based.
 */
function findFunctions(
  lines: string[]
): Array<{ name: string; bodyStart: number; bodyEnd: number }> {
  const results: Array<{ name: string; bodyStart: number; bodyEnd: number }> = [];

  // Pattern: function keyword or arrow function assigned to const/let/var
  const funcKeywordRe = /(?:^|\s)function\s+(\w+)\s*\(/;
  const arrowFuncRe = /(?:^|(?:export\s+)?)(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(.*\)\s*(?::\s*\S+\s*)?=>/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const funcMatch = line.match(funcKeywordRe) ?? line.match(arrowFuncRe);
    if (!funcMatch) continue;

    const name = funcMatch[1];

    // Find the opening { for this function (may be on same or next line)
    let braceStart = -1;
    let searchLine = i;
    while (searchLine < Math.min(i + 5, lines.length)) {
      const idx = lines[searchLine].indexOf('{');
      if (idx !== -1) {
        braceStart = searchLine;
        break;
      }
      searchLine++;
    }
    if (braceStart === -1) continue;

    // Track brace depth to find matching closing brace
    let depth = 0;
    let bodyEnd = -1;
    for (let j = braceStart; j < lines.length; j++) {
      for (const ch of lines[j]) {
        if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) {
            bodyEnd = j;
            break;
          }
        }
      }
      if (bodyEnd !== -1) break;
    }
    if (bodyEnd === -1) continue;

    results.push({ name, bodyStart: braceStart + 1, bodyEnd: bodyEnd + 1 });
  }

  return results;
}

// ─── CC Detection ─────────────────────────────────────────────────────────────

/**
 * Count cyclomatic complexity of a function body (lines bodyStart..bodyEnd, 1-based).
 * CC = 1 + (number of branching nodes)
 * Branching nodes: if, else if, switch case, for, while, do, catch, &&, ||, ? (ternary)
 */
function computeCC(lines: string[], bodyStart: number, bodyEnd: number): number {
  // Each pattern counts ONE branching node.
  // NOTE: else if must come before the plain `if` pattern to avoid double-count.
  const branchPatterns = [
    /\belse\s+if\s*\(/g,   // else if( — counted once (not as separate if)
    /(?<!else\s)\bif\s*\(/g, // if( — plain if only (not else if)
    /\bcase\s+/g,          // switch case
    /\bfor\s*\(/g,         // for(
    /\bwhile\s*\(/g,       // while(
    /\bdo\s*\{/g,          // do {
    /\bcatch\s*\(/g,       // catch(
    /&&/g,                 // logical AND
    /\|\|/g,               // logical OR
    /\?(?![?.])/g,         // ternary ? (not ?. or ??)
  ];

  let count = 1; // base complexity

  for (let i = bodyStart - 1; i < bodyEnd; i++) {
    const line = lines[i];
    // Remove string literals to avoid false positives
    const cleaned = line.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, '""');

    for (const pattern of branchPatterns) {
      const matches = cleaned.match(pattern);
      if (matches) count += matches.length;
    }
  }

  return count;
}

function scanCC(
  filePath: string,
  lines: string[],
  scanId: string
): GCFinding[] {
  const findings: GCFinding[] = [];
  const functions = findFunctions(lines);

  for (const fn of functions) {
    const cc = computeCC(lines, fn.bodyStart, fn.bodyEnd);
    if (cc < 10) continue;

    const severity = cc >= 15 ? 'high' : 'medium';

    findings.push({
      id: generateId(),
      scan_id: scanId,
      category: 'REFACTOR_CANDIDATE',
      severity,
      safety_level: 'SAFE',
      file_path: filePath,
      line_start: fn.bodyStart,
      line_end: fn.bodyEnd,
      rule_source: 'BUILTIN',
      rule_id: 'high-complexity',
      description: `Function '${fn.name}' has cyclomatic complexity of ${cc} (threshold: 10)`,
      suggested_fix: 'Consider breaking this function into smaller, more focused functions.',
      status: 'detected',
      resolved_at: null,
    });
  }

  return findings;
}

// ─── Code Duplication Detection ───────────────────────────────────────────────

const MIN_DUP_LINES = 10;

/**
 * Detect duplicate code blocks (>= MIN_DUP_LINES consecutive normalized lines)
 * within a single file.
 */
function scanDuplication(
  filePath: string,
  lines: string[],
  scanId: string
): GCFinding[] {
  const findings: GCFinding[] = [];

  // Normalize lines: skip blank lines and comment-only lines
  const normalized: Array<{ original: number; text: string }> = [];
  for (let i = 0; i < lines.length; i++) {
    const text = normalizeForDup(lines[i]);
    if (text.length === 0) continue;
    normalized.push({ original: i + 1, text });
  }

  const n = normalized.length;
  if (n < MIN_DUP_LINES * 2) return findings;

  // Track already-reported start positions to avoid duplicates
  const reported = new Set<number>();

  for (let i = 0; i <= n - MIN_DUP_LINES; i++) {
    if (reported.has(i)) continue;

    for (let j = i + MIN_DUP_LINES; j <= n - MIN_DUP_LINES; j++) {
      if (reported.has(j)) continue;

      // Check if block starting at i matches block starting at j
      let matchLen = 0;
      while (
        i + matchLen < n &&
        j + matchLen < n &&
        normalized[i + matchLen].text === normalized[j + matchLen].text
      ) {
        matchLen++;
      }

      if (matchLen >= MIN_DUP_LINES) {
        // Report the second occurrence
        if (!reported.has(j)) {
          const lineStart = normalized[j].original;
          const lineEnd = normalized[j + matchLen - 1].original;
          const firstLineStart = normalized[i].original;
          const firstLineEnd = normalized[i + matchLen - 1].original;

          findings.push({
            id: generateId(),
            scan_id: scanId,
            category: 'REFACTOR_CANDIDATE',
            severity: 'medium',
            safety_level: 'SAFE',
            file_path: filePath,
            line_start: lineStart,
            line_end: lineEnd,
            rule_source: 'BUILTIN',
            rule_id: 'code-duplication',
            description: `Duplicate code block (${matchLen} lines) also appears at lines ${firstLineStart}-${firstLineEnd}`,
            suggested_fix: 'Extract the duplicated logic into a shared function.',
            status: 'detected',
            resolved_at: null,
          });
          reported.add(j);
        }
        break; // Move on after finding first match for block i
      }
    }
  }

  return findings;
}

// ─── Function Length Detection ────────────────────────────────────────────────

const MAX_FUNCTION_LINES = 100;

function scanFunctionLength(
  filePath: string,
  lines: string[],
  scanId: string
): GCFinding[] {
  const findings: GCFinding[] = [];
  const functions = findFunctions(lines);

  for (const fn of functions) {
    const length = fn.bodyEnd - fn.bodyStart + 1;
    if (length <= MAX_FUNCTION_LINES) continue;

    findings.push({
      id: generateId(),
      scan_id: scanId,
      category: 'REFACTOR_CANDIDATE',
      severity: 'medium',
      safety_level: 'SAFE',
      file_path: filePath,
      line_start: fn.bodyStart,
      line_end: fn.bodyEnd,
      rule_source: 'BUILTIN',
      rule_id: 'long-function',
      description: `Function '${fn.name}' is ${length} lines long (threshold: ${MAX_FUNCTION_LINES})`,
      suggested_fix: 'Break this function into smaller, more focused functions.',
      status: 'detected',
      resolved_at: null,
    });
  }

  return findings;
}

// ─── Nesting Depth Detection ──────────────────────────────────────────────────

// The function's own opening brace counts as depth 1 in our char-by-char counter.
// Spec says "function body { = depth 0", so 4 levels of inner nesting = depth 5 in our counter.
const MAX_NESTING_DEPTH = 5; // depth 1 (fn body) + 4 inner levels

/**
 * Detect nesting depth >= 4 inner levels within each function body.
 * Depth tracking starts at 0 before the function's own brace;
 * the function body itself counts as depth 1, so 4 inner levels = depth 5.
 */
function scanNestingDepth(
  filePath: string,
  lines: string[],
  scanId: string
): GCFinding[] {
  const findings: GCFinding[] = [];
  const functions = findFunctions(lines);
  const reported = new Set<string>(); // avoid duplicate reports per function

  for (const fn of functions) {
    // depth starts at 0 (we enter at depth 1 when we see first {)
    let depth = 0;
    let violationStart = -1;
    let violationEnd = -1;

    for (let i = fn.bodyStart - 1; i < fn.bodyEnd; i++) {
      const line = lines[i];
      // Remove string literals to avoid counting braces inside strings
      const cleaned = line.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, '""');

      for (const ch of cleaned) {
        if (ch === '{') {
          depth++;
          if (depth >= MAX_NESTING_DEPTH) {
            if (violationStart === -1) {
              violationStart = i + 1;
            }
            violationEnd = i + 1;
          }
        } else if (ch === '}') {
          depth--;
        }
      }
    }

    if (violationStart !== -1) {
      const key = `${filePath}:${fn.name}`;
      if (!reported.has(key)) {
        reported.add(key);
        findings.push({
          id: generateId(),
          scan_id: scanId,
          category: 'REFACTOR_CANDIDATE',
          severity: 'medium',
          safety_level: 'SAFE',
          file_path: filePath,
          line_start: violationStart,
          line_end: violationEnd,
          rule_source: 'BUILTIN',
          rule_id: 'deep-nesting',
          description: `Function '${fn.name}' has nesting depth >= ${MAX_NESTING_DEPTH}`,
          suggested_fix: 'Reduce nesting by extracting logic into helper functions or using early returns.',
          status: 'detected',
          resolved_at: null,
        });
      }
    }
  }

  return findings;
}

// ─── Scanner ──────────────────────────────────────────────────────────────────

export class RefactorScanner implements GCScanner {
  readonly name = 'RefactorScanner';

  async scan(files: string[]): Promise<GCFinding[]> {
    if (files.length === 0) return [];

    const scanId = generateId();
    const findings: GCFinding[] = [];

    for (const filePath of files) {
      const lines = readLines(filePath);
      if (lines === null) continue;

      findings.push(...scanCC(filePath, lines, scanId));
      findings.push(...scanDuplication(filePath, lines, scanId));
      findings.push(...scanFunctionLength(filePath, lines, scanId));
      findings.push(...scanNestingDepth(filePath, lines, scanId));
    }

    return findings;
  }
}
