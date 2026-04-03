import { z } from 'zod';
import * as YAML from 'yaml';
import * as fs from 'node:fs';
import { normalizeError } from '../utils.js';

// --- Sub-schemas ---

export const CustomRuleSchema = z.object({
  id: z.string(),
  pattern: z.string().refine(
    (val) => {
      try {
        new RegExp(val);
        return true;
      } catch {
        return false;
      }
    },
    { message: 'Invalid regular expression pattern' },
  ),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  message: z.string(),
});

export const IgnoreRuleSchema = z.object({
  rule_id: z.string(),
  paths: z.array(z.string()),
  reason: z.string(),
  expires: z.string().optional(),
});

export const SeverityAdjustmentSchema = z.object({
  rule_id: z.string(),
  new_severity: z.enum(['critical', 'high', 'medium', 'low']),
  condition: z.string(),
});

// --- Conditional Activation sub-schemas ---

export const SkipWhenSchema = z.object({
  task_tags: z.array(z.string()).optional(),
  changed_files_only: z.array(z.string()).optional(),
});

export const ActivateWhenSchema = z.object({
  completed_tasks_gte: z.number().optional(),
  changed_files_pattern: z.string().optional(),
});

export const ModuleConditionalConfigSchema = z.object({
  enabled: z.boolean(),
  skip_when: SkipWhenSchema.optional(),
  activate_when: ActivateWhenSchema.optional(),
});

export type ModuleConditionalConfig = z.infer<typeof ModuleConditionalConfigSchema>;

export const ConditionalModuleSchema = z.union([z.boolean(), ModuleConditionalConfigSchema]).optional();

export interface ConditionContext {
  taskTags: string[];
  changedFiles: string[];
  completedTaskCount: number;
}

// --- Main schema ---

export const QaRulesSchema = z.object({
  profile: z
    .enum(['web-frontend', 'api-server', 'fullstack', 'library', 'cli-tool'])
    .optional(),
  risk_thresholds: z
    .object({
      green: z.number(),
      yellow: z.number(),
      orange: z.number(),
    })
    .optional(),
  severity_weights: z
    .object({
      critical: z.number(),
      high: z.number(),
      medium: z.number(),
      low: z.number(),
    })
    .optional(),
  modules: z
    .object({
      lint_check: z.boolean().optional(),
      type_check: z.boolean().optional(),
      test_coverage: z.boolean().optional(),
      dead_code: z.boolean().optional(),
      dependency_audit: z.boolean().optional(),
      complexity_analysis: z.boolean().optional(),
      shadow: ConditionalModuleSchema,
      flow_tester: ConditionalModuleSchema,
      wave_gate: z.boolean().optional(),
      adaptive_planner: z.boolean().optional(),
      design_review: z.boolean().optional(),
      skeleton_guard: z.boolean().optional(),
      auto_trigger: z
        .object({
          enabled: z.boolean().default(true),
          milestones: z.array(z.number()).default([50, 100]),
        })
        .optional(),
    })
    .optional(),
  regression_bonus: z.number().optional(),
  custom_rules: z.array(CustomRuleSchema).optional(),
  ignore: z.array(IgnoreRuleSchema).optional(),
  severity_adjustments: z.array(SeverityAdjustmentSchema).optional(),
});

export type QaRulesConfig = z.infer<typeof QaRulesSchema>;

// --- L0 Defaults ---

export interface ResolvedQaConfig {
  profile?: string;
  risk_thresholds: { green: number; yellow: number; orange: number };
  severity_weights: { critical: number; high: number; medium: number; low: number };
  modules: {
    lint_check: boolean;
    type_check: boolean;
    test_coverage: boolean;
    dead_code: boolean;
    dependency_audit: boolean;
    complexity_analysis: boolean;
    shadow: ModuleConditionalConfig;
    flow_tester: ModuleConditionalConfig;
    wave_gate: boolean;
    adaptive_planner: boolean;
    design_review: boolean;
    skeleton_guard: boolean;
    auto_trigger: {
      enabled: boolean;
      milestones: number[];
    };
  };
  regression_bonus: number;
  custom_rules?: Array<z.infer<typeof CustomRuleSchema>>;
  ignore?: Array<z.infer<typeof IgnoreRuleSchema>>;
  severity_adjustments?: Array<z.infer<typeof SeverityAdjustmentSchema>>;
}

