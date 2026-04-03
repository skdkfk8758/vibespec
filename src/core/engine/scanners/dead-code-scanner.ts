/**
 * DeadCodeScanner — 미사용 코드 탐지 스캐너
 *
 * 정규식 기반으로 미사용 export/import/변수를 탐지합니다.
 * 추후 ts-morph AST 기반으로 교체 가능한 구조로 설계되어 있습니다.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { GCFinding, GCScanner } from '../../types.js';
import { generateId } from '../../utils.js';

const CHUNK_SIZE = 10000; // lines

// Test file patterns
const TEST_PATH_PATTERNS = [
  /[/\\]test[/\\]/,
  /[/\\]__tests__[/\\]/,
  /\.test\.[^/\\]+$/,
  /\.spec\.[^/\\]+$/,
];

function isTestFile(filePath: string): boolean {
  return TEST_PATH_PATTERNS.some(p => p.test(filePath));
}

// Detect dynamic imports: require(variable), eval(), import(variable)
const DYNAMIC_IMPORT_PATTERNS = [
  /require\s*\(\s*[^'"]/,           // require(variable)
  /\beval\s*\(/,                     // eval(
  /\bimport\s*\(\s*[^'"]/,          // import(variable) — not a static string
];

function hasDynamicImport(content: string): boolean {
  return DYNAMIC_IMPORT_PATTERNS.some(p => p.test(content));
}

interface ExportedSymbol {
  name: string;
  line: number;
}

function extractExports(content: string): ExportedSymbol[] {
  const results: ExportedSymbol[] = [];

  // Named exports: export function/const/etc.
  let match: RegExpExecArray | null;
  const exportRegex = /export\s+(?:(?:async|default)\s+)?(?:function\s*\*?\s*|const\s+|let\s+|var\s+|class\s+|type\s+|interface\s+|enum\s+)(\w+)/g;
  while ((match = exportRegex.exec(content)) !== null) {
    const name = match[1];
    if (name && name !== 'default') {
      const lineNum = content.slice(0, match.index).split('\n').length;
      results.push({ name, line: lineNum });
    }
  }

  // Brace exports: export { foo, bar as baz }
  const braceRegex = /export\s*\{([^}]+)\}/g;
  while ((match = braceRegex.exec(content)) !== null) {
    const lineNum = content.slice(0, match.index).split('\n').length;
    const items = match[1].split(',');
    for (const item of items) {
      const parts = item.trim().split(/\s+as\s+/);
      // The exported name is the last part (after 'as') or the only part
      const exportedName = (parts[parts.length - 1] || '').trim();
      if (exportedName && exportedName !== 'default') {
        results.push({ name: exportedName, line: lineNum });
      }
    }
  }

  return results;
}

// Build a set of all symbol names referenced in a set of files
function buildReferenceSet(allContents: string[]): Set<string> {
  const refs = new Set<string>();
  const identifierRegex = /\b([A-Za-z_$][A-Za-z0-9_$]*)\b/g;
  for (const content of allContents) {
    let m: RegExpExecArray | null;
    while ((m = identifierRegex.exec(content)) !== null) {
      refs.add(m[1]);
    }
  }
  return refs;
}

// Detect circular references using import graph
function extractImports(content: string): string[] {
  const imports: string[] = [];
  let match: RegExpExecArray | null;
  const regex = /(?:import|export)\s+(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))?\s+from\s+['"]([^'"]+)['"]/g;
  while ((match = regex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

function resolveImportPath(fromFile: string, importPath: string): string | null {
  if (importPath.startsWith('.')) {
    const dir = path.dirname(fromFile);
    let resolved = path.resolve(dir, importPath);
    // Strip .js extension and try common extensions
    resolved = resolved.replace(/\.js$/, '');
    return resolved;
  }
  return null; // external module
}

function detectCircularRefs(files: string[], contentMap: Map<string, string>): Set<string> {
  // Build adjacency map: normalized path (no ext) -> Set of normalized paths
  const graph = new Map<string, Set<string>>();

  for (const file of files) {
    const content = contentMap.get(file) ?? '';
    const normalizedFile = file.replace(/\.[^/.]+$/, '');
    const deps = new Set<string>();
    const imports = extractImports(content);
    for (const imp of imports) {
      const resolved = resolveImportPath(file, imp);
      if (resolved) deps.add(resolved);
    }
    graph.set(normalizedFile, deps);
  }

  // DFS-based cycle detection
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const cycleNodes = new Set<string>();

  function dfs(node: string): boolean {
    if (inStack.has(node)) {
      cycleNodes.add(node);
      return true;
    }
    if (visited.has(node)) return false;
    visited.add(node);
    inStack.add(node);
    const deps = graph.get(node) ?? new Set();
    for (const dep of deps) {
      if (dfs(dep)) {
        cycleNodes.add(node);
      }
    }
    inStack.delete(node);
    return false;
  }

  for (const node of graph.keys()) {
    dfs(node);
  }

  // Map back to original file paths
  const cycleFiles = new Set<string>();
  for (const file of files) {
    const normalized = file.replace(/\.[^/.]+$/, '');
    if (cycleNodes.has(normalized)) {
      cycleFiles.add(file);
    }
  }
  return cycleFiles;
}

function splitIntoChunks(lines: string[], chunkSize: number): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < lines.length; i += chunkSize) {
    chunks.push(lines.slice(i, i + chunkSize));
  }
  return chunks;
}

export class DeadCodeScanner implements GCScanner {
  readonly name = 'DeadCodeScanner';

  async scan(files: string[]): Promise<GCFinding[]> {
    if (files.length === 0) return [];

    const findings: GCFinding[] = [];

    // Read all file contents
    const contentMap = new Map<string, string>();
    for (const file of files) {
      try {
        contentMap.set(file, fs.readFileSync(file, 'utf-8'));
      } catch {
        // Skip unreadable files
      }
    }

    // Detect circular references
    const circularFiles = detectCircularRefs(files, contentMap);

    // Build reference set from ALL non-test files (for cross-file usage analysis)
    // Test files are included in reference tracking to avoid false positives
    for (const file of files) {
      const content = contentMap.get(file);
      if (!content) continue;

      const isTest = isTestFile(file);
      const hasDynamic = hasDynamicImport(content);
      const isCircular = circularFiles.has(file);

      // If dynamic import detected, emit a RISKY finding
      if (hasDynamic) {
        findings.push({
          id: generateId(),
          scan_id: '',
          category: 'DEAD_CODE',
          severity: 'medium',
          safety_level: 'RISKY',
          file_path: file,
          line_start: 1,
          line_end: 1,
          rule_source: 'BUILTIN',
          rule_id: null,
          description: 'Dynamic import detected (require(variable) or eval()). Module analysis skipped.',
          suggested_fix: 'Replace dynamic imports with static imports where possible.',
          status: 'detected',
          resolved_at: null,
        });
        // Skip dead code analysis for dynamic import files
        continue;
      }

      // Skip dead code analysis for test files
      if (isTest) continue;

      // If circular, emit a RISKY finding and mark but still analyze
      if (isCircular) {
        findings.push({
          id: generateId(),
          scan_id: '',
          category: 'DEAD_CODE',
          severity: 'medium',
          safety_level: 'RISKY',
          file_path: file,
          line_start: 1,
          line_end: 1,
          rule_source: 'BUILTIN',
          rule_id: null,
          description: 'Circular reference detected. Findings are classified as RISKY.',
          suggested_fix: 'Refactor to remove circular dependencies.',
          status: 'detected',
          resolved_at: null,
        });
      }

      // Handle large files with chunk splitting
      const lines = content.split('\n');
      const chunks = lines.length > CHUNK_SIZE
        ? splitIntoChunks(lines, CHUNK_SIZE)
        : [lines];

      // Process each chunk to find exports
      const allExports: ExportedSymbol[] = [];
      let chunkOffset = 0;
      for (const chunk of chunks) {
        const chunkContent = chunk.join('\n');
        const chunkExports = extractExports(chunkContent);
        // Adjust line numbers for chunk offset
        for (const exp of chunkExports) {
          allExports.push({ name: exp.name, line: exp.line + chunkOffset });
        }
        chunkOffset += chunk.length;
      }

      // Build reference set excluding the current file (to check cross-file usage)
      const otherContents: string[] = [];
      for (const [f, c] of contentMap.entries()) {
        if (f !== file) otherContents.push(c);
      }
      const otherRefs = buildReferenceSet(otherContents);

      // Check which exports are not referenced elsewhere
      for (const exp of allExports) {
        if (!otherRefs.has(exp.name)) {
          findings.push({
            id: generateId(),
            scan_id: '',
            category: 'DEAD_CODE',
            severity: 'low',
            safety_level: isCircular ? 'RISKY' : 'SAFE',
            file_path: file,
            line_start: exp.line,
            line_end: exp.line,
            rule_source: 'BUILTIN',
            rule_id: null,
            description: `Unused export: '${exp.name}' is exported but not referenced in other files.`,
            suggested_fix: `Remove or internalize the export of '${exp.name}'.`,
            status: 'detected',
            resolved_at: null,
          });
        }
      }
    }

    return findings;
  }
}
