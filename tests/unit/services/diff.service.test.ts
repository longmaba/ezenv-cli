import { DiffService } from '../../../src/services/diff.service';
import { DiffResult, DiffOptions } from '../../../src/types';

describe('DiffService', () => {
  let diffService: DiffService;

  beforeEach(() => {
    diffService = new DiffService();
  });

  describe('compareSecrets', () => {
    it('should identify added secrets', () => {
      const local = { KEY1: 'value1' };
      const remote = { KEY1: 'value1', KEY2: 'value2' };

      const result = diffService.compareSecrets(local, remote);

      expect(result.added).toEqual({ KEY2: 'value2' });
      expect(result.modified).toEqual({});
      expect(result.removed).toEqual({});
      expect(result.localOnly).toEqual({});
    });

    it('should identify modified secrets', () => {
      const local = { KEY1: 'old-value' };
      const remote = { KEY1: 'new-value' };

      const result = diffService.compareSecrets(local, remote);

      expect(result.added).toEqual({});
      expect(result.modified).toEqual({
        KEY1: { old: 'old-value', new: 'new-value' }
      });
      expect(result.removed).toEqual({});
      expect(result.localOnly).toEqual({});
    });

    it('should identify removed secrets', () => {
      const local = { KEY1: 'value1', KEY2: 'value2' };
      const remote = { KEY1: 'value1' };

      const result = diffService.compareSecrets(local, remote);

      expect(result.added).toEqual({});
      expect(result.modified).toEqual({});
      expect(result.removed).toEqual({ KEY2: 'value2' });
      expect(result.localOnly).toEqual({});
    });

    it('should identify local-only secrets', () => {
      const local = { KEY1: 'value1', LOCAL_KEY: 'local-value' };
      const remote = { KEY1: 'value1' };

      const result = diffService.compareSecrets(local, remote);

      expect(result.added).toEqual({});
      expect(result.modified).toEqual({});
      expect(result.removed).toEqual({});
      expect(result.localOnly).toEqual({ LOCAL_KEY: 'local-value' });
    });

    it('should handle mixed changes', () => {
      const local = {
        UNCHANGED: 'same',
        MODIFIED: 'old',
        REMOVED: 'gone',
        LOCAL_VAR: 'local'
      };
      const remote = {
        UNCHANGED: 'same',
        MODIFIED: 'new',
        ADDED: 'new-value'
      };

      const result = diffService.compareSecrets(local, remote);

      expect(result.added).toEqual({ ADDED: 'new-value' });
      expect(result.modified).toEqual({
        MODIFIED: { old: 'old', new: 'new' }
      });
      expect(result.removed).toEqual({ REMOVED: 'gone' });
      expect(result.localOnly).toEqual({ LOCAL_VAR: 'local' });
    });

    it('should handle empty states', () => {
      expect(diffService.compareSecrets({}, {})).toEqual({
        added: {},
        modified: {},
        removed: {},
        localOnly: {}
      });

      const result1 = diffService.compareSecrets({}, { KEY: 'value' });
      expect(result1.added).toEqual({ KEY: 'value' });

      const result2 = diffService.compareSecrets({ KEY: 'value' }, {});
      expect(result2.removed).toEqual({ KEY: 'value' });
    });
  });

  describe('formatDiff', () => {
    const sampleDiff: DiffResult = {
      added: { API_KEY: 'new-value' },
      modified: { DATABASE_URL: { old: 'old-value', new: 'new-value' } },
      removed: { OLD_KEY: 'old-value' },
      localOnly: { LOCAL_VAR: 'local' }
    };

    it('should return empty string for no changes', () => {
      const emptyDiff: DiffResult = {
        added: {},
        modified: {},
        removed: {},
        localOnly: {}
      };

      const result = diffService.formatDiff(emptyDiff, {
        format: 'inline',
        colorize: false
      });

      expect(result).toBe('');
    });

    it('should format inline diff', () => {
      const result = diffService.formatDiff(sampleDiff, {
        format: 'inline',
        colorize: false
      });

      expect(result).toContain('+ API_KEY=new-value');
      expect(result).toContain('~ DATABASE_URL');
      expect(result).toContain('  - old-value');
      expect(result).toContain('  + new-value');
      expect(result).toContain('- OLD_KEY=old-value');
      expect(result).toContain('! LOCAL_VAR=local');
    });

    it('should format side-by-side diff', () => {
      const result = diffService.formatDiff(sampleDiff, {
        format: 'side-by-side',
        colorize: false
      });

      expect(result).toContain('KEY');
      expect(result).toContain('LOCAL');
      expect(result).toContain('REMOTE');
      expect(result).toContain('STATUS');
      expect(result).toContain('API_KEY');
      expect(result).toContain('Added');
      expect(result).toContain('Modified');
      expect(result).toContain('Removed');
      expect(result).toContain('Local Only');
    });

    it('should format summary diff', () => {
      const result = diffService.formatDiff(sampleDiff, {
        format: 'summary',
        colorize: false
      });

      expect(result).toBe('Added: 1, Modified: 1, Removed: 1, Local Only: 1');
    });

    it('should handle partial changes in summary', () => {
      const partialDiff: DiffResult = {
        added: { KEY1: 'val1', KEY2: 'val2' },
        modified: {},
        removed: {},
        localOnly: {}
      };

      const result = diffService.formatDiff(partialDiff, {
        format: 'summary',
        colorize: false
      });

      expect(result).toBe('Added: 2');
    });
  });

  describe('applyDiff', () => {
    it('should apply diff correctly', async () => {
      const mockFileService = {
        readEnvFile: jest.fn().mockResolvedValue({
          UNCHANGED: 'same',
          MODIFIED: 'old',
          REMOVED: 'gone',
          LOCAL_VAR: 'local'
        }),
        writeEnvFile: jest.fn()
      };

      const diff: DiffResult = {
        added: { ADDED: 'new-value' },
        modified: { MODIFIED: { old: 'old', new: 'new' } },
        removed: { REMOVED: 'gone' },
        localOnly: { LOCAL_VAR: 'local' }
      };

      await diffService.applyDiff('/path/to/.env', diff, mockFileService);

      expect(mockFileService.writeEnvFile).toHaveBeenCalledWith(
        '/path/to/.env',
        {
          ADDED: 'new-value',
          MODIFIED: 'new',
          UNCHANGED: 'same',
          LOCAL_VAR: 'local'
        }
      );
    });
  });
});