#!/usr/bin/env npx tsx
import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SKILLS_DIR = path.join(ROOT, "skills");
const AGENTS_DIR = path.join(ROOT, "agents");
const PLUGIN_JSON = path.join(ROOT, ".claude-plugin", "plugin.json");
const HOOKS_JSON = path.join(ROOT, "hooks", "hooks.json");

const C = { RED: "\x1b[91m", GREEN: "\x1b[92m", YELLOW: "\x1b[93m", CYAN: "\x1b[96m", BOLD: "\x1b[1m", DIM: "\x1b[2m", RESET: "\x1b[0m" };

interface Frontmatter { [key: string]: string }
interface VR { errors: string[]; warnings: string[]; info: string[] }

function parseFM(content: string): Frontmatter | null {
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

function vr(): VR { return { errors: [], warnings: [], info: [] } }

function validateSkills(): { results: Record<string, VR>; count: number } {
  const results: Record<string, VR> = {};
  if (!fs.existsSync(SKILLS_DIR)) return { results, count: 0 };
  const dirs = fs.readdirSync(SKILLS_DIR).filter(d => fs.statSync(path.join(SKILLS_DIR, d)).isDirectory());
  for (const dir of dirs) {
    const r = vr();
    const p = path.join(SKILLS_DIR, dir, "SKILL.md");
    if (!fs.existsSync(p)) { r.errors.push("Missing SKILL.md"); results[dir] = r; continue; }
    const content = fs.readFileSync(p, "utf-8");
    const fm = parseFM(content);
    if (!fm) { r.errors.push("Missing YAML frontmatter (must start with ---)"); results[dir] = r; continue; }
    for (const f of ["name", "description"]) if (!fm[f]) r.errors.push(`Missing required field: ${f}`);
    if (fm.name && fm.name !== dir) r.errors.push(`Name mismatch: '${fm.name}' vs dir '${dir}'`);
    if (fm.description && fm.description.length < 20) r.warnings.push(`Description very short (${fm.description.length} chars)`);
    r.info.push(`${content.split(/\s+/).length} words`);
    if (fm.type) r.info.push(`type: ${fm.type}`);
    results[dir] = r;
  }
  return { results, count: dirs.length };
}

function validateAgents(): { results: Record<string, VR>; count: number } {
  const results: Record<string, VR> = {};
  if (!fs.existsSync(AGENTS_DIR)) return { results, count: 0 };
  const files = fs.readdirSync(AGENTS_DIR).filter(f => f.endsWith(".md"));
  for (const file of files) {
    const r = vr();
    const fm = parseFM(fs.readFileSync(path.join(AGENTS_DIR, file), "utf-8"));
    if (!fm) { r.errors.push("Missing YAML frontmatter"); results[file] = r; continue; }
    for (const f of ["name", "description"]) if (!fm[f]) r.errors.push(`Missing required field: ${f}`);
    results[file] = r;
  }
  return { results, count: files.length };
}

function validateHooks(): VR {
  const r = vr();
  if (!fs.existsSync(HOOKS_JSON)) { r.warnings.push("Missing hooks/hooks.json"); return r; }
  let config: { hooks?: Record<string, Array<{ command: string }>> };
  try { config = JSON.parse(fs.readFileSync(HOOKS_JSON, "utf-8")); } catch { r.errors.push("Invalid JSON"); return r; }
  let count = 0;
  for (const [evt, list] of Object.entries(config.hooks || {})) {
    if (!Array.isArray(list)) continue;
    for (const h of list) {
      count++;
      const m = h.command?.match(/hooks\/[\w.-]+\.sh/);
      if (m && !fs.existsSync(path.join(ROOT, m[0]))) r.errors.push(`Script not found: ${m[0]} (${evt})`);
    }
  }
  r.info.push(`${count} hooks`); return r;
}

function validatePlugin(): VR {
  const r = vr();
  if (!fs.existsSync(PLUGIN_JSON)) { r.errors.push("Missing plugin.json"); return r; }
  let data: Record<string, unknown>;
  try { data = JSON.parse(fs.readFileSync(PLUGIN_JSON, "utf-8")); } catch { r.errors.push("Invalid JSON"); return r; }
  for (const f of ["name", "version", "description"]) if (!data[f]) r.errors.push(`Missing: ${f}`);
  const v = data.version as string;
  if (v && !/^\d+\.\d+\.\d+$/.test(v)) r.warnings.push(`Version '${v}' not semver`);
  r.info.push(`v${v || "unknown"}`); return r;
}

function print(r: VR, indent = 4) {
  const p = " ".repeat(indent);
  for (const e of r.errors) console.log(`${p}${C.RED}✗ ERROR:${C.RESET} ${e}`);
  for (const w of r.warnings) console.log(`${p}${C.YELLOW}⚠ WARN:${C.RESET}  ${w}`);
  for (const i of r.info) console.log(`${p}${C.DIM}ℹ ${i}${C.RESET}`);
}

const pluginR = validatePlugin();
const { results: skillR, count: sc } = validateSkills();
const { results: agentR, count: ac } = validateAgents();
const hookR = validateHooks();

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
