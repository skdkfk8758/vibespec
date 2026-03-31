import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  resolveConfig,
  validateConfig,
  detectProfile,
  DEFAULT_QA_CONFIG,
  deepMerge,
  PROFILE_PRESETS,
} from '../../core/engine/qa-config.js';
import type { ResolvedQaConfig } from '../../core/engine/qa-config.js';

// ============================================================
// AC01: vs qa config resolve가 머지된 JSON을 정상 출력해야 한다
// ============================================================
describe('AC01: config resolve outputs merged JSON', () => {
  it('AC01: resolveConfig without planId returns L0+L1 merged config', () => {
    // Arrange: no yaml, no plan => pure L0 defaults
    const config = resolveConfig({ yamlPath: '/nonexistent/path.yaml' });

    // Assert
    expect(config.risk_thresholds).toEqual({ green: 0.2, yellow: 0.5, orange: 0.8 });
    expect(config.severity_weights).toEqual({ critical: 0.4, high: 0.3, medium: 0.2, low: 0.1 });
    expect(config.modules.lint_check).toBe(true);
    expect(config.regression_bonus).toBe(0.2);
  });

  it('AC01: resolveConfig with yaml merges L1 over L0', () => {
    // Arrange
    const tmpDir = fs.mkdtempSync('/tmp/qa-config-cli-test-');
    const tmpFile = path.join(tmpDir, 'qa-rules.yaml');
    fs.writeFileSync(tmpFile, 'risk_thresholds:\n  green: 0.1\n  yellow: 0.5\n  orange: 0.8\nregression_bonus: 0.5\n');

    try {
      // Act
      const config = resolveConfig({ yamlPath: tmpFile });

      // Assert
      expect(config.risk_thresholds.green).toBe(0.1);
      expect(config.risk_thresholds.yellow).toBe(0.5); // L0 default kept
      expect(config.regression_bonus).toBe(0.5);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });
});

// ============================================================
// AC02: vs qa config resolve <plan_id>가 L2 오버라이드를 포함해야 한다
// ============================================================
describe('AC02: config resolve with plan_id includes L2 overrides', () => {
  it('AC02: resolveConfig with planId and db applies L2 overrides', () => {
    // Arrange: mock db returning qa_overrides
    const mockDb = {
      prepare: (sql: string) => ({
        get: (...args: any[]) => ({
          qa_overrides: JSON.stringify({ risk_thresholds: { green: 0.05 } }),
        }),
      }),
    };

    // Act
    const config = resolveConfig({
      planId: 'plan_test123',
      db: mockDb as any,
      yamlPath: '/nonexistent/path.yaml',
    });

    // Assert
    expect(config.risk_thresholds.green).toBe(0.05);
    expect(config.risk_thresholds.yellow).toBe(0.5); // L0 default
    expect(config.risk_thresholds.orange).toBe(0.8); // L0 default
  });

  it('AC02: L2 override replaces L1 values', () => {
    // Arrange
    const tmpDir = fs.mkdtempSync('/tmp/qa-config-cli-test-');
    const tmpFile = path.join(tmpDir, 'qa-rules.yaml');
    fs.writeFileSync(tmpFile, 'risk_thresholds:\n  green: 0.15\n');

    const mockDb = {
      prepare: (sql: string) => ({
        get: (...args: any[]) => ({
          qa_overrides: JSON.stringify({ risk_thresholds: { green: 0.01 } }),
        }),
      }),
    };

    try {
      const config = resolveConfig({
        planId: 'plan_test456',
        db: mockDb as any,
        yamlPath: tmpFile,
      });

      // Assert: L2 (0.01) overrides L1 (0.15)
      expect(config.risk_thresholds.green).toBe(0.01);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });
});

// ============================================================
// AC03: vs qa config validate가 유효한 설정에 대해 에러 0건
// ============================================================
describe('AC03: config validate reports 0 errors for valid config', () => {
  it('AC03: validateConfig returns no errors for valid config', () => {
    // Arrange
    const validConfig: ResolvedQaConfig = {
      ...DEFAULT_QA_CONFIG,
      risk_thresholds: { green: 0.2, yellow: 0.5, orange: 0.8 },
    };

    // Act
    const result = validateConfig(validConfig);

    // Assert
    expect(result.errors).toHaveLength(0);
  });

  it('AC03: validateConfig may have warnings but no errors for defaults', () => {
    const result = validateConfig(DEFAULT_QA_CONFIG);
    expect(result.errors).toHaveLength(0);
  });
});

// ============================================================
// AC04: vs qa config validate가 잘못된 정규식을 에러로 보고
// ============================================================
describe('AC04: config validate reports invalid regex as error', () => {
  it('AC04: reports error for custom_rule with invalid regex', () => {
    // Arrange
    const config: ResolvedQaConfig = {
      ...DEFAULT_QA_CONFIG,
      custom_rules: [
        { id: 'bad-rule', pattern: '[invalid(regex', severity: 'high', message: 'bad' },
      ],
    };

    // Act
    const result = validateConfig(config);

    // Assert
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.includes('regex') || e.includes('pattern') || e.includes('bad-rule'))).toBe(true);
  });

  it('AC04: no regex error for valid custom_rules', () => {
    const config: ResolvedQaConfig = {
      ...DEFAULT_QA_CONFIG,
      custom_rules: [
        { id: 'good-rule', pattern: '^console\\.log', severity: 'medium', message: 'no console' },
      ],
    };

    const result = validateConfig(config);
    expect(result.errors.filter(e => e.includes('regex') || e.includes('pattern'))).toHaveLength(0);
  });
});

