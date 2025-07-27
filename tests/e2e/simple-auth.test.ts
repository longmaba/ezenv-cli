import { AuthService } from '../../src/services/auth.service';
import { CredentialService } from '../../src/services/credential.service';
import { setMockResponse, clearAllMocks, createErrorResponse, createSuccessResponse } from '../__mocks__/node-fetch';

describe('Simple Auth Flow Test', () => {
  let authService: AuthService;
  let credentialService: CredentialService;

  beforeEach(() => {
    clearAllMocks();
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';
    
    credentialService = new CredentialService();
    authService = new AuthService(credentialService);
  });

  afterEach(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
  });

  it('should complete auth flow', async () => {
    // Mock successful password auth response
    setMockResponse('/auth/v1/token', async (url) => {
      // Check for grant_type=password in URL
      if (url.includes('grant_type=password')) {
        return createSuccessResponse({
          access_token: 'test-token-123',
          token_type: 'Bearer',
          expires_in: 3600,
          refresh_token: 'refresh-123',
          user: {
            id: 'user-123',
            email: 'test@example.com'
          }
        });
      }
      return createErrorResponse(400, { error: 'unsupported_grant_type' });
    });

    // Authenticate with password
    await authService.authenticateWithPassword('test@example.com', 'password123');
    
    // Verify token was stored
    const storedToken = await authService.getStoredToken();
    expect(storedToken).toBe('test-token-123');
  });

  it('should handle invalid credentials', async () => {
    setMockResponse('/auth/v1/token', createErrorResponse(400, {
      error: 'invalid_grant',
      error_description: 'Invalid email or password'
    }));

    await expect(authService.authenticateWithPassword('test@example.com', 'wrong'))
      .rejects.toThrow('Invalid email or password');
  });

  it('should handle network errors with retry', async () => {
    let attemptCount = 0;
    
    setMockResponse('/auth/v1/token', async () => {
      attemptCount++;
      if (attemptCount < 3) {
        const error = new Error('fetch failed');
        (error as any).code = 'ENOTFOUND';
        throw error;
      }
      // Success on third attempt
      return createSuccessResponse({
        access_token: 'test-token-123',
        expires_in: 3600,
        user: { id: '123', email: 'test@example.com' }
      });
    });

    // Use fake timers for retry delays
    jest.useFakeTimers();
    
    const authPromise = authService.authenticateWithPassword('test@example.com', 'password');
    
    // Advance through retry delays
    await jest.advanceTimersByTimeAsync(1000); // First retry after 1s
    await jest.advanceTimersByTimeAsync(2000); // Second retry after 2s
    
    await authPromise;
    
    expect(attemptCount).toBe(3);
    
    jest.useRealTimers();
  }, 15000);

  it('should handle server errors', async () => {
    setMockResponse('/auth/v1/token', createErrorResponse(500, { error: 'internal_server_error' }));

    await expect(authService.authenticateWithPassword('test@example.com', 'password'))
      .rejects.toThrow();
  });

  it('should handle rate limiting', async () => {
    setMockResponse('/auth/v1/token', createErrorResponse(429, { error: 'rate_limit_exceeded' }));

    try {
      await authService.authenticateWithPassword('test@example.com', 'password');
    } catch (error: any) {
      expect(error.code).toBe('RATE_LIMITED');
    }
  });
});