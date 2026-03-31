import * as fs from 'node:fs';
import * as path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';

const PENDING_DIR = '.claude/self-improve/pending';
const PROCESSED_DIR = '.claude/self-improve/processed';
const RULES_DIR = '.claude/rules';
const MAX_PER_RUN = 5;
const MAX_RETRIES = 3;

const SYSTEM_PROMPT = `You are analyzing a git diff from a fix commit. Extract the repeatable mistake pattern. Output JSON: { title: string, pattern: string (NEVER DO description), applies_when: string (glob pattern for files), category: string (one of LOGIC_ERROR, TYPE_ERROR, API_MISUSE, MISSING_EDGE, PATTERN_VIOLATION, CONFIG_ERROR, TEST_GAP) }`;

interface PendingData {
  type: string;
  commit_hash: string;
  commit_message: string;
  diff_summary: string;
  diff_content: string;
  task_id: string;
  timestamp: string;
  retry_count?: number;
}

interface ApiAnalysis {
  title: string;
  pattern: string;
  applies_when: string;
  category: string;
}

interface RuleResult {
  ruleFile: string;
  title: string;
}

interface ProcessResult {
  processed: number;
  failed: number;
  rules: RuleResult[];
  skipped?: boolean;
}

interface ProcessOptions {
  projectRoot: string;
  requireApiKey?: boolean;
}

function generateRuleId(): string {
  return `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildRuleContent(analysis: ApiAnalysis, commitMessage: string, ruleId: string): string {
  const now = new Date().toISOString();
  return `---
Applies When: ${analysis.applies_when}
Enforcement: SOFT
Created: ${now}
Rule-ID: ${ruleId}
---
NEVER DO: ${analysis.pattern}
WHY: fix 커밋에서 자동 추출 — ${commitMessage}
`;
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

export async function processAutoRuleGen(options: ProcessOptions): Promise<ProcessResult> {
  const { projectRoot, requireApiKey = false } = options;

  // AC06: Check API key
  if (requireApiKey && !process.env.ANTHROPIC_API_KEY) {
    process.stderr.write('Warning: ANTHROPIC_API_KEY is not set. Skipping auto-rule-gen.\n');
    return { processed: 0, failed: 0, rules: [], skipped: true };
  }

  const pendingDir = path.join(projectRoot, PENDING_DIR);
  const processedDir = path.join(projectRoot, PROCESSED_DIR);
  const rulesDir = path.join(projectRoot, RULES_DIR);

  // Ensure directories exist
  fs.mkdirSync(pendingDir, { recursive: true });
  fs.mkdirSync(processedDir, { recursive: true });
  fs.mkdirSync(rulesDir, { recursive: true });

  // List pending JSON files
  const pendingFiles = fs.readdirSync(pendingDir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .slice(0, MAX_PER_RUN);

  const client = new Anthropic();
  const result: ProcessResult = { processed: 0, failed: 0, rules: [] };

  for (const filename of pendingFiles) {
    const pendingPath = path.join(pendingDir, filename);
    const data: PendingData = JSON.parse(fs.readFileSync(pendingPath, 'utf-8'));

    try {
      // Call Haiku API
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: data.diff_content },
        ],
      });

      // Parse API response
      const textBlock = response.content.find((b: { type: string }) => b.type === 'text') as { type: 'text'; text: string } | undefined;
      if (!textBlock) {
        throw new Error('No text block in API response');
      }

      const analysis: ApiAnalysis = JSON.parse(textBlock.text);

      // Generate rule
      const ruleId = generateRuleId();
      const ruleContent = buildRuleContent(analysis, data.commit_message, ruleId);
      const slug = slugify(analysis.title);
      const category = analysis.category.toLowerCase();
      const ruleFilename = `${category}-${slug}.md`;
      const ruleFilePath = path.join(rulesDir, ruleFilename);

      fs.writeFileSync(ruleFilePath, ruleContent, 'utf-8');

      // Move pending to processed (AC03)
      const destPath = path.join(processedDir, filename);
      fs.renameSync(pendingPath, destPath);

      result.processed++;
      result.rules.push({ ruleFile: ruleFilename, title: analysis.title });
    } catch {
      // AC04 & AC05: Handle API failure
      const retryCount = (data.retry_count ?? 0) + 1;

      if (retryCount > MAX_RETRIES) {
        // AC05: rename to .failed
        const failedPath = path.join(pendingDir, `${filename}.failed`);
        fs.renameSync(pendingPath, failedPath);
      } else {
        // AC04: increment retry_count
        data.retry_count = retryCount;
        fs.writeFileSync(pendingPath, JSON.stringify(data), 'utf-8');
      }

      result.failed++;
    }
  }

  return result;
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const projectRoot = process.cwd();
  processAutoRuleGen({ projectRoot, requireApiKey: true })
    .then((result) => {
      if (result.skipped) {
        process.exit(0);
      }
      console.log(`Processed: ${result.processed}, Failed: ${result.failed}`);
      for (const rule of result.rules) {
        console.log(`  Created: ${rule.ruleFile} — ${rule.title}`);
      }
    })
    .catch((err) => {
      console.error('auto-rule-gen failed:', err);
      process.exit(1);
    });
}
