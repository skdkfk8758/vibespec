import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { registerKnowledgeCommands } from '../commands/knowledge.js';
import {
  formatRuleList,
  formatRuleDetail,
  formatEscalationStatus,
} from '../formatters.js';
import type { SelfImproveRule } from '../../core/types.js';
import type { EscalationCandidate } from '../../core/types.js';

// ── Formatter tests ─────────────────────────────────────────────────────

function makeRule(overrides?: Partial<SelfImproveRule>): SelfImproveRule {
  return {
    id: 'rule-001',
    error_kb_id: null,
    title: 'Always use optional chaining',
    category: 'code-style',
    rule_path: '.claude/rules/code-style-always-use-optional-chaining.md',
    occurrences: 5,
    prevented: 2,
    status: 'active',
    enforcement: 'SOFT',
    escalated_at: null,
    created_at: '2026-03-01T00:00:00.000Z',
    last_triggered_at: '2026-03-15T00:00:00.000Z',
    ...overrides,
  };
}

describe('formatRuleList', () => {
  it('AC02: rules list에 [SOFT] 태그가 표시된다', () => {
    const rules = [makeRule({ enforcement: 'SOFT' })];
    const result = formatRuleList(rules);
    expect(result).toContain('[SOFT]');
    expect(result).toContain('rule-001');
    expect(result).toContain('Always use optional chaining');
  });

  it('AC02: rules list에 [HARD] 태그가 표시된다', () => {
    const rules = [makeRule({ enforcement: 'HARD', escalated_at: '2026-03-20T00:00:00.000Z' })];
    const result = formatRuleList(rules);
    expect(result).toContain('[HARD]');
    expect(result).toContain('rule-001');
  });

  it('AC02: rules list에 SOFT와 HARD 규칙이 혼합 표시된다', () => {
    const rules = [
      makeRule({ id: 'rule-001', enforcement: 'SOFT' }),
      makeRule({ id: 'rule-002', enforcement: 'HARD', title: 'No console.log in production' }),
    ];
    const result = formatRuleList(rules);
    expect(result).toContain('[SOFT]');
    expect(result).toContain('[HARD]');
    expect(result).toContain('rule-001');
    expect(result).toContain('rule-002');
  });

  it('AC02: 빈 목록은 "No rules found." 반환', () => {
    const result = formatRuleList([]);
    expect(result).toBe('No rules found.');
  });
});

describe('formatRuleDetail', () => {
  it('AC02: rules show에 enforcement와 escalated_at이 표시된다', () => {
    const rule = makeRule({ enforcement: 'HARD', escalated_at: '2026-03-20T10:00:00.000Z' });
    const result = formatRuleDetail(rule);
    expect(result).toContain('Enforcement: HARD');
    expect(result).toContain('Escalated:   2026-03-20T10:00:00.000Z');
  });

  it('AC02: SOFT 규칙은 escalated_at이 없으면 "-" 표시', () => {
    const rule = makeRule({ enforcement: 'SOFT', escalated_at: null });
    const result = formatRuleDetail(rule);
    expect(result).toContain('Enforcement: SOFT');
    expect(result).toContain('Escalated:   -');
  });
});

describe('formatEscalationStatus', () => {
  it('AC03: 에스컬레이션 대상에 "HARD 승격 예정" 표시', () => {
    const candidates: EscalationCandidate[] = [
      {
        id: 'rule-001',
        title: 'Always use optional chaining',
        rule_path: '.claude/rules/code-style-always-use-optional-chaining.md',
        created_at: '2026-01-15T00:00:00.000Z',
        occurrences: 5,
        prevented: 0,
        days_since_creation: 75,
      },
    ];
    const result = formatEscalationStatus(candidates);
    expect(result).toContain('HARD 승격 예정');
    expect(result).toContain('rule-001');
    expect(result).toContain('Always use optional chaining');
  });

  it('AC03: 빈 후보 목록', () => {
    const result = formatEscalationStatus([]);
    expect(result).toContain('No escalation candidates');
  });
});