export const DEFAULT_QA_CONFIG: ResolvedQaConfig = {
  risk_thresholds: { green: 0.2, yellow: 0.5, orange: 0.8 },
  severity_weights: { critical: 0.4, high: 0.3, medium: 0.2, low: 0.1 },
  modules: {
    lint_check: true,
    type_check: true,
    test_coverage: true,
    dead_code: true,
    dependency_audit: true,
    complexity_analysis: true,
    shadow: { enabled: false },
    flow_tester: { enabled: false },
    wave_gate: false,
    adaptive_planner: false,
    design_review: false,
    skeleton_guard: false,
    auto_trigger: {
      enabled: true,
      milestones: [50, 100],
    },
  },
  regression_bonus: 0.2,
};

// --- Profile Presets ---

export const PROFILE_PRESETS: Record<string, Partial<ResolvedQaConfig>> = {
  'web-frontend': {
    modules: {
      lint_check: true,
      type_check: true,
      test_coverage: true,
      dead_code: true,
      dependency_audit: true,
      complexity_analysis: true,
      shadow: { enabled: true },
      flow_tester: { enabled: false },
      wave_gate: false,
      adaptive_planner: false,
      design_review: true,
      skeleton_guard: true,
      auto_trigger: { enabled: true, milestones: [50, 100] },
    },
    severity_weights: { critical: 0.4, high: 0.3, medium: 0.2, low: 0.1 },
  },
  'api-server': {
    modules: {
      lint_check: true,
      type_check: true,
      test_coverage: true,
      dead_code: true,
      dependency_audit: true,
      complexity_analysis: true,
      shadow: { enabled: false },
      flow_tester: { enabled: false },
      wave_gate: true,
      adaptive_planner: false,
      design_review: false,
      skeleton_guard: false,
      auto_trigger: { enabled: true, milestones: [50, 100] },
    },
    severity_weights: { critical: 0.5, high: 0.3, medium: 0.15, low: 0.05 },
  },
  fullstack: {
    modules: {
      lint_check: true,
      type_check: true,
      test_coverage: true,
      dead_code: true,
      dependency_audit: true,
      complexity_analysis: true,
      shadow: { enabled: true },
      flow_tester: { enabled: false },
      wave_gate: true,
      adaptive_planner: false,
      design_review: true,
      skeleton_guard: true,
      auto_trigger: { enabled: true, milestones: [50, 100] },
    },
  },
  library: {
    modules: {
      lint_check: true,
      type_check: true,
      test_coverage: true,
      dead_code: true,
      dependency_audit: true,
      complexity_analysis: true,
      shadow: { enabled: false },
      flow_tester: { enabled: false },
      wave_gate: false,
      adaptive_planner: false,
      design_review: false,
      skeleton_guard: false,
      auto_trigger: { enabled: true, milestones: [50, 100] },
    },
    regression_bonus: 0.3,
  },
  'cli-tool': {
    modules: {
      lint_check: true,
      type_check: true,
      test_coverage: true,
      dead_code: true,
      dependency_audit: false,
      complexity_analysis: true,
      shadow: { enabled: false },
      flow_tester: { enabled: false },
      wave_gate: false,
      adaptive_planner: false,
      design_review: false,
      skeleton_guard: false,
      auto_trigger: { enabled: true, milestones: [50, 100] },
    },
  },
};

// --- Deep Merge ---

