import { AuthService } from '../../../src/services/auth.service';
import { CredentialService } from '../../../src/services/credential.service';
import fetch from 'node-fetch';

// Mock node-fetch
jest.mock('node-fetch');
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('AuthService', () => {
  let authService: AuthService;
  let mockCredentialService: jest.Mocked<CredentialService>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
    jest.useFakeTimers();
    
    mockCredentialService = {
      store: jest.fn(),
      retrieve: jest.fn(),
      delete: jest.fn(),
    } as any;
    
    // Set up environment variables for tests
    process.env.SUPABASE_URL = 'https://test-project.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';
    
    authService = new AuthService(mockCredentialService);
  });

  afterEach(() => {
    jest.useRealTimers();
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
  });

  describe('constructor', () => {
    it('should use default hosted service when environment variables are not set', () => {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_ANON_KEY;
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      expect(() => new AuthService(mockCredentialService))
        .not.toThrow();
      
      const authService = new AuthService(mockCredentialService);
      expect(authService).toBeDefined();
    });

    it('should use environment variables when set', () => {
      process.env.SUPABASE_URL = 'https://custom.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'custom-key';
      
      expect(() => new AuthService(mockCredentialService))
        .not.toThrow();
    });

    it('should accept NEXT_PUBLIC environment variables as fallback', () => {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_ANON_KEY;
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fallback.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fallback-key';
      
      const service = new AuthService(mockCredentialService);
      expect(service).toBeDefined();
      
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    });

    it('should remove trailing slash from URL', () => {
      process.env.SUPABASE_URL = 'https://test-project.supabase.co/';
      
      const service = new AuthService(mockCredentialService);
      expect(service).toBeDefined();
    });
  });

  describe('authenticateWithPassword', () => {
    it('should successfully authenticate with valid credentials', async () => {
      const mockResponse = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as any);

      await authService.authenticateWithPassword('test@example.com', 'password123');
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/v1/token?grant_type=password'),
        expect.objectContaining({
          method: 'POST',
          headers: {
            'apikey': 'test-anon-key',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'password123',
            gotrue_meta_security: {},
          }),
        })
      );

      expect(mockCredentialService.store).toHaveBeenCalledWith(
        'ezenv-cli-production',
        'token_data',
        expect.stringContaining('test-access-token')
      );
    });

    it('should throw INVALID_CREDENTIALS error for wrong password', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ 
          error: 'invalid_grant',
          error_description: 'Invalid email or password' 
        }),
      } as any);

      try {
        await authService.authenticateWithPassword('test@example.com', 'wrong');
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toBe('Invalid email or password');
        expect(error.code).toBe('INVALID_CREDENTIALS');
      }
    });

    it('should throw RATE_LIMITED error on 429 status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => JSON.stringify({ 
          error: 'rate_limit_exceeded' 
        }),
      } as any);

      try {
        await authService.authenticateWithPassword('test@example.com', 'password');
      } catch (error: any) {
        expect(error.code).toBe('RATE_LIMITED');
      }
    });

    it('should throw SERVER_ERROR on 500+ status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => JSON.stringify({ error: 'internal_error' }),
      } as any);

      try {
        await authService.authenticateWithPassword('test@example.com', 'password');
      } catch (error: any) {
        expect(error.code).toBe('SERVER_ERROR');
      }
    });

    it('should retry on network errors with exponential backoff', async () => {
      jest.useFakeTimers();
      const networkError = new Error('Network error');
      (networkError as any).code = 'ENOTFOUND';

      // First two attempts fail, third succeeds
      mockFetch
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'test-token',
            expires_in: 3600,
            user: { id: '123', email: 'test@example.com' },
          }),
        } as any);

      const authPromise = authService.authenticateWithPassword('test@example.com', 'password');
      
      // Advance through retry delays
      await jest.advanceTimersByTimeAsync(1000); // First retry after 1s
      await jest.advanceTimersByTimeAsync(2000); // Second retry after 2s
      
      await authPromise;

      expect(mockFetch).toHaveBeenCalledTimes(3);
      jest.useRealTimers();
    });

    it('should throw NETWORK_ERROR after max retries', async () => {
      jest.useFakeTimers();
      const networkError = new Error('Network error');
      (networkError as any).code = 'ECONNREFUSED';

      mockFetch.mockRejectedValue(networkError);

      const authPromise = authService.authenticateWithPassword('test@example.com', 'password');
      
      // Advance through all retry delays
      await jest.advanceTimersByTimeAsync(1000); // First retry after 1s
      await jest.advanceTimersByTimeAsync(2000); // Second retry after 2s
      await jest.advanceTimersByTimeAsync(4000); // Third retry after 4s
      
      await expect(authPromise).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
        message: 'Network connection failed'
      });
      expect(mockFetch).toHaveBeenCalledTimes(3); // Max retries
      
      jest.useRealTimers();
    });
  });

  describe('refreshToken', () => {
    it('should successfully refresh token', async () => {
      const storedData = {
        access_token: 'old-token',
        refresh_token: 'refresh-token',
        expires_at: new Date().toISOString(),
        environment: 'production',
      };

      mockCredentialService.retrieve.mockResolvedValueOnce(JSON.stringify(storedData));

      const newTokenResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => newTokenResponse,
      } as any);

      const result = await authService.refreshToken();

      expect(result).toEqual(newTokenResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/v1/token?grant_type=refresh_token'),
        expect.objectContaining({
          method: 'POST',
          headers: {
            'apikey': 'test-anon-key',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refresh_token: 'refresh-token' }),
        })
      );
    });

    it('should return null when no refresh token is stored', async () => {
      mockCredentialService.retrieve.mockResolvedValueOnce(null);

      const result = await authService.refreshToken();
      expect(result).toBeNull();
    });

    it('should return null on refresh failure', async () => {
      const storedData = {
        access_token: 'old-token',
        refresh_token: 'refresh-token',
        expires_at: new Date().toISOString(),
        environment: 'production',
      };

      mockCredentialService.retrieve.mockResolvedValueOnce(JSON.stringify(storedData));

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as any);

      const result = await authService.refreshToken();
      expect(result).toBeNull();
    });
  });

  describe('logout', () => {
    it('should delete stored token', async () => {
      mockCredentialService.delete.mockResolvedValueOnce(true);

      await authService.logout();

      expect(mockCredentialService.delete).toHaveBeenCalledWith(
        'ezenv-cli-production',
        'token_data'
      );
    });
  });

  describe('getCurrentUser', () => {
    it('should fetch current user data', async () => {
      const storedData = {
        access_token: 'test-token',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        environment: 'production',
      };

      mockCredentialService.retrieve.mockResolvedValueOnce(JSON.stringify(storedData));

      const userData = {
        id: 'user-123',
        email: 'test@example.com',
        created_at: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => userData,
      } as any);

      const result = await authService.getCurrentUser();

      expect(result).toEqual(userData);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/v1/user'),
        expect.objectContaining({
          method: 'GET',
          headers: {
            'apikey': 'test-anon-key',
            'Authorization': 'Bearer test-token',
          },
        })
      );
    });

    it('should return null when no token is stored', async () => {
      mockCredentialService.retrieve.mockResolvedValueOnce(null);

      const result = await authService.getCurrentUser();
      expect(result).toBeNull();
    });

    it('should return null on API error', async () => {
      const storedData = {
        access_token: 'test-token',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        environment: 'production',
      };

      mockCredentialService.retrieve.mockResolvedValueOnce(JSON.stringify(storedData));

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as any);

      const result = await authService.getCurrentUser();
      expect(result).toBeNull();
    });
  });

  describe('isAuthenticated', () => {
    it('should return true for valid non-expired token', async () => {
      mockCredentialService.retrieve.mockResolvedValueOnce('test-token');
      mockCredentialService.getCredentialMetadata = jest.fn().mockResolvedValueOnce({
        expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
      });
      mockCredentialService.getCredential = jest.fn().mockResolvedValueOnce('test-token');

      const result = await authService.isAuthenticated();
      expect(result).toBe(true);
    });

    it('should return false when no token is stored', async () => {
      mockCredentialService.getCredential = jest.fn().mockResolvedValueOnce(null);

      const result = await authService.isAuthenticated();
      expect(result).toBe(false);
    });

    it('should attempt refresh when token is expired', async () => {
      mockCredentialService.getCredential = jest.fn()
        .mockResolvedValueOnce('test-token')
        .mockResolvedValueOnce('refresh-token');
      mockCredentialService.getCredentialMetadata = jest.fn().mockResolvedValueOnce({
        expiresAt: new Date(Date.now() - 1000).toISOString(), // Expired
      });

      // Mock successful refresh
      const storedData = {
        access_token: 'old-token',
        refresh_token: 'refresh-token',
        expires_at: new Date(Date.now() - 1000).toISOString(),
        environment: 'production',
      };
      mockCredentialService.retrieve.mockResolvedValueOnce(JSON.stringify(storedData));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-token',
          expires_in: 3600,
        }),
      } as any);

      const result = await authService.isAuthenticated();
      expect(result).toBe(true);
    });
  });

  describe('environment management', () => {
    it('should set and get environment', () => {
      authService.setEnvironment('staging');
      expect(authService.getEnvironment()).toBe('staging');

      authService.setEnvironment('production');
      expect(authService.getEnvironment()).toBe('production');
    });

    it('should use environment-specific service names', async () => {
      authService.setEnvironment('development');
      
      await authService.storeCredentials('test-token', 3600);

      expect(mockCredentialService.store).toHaveBeenCalledWith(
        'ezenv-cli-development',
        'token_data',
        expect.any(String)
      );
    });
  });
});