// ── CLI command integration tests ───────────────────────────────────────

// Mock the engine and shared modules
const mockEngine = {
  listRules: vi.fn(),
  getRule: vi.fn(),
  escalateRule: vi.fn(),
  checkEscalation: vi.fn(),
  autoArchiveStale: vi.fn(),
  getPendingCount: vi.fn(),
  getRuleStats: vi.fn(),
  getLastRunTimestamp: vi.fn(),
  getMaxActiveRules: vi.fn(),
  archiveRule: vi.fn(),
};

vi.mock('../../core/db/connection.js', () => ({
  findProjectRoot: () => '/mock/root',
}));

vi.mock('../../core/engine/self-improve.js', () => ({
  SelfImproveEngine: vi.fn(() => mockEngine),
}));

vi.mock('../../core/engine/error-kb.js', () => ({
  ErrorKBEngine: vi.fn(() => ({})),
}));

let capturedOutput: unknown = null;
let capturedFormatted: string | undefined = undefined;
let capturedError: string | null = null;

vi.mock('../shared.js', () => ({
  output: (data: unknown, formatted?: string) => {
    capturedOutput = data;
    capturedFormatted = formatted;
  },
  outputError: (msg: string) => {
    capturedError = msg;
  },
  getJsonMode: () => false,
  initDb: () => ({}),
  initModels: () => ({}),
}));

function createProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerKnowledgeCommands(program, () => ({} as any));
  return program;
}

describe('CLI: rules update --enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOutput = null;
    capturedFormatted = undefined;
    capturedError = null;
  });

  it('AC01: --enforcement HARD 실행 시 escalateRule이 호출된다', async () => {
    mockEngine.escalateRule.mockReturnValue(true);
    mockEngine.getRule.mockReturnValue(makeRule({ id: 'rule-001', enforcement: 'HARD', escalated_at: '2026-03-20T00:00:00.000Z' }));

    const program = createProgram();
    await program.parseAsync(['node', 'test', 'self-improve', 'rules', 'update', 'rule-001', '--enforcement', 'HARD']);

    expect(mockEngine.escalateRule).toHaveBeenCalledWith('rule-001');
  });

  it('AC01: --enforcement SOFT 실행 시 DB 직접 업데이트 (escalateRule 호출 안됨)', async () => {
    mockEngine.getRule.mockReturnValue(makeRule({ id: 'rule-001', enforcement: 'SOFT' }));

    const program = createProgram();
    await program.parseAsync(['node', 'test', 'self-improve', 'rules', 'update', 'rule-001', '--enforcement', 'SOFT']);

    expect(mockEngine.escalateRule).not.toHaveBeenCalled();
  });
});

describe('CLI: rules list with enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOutput = null;
    capturedFormatted = undefined;
  });

  it('AC02: rules list 출력에 [SOFT]/[HARD] 태그가 포함된다', async () => {
    mockEngine.listRules.mockReturnValue([
      makeRule({ id: 'rule-001', enforcement: 'SOFT' }),
      makeRule({ id: 'rule-002', enforcement: 'HARD', title: 'No console.log' }),
    ]);

    const program = createProgram();
    await program.parseAsync(['node', 'test', 'self-improve', 'rules', 'list']);

    expect(capturedFormatted).toContain('[SOFT]');
    expect(capturedFormatted).toContain('[HARD]');
  });
});

describe('CLI: rules show with enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOutput = null;
    capturedFormatted = undefined;
  });

  it('AC02: rules show에 enforcement, escalated_at 표시', async () => {
    mockEngine.getRule.mockReturnValue(
      makeRule({ enforcement: 'HARD', escalated_at: '2026-03-20T00:00:00.000Z' })
    );

    const program = createProgram();
    await program.parseAsync(['node', 'test', 'self-improve', 'rules', 'show', 'rule-001']);

    expect(capturedFormatted).toContain('Enforcement: HARD');
    expect(capturedFormatted).toContain('Escalated:');
  });
});