export function deepMerge<T extends Record<string, any>>(base: T, override: Record<string, any>): T {
  const result: Record<string, any> = { ...base };

  for (const key of Object.keys(override)) {
    const baseVal = base[key];
    const overrideVal = override[key];

    if (
      overrideVal !== null &&
      overrideVal !== undefined &&
      typeof overrideVal === 'object' &&
      !Array.isArray(overrideVal) &&
      typeof baseVal === 'object' &&
      baseVal !== null &&
      !Array.isArray(baseVal)
    ) {
      result[key] = deepMerge(baseVal, overrideVal);
    } else if (overrideVal !== undefined) {
      result[key] = overrideVal;
    }
  }

  return result as T;
}

// --- YAML Loader ---

export function loadYamlConfig(yamlPath: string): ResolvedQaConfig {
  try {
    if (!fs.existsSync(yamlPath)) {
      return { ...DEFAULT_QA_CONFIG };
    }

    const content = fs.readFileSync(yamlPath, 'utf-8');
    const parsed = YAML.parse(content);

    if (parsed === null || parsed === undefined) {
      return { ...DEFAULT_QA_CONFIG };
    }

    const validated = QaRulesSchema.parse(parsed);
    return deepMerge(DEFAULT_QA_CONFIG, validated) as ResolvedQaConfig;
  } catch (err) {
    console.warn(
      `[VibeSpec] qa-rules.yaml 파싱 실패, L0 기본값을 사용합니다: ${normalizeError(err).message}`,
    );
    return { ...DEFAULT_QA_CONFIG };
  }
}

// --- Expires Filter ---

function filterExpiredIgnoreRules(config: ResolvedQaConfig): ResolvedQaConfig {
  if (!config.ignore) return config;

  const now = new Date().toISOString().split('T')[0];
  const filtered = config.ignore.filter((rule) => {
    if (!rule.expires) return true;
    return rule.expires >= now;
  });

  return { ...config, ignore: filtered };
}

// --- Normalize boolean modules to object form ---

function normalizeConditionalModule(
  value: boolean | ModuleConditionalConfig | undefined,
  defaultValue: ModuleConditionalConfig,
): ModuleConditionalConfig {
  if (value === undefined) return defaultValue;
  if (typeof value === 'boolean') return { enabled: value };
  return value;
}

function normalizeConditionalModules(config: ResolvedQaConfig): ResolvedQaConfig {
  return {
    ...config,
    modules: {
      ...config.modules,
      shadow: normalizeConditionalModule(
        config.modules.shadow as any,
        DEFAULT_QA_CONFIG.modules.shadow,
      ),
      flow_tester: normalizeConditionalModule(
        config.modules.flow_tester as any,
        DEFAULT_QA_CONFIG.modules.flow_tester,
      ),
    },
  };
}

// --- Resolve Config ---

export interface ResolveConfigOptions {
  planId?: string;
  db?: { prepare: (sql: string) => { get: (...args: any[]) => any } };
  yamlPath?: string;
  rawConfig?: ResolvedQaConfig;
}

export function resolveConfig(options: ResolveConfigOptions = {}): ResolvedQaConfig {
  const { planId, db, yamlPath, rawConfig } = options;

  // L0: defaults
  let config: ResolvedQaConfig = { ...DEFAULT_QA_CONFIG };

  // If rawConfig is provided directly (for testing), use it
  if (rawConfig) {
    config = { ...rawConfig };
    config = normalizeConditionalModules(config);
    return filterExpiredIgnoreRules(config);
  }

  // L1: YAML file
  const effectiveYamlPath = yamlPath ?? '.claude/qa-rules.yaml';
  const yamlConfig = loadYamlConfig(effectiveYamlPath);

  // Apply profile preset if specified
  const profileName = yamlConfig.profile;
  if (profileName && PROFILE_PRESETS[profileName]) {
    config = deepMerge(config, PROFILE_PRESETS[profileName]);
  }

  // Merge L1 over (L0 + preset)
  config = deepMerge(config, yamlConfig);

  // L2: Plan-level overrides from DB
  if (planId && db) {
    try {
      const row = db.prepare('SELECT qa_overrides FROM plans WHERE id = ?').get(planId) as
        | { qa_overrides: string | null }
        | undefined;
      if (row?.qa_overrides) {
        const overrides = JSON.parse(row.qa_overrides);
        config = deepMerge(config, overrides);
      }
    } catch {
      // DB read failure is non-fatal
    }
  }

  // Normalize boolean->object for conditional modules
  config = normalizeConditionalModules(config);

  // Filter expired ignore rules
  config = filterExpiredIgnoreRules(config);

  return config;
}

