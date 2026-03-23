#!/usr/bin/env npx tsx
import fs from "fs";
import path from "path";

const C = { RED: "\x1b[91m", GREEN: "\x1b[92m", YELLOW: "\x1b[93m", CYAN: "\x1b[96m", BOLD: "\x1b[1m", DIM: "\x1b[2m", RESET: "\x1b[0m" };

export interface Frontmatter { [key: string]: string }
export interface VR { errors: string[]; warnings: string[]; info: string[] }

const VALID_INVOCATIONS = ["user", "auto", "system"];

export function parseFrontmatter(content: string): Frontmatter | null {
  if (!content.startsWith("---")) return null;
  const end = content.indexOf("---", 3);
  if (end === -1) return null;
  const result: Frontmatter = {};
  for (const line of content.slice(3, end).trim().split("\n")) {
    const m = line.trim().match(/^(\S+):\s*(.+)$/);
    if (m) result[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return result;
}

export function validateSkillContent(content: string, dirName: string): VR {
  const r: VR = { errors: [], warnings: [], info: [] };
  const fm = parseFrontmatter(content);
  if (!fm) { r.errors.push("Missing YAML frontmatter (must start with ---)"); return r; }

  for (const f of ["name", "description"]) {
    if (!fm[f]) r.errors.push(`Missing required field: ${f}`);
  }
  if (fm.name && fm.name !== dirName) r.errors.push(`Name mismatch: '${fm.name}' vs dir '${dirName}'`);
  if (fm.description && fm.description.length < 20) r.warnings.push(`Description very short (${fm.description.length} chars)`);
  if (fm.invocation && !VALID_INVOCATIONS.includes(fm.invocation)) {
    r.warnings.push(`Invalid invocation '${fm.invocation}' (expected: ${VALID_INVOCATIONS.join("|")})`);
  }

  const body = content.slice(content.indexOf("---", 3) + 3);
  if (!body.includes("## Steps") && !body.includes("## When to Use")) {
    r.warnings.push("Missing recommended section: ## Steps or ## When to Use");
  }

  r.info.push(`${(content.match(/\S+/g) ?? []).length} words`);
  if (fm.type) r.info.push(`type: ${fm.type}`);
  return r;
}

function vr(): VR { return { errors: [], warnings: [], info: [] } }

function validateSkills(skillsDir: string): { results: Record<string, VR>; count: number } {
  const results: Record<string, VR> = {};
  if (!fs.existsSync(skillsDir)) return { results, count: 0 };
  const dirs = fs.readdirSync(skillsDir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
  for (const dir of dirs) {
    const p = path.join(skillsDir, dir, "SKILL.md");
    if (!fs.existsSync(p)) { const r = vr(); r.errors.push("Missing SKILL.md"); results[dir] = r; continue; }
    const content = fs.readFileSync(p, "utf-8");
    results[dir] = validateSkillContent(content, dir);
  }
  return { results, count: dirs.length };
}

export function validateAgents(agentsDir: string): { results: Record<string, VR>; count: number } {
  const results: Record<string, VR> = {};
  if (!fs.existsSync(agentsDir)) return { results, count: 0 };
  const files = fs.readdirSync(agentsDir).filter(f => f.endsWith(".md"));
  for (const file of files) {
    const r = vr();
    const fm = parseFrontmatter(fs.readFileSync(path.join(agentsDir, file), "utf-8"));
    if (!fm) { r.errors.push("Missing YAML frontmatter"); results[file] = r; continue; }
    for (const f of ["name", "description"]) if (!fm[f]) r.errors.push(`Missing required field: ${f}`);
    results[file] = r;
  }
  return { results, count: files.length };
}

export function validateHooks(hooksJson: string, root: string): VR {
  const r = vr();
  if (!fs.existsSync(hooksJson)) { r.warnings.push("Missing hooks/hooks.json"); return r; }
  let config: { hooks?: Record<string, unknown[]> };
  try { config = JSON.parse(fs.readFileSync(hooksJson, "utf-8")); } catch { r.errors.push("Invalid JSON"); return r; }
  let count = 0;

  function checkCommand(cmd: string, evt: string) {
    count++;
    const m = cmd.match(/hooks\/[\w.-]+\.sh/);
    if (m && !fs.existsSync(path.join(root, m[0]))) r.errors.push(`Script not found: ${m[0]} (${evt})`);
  }

  for (const [evt, list] of Object.entries(config.hooks || {})) {
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      const e = entry as Record<string, unknown>;
      if (typeof e.command === "string") {
        checkCommand(e.command, evt);
      }
      if (Array.isArray(e.hooks)) {
        for (const h of e.hooks) {
          const hh = h as Record<string, unknown>;
          if (typeof hh.command === "string") checkCommand(hh.command, evt);
        }
      }
    }
  }
  r.info.push(`${count} hooks`); return r;
}

export function validateConsistency(root: string): VR {
  const r = vr();
  const hooksJson = path.join(root, "hooks", "hooks.json");
  const agentsDir = path.join(root, "agents");

  const hookR = validateHooks(hooksJson, root);
  r.errors.push(...hookR.errors);
  r.warnings.push(...hookR.warnings);
  r.info.push(...hookR.info);

  const { results: agentR } = validateAgents(agentsDir);
  for (const [file, result] of Object.entries(agentR)) {
    for (const e of result.errors) r.errors.push(`agents/${file}: ${e}`);
    for (const w of result.warnings) r.warnings.push(`agents/${file}: ${w}`);
  }

  return r;
}

function validatePluginJson(pluginJson: string): VR {
  const r = vr();
  if (!fs.existsSync(pluginJson)) { r.errors.push("Missing plugin.json"); return r; }
  let data: Record<string, unknown>;
  try { data = JSON.parse(fs.readFileSync(pluginJson, "utf-8")); } catch { r.errors.push("Invalid JSON"); return r; }
  for (const f of ["name", "version", "description"]) if (!data[f]) r.errors.push(`Missing: ${f}`);
  const v = typeof data.version === "string" ? data.version : undefined;
  if (v && !/^\d+\.\d+\.\d+$/.test(v)) r.warnings.push(`Version '${v}' not semver`);
  r.info.push(`v${v ?? "unknown"}`); return r;
}

function print(r: VR, indent = 4) {
  const p = " ".repeat(indent);
  for (const e of r.errors) console.log(`${p}${C.RED}✗ ERROR:${C.RESET} ${e}`);
  for (const w of r.warnings) console.log(`${p}${C.YELLOW}⚠ WARN:${C.RESET}  ${w}`);
  for (const i of r.info) console.log(`${p}${C.DIM}ℹ ${i}${C.RESET}`);
}

const isMain = import.meta.url === `file://${process.argv[1]}`
  || process.argv[1]?.endsWith("validate-plugin.ts");

if (isMain) {
  const ROOT = path.resolve(import.meta.dirname, "..");
  const SKILLS_DIR = path.join(ROOT, "skills");
  const AGENTS_DIR = path.join(ROOT, "agents");
  const PLUGIN_JSON = path.join(ROOT, ".claude-plugin", "plugin.json");
  const HOOKS_JSON = path.join(ROOT, "hooks", "hooks.json");

  const pluginR = validatePluginJson(PLUGIN_JSON);
  const { results: skillR, count: sc } = validateSkills(SKILLS_DIR);
  const { results: agentR, count: ac } = validateAgents(AGENTS_DIR);
  const hookR = validateHooks(HOOKS_JSON, ROOT);

  let te = pluginR.errors.length + hookR.errors.length;
  let tw = pluginR.warnings.length + hookR.warnings.length;
  for (const v of Object.values(skillR)) { te += v.errors.length; tw += v.warnings.length; }
  for (const v of Object.values(agentR)) { te += v.errors.length; tw += v.warnings.length; }

  console.log(`\n${C.BOLD}${"=".repeat(60)}\n VibeSpec Plugin Validator\n${"=".repeat(60)}${C.RESET}\n`);
  const status = te === 0 ? `${C.GREEN}✓ PASS${C.RESET}` : `${C.RED}✗ FAIL${C.RESET}`;
  console.log(`${C.BOLD}${C.CYAN}┌─ Plugin: vs${C.RESET}  [${sc} skills, ${ac} agents]  ${status}${tw > 0 ? ` ${C.YELLOW}(${tw} warnings)${C.RESET}` : ""}`);

  if (pluginR.errors.length || pluginR.warnings.length) { console.log(`  ${C.BOLD}Manifest:${C.RESET}`); print(pluginR); }
  const si = Object.entries(skillR).filter(([,v]) => v.errors.length || v.warnings.length);
  if (si.length) { console.log(`  ${C.BOLD}Skills with issues:${C.RESET}`); for (const [n,v] of si) { console.log(`    ${n}:`); print(v, 6); } }
  const ai = Object.entries(agentR).filter(([,v]) => v.errors.length || v.warnings.length);
  if (ai.length) { console.log(`  ${C.BOLD}Agents with issues:${C.RESET}`); for (const [n,v] of ai) { console.log(`    ${n}:`); print(v, 6); } }
  if (hookR.errors.length || hookR.warnings.length) { console.log(`  ${C.BOLD}Hooks:${C.RESET}`); print(hookR); }

  console.log(`${C.CYAN}└${"─".repeat(59)}${C.RESET}\n`);
  console.log(`${C.BOLD}${"=".repeat(60)}\n Summary\n${"=".repeat(60)}${C.RESET}`);
  console.log(`  Skills:  ${sc}\n  Agents:  ${ac}`);
  const hi = hookR.info.find(i => i.includes("hooks")); if (hi) console.log(`  Hooks:   ${hi}`);
  console.log();
  console.log(te === 0 ? `  ${C.GREEN}${C.BOLD}✓ ALL CHECKS PASSED${C.RESET} (${tw} warnings)` : `  ${C.RED}${C.BOLD}✗ ${te} ERRORS${C.RESET}, ${tw} warnings`);
  console.log();
  process.exit(te > 0 ? 1 : 0);
}
