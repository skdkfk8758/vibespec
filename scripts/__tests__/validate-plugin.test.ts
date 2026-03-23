import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseFrontmatter, validateSkillContent, validateHooks, validateAgents, validateConsistency } from '../validate-plugin';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('parseFrontmatter', () => {
  it('should parse valid frontmatter with all fields', () => {
    const content = `---
name: my-skill
description: A useful skill for doing things well
invocation: user
---

# My Skill

## Steps
1. Do the thing`;

    const fm = parseFrontmatter(content);
    expect(fm).not.toBeNull();
    expect(fm!.name).toBe('my-skill');
    expect(fm!.description).toBe('A useful skill for doing things well');
    expect(fm!.invocation).toBe('user');
  });

  it('should return null for content without frontmatter', () => {
    const content = '# No Frontmatter\nJust text.';
    expect(parseFrontmatter(content)).toBeNull();
  });

  it('should return null for unclosed frontmatter', () => {
    const content = '---\nname: broken\nno closing';
    expect(parseFrontmatter(content)).toBeNull();
  });
});

describe('validateSkillContent', () => {
  function makeSkill(opts: {
    name?: string;
    description?: string;
    invocation?: string;
    type?: string;
    body?: string;
  } = {}): string {
    const fmLines: string[] = [];
    if (opts.name !== undefined) fmLines.push(`name: ${opts.name}`);
    if (opts.description !== undefined) fmLines.push(`description: ${opts.description}`);
    if (opts.invocation !== undefined) fmLines.push(`invocation: ${opts.invocation}`);
    if (opts.type !== undefined) fmLines.push(`type: ${opts.type}`);
    const fm = fmLines.length > 0 ? `---\n${fmLines.join('\n')}\n---\n` : '';
    const body = opts.body ?? '# Title\n\n## Steps\n1. Do something';
    return fm + body;
  }

  // AC: name이 디렉토리와 불일치하는 SKILL.md -> error 반환
  it('should return error when name mismatches directory', () => {
    const content = makeSkill({ name: 'wrong-name', description: 'A valid description over twenty chars' });
    const result = validateSkillContent(content, 'correct-name');
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('mismatch'),
    ]));
  });

  // AC: 유효한 SKILL.md -> 에러 없이 통과
  it('should pass with no errors for valid skill content', () => {
    const content = makeSkill({ name: 'my-skill', description: 'A valid description over twenty chars', invocation: 'user' });
    const result = validateSkillContent(content, 'my-skill');
    expect(result.errors).toHaveLength(0);
  });

  // Spec: name, description 필수 -> error
  it('should return error when name is missing', () => {
    const content = makeSkill({ description: 'A valid description over twenty chars' });
    const result = validateSkillContent(content, 'my-skill');
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('name'),
    ]));
  });

  it('should return error when description is missing', () => {
    const content = makeSkill({ name: 'my-skill' });
    const result = validateSkillContent(content, 'my-skill');
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('description'),
    ]));
  });

  // Spec: invocation enum 체크(user|auto|system) -> warning
  // AC: invocation 값이 invalid -> warning 반환
  it('should return warning when invocation value is invalid', () => {
    const content = makeSkill({
      name: 'my-skill',
      description: 'A valid description over twenty chars',
      invocation: 'manual',
    });
    const result = validateSkillContent(content, 'my-skill');
    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('invocation'),
    ]));
  });

  it('should not warn for valid invocation values (user, auto, system)', () => {
    for (const inv of ['user', 'auto', 'system']) {
      const content = makeSkill({
        name: 'my-skill',
        description: 'A valid description over twenty chars',
        invocation: inv,
      });
      const result = validateSkillContent(content, 'my-skill');
      expect(result.warnings.filter((w: string) => w.includes('invocation'))).toHaveLength(0);
    }
  });

  // Spec: description 20자 미만 경고
  it('should return warning when description is shorter than 20 chars', () => {
    const content = makeSkill({ name: 'my-skill', description: 'Short desc' });
    const result = validateSkillContent(content, 'my-skill');
    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('short'),
    ]));
  });

  // Spec: body 필수 섹션(## Steps 또는 ## When to Use) 존재 경고
  it('should return warning when body lacks both Steps and When to Use sections', () => {
    const content = makeSkill({
      name: 'my-skill',
      description: 'A valid description over twenty chars',
      invocation: 'user',
      body: '# Title\n\nSome content without required sections.',
    });
    const result = validateSkillContent(content, 'my-skill');
    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('Steps'),
    ]));
  });

  it('should not warn about body sections when ## When to Use is present', () => {
    const content = makeSkill({
      name: 'my-skill',
      description: 'A valid description over twenty chars',
      invocation: 'user',
      body: '# Title\n\n## When to Use\nUse when needed.',
    });
    const result = validateSkillContent(content, 'my-skill');
    expect(result.warnings.filter((w: string) => w.includes('Steps') || w.includes('When to Use'))).toHaveLength(0);
  });

  // Spec: 유효하지 않은 프론트매터는 error
  it('should return error when frontmatter is missing entirely', () => {
    const content = '# No Frontmatter\nJust text.';
    const result = validateSkillContent(content, 'my-skill');
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('frontmatter'),
    ]));
  });
});

