import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export interface SkillInfo {
  name: string;
  description: string;
  invocation: string;
}

export interface SkillTransitionResult {
  name: string;
  invocation: string;
  previous: string;
}

function parseFrontmatter(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return result;
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    result[key] = value;
  }
  return result;
}

export function listDeferredSkills(skillsDir: string): SkillInfo[] {
  if (!existsSync(skillsDir)) return [];

  const entries = readdirSync(skillsDir, { withFileTypes: true });
  const results: SkillInfo[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillMdPath = join(skillsDir, entry.name, 'SKILL.md');
    let content: string;
    try {
      content = readFileSync(skillMdPath, 'utf8');
    } catch {
      continue;
    }
    const fm = parseFrontmatter(content);

    if (fm['invocation'] === 'deferred') {
      results.push({
        name: fm['name'] ?? entry.name,
        description: fm['description'] ?? '',
        invocation: 'deferred',
      });
    }
  }

  return results;
}

export function promoteSkill(skillsDir: string, skillName: string): SkillTransitionResult {
  const skillMdPath = join(skillsDir, skillName, 'SKILL.md');
  if (!existsSync(skillMdPath)) {
    throw new Error(`Skill not found: ${skillName}`);
  }

  const content = readFileSync(skillMdPath, 'utf8');
  const fm = parseFrontmatter(content);

  if (fm['invocation'] !== 'deferred') {
    throw new Error(`Skill '${skillName}' is not deferred (current: ${fm['invocation'] ?? 'unknown'})`);
  }

  const updated = content.replace(/^invocation: deferred$/m, 'invocation: user');
  writeFileSync(skillMdPath, updated, 'utf8');

  return {
    name: skillName,
    invocation: 'user',
    previous: 'deferred',
  };
}

export function demoteSkill(skillsDir: string, skillName: string): SkillTransitionResult {
  const skillMdPath = join(skillsDir, skillName, 'SKILL.md');
  if (!existsSync(skillMdPath)) {
    throw new Error(`Skill not found: ${skillName}`);
  }

  const content = readFileSync(skillMdPath, 'utf8');
  const fm = parseFrontmatter(content);

  if (fm['invocation'] === 'deferred') {
    throw new Error(`Skill '${skillName}' is already deferred`);
  }

  const currentInvocation = fm['invocation'] ?? 'user';
  const updated = content.replace(
    new RegExp(`^invocation: ${currentInvocation}$`, 'm'),
    'invocation: deferred'
  );
  writeFileSync(skillMdPath, updated, 'utf8');

  return {
    name: skillName,
    invocation: 'deferred',
    previous: currentInvocation,
  };
}
