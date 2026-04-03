import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

// We'll test the skill-deferred logic by importing and calling the internal functions.
// Since the CLI registers commands via registerGovernanceCommands, we test the underlying
// helper functions directly if exported, or via a thin wrapper approach.
//
// For integration: we create a temp skills/ directory with fake SKILL.md files,
// then call the command action functions directly.

let tmpDir: string;
let skillsDir: string;

function makeSkillDir(name: string, invocation: string) {
  const dir = path.join(skillsDir, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'SKILL.md'),
    `---\nname: ${name}\ndescription: Test skill ${name}\ninvocation: ${invocation}\n---\n\n# ${name}\n`
  );
}

describe('skill-deferred CLI commands', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-skill-deferred-test-'));
    skillsDir = path.join(tmpDir, 'skills');
    fs.mkdirSync(skillsDir);

    // Create test skills
    makeSkillDir('skill-a', 'deferred');
    makeSkillDir('skill-b', 'deferred');
    makeSkillDir('skill-c', 'user');
    makeSkillDir('skill-d', 'agent');
    makeSkillDir('skill-e', 'deferred');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── Helpers to import and test ──
  // We import after creating temp files so we can spy on process.cwd()
  async function loadHelpers() {
    const mod = await import('../commands/skill-deferred-helpers.js');
    return mod;
  }

  it('AC01: listDeferredSkills returns only deferred skills', async () => {
    const { listDeferredSkills } = await loadHelpers();
    const result = listDeferredSkills(skillsDir);
    expect(result).toHaveLength(3);
    expect(result.map((s: { name: string }) => s.name).sort()).toEqual(['skill-a', 'skill-b', 'skill-e']);
  });

  it('AC01: listDeferredSkills returns name and description fields', async () => {
    const { listDeferredSkills } = await loadHelpers();
    const result = listDeferredSkills(skillsDir);
    expect(result[0]).toHaveProperty('name');
    expect(result[0]).toHaveProperty('description');
    expect(result[0]).toHaveProperty('invocation', 'deferred');
  });

  it('AC01: listDeferredSkills returns empty array when no deferred skills exist', async () => {
    const emptyDir = path.join(tmpDir, 'empty-skills');
    fs.mkdirSync(emptyDir);
    makeSkillDir2(emptyDir, 'skill-x', 'user');
    const { listDeferredSkills } = await loadHelpers();
    expect(listDeferredSkills(emptyDir)).toHaveLength(0);
  });

  it('AC02: promoteSkill changes invocation from deferred to user', async () => {
    const { promoteSkill, listDeferredSkills } = await loadHelpers();
    promoteSkill(skillsDir, 'skill-a');
    const skillMd = fs.readFileSync(path.join(skillsDir, 'skill-a', 'SKILL.md'), 'utf8');
    expect(skillMd).toContain('invocation: user');
    expect(skillMd).not.toContain('invocation: deferred');
  });

  it('AC02: promoteSkill removes the skill from deferred list', async () => {
    const { promoteSkill, listDeferredSkills } = await loadHelpers();
    promoteSkill(skillsDir, 'skill-a');
    const result = listDeferredSkills(skillsDir);
    expect(result.map((s: { name: string }) => s.name)).not.toContain('skill-a');
  });

  it('AC02: promoteSkill throws error when skill not found', async () => {
    const { promoteSkill } = await loadHelpers();
    expect(() => promoteSkill(skillsDir, 'nonexistent')).toThrow();
  });

  it('AC02: promoteSkill throws error when skill is not deferred', async () => {
    const { promoteSkill } = await loadHelpers();
    expect(() => promoteSkill(skillsDir, 'skill-c')).toThrow();
  });

  it('AC03: demoteSkill changes invocation from user to deferred', async () => {
    const { demoteSkill } = await loadHelpers();
    demoteSkill(skillsDir, 'skill-c');
    const skillMd = fs.readFileSync(path.join(skillsDir, 'skill-c', 'SKILL.md'), 'utf8');
    expect(skillMd).toContain('invocation: deferred');
    expect(skillMd).not.toContain('invocation: user');
  });

  it('AC03: demoteSkill adds skill to deferred list', async () => {
    const { demoteSkill, listDeferredSkills } = await loadHelpers();
    demoteSkill(skillsDir, 'skill-c');
    const result = listDeferredSkills(skillsDir);
    expect(result.map((s: { name: string }) => s.name)).toContain('skill-c');
  });

  it('AC03: demoteSkill throws error when skill not found', async () => {
    const { demoteSkill } = await loadHelpers();
    expect(() => demoteSkill(skillsDir, 'nonexistent')).toThrow();
  });

  it('AC03: demoteSkill throws error when skill is already deferred', async () => {
    const { demoteSkill } = await loadHelpers();
    expect(() => demoteSkill(skillsDir, 'skill-a')).toThrow();
  });

  it('AC04: listDeferredSkills result is JSON-serializable with expected shape', async () => {
    const { listDeferredSkills } = await loadHelpers();
    const result = listDeferredSkills(skillsDir);
    const json = JSON.stringify(result);
    const parsed = JSON.parse(json) as Array<{ name: string; invocation: string; description: string }>;
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.every((item) => typeof item.name === 'string')).toBe(true);
    expect(parsed.every((item) => item.invocation === 'deferred')).toBe(true);
  });

  it('AC04: promoteSkill returns result object for JSON output', async () => {
    const { promoteSkill } = await loadHelpers();
    const result = promoteSkill(skillsDir, 'skill-b');
    expect(result).toHaveProperty('name', 'skill-b');
    expect(result).toHaveProperty('invocation', 'user');
    expect(result).toHaveProperty('previous', 'deferred');
  });

  it('AC04: demoteSkill returns result object for JSON output', async () => {
    const { demoteSkill } = await loadHelpers();
    const result = demoteSkill(skillsDir, 'skill-c');
    expect(result).toHaveProperty('name', 'skill-c');
    expect(result).toHaveProperty('invocation', 'deferred');
    expect(result).toHaveProperty('previous', 'user');
  });
});

// Helper used in test (closure issue workaround)
function makeSkillDir2(skillsDir: string, name: string, invocation: string) {
  const dir = path.join(skillsDir, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'SKILL.md'),
    `---\nname: ${name}\ndescription: Test skill ${name}\ninvocation: ${invocation}\n---\n\n# ${name}\n`
  );
}
