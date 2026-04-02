import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  QaRulesSchema,
  DEFAULT_QA_CONFIG,
  loadYamlConfig,
  resolveConfig,
  deepMerge,
  PROFILE_PRESETS,
  evaluateCondition,
  type ResolvedQaConfig,
  type ModuleConditionalConfig,
  type ConditionContext,
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
      expect(DEFAULT_QA_CONFIG.modules.shadow).toEqual({ enabled: false });
      expect(DEFAULT_QA_CONFIG.modules.wave_gate).toBe(false);
      expect(DEFAULT_QA_CONFIG.modules.adaptive_planner).toBe(false);
      expect(DEFAULT_QA_CONFIG.modules.design_review).toBe(false);
      expect(DEFAULT_QA_CONFIG.modules.skeleton_guard).toBe(false);
      expect(DEFAULT_QA_CONFIG.regression_bonus).toBe(0.2);
    });
  });

  // AC04: L1 설정이 L0의 특정 필드만 오버라이드하고 나머지는 기본값을 유지해야 한다
  describe('AC04: L1 overrides specific fields, rest stays L0', () => {
    it('AC04: should merge L1 yaml over L0 defaults keeping unset fields', () => {
      const l0 = {
        risk_thresholds: { green: 0.2, yellow: 0.5, orange: 0.8 },
        modules: { lint_check: true, type_check: true, shadow: { enabled: false } },
      };
      const l1 = {
        risk_thresholds: { green: 0.1 },
        modules: { shadow: { enabled: true } },
      };

      const merged = deepMerge(l0, l1);
      expect(merged.risk_thresholds.green).toBe(0.1);
      expect(merged.risk_thresholds.yellow).toBe(0.5);
      expect(merged.risk_thresholds.orange).toBe(0.8);
      expect(merged.modules.lint_check).toBe(true);
      expect(merged.modules.shadow).toEqual({ enabled: true });
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

    it('AC06: web-frontend and fullstack presets should enable design_review', () => {
      expect(PROFILE_PRESETS['web-frontend']!.modules!.design_review).toBe(true);
      expect(PROFILE_PRESETS['fullstack']!.modules!.design_review).toBe(true);
      expect(PROFILE_PRESETS['api-server']!.modules!.design_review).toBe(false);
      expect(PROFILE_PRESETS['library']!.modules!.design_review).toBe(false);
      expect(PROFILE_PRESETS['cli-tool']!.modules!.design_review).toBe(false);
    });

    it('AC06: web-frontend and fullstack presets should enable skeleton_guard', () => {
      expect(PROFILE_PRESETS['web-frontend']!.modules!.skeleton_guard).toBe(true);
      expect(PROFILE_PRESETS['fullstack']!.modules!.skeleton_guard).toBe(true);
      expect(PROFILE_PRESETS['api-server']!.modules!.skeleton_guard).toBe(false);
      expect(PROFILE_PRESETS['library']!.modules!.skeleton_guard).toBe(false);
      expect(PROFILE_PRESETS['cli-tool']!.modules!.skeleton_guard).toBe(false);
    });

    it('AC06: explicit values should override profile preset', () => {
      const config = {
        profile: 'web-frontend' as const,
        modules: { shadow: { enabled: true } },
      };
      const preset = PROFILE_PRESETS['web-frontend'];
      const withPreset = deepMerge(DEFAULT_QA_CONFIG, preset);
      const result = deepMerge(withPreset, config);

      expect(result.modules.shadow).toEqual({ enabled: true });
    });

    it('AC06: resolveConfig should apply profile from yaml config', () => {
      const yamlContent = 'profile: api-server\n';
      const tmpDir = fs.mkdtempSync('/tmp/qa-config-test-');
      const tmpFile = path.join(tmpDir, 'qa-rules.yaml');
      fs.writeFileSync(tmpFile, yamlContent);

      try {
        const config = resolveConfig({ yamlPath: tmpFile });
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

  // --- auto_trigger module tests ---

  describe('auto_trigger module schema', () => {
    it('AC01: qa-config.ts에 auto_trigger 모듈이 Zod 스키마에 정의되어 있어야 한다', () => {
      const configWithAutoTrigger = {
        modules: {
          auto_trigger: {
            enabled: true,
            milestones: [50, 100],
          },
        },
      };
      const result = QaRulesSchema.parse(configWithAutoTrigger);
      expect(result.modules!.auto_trigger).toBeDefined();
      expect(result.modules!.auto_trigger!.enabled).toBe(true);
      expect(result.modules!.auto_trigger!.milestones).toEqual([50, 100]);
    });

    it('AC01: auto_trigger는 optional이어야 한다', () => {
      const configWithoutAutoTrigger = {
        modules: {
          lint_check: true,
        },
      };
      const result = QaRulesSchema.parse(configWithoutAutoTrigger);
      expect(result.modules!.auto_trigger).toBeUndefined();
    });

    it('AC02: 기본값이 enabled: true, milestones: [50, 100]이어야 한다', () => {
      expect(DEFAULT_QA_CONFIG.modules.auto_trigger).toBeDefined();
      expect(DEFAULT_QA_CONFIG.modules.auto_trigger.enabled).toBe(true);
      expect(DEFAULT_QA_CONFIG.modules.auto_trigger.milestones).toEqual([50, 100]);
    });

    it('AC03: resolveConfig가 auto_trigger 필드를 포함하여 반환해야 한다', () => {
      const config = resolveConfig({ rawConfig: { ...DEFAULT_QA_CONFIG } });
      expect(config.modules.auto_trigger).toBeDefined();
      expect(config.modules.auto_trigger.enabled).toBe(true);
      expect(config.modules.auto_trigger.milestones).toEqual([50, 100]);
    });

    it('AC03: YAML 오버라이드로 auto_trigger를 변경할 수 있어야 한다', () => {
      const tmpDir = fs.mkdtempSync('/tmp/qa-config-test-');
      const tmpFile = path.join(tmpDir, 'qa-rules.yaml');
      fs.writeFileSync(tmpFile, 'modules:\n  auto_trigger:\n    enabled: false\n    milestones: [25, 75]\n');

      try {
        const config = resolveConfig({ yamlPath: tmpFile });
        expect(config.modules.auto_trigger.enabled).toBe(false);
        expect(config.modules.auto_trigger.milestones).toEqual([25, 75]);
      } finally {
        fs.rmSync(tmpDir, { recursive: true });
      }
    });
  });

  // --- Conditional Activation (shadow / flow_tester) ---

  describe('Conditional Activation schema and resolveConfig', () => {
    it('AC01: 기존 shadow: true 설정이 {enabled: true}로 자동 변환되어야 한다', () => {
      const config = resolveConfig({
        rawConfig: {
          ...DEFAULT_QA_CONFIG,
          modules: { ...DEFAULT_QA_CONFIG.modules, shadow: true as any },
        },
      });
      const shadow = config.modules.shadow;
      expect(shadow).toEqual({ enabled: true });
    });

    it('AC01: 기존 shadow: false 설정이 {enabled: false}로 자동 변환되어야 한다', () => {
      const config = resolveConfig({
        rawConfig: {
          ...DEFAULT_QA_CONFIG,
          modules: { ...DEFAULT_QA_CONFIG.modules, shadow: false as any },
        },
      });
      const shadow = config.modules.shadow;
      expect(shadow).toEqual({ enabled: false });
    });

    it('AC02: shadow: {enabled: true, skip_when: {task_tags: ["docs"]}} 설정이 파싱되어야 한다', () => {
      const input = {
        modules: {
          shadow: {
            enabled: true,
            skip_when: { task_tags: ['docs'] },
          },
        },
      };
      const result = QaRulesSchema.parse(input);
      const shadow = result.modules!.shadow as any;
      expect(shadow.enabled).toBe(true);
      expect(shadow.skip_when.task_tags).toEqual(['docs']);
    });

    it('AC02: shadow with activate_when should parse correctly', () => {
      const input = {
        modules: {
          shadow: {
            enabled: true,
            activate_when: { completed_tasks_gte: 5, changed_files_pattern: '*.ts' },
          },
        },
      };
      const result = QaRulesSchema.parse(input);
      const shadow = result.modules!.shadow as any;
      expect(shadow.activate_when.completed_tasks_gte).toBe(5);
      expect(shadow.activate_when.changed_files_pattern).toBe('*.ts');
    });

    it('AC02: flow_tester도 동일 패턴이 적용되어야 한다', () => {
      const input = {
        modules: {
          flow_tester: {
            enabled: true,
            skip_when: { task_tags: ['hotfix'] },
          },
        },
      };
      const result = QaRulesSchema.parse(input);
      const ft = result.modules!.flow_tester as any;
      expect(ft.enabled).toBe(true);
      expect(ft.skip_when.task_tags).toEqual(['hotfix']);
    });
  });

  describe('evaluateCondition', () => {
    it('AC03: evaluateCondition이 skip_when.task_tags 조건 매칭 시 false를 반환해야 한다', () => {
      const moduleConfig: ModuleConditionalConfig = {
        enabled: true,
        skip_when: { task_tags: ['docs', 'chore'] },
      };
      const context: ConditionContext = {
        taskTags: ['docs'],
        changedFiles: ['README.md'],
        completedTaskCount: 3,
      };
      expect(evaluateCondition(moduleConfig, context)).toBe(false);
    });

    it('AC03: evaluateCondition이 skip_when.changed_files_only 매칭 시 false를 반환해야 한다', () => {
      const moduleConfig: ModuleConditionalConfig = {
        enabled: true,
        skip_when: { changed_files_only: ['*.md', '*.txt'] },
      };
      const context: ConditionContext = {
        taskTags: [],
        changedFiles: ['README.md', 'CHANGELOG.md'],
        completedTaskCount: 3,
      };
      expect(evaluateCondition(moduleConfig, context)).toBe(false);
    });

    it('AC03: skip_when 조건이 매칭되지 않으면 true를 반환해야 한다', () => {
      const moduleConfig: ModuleConditionalConfig = {
        enabled: true,
        skip_when: { task_tags: ['docs'] },
      };
      const context: ConditionContext = {
        taskTags: ['feature'],
        changedFiles: ['src/app.ts'],
        completedTaskCount: 3,
      };
      expect(evaluateCondition(moduleConfig, context)).toBe(true);
    });

    it('AC04: evaluateCondition이 activate_when.completed_tasks_gte 미충족 시 false를 반환해야 한다', () => {
      const moduleConfig: ModuleConditionalConfig = {
        enabled: true,
        activate_when: { completed_tasks_gte: 10 },
      };
      const context: ConditionContext = {
        taskTags: [],
        changedFiles: ['src/app.ts'],
        completedTaskCount: 3,
      };
      expect(evaluateCondition(moduleConfig, context)).toBe(false);
    });

    it('AC04: evaluateCondition이 activate_when.changed_files_pattern 미충족 시 false를 반환해야 한다', () => {
      const moduleConfig: ModuleConditionalConfig = {
        enabled: true,
        activate_when: { changed_files_pattern: '*.ts' },
      };
      const context: ConditionContext = {
        taskTags: [],
        changedFiles: ['README.md', 'docs/guide.md'],
        completedTaskCount: 5,
      };
      expect(evaluateCondition(moduleConfig, context)).toBe(false);
    });

    it('AC04: activate_when 조건이 충족되면 true를 반환해야 한다', () => {
      const moduleConfig: ModuleConditionalConfig = {
        enabled: true,
        activate_when: { completed_tasks_gte: 5 },
      };
      const context: ConditionContext = {
        taskTags: [],
        changedFiles: ['src/app.ts'],
        completedTaskCount: 10,
      };
      expect(evaluateCondition(moduleConfig, context)).toBe(true);
    });

    it('AC03+AC04: enabled가 false이면 조건과 무관하게 false를 반환해야 한다', () => {
      const moduleConfig: ModuleConditionalConfig = {
        enabled: false,
      };
      const context: ConditionContext = {
        taskTags: [],
        changedFiles: ['src/app.ts'],
        completedTaskCount: 100,
      };
      expect(evaluateCondition(moduleConfig, context)).toBe(false);
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
      expect(ignoreIds).not.toContain('rule-a');
      expect(ignoreIds).toContain('rule-b');
      expect(ignoreIds).toContain('rule-c');
    });
  });
});
