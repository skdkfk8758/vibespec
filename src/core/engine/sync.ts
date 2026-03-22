import * as path from 'node:path';
import type { ObsidianAdapter } from '../adapter/obsidian.js';
import { ErrorKBEngine, parseFrontmatter, serializeFrontmatter } from './error-kb.js';
import type { ErrorEntry } from '../types.js';

export interface SyncOptions {
  import?: boolean;
  dryRun?: boolean;
}

export interface SyncResult {
  created_in_vault: number;
  created_in_local: number;
  updated_in_vault: number;
  updated_in_local: number;
  conflicts: Array<{ id: string; resolution: 'local_wins' | 'vault_wins' }>;
  skipped_vault_only: string[];
  errors: string[];
}

export class SyncEngine {
  constructor(
    private kb: ErrorKBEngine,
    private obsidian: ObsidianAdapter,
  ) {}

  async fullSync(opts?: SyncOptions): Promise<SyncResult> {
    const result: SyncResult = {
      created_in_vault: 0,
      created_in_local: 0,
      updated_in_vault: 0,
      updated_in_local: 0,
      conflicts: [],
      skipped_vault_only: [],
      errors: [],
    };

    try {
      // 1. Collect local entries
      const localFiles = this.kb.listErrorFiles();
      const localEntries = new Map<string, ErrorEntry>();
      for (const file of localFiles) {
        const id = path.basename(file, '.md');
        const entry = this.kb.show(id);
        if (entry) localEntries.set(id, entry);
      }

      // 2. Collect vault notes
      const vaultPaths = await this.obsidian.listNotes();
      const vaultIds = new Set<string>();
      for (const vp of vaultPaths) {
        const id = path.basename(vp, '.md');
        vaultIds.add(id);
      }

      // 3. Local-only → create in vault
      for (const [id, entry] of localEntries) {
        if (!vaultIds.has(id)) {
          if (!opts?.dryRun) {
            try {
              const content = this.entryToContent(entry);
              await this.obsidian.createNote(id, content);
            } catch (e) {
              result.errors.push(`Failed to create vault note ${id}: ${e}`);
              continue;
            }
          }
          result.created_in_vault++;
        }
      }

      // 4. Vault-only → import to local or skip
      for (const vid of vaultIds) {
        if (!localEntries.has(vid)) {
          if (opts?.import) {
            if (!opts?.dryRun) {
              try {
                const content = await this.obsidian.readNote(vid);
                if (content) {
                  const { meta, body } = parseFrontmatter(content);
                  // Import by creating the entry via direct file write
                  const entry = this.kb.toErrorEntry(vid, meta, body);
                  this.kb.add({
                    title: entry.title,
                    severity: entry.severity,
                    tags: entry.tags,
                    cause: this.extractSection(body, 'Cause'),
                    solution: this.extractSection(body, 'Solution'),
                  });
                }
              } catch (e) {
                result.errors.push(`Failed to import vault note ${vid}: ${e}`);
                continue;
              }
            }
            result.created_in_local++;
          } else {
            result.skipped_vault_only.push(vid);
          }
        }
      }

      // 5. Both exist → compare by last_seen timestamp (LWW)
      for (const [id, localEntry] of localEntries) {
        if (!vaultIds.has(id)) continue;

        try {
          const vaultContent = await this.obsidian.readNote(id);
          if (!vaultContent) continue;

          const { meta: vaultMeta } = parseFrontmatter(vaultContent);
          const localTime = new Date(localEntry.last_seen).getTime();
          const vaultTime = new Date(vaultMeta.last_seen).getTime();

          if (isNaN(localTime) || isNaN(vaultTime)) continue;

          if (localTime > vaultTime) {
            // Local is newer → update vault
            if (!opts?.dryRun) {
              const content = this.entryToContent(localEntry);
              await this.obsidian.updateNote(id, content);
            }
            result.updated_in_vault++;
            result.conflicts.push({ id, resolution: 'local_wins' });
          } else if (vaultTime > localTime) {
            // Vault is newer → update local
            if (!opts?.dryRun) {
              const { meta: vm } = parseFrontmatter(vaultContent);
              this.kb.update(id, {
                severity: vm.severity,
                status: vm.status,
                occurrences: vm.occurrences,
                last_seen: vm.last_seen,
                tags: vm.tags,
              });
            }
            result.updated_in_local++;
            result.conflicts.push({ id, resolution: 'vault_wins' });
          }
          // Equal timestamps → no action needed
        } catch (e) {
          result.errors.push(`Failed to sync ${id}: ${e}`);
        }
      }
    } catch (e) {
      result.errors.push(`Sync failed: ${e}`);
    }

    return result;
  }

  private entryToContent(entry: ErrorEntry): string {
    const meta = {
      title: entry.title,
      severity: entry.severity,
      tags: entry.tags,
      status: entry.status,
      occurrences: entry.occurrences,
      first_seen: entry.first_seen,
      last_seen: entry.last_seen,
    };
    return serializeFrontmatter(meta) + '\n' + entry.content;
  }

  private extractSection(body: string, section: string): string | undefined {
    const regex = new RegExp(`## ${section}\\s*\\n\\n([\\s\\S]*?)(?=\\n## |$)`);
    const match = body.match(regex);
    return match?.[1]?.trim() || undefined;
  }
}
