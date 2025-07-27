import { SecretsService } from '../../../src/services/secrets.service';
import { AuthService } from '../../../src/services/auth.service';
import { CLIError, APIError } from '../../../src/utils/errors';
import { logger } from '../../../src/utils/logger';
import fetch from 'node-fetch';

jest.mock('../../../src/utils/logger');
jest.mock('node-fetch');
jest.mock('../../../src/services/auth.service');

const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('SecretsService', () => {
  let secretsService: SecretsService;
  let mockAuthService: jest.Mocked<AuthService>;

  beforeEach(() => {
    mockAuthService = {
      getStoredToken: jest.fn(),
      setEnvironment: jest.fn()
    } as any;
    
    // Mock AuthService constructor to return our mock
    (AuthService as jest.MockedClass<typeof AuthService>).mockImplementation(() => mockAuthService);
    
    secretsService = new SecretsService();
    jest.clearAllMocks();
  });

  describe('getSecrets', () => {
    it('should fetch secrets successfully', async () => {
      const mockSecrets = {
        DATABASE_URL: 'postgresql://localhost:5432/db',
        API_KEY: 'sk-1234567890',
        DEBUG: 'true'
      };

      // Mock auth token
      mockAuthService.getStoredToken.mockResolvedValue('test-token');

      // Mock project lookup
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ id: 'project-123' }]
        } as any)
        // Mock environment lookup
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ id: 'env-456' }]
        } as any)
        // Mock Edge Function call
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ secrets: mockSecrets })
        } as any);

      const result = await secretsService.getSecrets('my-project', 'development');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/functions/v1/get-secrets'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token'
          }),
          body: JSON.stringify({
            projectId: 'project-123',
            environmentId: 'env-456'
          })
        })
      );
      expect(result).toEqual(mockSecrets);
      expect(logger.debug).toHaveBeenCalledWith(
        'Fetching secrets',
        { projectNameOrId: 'my-project', environmentNameOrId: 'development' }
      );
      expect(logger.debug).toHaveBeenCalledWith(
        'Secrets fetched successfully',
        { count: 3 }
      );
    });

    it('should handle empty secrets response', async () => {
      mockAuthService.getStoredToken.mockResolvedValue('test-token');

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ id: 'project-123' }]
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ id: 'env-456' }]
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ secrets: {} })
        } as any);

      const result = await secretsService.getSecrets('my-project', 'development');

      expect(result).toEqual({});
      expect(logger.debug).toHaveBeenCalledWith(
        'Secrets fetched successfully',
        { count: 0 }
      );
    });

    it('should rethrow CLIError', async () => {
      mockAuthService.getStoredToken.mockResolvedValue(null);

      await expect(
        secretsService.getSecrets('my-project', 'development')
      ).rejects.toThrow(CLIError);

      await expect(
        secretsService.getSecrets('my-project', 'development')
      ).rejects.toMatchObject({
        message: 'Not authenticated',
        code: 'AUTH_REQUIRED'
      });

      expect(logger.error).not.toHaveBeenCalled();
    });

    it('should wrap unknown errors in CLIError', async () => {
      const unknownError = new Error('Network error');
      mockAuthService.getStoredToken.mockResolvedValue('test-token');
      mockFetch.mockRejectedValue(unknownError);

      await expect(
        secretsService.getSecrets('my-project', 'development')
      ).rejects.toThrow(CLIError);

      await expect(
        secretsService.getSecrets('my-project', 'development')
      ).rejects.toMatchObject({
        message: 'Failed to fetch secrets',
        code: 'SECRETS_FETCH_FAILED',
        details: { projectNameOrId: 'my-project', environmentNameOrId: 'development' }
      });

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to fetch secrets',
        unknownError
      );
    });

    it('should never log secret values', async () => {
      const mockSecrets = {
        DATABASE_URL: 'postgresql://user:password@localhost:5432/db',
        API_KEY: 'sk-super-secret-key',
        SECRET_TOKEN: 'very-secret-value'
      };

      mockAuthService.getStoredToken.mockResolvedValue('test-token');
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ id: 'project-123' }]
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ id: 'env-456' }]
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ secrets: mockSecrets })
        } as any);

      await secretsService.getSecrets('my-project', 'production');

      // Check that logger was called but never with actual secret values
      const loggerCalls = (logger.debug as jest.Mock).mock.calls;
      const allLoggedValues = JSON.stringify(loggerCalls);
      
      expect(allLoggedValues).not.toContain('postgresql://user:password');
      expect(allLoggedValues).not.toContain('sk-super-secret-key');
      expect(allLoggedValues).not.toContain('very-secret-value');
      expect(allLoggedValues).toContain('count');
    });
  });
});