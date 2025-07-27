import { DiffService } from '../../../src/services/diff.service';

// Mocking chalk to test color output
jest.mock('chalk', () => ({
  supportsColor: { level: 1 },
  green: (str: string) => `[green]${str}[/green]`,
  red: (str: string) => `[red]${str}[/red]`,
  yellow: (str: string) => `[yellow]${str}[/yellow]`,
  cyan: (str: string) => `[cyan]${str}[/cyan]`
}));

describe('DiffService - Format with colors', () => {
  let diffService: DiffService;
  let originalIsTTY: boolean | undefined;

  beforeEach(() => {
    diffService = new DiffService();
    // Mock process.stdout.isTTY to enable colors
    originalIsTTY = process.stdout.isTTY;
    process.stdout.isTTY = true;
  });
  
  afterEach(() => {
    // Restore original value
    process.stdout.isTTY = originalIsTTY;
  });

  it('should apply colors to inline diff when colorize is true', () => {
    const diff = {
      added: { NEW_KEY: 'value' },
      modified: { CHANGED: { old: 'old', new: 'new' } },
      removed: { GONE: 'removed' },
      localOnly: { LOCAL_KEY: 'local' }
    };

    const result = diffService.formatDiff(diff, {
      format: 'inline',
      colorize: true
    });

    expect(result).toContain('[green]+ NEW_KEY=value[/green]');
    expect(result).toContain('[yellow]~ CHANGED[/yellow]');
    expect(result).toContain('[red]  - old[/red]');
    expect(result).toContain('[green]  + new[/green]');
    expect(result).toContain('[red]- GONE=removed[/red]');
    expect(result).toContain('[cyan]! LOCAL_KEY=local[/cyan]');
  });

  it('should handle special characters in values', () => {
    const diff = {
      added: {
        'SPECIAL_CHARS': 'value with spaces',
        'HASH_VALUE': 'contains#hash',
        'EQUALS_VALUE': 'has=equals'
      },
      modified: {},
      removed: {},
      localOnly: {}
    };

    const result = diffService.formatDiff(diff, {
      format: 'inline',
      colorize: false
    });

    expect(result).toContain('+ SPECIAL_CHARS=value with spaces');
    expect(result).toContain('+ HASH_VALUE=contains#hash');
    expect(result).toContain('+ EQUALS_VALUE=has=equals');
  });

  it('should handle large diffs', () => {
    const added: Record<string, string> = {};
    const removed: Record<string, string> = {};
    
    // Create 100 additions and 100 removals
    for (let i = 0; i < 100; i++) {
      added[`NEW_KEY_${i}`] = `value_${i}`;
      removed[`OLD_KEY_${i}`] = `old_value_${i}`;
    }

    const diff = {
      added,
      modified: {},
      removed,
      localOnly: {}
    };

    const result = diffService.formatDiff(diff, {
      format: 'summary',
      colorize: false
    });

    expect(result).toBe('Added: 100, Removed: 100');
  });

  it('should format side-by-side with proper column alignment', () => {
    const diff = {
      added: { 'VERY_LONG_KEY_NAME_THAT_SHOULD_BE_ALIGNED': 'short' },
      modified: { 'K': { old: 'very-long-old-value-that-needs-space', new: 'n' } },
      removed: {},
      localOnly: {}
    };

    const result = diffService.formatDiff(diff, {
      format: 'side-by-side',
      colorize: false
    });

    const lines = result.split('\n');
    const headerLine = lines[0];
    const separatorLine = lines[1];
    
    // Check that all pipes align
    const pipesInHeader = [...headerLine.matchAll(/\|/g)].map(m => m.index!);
    const pipesInSeparator = [...separatorLine.matchAll(/\|/g)].map(m => m.index!);
    
    expect(pipesInHeader).toEqual(pipesInSeparator);
    
    // Check that content doesn't overflow
    lines.slice(2).forEach(line => {
      if (line) {
        const parts = line.split(' | ');
        expect(parts).toHaveLength(4);
      }
    });
  });
});