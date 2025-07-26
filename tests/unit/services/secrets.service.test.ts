import { SecretsService } from '../../../src/services/secrets.service';
import { APIService } from '../../../src/services/api.service';
import { CLIError } from '../../../src/utils/errors';
import { logger } from '../../../src/utils/logger';

jest.mock('../../../src/utils/logger');

describe('SecretsService', () => {
  let secretsService: SecretsService;
  let mockApiService: jest.Mocked<APIService>;

  beforeEach(() => {
    mockApiService = {
      post: jest.fn()
    } as any;
    
    secretsService = new SecretsService(mockApiService);
    jest.clearAllMocks();
  });

  describe('getSecrets', () => {
    it('should fetch secrets successfully', async () => {
      const mockSecrets = {
        DATABASE_URL: 'postgresql://localhost:5432/db',
        API_KEY: 'sk-1234567890',
        DEBUG: 'true'
      };

      mockApiService.post.mockResolvedValue({
        secrets: mockSecrets
      });

      const result = await secretsService.getSecrets('my-project', 'development');

      expect(mockApiService.post).toHaveBeenCalledWith(
        '/functions/v1/get-secrets',
        {
          projectName: 'my-project',
          environmentName: 'development'
        }
      );
      expect(result).toEqual(mockSecrets);
      expect(logger.debug).toHaveBeenCalledWith(
        'Fetching secrets',
        { projectName: 'my-project', environmentName: 'development' }
      );
      expect(logger.debug).toHaveBeenCalledWith(
        'Secrets fetched successfully',
        { count: 3 }
      );
    });

    it('should handle empty secrets response', async () => {
      mockApiService.post.mockResolvedValue({
        secrets: {}
      });

      const result = await secretsService.getSecrets('my-project', 'development');

      expect(result).toEqual({});
      expect(logger.debug).toHaveBeenCalledWith(
        'Secrets fetched successfully',
        { count: 0 }
      );
    });

    it('should rethrow CLIError', async () => {
      const cliError = new CLIError('Not authenticated', 'NOT_AUTHENTICATED');
      mockApiService.post.mockRejectedValue(cliError);

      await expect(
        secretsService.getSecrets('my-project', 'development')
      ).rejects.toThrow(cliError);

      expect(logger.error).not.toHaveBeenCalled();
    });

    it('should wrap unknown errors in CLIError', async () => {
      const unknownError = new Error('Network error');
      mockApiService.post.mockRejectedValue(unknownError);

      await expect(
        secretsService.getSecrets('my-project', 'development')
      ).rejects.toThrow(CLIError);

      await expect(
        secretsService.getSecrets('my-project', 'development')
      ).rejects.toMatchObject({
        message: 'Failed to fetch secrets',
        code: 'SECRETS_FETCH_FAILED',
        details: { projectName: 'my-project', environmentName: 'development' }
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

      mockApiService.post.mockResolvedValue({
        secrets: mockSecrets
      });

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