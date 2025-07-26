import { formatSecrets, OutputFormat } from '../../../src/utils/formatters';

describe('formatSecrets', () => {
  const testSecrets = {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    API_KEY: 'sk-1234567890',
    DEBUG: 'true',
    MULTI_LINE: 'line1\nline2\nline3',
    WITH_SPACES: 'value with spaces',
    WITH_QUOTES: 'value "with" quotes',
    SPECIAL_CHARS: 'value$with`special@chars#'
  };

  describe('env format', () => {
    it('should format simple key-value pairs', () => {
      const result = formatSecrets({ DEBUG: 'true' }, 'env');
      expect(result).toBe('DEBUG=true');
    });

    it('should quote values with spaces', () => {
      const result = formatSecrets({ KEY: 'value with spaces' }, 'env');
      expect(result).toBe('KEY="value with spaces"');
    });

    it('should escape quotes in values', () => {
      const result = formatSecrets({ KEY: 'value "with" quotes' }, 'env');
      expect(result).toBe('KEY="value \\"with\\" quotes"');
    });

    it('should handle multiline values', () => {
      const result = formatSecrets({ KEY: 'line1\nline2' }, 'env');
      expect(result).toBe('KEY="line1\\nline2"');
    });

    it('should handle empty object', () => {
      const result = formatSecrets({}, 'env');
      expect(result).toBe('');
    });

    it('should format multiple secrets', () => {
      const result = formatSecrets({
        KEY1: 'value1',
        KEY2: 'value2'
      }, 'env');
      expect(result).toBe('KEY1=value1\nKEY2=value2');
    });
  });

  describe('json format', () => {
    it('should format as valid JSON', () => {
      const result = formatSecrets(testSecrets, 'json');
      const parsed = JSON.parse(result);
      expect(parsed).toEqual(testSecrets);
    });

    it('should indent with 2 spaces', () => {
      const result = formatSecrets({ KEY: 'value' }, 'json');
      expect(result).toBe('{\n  "KEY": "value"\n}');
    });

    it('should handle empty object', () => {
      const result = formatSecrets({}, 'json');
      expect(result).toBe('{}');
    });
  });

  describe('yaml format', () => {
    it('should format simple key-value pairs', () => {
      const result = formatSecrets({ KEY: 'value' }, 'yaml');
      expect(result).toBe('KEY: value');
    });

    it('should quote values with colons', () => {
      const result = formatSecrets({ KEY: 'value:with:colons' }, 'yaml');
      expect(result).toBe('KEY: "value:with:colons"');
    });

    it('should quote values with hash', () => {
      const result = formatSecrets({ KEY: 'value#comment' }, 'yaml');
      expect(result).toBe('KEY: "value#comment"');
    });

    it('should handle multiline values with pipe notation', () => {
      const result = formatSecrets({ KEY: 'line1\nline2\nline3' }, 'yaml');
      expect(result).toBe('KEY: |\n  line1\n  line2\n  line3');
    });

    it('should quote values with leading/trailing spaces', () => {
      const result = formatSecrets({ KEY: ' value ' }, 'yaml');
      expect(result).toBe('KEY: " value "');
    });

    it('should handle empty object', () => {
      const result = formatSecrets({}, 'yaml');
      expect(result).toBe('');
    });
  });

  describe('export format', () => {
    it('should format as shell export commands', () => {
      const result = formatSecrets({ KEY: 'value' }, 'export');
      expect(result).toBe('export KEY="value"');
    });

    it('should escape shell special characters', () => {
      const result = formatSecrets({ KEY: 'value$with`special' }, 'export');
      expect(result).toBe('export KEY="value\\$with\\`special"');
    });

    it('should escape quotes', () => {
      const result = formatSecrets({ KEY: 'value "with" quotes' }, 'export');
      expect(result).toBe('export KEY="value \\"with\\" quotes"');
    });

    it('should handle multiple exports', () => {
      const result = formatSecrets({
        KEY1: 'value1',
        KEY2: 'value2'
      }, 'export');
      expect(result).toBe('export KEY1="value1"\nexport KEY2="value2"');
    });

    it('should handle empty object', () => {
      const result = formatSecrets({}, 'export');
      expect(result).toBe('');
    });
  });

  describe('error handling', () => {
    it('should throw for unknown format', () => {
      expect(() => {
        formatSecrets({ KEY: 'value' }, 'unknown' as OutputFormat);
      }).toThrow('Unknown format: unknown');
    });
  });
});