describe('validateHooks', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-hooks-'));
    fs.mkdirSync(path.join(tmpDir, 'hooks'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // AC1: hooks.json에 존재하지 않는 스크립트 경로 -> error 반환
  it('should return error when hooks.json references a non-existent script', () => {
    const hooksJson = path.join(tmpDir, 'hooks', 'hooks.json');
    fs.writeFileSync(hooksJson, JSON.stringify({
      hooks: {
        PreToolUse: [{
          matcher: 'Bash',
          hooks: [{
            type: 'command',
            command: 'bash ${CLAUDE_PLUGIN_ROOT}/hooks/missing-script.sh',
          }],
        }],
      },
    }));
    // missing-script.sh does NOT exist

    const result = validateHooks(hooksJson, tmpDir);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('missing-script.sh');
  });

  // AC3: 정상 hooks.json -> 통과
  it('should pass when all referenced scripts exist', () => {
    const hooksJson = path.join(tmpDir, 'hooks', 'hooks.json');
    // Create the referenced script
    fs.writeFileSync(path.join(tmpDir, 'hooks', 'my-hook.sh'), '#!/bin/bash\necho ok');
    fs.writeFileSync(hooksJson, JSON.stringify({
      hooks: {
        PreToolUse: [{
          matcher: 'Bash',
          hooks: [{
            type: 'command',
            command: 'bash ${CLAUDE_PLUGIN_ROOT}/hooks/my-hook.sh',
          }],
        }],
      },
    }));

    const result = validateHooks(hooksJson, tmpDir);
    expect(result.errors).toHaveLength(0);
  });

  it('should return error for invalid JSON in hooks.json', () => {
    const hooksJson = path.join(tmpDir, 'hooks', 'hooks.json');
    fs.writeFileSync(hooksJson, '{ invalid json }');

    const result = validateHooks(hooksJson, tmpDir);
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('Invalid JSON'),
    ]));
  });
});

describe('validateAgents', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-agents-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // AC2: 에이전트 .md에 name 누락 -> error 반환
  it('should return error when agent .md is missing name field', () => {
    fs.writeFileSync(path.join(tmpDir, 'my-agent.md'), `---
description: A valid agent description
---

# My Agent`);

    const { results } = validateAgents(tmpDir);
    expect(results['my-agent.md'].errors).toEqual(expect.arrayContaining([
      expect.stringContaining('name'),
    ]));
  });

  // AC2 variant: description 누락 -> error 반환
  it('should return error when agent .md is missing description field', () => {
    fs.writeFileSync(path.join(tmpDir, 'my-agent.md'), `---
name: my-agent
---

# My Agent`);

    const { results } = validateAgents(tmpDir);
    expect(results['my-agent.md'].errors).toEqual(expect.arrayContaining([
      expect.stringContaining('description'),
    ]));
  });

  // AC3: 정상 agents -> 통과
  it('should pass when agent .md has all required fields', () => {
    fs.writeFileSync(path.join(tmpDir, 'my-agent.md'), `---
name: my-agent
description: A valid agent that does things
---

# My Agent`);

    const { results } = validateAgents(tmpDir);
    expect(results['my-agent.md'].errors).toHaveLength(0);
  });

  it('should return error when agent .md has no frontmatter', () => {
    fs.writeFileSync(path.join(tmpDir, 'bad-agent.md'), '# No Frontmatter\nJust text.');

    const { results } = validateAgents(tmpDir);
    expect(results['bad-agent.md'].errors).toEqual(expect.arrayContaining([
      expect.stringContaining('frontmatter'),
    ]));
  });
});

describe('validateConsistency', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-consistency-'));
    fs.mkdirSync(path.join(tmpDir, 'hooks'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'agents'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // AC3: 정상 hooks.json + agents -> 통과
  it('should pass when hooks and agents are all valid', () => {
    fs.writeFileSync(path.join(tmpDir, 'hooks', 'my-hook.sh'), '#!/bin/bash\necho ok');
    fs.writeFileSync(path.join(tmpDir, 'hooks', 'hooks.json'), JSON.stringify({
      hooks: {
        PreToolUse: [{
          matcher: 'Bash',
          hooks: [{ type: 'command', command: 'bash ${CLAUDE_PLUGIN_ROOT}/hooks/my-hook.sh' }],
        }],
      },
    }));
    fs.writeFileSync(path.join(tmpDir, 'agents', 'agent.md'), `---
name: agent
description: A valid agent description here
---

# Agent`);

    const result = validateConsistency(tmpDir);
    expect(result.errors).toHaveLength(0);
  });

  // Combined: hooks error + agents error both reported
  it('should aggregate errors from both hooks and agents', () => {
    fs.writeFileSync(path.join(tmpDir, 'hooks', 'hooks.json'), JSON.stringify({
      hooks: {
        PreToolUse: [{
          matcher: 'Bash',
          hooks: [{ type: 'command', command: 'bash ${CLAUDE_PLUGIN_ROOT}/hooks/nonexistent.sh' }],
        }],
      },
    }));
    fs.writeFileSync(path.join(tmpDir, 'agents', 'bad.md'), `---
description: Only description no name
---
# Bad`);

    const result = validateConsistency(tmpDir);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
    expect(result.errors.some(e => e.includes('nonexistent.sh'))).toBe(true);
    expect(result.errors.some(e => e.includes('name'))).toBe(true);
  });
});
