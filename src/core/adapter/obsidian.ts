import type { ObsidianSearchResult, TagInfo } from '../types.js';

let obsidianTs: typeof import('obsidian-ts') | null = null;

async function getObsidianTs() {
  if (!obsidianTs) {
    try {
      obsidianTs = await import('obsidian-ts');
    } catch {
      return null;
    }
  }
  return obsidianTs;
}

export class ObsidianAdapter {
  private vault: string;
  private folder: string;

  constructor(vault: string, folder = 'VibeSpec/Errors') {
    this.vault = vault;
    this.folder = folder;
  }

  static async isAvailable(_vault?: string): Promise<boolean> {
    const obs = await getObsidianTs();
    if (!obs) return false;
    try {
      return await obs.isCompatible();
    } catch {
      return false;
    }
  }

  private notePath(id: string): string {
    return `${this.folder}/${id}.md`;
  }

  async createNote(id: string, content: string): Promise<void> {
    const obs = await getObsidianTs();
    if (!obs) return;
    try {
      await obs.file.create({
        vault: this.vault,
        path: this.notePath(id),
        content,
        overwrite: false,
      });
    } catch {
      // silently ignore
    }
  }

  async readNote(id: string): Promise<string | null> {
    const obs = await getObsidianTs();
    if (!obs) return null;
    try {
      return await obs.file.read({ vault: this.vault, path: this.notePath(id) });
    } catch {
      return null;
    }
  }

  async updateNote(id: string, content: string): Promise<void> {
    const obs = await getObsidianTs();
    if (!obs) return;
    try {
      await obs.file.create({
        vault: this.vault,
        path: this.notePath(id),
        content,
        overwrite: true,
      });
    } catch {
      // silently ignore
    }
  }

  async deleteNote(id: string): Promise<void> {
    const obs = await getObsidianTs();
    if (!obs) return;
    try {
      await obs.file.delete({ vault: this.vault, path: this.notePath(id) });
    } catch {
      // silently ignore
    }
  }

  async search(query: string): Promise<ObsidianSearchResult[]> {
    const obs = await getObsidianTs();
    if (!obs) return [];
    try {
      const results = await obs.search.context({
        vault: this.vault,
        query,
        path: this.folder,
      });
      return results.map(r => ({
        file: r.file,
        matches: r.matches.map(m => m.text),
        score: r.matches.length,
      }));
    } catch {
      return [];
    }
  }

  async setProperty(file: string, name: string, value: string): Promise<void> {
    const obs = await getObsidianTs();
    if (!obs) return;
    try {
      await obs.property.set({
        vault: this.vault,
        path: file,
        name,
        value,
      });
    } catch {
      // silently ignore
    }
  }

  async getTags(): Promise<TagInfo[]> {
    const obs = await getObsidianTs();
    if (!obs) return [];
    try {
      const tags = await obs.tag.list({ vault: this.vault });
      return tags.map(t => ({
        tag: t.tag,
        count: t.count ?? 0,
      }));
    } catch {
      return [];
    }
  }

  async listNotes(): Promise<string[]> {
    const obs = await getObsidianTs();
    if (!obs) return [];
    try {
      return await obs.file.list({
        vault: this.vault,
        folder: this.folder,
        ext: 'md',
      });
    } catch {
      return [];
    }
  }
}
