import chalk from 'chalk';
import { DiffResult, DiffOptions } from '../types';

export class DiffService {
  compareSecrets(
    local: Record<string, string>,
    remote: Record<string, string>
  ): DiffResult {
    const added: Record<string, string> = {};
    const modified: Record<string, { old: string; new: string }> = {};
    const removed: Record<string, string> = {};
    const localOnly: Record<string, string> = {};

    // Find added and modified
    for (const [key, value] of Object.entries(remote)) {
      if (!(key in local)) {
        added[key] = value;
      } else if (local[key] !== value) {
        modified[key] = { old: local[key], new: value };
      }
    }

    // Find removed and local-only
    for (const [key, value] of Object.entries(local)) {
      if (!(key in remote)) {
        if (key.startsWith('LOCAL_') || key.endsWith('_LOCAL')) {
          localOnly[key] = value;
        } else {
          removed[key] = value;
        }
      }
    }

    return { added, modified, removed, localOnly };
  }

  formatDiff(diff: DiffResult, options: DiffOptions): string {
    const hasChanges = 
      Object.keys(diff.added).length > 0 ||
      Object.keys(diff.modified).length > 0 ||
      Object.keys(diff.removed).length > 0 ||
      Object.keys(diff.localOnly).length > 0;

    if (!hasChanges) {
      return '';
    }

    switch (options.format) {
      case 'inline':
        return this.formatInline(diff, options);
      case 'side-by-side':
        return this.formatSideBySide(diff, options);
      case 'summary':
        return this.formatSummary(diff, options);
      default:
        return this.formatInline(diff, options);
    }
  }

  private formatInline(diff: DiffResult, options: DiffOptions): string {
    const lines: string[] = [];
    const color = options.colorize && process.stdout.isTTY;

    // Added
    for (const [key, value] of Object.entries(diff.added)) {
      const line = `+ ${key}=${value}`;
      lines.push(color ? chalk.green(line) : line);
    }

    // Modified
    for (const [key, { old, new: newValue }] of Object.entries(diff.modified)) {
      const header = `~ ${key}`;
      const oldLine = `  - ${old}`;
      const newLine = `  + ${newValue}`;
      
      if (color) {
        lines.push(chalk.yellow(header));
        lines.push(chalk.red(oldLine));
        lines.push(chalk.green(newLine));
      } else {
        lines.push(header);
        lines.push(oldLine);
        lines.push(newLine);
      }
    }

    // Removed
    for (const [key, value] of Object.entries(diff.removed)) {
      const line = `- ${key}=${value}`;
      lines.push(color ? chalk.red(line) : line);
    }

    // Local only
    for (const [key, value] of Object.entries(diff.localOnly)) {
      const line = `! ${key}=${value}`;
      lines.push(color ? chalk.cyan(line) : line);
    }

    return lines.join('\n');
  }

  private formatSideBySide(diff: DiffResult, options: DiffOptions): string {
    const color = options.colorize && process.stdout.isTTY;
    const rows: Array<[string, string, string, string]> = [];

    // Collect all rows
    for (const [key, value] of Object.entries(diff.added)) {
      rows.push([key, '-', value, 'Added']);
    }

    for (const [key, { old, new: newValue }] of Object.entries(diff.modified)) {
      rows.push([key, old, newValue, 'Modified']);
    }

    for (const [key, value] of Object.entries(diff.removed)) {
      rows.push([key, value, '-', 'Removed']);
    }

    for (const [key, value] of Object.entries(diff.localOnly)) {
      rows.push([key, value, '-', 'Local Only']);
    }

    // Calculate column widths
    const keyWidth = Math.max(10, ...rows.map(r => r[0].length));
    const localWidth = Math.max(12, ...rows.map(r => r[1].length));
    const remoteWidth = Math.max(12, ...rows.map(r => r[2].length));

    // Format header
    const header = [
      'KEY'.padEnd(keyWidth),
      'LOCAL'.padEnd(localWidth),
      'REMOTE'.padEnd(remoteWidth),
      'STATUS'
    ].join(' | ');

    const separator = [
      '-'.repeat(keyWidth),
      '-'.repeat(localWidth),
      '-'.repeat(remoteWidth),
      '-'.repeat(11)
    ].join('-|-');

    const lines = [header, separator];

    // Format rows
    for (const [key, local, remote, status] of rows) {
      const row = [
        key.padEnd(keyWidth),
        local.padEnd(localWidth),
        remote.padEnd(remoteWidth),
        status
      ].join(' | ');

      if (color) {
        switch (status) {
          case 'Added':
            lines.push(chalk.green(row));
            break;
          case 'Modified':
            lines.push(chalk.yellow(row));
            break;
          case 'Removed':
            lines.push(chalk.red(row));
            break;
          case 'Local Only':
            lines.push(chalk.cyan(row));
            break;
          default:
            lines.push(row);
        }
      } else {
        lines.push(row);
      }
    }

    return lines.join('\n');
  }

  private formatSummary(diff: DiffResult, options: DiffOptions): string {
    const counts = {
      added: Object.keys(diff.added).length,
      modified: Object.keys(diff.modified).length,
      removed: Object.keys(diff.removed).length,
      localOnly: Object.keys(diff.localOnly).length
    };

    const parts: string[] = [];
    const color = options.colorize && process.stdout.isTTY;

    if (counts.added > 0) {
      const text = `Added: ${counts.added}`;
      parts.push(color ? chalk.green(text) : text);
    }

    if (counts.modified > 0) {
      const text = `Modified: ${counts.modified}`;
      parts.push(color ? chalk.yellow(text) : text);
    }

    if (counts.removed > 0) {
      const text = `Removed: ${counts.removed}`;
      parts.push(color ? chalk.red(text) : text);
    }

    if (counts.localOnly > 0) {
      const text = `Local Only: ${counts.localOnly}`;
      parts.push(color ? chalk.cyan(text) : text);
    }

    return parts.join(', ');
  }

  async applyDiff(
    filePath: string,
    diff: DiffResult,
    fileService: {
      readEnvFile: (path: string) => Promise<Record<string, string>>;
      writeEnvFile: (path: string, data: Record<string, string>) => Promise<void>;
    }
  ): Promise<void> {
    const current = await fileService.readEnvFile(filePath);
    const updated: Record<string, string> = {};

    // Start with remote values (added + modified)
    for (const [key, value] of Object.entries(diff.added)) {
      updated[key] = value;
    }

    for (const [key, { new: newValue }] of Object.entries(diff.modified)) {
      updated[key] = newValue;
    }

    // Add unchanged values
    for (const [key, value] of Object.entries(current)) {
      if (!(key in diff.removed) && !(key in diff.modified)) {
        updated[key] = value;
      }
    }

    // Preserve local-only variables
    for (const [key, value] of Object.entries(diff.localOnly)) {
      updated[key] = value;
    }

    await fileService.writeEnvFile(filePath, updated);
  }
}