// ============================================================
// AC05: vs qa config validate가 risk_thresholds 역전을 에러로 보고
// ============================================================
describe('AC05: config validate reports inverted risk_thresholds', () => {
  it('AC05: reports error when green >= yellow', () => {
    const config: ResolvedQaConfig = {
      ...DEFAULT_QA_CONFIG,
      risk_thresholds: { green: 0.6, yellow: 0.5, orange: 0.8 },
    };

    const result = validateConfig(config);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.includes('threshold') || e.includes('green') || e.includes('yellow'))).toBe(true);
  });

  it('AC05: reports error when yellow >= orange', () => {
    const config: ResolvedQaConfig = {
      ...DEFAULT_QA_CONFIG,
      risk_thresholds: { green: 0.2, yellow: 0.9, orange: 0.8 },
    };

    const result = validateConfig(config);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.includes('threshold') || e.includes('yellow') || e.includes('orange'))).toBe(true);
  });

  it('AC05: no threshold error for correct ordering', () => {
    const config: ResolvedQaConfig = {
      ...DEFAULT_QA_CONFIG,
      risk_thresholds: { green: 0.2, yellow: 0.5, orange: 0.8 },
    };

    const result = validateConfig(config);
    expect(result.errors.filter(e => e.includes('threshold'))).toHaveLength(0);
  });
});

// ============================================================
// AC06: vs qa config init가 package.json 기반으로 프로파일을 추천
// ============================================================
describe('AC06: config init recommends profile based on package.json', () => {
  it('AC06: detects web-frontend for react dependency', () => {
    const packageJson = {
      dependencies: { react: '^18.0.0', 'react-dom': '^18.0.0' },
    };

    const profile = detectProfile(packageJson);
    expect(profile).toBe('web-frontend');
  });

  it('AC06: detects web-frontend for next dependency', () => {
    const packageJson = {
      dependencies: { next: '^14.0.0' },
    };

    const profile = detectProfile(packageJson);
    expect(profile).toBe('web-frontend');
  });

  it('AC06: detects api-server for express dependency', () => {
    const packageJson = {
      dependencies: { express: '^4.18.0' },
    };

    const profile = detectProfile(packageJson);
    expect(profile).toBe('api-server');
  });

  it('AC06: detects api-server for fastify dependency', () => {
    const packageJson = {
      dependencies: { fastify: '^4.0.0' },
    };

    const profile = detectProfile(packageJson);
    expect(profile).toBe('api-server');
  });

  it('AC06: detects fullstack for react + express', () => {
    const packageJson = {
      dependencies: { react: '^18.0.0', express: '^4.18.0' },
    };

    const profile = detectProfile(packageJson);
    expect(profile).toBe('fullstack');
  });

  it('AC06: detects cli-tool for commander/yargs dependency', () => {
    const packageJson = {
      dependencies: { commander: '^11.0.0' },
    };

    const profile = detectProfile(packageJson);
    expect(profile).toBe('cli-tool');
  });

  it('AC06: falls back to library for unknown deps', () => {
    const packageJson = {
      dependencies: { lodash: '^4.0.0' },
    };

    const profile = detectProfile(packageJson);
    expect(profile).toBe('library');
  });
});

// ============================================================
// Additional: validateConfig warns when all modules are false
// ============================================================
describe('validateConfig warns when all modules are false', () => {
  it('warns when every module is disabled', () => {
    const config: ResolvedQaConfig = {
      ...DEFAULT_QA_CONFIG,
      modules: {
        lint_check: false,
        type_check: false,
        test_coverage: false,
        dead_code: false,
        dependency_audit: false,
        complexity_analysis: false,
        shadow: false,
        wave_gate: false,
        adaptive_planner: false,
      },
    };

    const result = validateConfig(config);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some(w => w.includes('module'))).toBe(true);
  });
});
