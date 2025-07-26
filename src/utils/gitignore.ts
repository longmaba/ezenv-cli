import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

export class GitignoreManager {
  private gitignorePath: string;

  constructor(baseDir: string = process.cwd()) {
    this.gitignorePath = resolve(baseDir, '.gitignore');
  }

  exists(): boolean {
    return existsSync(this.gitignorePath);
  }

  hasEntry(pattern: string): boolean {
    if (!this.exists()) {
      return false;
    }

    try {
      const content = readFileSync(this.gitignorePath, 'utf-8');
      const lines = content.split('\n');
      
      // Check for exact match or common variations
      return lines.some(line => {
        const trimmed = line.trim();
        if (trimmed === pattern) return true;
        
        // For .env, also check common patterns
        if (pattern === '.env') {
          return trimmed === '*.env' || 
                 trimmed === '.env*' ||
                 trimmed === '.env.*';
        }
        
        return false;
      });
    } catch {
      return false;
    }
  }

  addEntry(pattern: string, comment?: string): boolean {
    if (!this.exists()) {
      return false;
    }

    if (this.hasEntry(pattern)) {
      return true; // Already exists
    }

    try {
      const content = readFileSync(this.gitignorePath, 'utf-8');
      const newEntry = comment ? `\n# ${comment}\n${pattern}\n` : `\n${pattern}\n`;
      const newContent = content.trimEnd() + newEntry;
      
      writeFileSync(this.gitignorePath, newContent, 'utf-8');
      return true;
    } catch {
      return false;
    }
  }

  create(patterns: string[], comment?: string): void {
    const header = comment ? `# ${comment}\n` : '';
    const content = header + patterns.join('\n') + '\n';
    writeFileSync(this.gitignorePath, content, 'utf-8');
  }
}