describe('CLI: escalation-status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOutput = null;
    capturedFormatted = undefined;
  });

  it('AC03: escalation-status가 승격 대상 규칙 목록을 반환한다', async () => {
    const candidates: EscalationCandidate[] = [
      {
        id: 'rule-001',
        title: 'Always use optional chaining',
        rule_path: '.claude/rules/code-style-always-use-optional-chaining.md',
        created_at: '2026-01-15T00:00:00.000Z',
        occurrences: 5,
        prevented: 0,
        days_since_creation: 75,
      },
    ];
    mockEngine.checkEscalation.mockReturnValue(candidates);

    const program = createProgram();
    await program.parseAsync(['node', 'test', 'self-improve', 'escalation-status']);

    expect(mockEngine.checkEscalation).toHaveBeenCalled();
    expect(capturedFormatted).toContain('HARD 승격 예정');
    expect(capturedFormatted).toContain('rule-001');
  });
});

describe('CLI: escalate --auto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOutput = null;
    capturedFormatted = undefined;
  });

  it('AC04: escalate --auto가 조건 충족 규칙을 HARD로 승격한다', async () => {
    const candidates: EscalationCandidate[] = [
      {
        id: 'rule-001',
        title: 'Always use optional chaining',
        rule_path: '.claude/rules/code-style-always-use-optional-chaining.md',
        created_at: '2026-01-15T00:00:00.000Z',
        occurrences: 5,
        prevented: 0,
        days_since_creation: 75,
      },
      {
        id: 'rule-002',
        title: 'No console.log',
        rule_path: '.claude/rules/code-style-no-console-log.md',
        created_at: '2026-01-10T00:00:00.000Z',
        occurrences: 4,
        prevented: 0,
        days_since_creation: 80,
      },
    ];
    mockEngine.checkEscalation.mockReturnValue(candidates);
    mockEngine.escalateRule.mockReturnValue(true);

    const program = createProgram();
    await program.parseAsync(['node', 'test', 'self-improve', 'escalate', '--auto']);

    expect(mockEngine.checkEscalation).toHaveBeenCalled();
    expect(mockEngine.escalateRule).toHaveBeenCalledWith('rule-001');
    expect(mockEngine.escalateRule).toHaveBeenCalledWith('rule-002');
    expect(mockEngine.escalateRule).toHaveBeenCalledTimes(2);
  });

  it('AC04: 승격 대상이 없으면 적절한 메시지 출력', async () => {
    mockEngine.checkEscalation.mockReturnValue([]);

    const program = createProgram();
    await program.parseAsync(['node', 'test', 'self-improve', 'escalate', '--auto']);

    expect(mockEngine.escalateRule).not.toHaveBeenCalled();
  });
});

describe('CLI: archive-stale', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOutput = null;
    capturedFormatted = undefined;
  });

  it('AC05: archive-stale --days 60이 autoArchiveStale(60)을 호출한다', async () => {
    mockEngine.autoArchiveStale.mockReturnValue(['rule-003', 'rule-004']);

    const program = createProgram();
    await program.parseAsync(['node', 'test', 'self-improve', 'archive-stale', '--days', '60']);

    expect(mockEngine.autoArchiveStale).toHaveBeenCalledWith(60);
  });

  it('AC05: archive-stale 기본값은 60일', async () => {
    mockEngine.autoArchiveStale.mockReturnValue([]);

    const program = createProgram();
    await program.parseAsync(['node', 'test', 'self-improve', 'archive-stale']);

    expect(mockEngine.autoArchiveStale).toHaveBeenCalledWith(60);
  });

  it('AC05: archive된 규칙 ID가 결과에 포함된다', async () => {
    mockEngine.autoArchiveStale.mockReturnValue(['rule-003', 'rule-004']);

    const program = createProgram();
    await program.parseAsync(['node', 'test', 'self-improve', 'archive-stale', '--days', '60']);

    expect(capturedOutput).toEqual({ archived: ['rule-003', 'rule-004'], count: 2 });
  });
});
