import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  QaRulesSchema,
  DEFAULT_QA_CONFIG,
  loadYamlConfig,
  resolveConfig,
  deepMerge,
  PROFILE_PRESETS,
} from '../qa-config.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('QaConfigEngine', () => {
  // AC01: Zod 스키마가 유효한 qa-rules.yaml을 성공적으로 파싱해야 한다
  describe('AC01: Zod schema parses valid qa-rules.yaml', () => {
    it('AC01: should parse a fully valid config object', () => {
      const validConfig = {
        profile: 'fullstack',
        risk_thresholds: { green: 0.1, yellow: 0.4, orange: 0.7 },
        severity_weights: { critical: 0.5, high: 0.3, medium: 0.15, low: 0.05 },
        modules: {
          lint_check: true,
          type_check: true,
          test_coverage: true,
          dead_code: false,
          dependency_audit: true,
          complexity_analysis: true,
          shadow: false,
          wave_gate: false,
          adaptive_planner: false,
        },
        regression_bonus: 0.3,
        custom_rules: [
          {
            id: 'no-console',
            pattern: 'console\\.log',
            severity: 'medium' as const,
            message: 'Remove console.log',
          },
        ],
        ignore: [
          {
            rule_id: 'no-console',
            paths: ['src/debug/**'],
            reason: 'Debug files may use console',
          },
        ],
        severity_adjustments: [
          {
            rule_id: 'no-console',
            new_severity: 'low' as const,
            condition: 'test files',
          },
        ],
      };

      const result = QaRulesSchema.parse(validConfig);
      expect(result.profile).toBe('fullstack');
      expect(result.risk_thresholds!.green).toBe(0.1);
      expect(result.custom_rules).toHaveLength(1);
    });

    it('AC01: should accept partial config (all fields optional)', () => {
      const partial = { profile: 'web-frontend' };
      const result = QaRulesSchema.parse(partial);
      expect(result.profile).toBe('web-frontend');
    });
  });

  // AC02: Zod 스키마가 잘못된 정규식이 포함된 custom_rules를 거부해야 한다
  describe('AC02: Zod schema rejects invalid regex in custom_rules', () => {
    it('AC02: should reject custom_rule with invalid regex pattern', () => {
      const invalidConfig = {
        custom_rules: [
          {
            id: 'bad-regex',
            pattern: '[invalid(regex',
            severity: 'high',
            message: 'Bad regex',
          },
        ],
      };

      expect(() => QaRulesSchema.parse(invalidConfig)).toThrow();
    });

    it('AC02: should accept custom_rule with valid regex pattern', () => {
      const validConfig = {
        custom_rules: [
          {
            id: 'valid-regex',
            pattern: '^(foo|bar)\\d+$',
            severity: 'high',
            message: 'Valid regex',
          },
        ],
      };

      const result = QaRulesSchema.parse(validConfig);
      expect(result.custom_rules).toHaveLength(1);
    });
  });

  // AC03: qa-rules.yaml이 없을 때 L0 기본값만 반환되어야 한다
  describe('AC03: L0 defaults when no yaml file', () => {
    it('AC03: should return DEFAULT_QA_CONFIG when yaml file does not exist', () => {
      const config = loadYamlConfig('/nonexistent/path/qa-rules.yaml');
      expect(config).toEqual(DEFAULT_QA_CONFIG);
    });

    it('AC03: DEFAULT_QA_CONFIG should have correct default values', () => {
      expect(DEFAULT_QA_CONFIG.risk_thresholds).toEqual({
        green: 0.2,
        yellow: 0.5,
        orange: 0.8,
      });
      expect(DEFAULT_QA_CONFIG.severity_weights).toEqual({
        critical: 0.4,
        high: 0.3,
        medium: 0.2,
        low: 0.1,
      });
      expect(DEFAULT_QA_CONFIG.modules.lint_check).toBe(true);
      expect(DEFAULT_QA_CONFIG.modules.type_check).toBe(true);
      expect(DEFAULT_QA_CONFIG.modules.shadow).toBe(false);
      expect(DEFAULT_QA_CONFIG.modules.wave_gate).toBe(false);
      expect(DEFAULT_QA_CONFIG.modules.adaptive_planner).toBe(false);
      expect(DEFAULT_QA_CONFIG.regression_bonus).toBe(0.2);
    });
  });

  // AC04: L1 설정이 L0의 특정 필드만 오버라이드하고 나머지는 기본값을 유지해야 한다
  describe('AC04: L1 overrides specific fields, rest stays L0', () => {
    it('AC04: should merge L1 yaml over L0 defaults keeping unset fields', () => {
      const l0 = {
        risk_thresholds: { green: 0.2, yellow: 0.5, orange: 0.8 },
        modules: { lint_check: true, type_check: true, shadow: false },
      };
      const l1 = {
        risk_thresholds: { green: 0.1 },
        modules: { shadow: true },
      };

      const merged = deepMerge(l0, l1);
      expect(merged.risk_thresholds.green).toBe(0.1);
      expect(merged.risk_thresholds.yellow).toBe(0.5);
      expect(merged.risk_thresholds.orange).toBe(0.8);
      expect(merged.modules.lint_check).toBe(true);
      expect(merged.modules.shadow).toBe(true);
    });
  });

  // AC05: L2(plan.qa_overrides)가 L1을 오버라이드해야 한다
  describe('AC05: L2 overrides L1', () => {
    it('AC05: should apply L2 plan overrides on top of L1', () => {
      const l0 = DEFAULT_QA_CONFIG;
      const l1 = { risk_thresholds: { green: 0.1, yellow: 0.4, orange: 0.7 } };
      const l2 = { risk_thresholds: { green: 0.05 } };

      const step1 = deepMerge(l0, l1);
      const result = deepMerge(step1, l2);

      expect(result.risk_thresholds.green).toBe(0.05);
      expect(result.risk_thresholds.yellow).toBe(0.4);
      expect(result.risk_thresholds.orange).toBe(0.7);
    });

    it('AC05: arrays should be replaced, not merged', () => {
      const base = {
        custom_rules: [
          { id: 'rule-a', pattern: 'a', severity: 'high', message: 'A' },
          { id: 'rule-b', pattern: 'b', severity: 'low', message: 'B' },
        ],
      };
      const override = {
        custom_rules: [
          { id: 'rule-c', pattern: 'c', severity: 'medium', message: 'C' },
        ],
      };

      const merged = deepMerge(base, override);
      expect(merged.custom_rules).toHaveLength(1);
      expect(merged.custom_rules[0].id).toBe('rule-c');
    });
  });

  // AC06: profile 프리셋이 올바르게 적용되고, 명시적 값이 프리셋을 오버라이드해야 한다
  describe('AC06: profile presets', () => {
    it('AC06: should have all 5 profile presets defined', () => {
      expect(PROFILE_PRESETS).toHaveProperty('web-frontend');
      expect(PROFILE_PRESETS).toHaveProperty('api-server');
      expect(PROFILE_PRESETS).toHaveProperty('fullstack');
      expect(PROFILE_PRESETS).toHaveProperty('library');
      expect(PROFILE_PRESETS).toHaveProperty('cli-tool');
    });

    it('AC06: explicit values should override profile preset', () => {
      const config = {
        profile: 'web-frontend' as const,
        modules: { shadow: true },
      };
      const preset = PROFILE_PRESETS['web-frontend'];
      const withPreset = deepMerge(DEFAULT_QA_CONFIG, preset);
      const result = deepMerge(withPreset, config);

      // explicit override takes precedence
      expect(result.modules.shadow).toBe(true);
    });

    it('AC06: resolveConfig should apply profile from yaml config', () => {
      // We test the full pipeline by providing a mock yaml
      const yamlContent = 'profile: api-server\n';
      const tmpDir = fs.mkdtempSync('/tmp/qa-config-test-');
      const tmpFile = path.join(tmpDir, 'qa-rules.yaml');
      fs.writeFileSync(tmpFile, yamlContent);

      try {
        const config = resolveConfig({ yamlPath: tmpFile });
        // api-server preset should be applied
        expect(config.profile).toBe('api-server');
      } finally {
        fs.rmSync(tmpDir, { recursive: true });
      }
    });
  });

  // AC07: YAML 파싱 실패 시 L0 fallback + 경고가 출력되어야 한다
  describe('AC07: YAML parse failure returns L0 fallback with warning', () => {
    it('AC07: should return L0 and warn on invalid YAML', () => {
      const tmpDir = fs.mkdtempSync('/tmp/qa-config-test-');
      const tmpFile = path.join(tmpDir, 'qa-rules.yaml');
      fs.writeFileSync(tmpFile, '{{{{invalid yaml content!!!!');

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      try {
        const config = loadYamlConfig(tmpFile);
        expect(config).toEqual(DEFAULT_QA_CONFIG);
        expect(warnSpy).toHaveBeenCalled();
        expect(warnSpy.mock.calls[0][0]).toContain('qa-rules.yaml');
      } finally {
        warnSpy.mockRestore();
        fs.rmSync(tmpDir, { recursive: true });
      }
    });

    it('AC07: should return L0 and warn when Zod validation fails', () => {
      const tmpDir = fs.mkdtempSync('/tmp/qa-config-test-');
      const tmpFile = path.join(tmpDir, 'qa-rules.yaml');
      // Valid YAML but invalid schema (risk_thresholds.green should be number)
      fs.writeFileSync(tmpFile, 'risk_thresholds:\n  green: "not-a-number"\n');

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      try {
        const config = loadYamlConfig(tmpFile);
        expect(config).toEqual(DEFAULT_QA_CONFIG);
        expect(warnSpy).toHaveBeenCalled();
      } finally {
        warnSpy.mockRestore();
        fs.rmSync(tmpDir, { recursive: true });
      }
    });
  });

  // AC08: expires가 지난 ignore 규칙이 필터링되어야 한다
  describe('AC08: expired ignore rules are filtered out', () => {
    it('AC08: should filter out ignore rules with past expires date', () => {
      const config = {
        ...DEFAULT_QA_CONFIG,
        ignore: [
          {
            rule_id: 'rule-a',
            paths: ['src/**'],
            reason: 'temporary',
            expires: '2020-01-01',
          },
          {
            rule_id: 'rule-b',
            paths: ['lib/**'],
            reason: 'permanent',
          },
          {
            rule_id: 'rule-c',
            paths: ['test/**'],
            reason: 'future',
            expires: '2099-12-31',
          },
        ],
      };

      const result = resolveConfig({ rawConfig: config });
      const ignoreIds = result.ignore!.map((r: any) => r.rule_id);
      expect(ignoreIds).not.toContain('rule-a'); // expired
      expect(ignoreIds).toContain('rule-b'); // no expiry
      expect(ignoreIds).toContain('rule-c'); // future
    });
  });
});
