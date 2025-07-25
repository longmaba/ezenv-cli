import { AuthService } from '../../../src/services/auth.service';
import { CredentialService } from '../../../src/services/credential.service';
import fetch from 'node-fetch';

// Mock node-fetch
jest.mock('node-fetch');
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('AuthService - Enhanced Features', () => {
  let authService: AuthService;
  let mockCredentialService: jest.Mocked<CredentialService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockCredentialService = {
      store: jest.fn(),
      retrieve: jest.fn(),
      delete: jest.fn(),
      isUsingMemoryStorage: jest.fn(() => false),
    } as any;
    
    // Set up environment variable for tests
    process.env.SUPABASE_URL = 'https://test-project.supabase.co';
    
    authService = new AuthService(mockCredentialService);
  });

  afterEach(() => {
    delete process.env.SUPABASE_URL;
  });

  describe('environment management', () => {
    it('should default to production environment', () => {
      expect(authService.getEnvironment()).toBe('production');
    });

    it('should allow setting different environments', () => {
      authService.setEnvironment('development');
      expect(authService.getEnvironment()).toBe('development');
      
      authService.setEnvironment('staging');
      expect(authService.getEnvironment()).toBe('staging');
    });

    it('should use environment-specific service names', async () => {
      authService.setEnvironment('development');
      await authService.storeCredentials('test-token');
      
      expect(mockCredentialService.store).toHaveBeenCalledWith(
        'ezenv-cli-development',
        'token_data',
        expect.any(String)
      );
    });
  });

  describe('enhanced token storage', () => {
    it('should store token with metadata', async () => {
      const expiresIn = 3600;
      const refreshToken = 'refresh-token';
      const userId = 'user-123';
      
      await authService.storeCredentials('access-token', expiresIn, refreshToken, userId);
      
      expect(mockCredentialService.store).toHaveBeenCalledWith(
        'ezenv-cli-production',
        'token_data',
        expect.stringContaining('"access_token":"access-token"')
      );
      
      const storedData = JSON.parse(mockCredentialService.store.mock.calls[0][2]);
      expect(storedData).toMatchObject({
        access_token: 'access-token',
        environment: 'production',
        refresh_token: refreshToken,
        user_id: userId
      });
      expect(new Date(storedData.expires_at).getTime()).toBeGreaterThan(Date.now());
    });

    it('should use default expiry if not provided', async () => {
      await authService.storeCredentials('access-token');
      
      const storedData = JSON.parse(mockCredentialService.store.mock.calls[0][2]);
      const expiresAt = new Date(storedData.expires_at);
      const oneHourFromNow = new Date(Date.now() + 3600 * 1000);
      
      // Should be approximately 1 hour from now
      expect(Math.abs(expiresAt.getTime() - oneHourFromNow.getTime())).toBeLessThan(1000);
    });
  });

  describe('token retrieval', () => {
    it('should retrieve and parse stored token data', async () => {
      const tokenData = {
        access_token: 'stored-token',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        environment: 'production',
        refresh_token: 'refresh-token',
        user_id: 'user-123'
      };
      
      mockCredentialService.retrieve.mockResolvedValueOnce(JSON.stringify(tokenData));
      
      const retrieved = await authService.getStoredTokenData();
      expect(retrieved).toEqual(tokenData);
    });

    it('should handle old format tokens', async () => {
      mockCredentialService.retrieve.mockResolvedValueOnce('legacy-token');
      
      const retrieved = await authService.getStoredTokenData();
      expect(retrieved).toMatchObject({
        access_token: 'legacy-token',
        environment: 'production'
      });
    });

    it('should return null if no token stored', async () => {
      mockCredentialService.retrieve.mockResolvedValueOnce(null);
      
      const retrieved = await authService.getStoredTokenData();
      expect(retrieved).toBeNull();
    });
  });

  describe('token expiry checking', () => {
    it('should detect expired tokens', async () => {
      const expiredToken = {
        access_token: 'expired-token',
        expires_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        environment: 'production'
      };
      
      mockCredentialService.retrieve.mockResolvedValueOnce(JSON.stringify(expiredToken));
      
      const isExpired = await authService.isTokenExpired();
      expect(isExpired).toBe(true);
    });

    it('should detect tokens expiring within 5 minutes', async () => {
      const soonExpiringToken = {
        access_token: 'soon-expiring-token',
        expires_at: new Date(Date.now() + 240000).toISOString(), // 4 minutes from now
        environment: 'production'
      };
      
      mockCredentialService.retrieve.mockResolvedValueOnce(JSON.stringify(soonExpiringToken));
      
      const isExpired = await authService.isTokenExpired();
      expect(isExpired).toBe(true);
    });

    it('should detect valid tokens', async () => {
      const validToken = {
        access_token: 'valid-token',
        expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
        environment: 'production'
      };
      
      mockCredentialService.retrieve.mockResolvedValueOnce(JSON.stringify(validToken));
      
      const isExpired = await authService.isTokenExpired();
      expect(isExpired).toBe(false);
    });

    it('should return true if no token exists', async () => {
      mockCredentialService.retrieve.mockResolvedValueOnce(null);
      
      const isExpired = await authService.isTokenExpired();
      expect(isExpired).toBe(true);
    });
  });

  describe('token refresh', () => {
    it('should refresh token successfully', async () => {
      const storedToken = {
        access_token: 'old-token',
        expires_at: new Date(Date.now() + 300000).toISOString(),
        environment: 'production',
        refresh_token: 'refresh-token'
      };
      
      mockCredentialService.retrieve.mockResolvedValueOnce(JSON.stringify(storedToken));
      
      const newTokenResponse = {
        access_token: 'new-token',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'new-refresh-token'
      };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => newTokenResponse,
      } as any);
      
      const result = await authService.refreshToken();
      
      expect(result).toEqual(newTokenResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test-project.supabase.co/functions/v1/cli-auth/refresh',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ refresh_token: 'refresh-token' })
        })
      );
      
      // Should store the new token
      expect(mockCredentialService.store).toHaveBeenCalledWith(
        'ezenv-cli-production',
        'token_data',
        expect.stringContaining('"access_token":"new-token"')
      );
    });

    it('should return null if no refresh token available', async () => {
      const storedToken = {
        access_token: 'token',
        expires_at: new Date(Date.now() + 300000).toISOString(),
        environment: 'production'
      };
      
      mockCredentialService.retrieve.mockResolvedValueOnce(JSON.stringify(storedToken));
      
      const result = await authService.refreshToken();
      expect(result).toBeNull();
    });

    it('should return null on refresh failure', async () => {
      const storedToken = {
        access_token: 'old-token',
        expires_at: new Date(Date.now() + 300000).toISOString(),
        environment: 'production',
        refresh_token: 'refresh-token'
      };
      
      mockCredentialService.retrieve.mockResolvedValueOnce(JSON.stringify(storedToken));
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as any);
      
      const result = await authService.refreshToken();
      expect(result).toBeNull();
    });
  });

  describe('token deletion', () => {
    it('should delete token for current environment', async () => {
      authService.setEnvironment('staging');
      
      mockCredentialService.delete.mockResolvedValueOnce(true);
      
      const result = await authService.deleteStoredToken();
      
      expect(result).toBe(true);
      expect(mockCredentialService.delete).toHaveBeenCalledWith(
        'ezenv-cli-staging',
        'token_data'
      );
    });
  });
});