// --- Evaluate Condition ---

function matchesGlobPattern(pattern: string, filePath: string): boolean {
  const regexStr = '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$';
  return new RegExp(regexStr).test(filePath);
}

export function evaluateCondition(moduleConfig: ModuleConditionalConfig, context: ConditionContext): boolean {
  if (!moduleConfig.enabled) return false;

  if (moduleConfig.skip_when) {
    const { task_tags, changed_files_only } = moduleConfig.skip_when;

    if (task_tags && task_tags.length > 0) {
      const hasMatchingTag = context.taskTags.some((tag) => task_tags.includes(tag));
      if (hasMatchingTag) return false;
    }

    if (changed_files_only && changed_files_only.length > 0 && context.changedFiles.length > 0) {
      const allFilesMatch = context.changedFiles.every((file) =>
        changed_files_only.some((p) => matchesGlobPattern(p, file)),
      );
      if (allFilesMatch) return false;
    }
  }

  if (moduleConfig.activate_when) {
    const { completed_tasks_gte, changed_files_pattern } = moduleConfig.activate_when;

    if (completed_tasks_gte !== undefined) {
      if (context.completedTaskCount < completed_tasks_gte) return false;
    }

    if (changed_files_pattern !== undefined) {
      const hasMatchingFile = context.changedFiles.some((file) =>
        matchesGlobPattern(changed_files_pattern, file),
      );
      if (!hasMatchingFile) return false;
    }
  }

  return true;
}

// --- Validate Config ---

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

export function validateConfig(config: ResolvedQaConfig): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. risk_thresholds ordering: green < yellow < orange
  const { green, yellow, orange } = config.risk_thresholds;
  if (green >= yellow) {
    errors.push(`risk_thresholds ordering error: green (${green}) must be less than yellow (${yellow})`);
  }
  if (yellow >= orange) {
    errors.push(`risk_thresholds ordering error: yellow (${yellow}) must be less than orange (${orange})`);
  }

  // 2. custom_rules regex validation
  if (config.custom_rules) {
    for (const rule of config.custom_rules) {
      try {
        new RegExp(rule.pattern);
      } catch {
        errors.push(`Invalid regex pattern in custom_rule '${rule.id}': ${rule.pattern}`);
      }
    }
  }

  // 3. All modules false warning
  if (config.modules) {
    const allFalse = Object.entries(config.modules)
      .filter(([key]) => key !== 'auto_trigger')
      .every(([, v]) => {
        if (typeof v === 'boolean') return v === false;
        if (typeof v === 'object' && v !== null && 'enabled' in v) return !(v as ModuleConditionalConfig).enabled;
        return false;
      });
    if (allFalse) {
      warnings.push('All modules are disabled. No QA checks will be performed.');
    }
  }

  return { errors, warnings };
}

// --- Detect Profile ---

export function detectProfile(packageJson: {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}): string {
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };
  const depNames = Object.keys(allDeps);

  const frontendIndicators = ['react', 'react-dom', 'vue', 'svelte', 'next', 'nuxt', 'angular', '@angular/core'];
  const backendIndicators = ['express', 'fastify', 'koa', 'hapi', '@nestjs/core', 'hono'];
  const cliIndicators = ['commander', 'yargs', 'inquirer', 'oclif', 'meow', 'cac'];

  const hasFrontend = depNames.some((d) => frontendIndicators.includes(d));
  const hasBackend = depNames.some((d) => backendIndicators.includes(d));
  const hasCli = depNames.some((d) => cliIndicators.includes(d));

  if (hasFrontend && hasBackend) return 'fullstack';
  if (hasFrontend) return 'web-frontend';
  if (hasBackend) return 'api-server';
  if (hasCli) return 'cli-tool';
  return 'library';
}
