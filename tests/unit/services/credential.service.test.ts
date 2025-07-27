import { CredentialService } from '../../../src/services/credential.service';
import { MemoryCredentialStore } from '../../../src/services/memory-credential-store';
import keytar from 'keytar';

// Mock keytar
jest.mock('keytar');
const mockKeytar = keytar as jest.Mocked<typeof keytar>;

// Mock platform detection
jest.mock('../../../src/utils/platform', () => ({
  detectPlatform: jest.fn(() => 'darwin'),
  getPlatformName: jest.fn(() => 'macOS')
}));

describe('CredentialService', () => {
  let credentialService: CredentialService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset console methods
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    
    // Mock successful keytar test
    mockKeytar.getPassword.mockResolvedValue(null);
    mockKeytar.setPassword.mockResolvedValue(undefined);
    mockKeytar.deletePassword.mockResolvedValue(true);
    
    // Reset singleton instance completely
    (CredentialService as any).instance = null;
    // Reset static memory store with a fresh instance
    (CredentialService as any).memoryStore = new MemoryCredentialStore();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    // Reset singleton instance
    (CredentialService as any).instance = null;
  });

  describe('platform detection and fallback', () => {
    it('should use keytar when available', async () => {
      // Create a new instance and force it to initialize the store
      const service = new CredentialService();
      
      await service.store('test', 'account', 'password');
      
      // Should have tested keytar availability
      expect(mockKeytar.getPassword).toHaveBeenCalledWith('ezenv-test', 'test');
      // Should have called setPassword
      expect(mockKeytar.setPassword).toHaveBeenCalledWith('test', 'account', 'password');
      // Check console.log was called with credential store message
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('credential store'));
    });

    it('should fallback to memory storage when keytar fails', async () => {
      // Make keytar test fail
      mockKeytar.getPassword.mockRejectedValueOnce(new Error('Keytar not available'));
      
      // Reset singleton and create new instance
      (CredentialService as any).instance = null;
      const service = CredentialService.getInstance();
      
      await service.store('test', 'account', 'password');
      const retrieved = await service.retrieve('test', 'account');
      
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('System credential store unavailable'));
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Falling back to memory storage'));
      expect(retrieved).toBe('password');
      expect(service.isUsingMemoryStorage()).toBe(true);
    });

    it('should persist memory storage across service instances', async () => {
      // Make keytar fail for all instances
      mockKeytar.getPassword.mockRejectedValue(new Error('Keytar not available'));
      
      const service1 = new CredentialService();
      await service1.store('test', 'account', 'password123');
      
      const service2 = new CredentialService();
      const retrieved = await service2.retrieve('test', 'account');
      
      expect(retrieved).toBe('password123');
    });
  });

  describe('store', () => {
    beforeEach(() => {
      credentialService = CredentialService.getInstance();
    });
    
    it('should store credentials successfully', async () => {
      mockKeytar.getPassword.mockResolvedValue(null);
      mockKeytar.setPassword.mockResolvedValue(undefined);

      await credentialService.store('test-service', 'test-account', 'test-password');

      expect(mockKeytar.setPassword).toHaveBeenCalledWith(
        'test-service',
        'test-account',
        'test-password'
      );
    });

    it('should handle keychain errors gracefully', async () => {
      mockKeytar.getPassword.mockResolvedValue(null);
      mockKeytar.setPassword.mockRejectedValueOnce(
        new Error('Error: The specified item already exists in the keychain.')
      );

      await expect(
        credentialService.store('test-service', 'test-account', 'test-password')
      ).rejects.toThrow('Failed to store credentials. Please ensure your system keychain is accessible.');
    });

    it('should rethrow non-keychain errors', async () => {
      mockKeytar.getPassword.mockResolvedValue(null);
      mockKeytar.setPassword.mockRejectedValueOnce(new Error('Unknown error'));

      await expect(
        credentialService.store('test-service', 'test-account', 'test-password')
      ).rejects.toThrow('Unknown error');
    });
  });

  describe('retrieve', () => {
    beforeEach(() => {
      credentialService = CredentialService.getInstance();
    });
    
    it('should retrieve credentials successfully', async () => {
      // First call is for keytar test, second is the actual retrieve
      mockKeytar.getPassword
        .mockResolvedValueOnce(null) // keytar test
        .mockResolvedValueOnce('stored-password'); // actual retrieve

      const result = await credentialService.retrieve('test-service', 'test-account');

      expect(result).toBe('stored-password');
      expect(mockKeytar.getPassword).toHaveBeenCalledWith(
        'test-service',
        'test-account'
      );
    });

    it('should return null when no credentials found', async () => {
      mockKeytar.getPassword.mockResolvedValueOnce(null);

      const result = await credentialService.retrieve('test-service', 'test-account');

      expect(result).toBeNull();
    });

    it('should handle keychain errors gracefully', async () => {
      // First call for keytar test succeeds, second call fails
      mockKeytar.getPassword
        .mockResolvedValueOnce(null) // keytar test
        .mockRejectedValueOnce(new Error('Error accessing credential store')); // actual retrieve

      await expect(
        credentialService.retrieve('test-service', 'test-account')
      ).rejects.toThrow('Failed to retrieve credentials. Please ensure your system keychain is accessible.');
    });
  });

  describe('delete', () => {
    beforeEach(() => {
      credentialService = CredentialService.getInstance();
    });
    
    it('should delete credentials successfully', async () => {
      mockKeytar.deletePassword.mockResolvedValueOnce(true);

      const result = await credentialService.delete('test-service', 'test-account');

      expect(result).toBe(true);
      expect(mockKeytar.deletePassword).toHaveBeenCalledWith(
        'test-service',
        'test-account'
      );
    });

    it('should return false when no credentials to delete', async () => {
      mockKeytar.deletePassword.mockResolvedValueOnce(false);

      const result = await credentialService.delete('test-service', 'test-account');

      expect(result).toBe(false);
    });

    it('should handle keychain errors gracefully', async () => {
      const error = new Error('Keychain access denied');
      error.message = 'Error accessing keychain: Keychain access denied';
      mockKeytar.deletePassword.mockRejectedValueOnce(error);

      await expect(
        credentialService.delete('test-service', 'test-account')
      ).rejects.toThrow('Failed to delete credentials. Please ensure your system keychain is accessible.');
    });
  });
});