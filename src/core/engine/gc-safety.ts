import * as fs from 'node:fs';
import * as path from 'node:path';
import type { GCFinding, GCSafetyLevel } from '../types.js';

export class SafetyClassifier {
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  classify(finding: GCFinding): GCSafetyLevel {
    // All three conditions must be true for SAFE
    if (
      this.hasNoExternalDependency(finding) &&
      this.hasTestFile(finding)
    ) {
      return 'SAFE';
    }
    return 'RISKY';
  }

  private hasNoExternalDependency(finding: GCFinding): boolean {
    // Check if the finding's suggested_fix involves external package imports
    if (!finding.suggested_fix) return true;
    // If the fix references node_modules or external packages, it's not safe
    return !finding.suggested_fix.includes('node_modules');
  }

  private hasTestFile(finding: GCFinding): boolean {
    const filePath = finding.file_path;
    if (!filePath) return false;

    const absPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(this.projectRoot, filePath);

    const dir = path.dirname(absPath);
    const ext = path.extname(absPath);
    const baseName = path.basename(absPath, ext);

    // Check for common test file patterns
    const testPatterns = [
      path.join(dir, `${baseName}.test${ext}`),
      path.join(dir, `${baseName}.spec${ext}`),
      path.join(dir, '__tests__', `${baseName}.test${ext}`),
      path.join(dir, '__tests__', `${baseName}.spec${ext}`),
      path.join(dir, '__tests__', `${baseName}${ext}`),
    ];

    return testPatterns.some(p => fs.existsSync(p));
  }
}
