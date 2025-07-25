import { detectPlatform, getPlatformName } from '../../../src/utils/platform';
import { platform } from 'os';

// Mock os.platform
jest.mock('os', () => ({
  platform: jest.fn(),
}));

const mockPlatform = platform as jest.MockedFunction<typeof platform>;

describe('Platform Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('detectPlatform', () => {
    it('should detect macOS correctly', () => {
      mockPlatform.mockReturnValue('darwin');
      expect(detectPlatform()).toBe('darwin');
    });

    it('should detect Windows correctly', () => {
      mockPlatform.mockReturnValue('win32');
      expect(detectPlatform()).toBe('win32');
    });

    it('should detect Linux correctly', () => {
      mockPlatform.mockReturnValue('linux');
      expect(detectPlatform()).toBe('linux');
    });

    it('should map other Unix-like systems to Linux', () => {
      const unixPlatforms = ['freebsd', 'openbsd', 'sunos'] as any[];
      
      unixPlatforms.forEach(plat => {
        mockPlatform.mockReturnValue(plat);
        expect(detectPlatform()).toBe('linux');
      });
    });

    it('should return unknown for unsupported platforms', () => {
      mockPlatform.mockReturnValue('aix' as any);
      expect(detectPlatform()).toBe('unknown');
    });
  });

  describe('getPlatformName', () => {
    it('should return human-readable platform names', () => {
      mockPlatform.mockReturnValue('darwin');
      expect(getPlatformName()).toBe('macOS');

      mockPlatform.mockReturnValue('win32');
      expect(getPlatformName()).toBe('Windows');

      mockPlatform.mockReturnValue('linux');
      expect(getPlatformName()).toBe('Linux');

      mockPlatform.mockReturnValue('aix' as any);
      expect(getPlatformName()).toBe('Unknown');
    });
  });
});