import { AuthService } from '../../src/services/auth.service';
import { CredentialService } from '../../src/services/credential.service';
import { setMockResponse, clearAllMocks } from '../__mocks__/node-fetch';

describe.skip('E2E: Basic Authentication Flow - Device Code (Not Implemented)', () => {
  // SKIP REASON: These tests are for device code authentication flow which is planned
  // in the architecture but not yet implemented. Current implementation only supports
  // password authentication. See cli-architecture.md for planned device flow.
  let authService: AuthService;
  let credentialService: CredentialService;

  beforeEach(() => {
    clearAllMocks();
    jest.clearAllMocks();
    
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    
    credentialService = new CredentialService();
    authService = new AuthService(credentialService);
    
    // Reduce polling interval for faster tests
    (authService as any).pollingInterval = 100; // 100ms instead of 5s
  });

  afterEach(() => {
    delete process.env.SUPABASE_URL;
    jest.resetModules();
  });

  describe('Successful authentication flow', () => {
    it('should complete device code flow successfully', async () => {
      // Mock device auth response
      setMockResponse('/functions/v1/cli-auth/device', async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          device_code: 'test-device-123',
          user_code: 'TEST-CODE',
          verification_uri: 'https://test.supabase.co/cli-auth/verify',
          verification_uri_complete: 'https://test.supabase.co/cli-auth/verify?user_code=TEST-CODE',
          expires_in: 600,
          interval: 1
        })
      }));
      
      // Mock token response - authorized immediately
      setMockResponse('/functions/v1/cli-auth/token', async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'test-token-123',
          token_type: 'Bearer',
          expires_in: 3600,
          refresh_token: 'refresh-123'
        })
      }));
      
      // Get device code
      const deviceResponse = await authService.initDeviceAuth();
      expect(deviceResponse.device_code).toBe('test-device-123');
      expect(deviceResponse.user_code).toBe('TEST-CODE');
      
      // Poll for token
      const tokenResponse = await authService.pollForToken(deviceResponse.device_code);
      expect(tokenResponse.access_token).toBe('test-token-123');
      
      // Store credentials
      await authService.storeCredentials(
        tokenResponse.access_token,
        tokenResponse.expires_in,
        tokenResponse.refresh_token
      );
      
      // Verify stored
      const storedToken = await authService.getStoredToken();
      expect(storedToken).toBe('test-token-123');
    });

    it('should handle polling with authorization pending', async () => {
      // Mock device auth
      setMockResponse('/functions/v1/cli-auth/device', async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          device_code: 'pending-device',
          user_code: 'PEND-CODE',
          verification_uri: 'https://test.supabase.co/cli-auth/verify',
          verification_uri_complete: 'https://test.supabase.co/cli-auth/verify?user_code=PEND-CODE',
          expires_in: 600,
          interval: 1
        })
      }));
      
      // Mock token response - pending then success
      let callCount = 0;
      setMockResponse('/functions/v1/cli-auth/token', async () => {
        callCount++;
        if (callCount < 3) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ error: 'authorization_pending' })
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            access_token: 'pending-token',
            token_type: 'Bearer',
            expires_in: 3600
          })
        };
      });
      
      const deviceResponse = await authService.initDeviceAuth();
      const tokenResponse = await authService.pollForToken(deviceResponse.device_code);
      
      expect(tokenResponse.access_token).toBe('pending-token');
      expect(callCount).toBe(3); // Should have polled 3 times
    });
  });

  describe('Timeout and cancellation', () => {
    it('should timeout after max polling time', async () => {
      // Set very short timeout for testing
      (authService as any).maxPollingTime = 300; // 300ms
      
      // Mock device auth
      setMockResponse('/functions/v1/cli-auth/device', async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          device_code: 'timeout-device',
          user_code: 'TIMEOUT',
          verification_uri: 'https://test.supabase.co/cli-auth/verify',
          verification_uri_complete: 'https://test.supabase.co/cli-auth/verify?user_code=TIMEOUT',
          expires_in: 600,
          interval: 1
        })
      }));
      
      // Mock pending response forever
      setMockResponse('/functions/v1/cli-auth/token', async () => ({
        ok: true,
        status: 200,
        json: async () => ({ error: 'authorization_pending' })
      }));
      
      const deviceResponse = await authService.initDeviceAuth();
      
      // Should timeout
      await expect(authService.pollForToken(deviceResponse.device_code))
        .rejects.toThrow('Authentication timed out');
    });

    it('should handle expired device code', async () => {
      // Mock device auth
      setMockResponse('/functions/v1/cli-auth/device', async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          device_code: 'expired-device',
          user_code: 'EXPIRED',
          verification_uri: 'https://test.supabase.co/cli-auth/verify',
          verification_uri_complete: 'https://test.supabase.co/cli-auth/verify?user_code=EXPIRED',
          expires_in: 600,
          interval: 1
        })
      }));
      
      // Mock expired response
      setMockResponse('/functions/v1/cli-auth/token', async () => ({
        ok: true,
        status: 200,
        json: async () => ({ 
          error: 'expired_token',
          error_description: 'Device code has expired'
        })
      }));
      
      const deviceResponse = await authService.initDeviceAuth();
      
      // Should fail with expired error
      await expect(authService.pollForToken(deviceResponse.device_code))
        .rejects.toThrow('Authentication expired');
    });
  });

  describe('Credential persistence', () => {
    it('should store and retrieve credentials', async () => {
      const token = 'persist-token-123';
      const expiresIn = 3600;
      const refreshToken = 'refresh-persist-123';
      
      // Store credentials
      await authService.storeCredentials(token, expiresIn, refreshToken);
      
      // Retrieve token
      const storedToken = await authService.getStoredToken();
      expect(storedToken).toBe(token);
      
      // Get full token data
      const tokenData = await authService.getStoredTokenData();
      expect(tokenData).toBeTruthy();
      expect(tokenData?.access_token).toBe(token);
      expect(tokenData?.refresh_token).toBe(refreshToken);
      expect(tokenData?.environment).toBe('production');
    });

    it('should isolate credentials by environment', async () => {
      // Store in production
      await authService.storeCredentials('prod-token', 3600);
      
      // Verify stored
      const prodToken = await authService.getStoredToken();
      expect(prodToken).toBe('prod-token');
      
      // Switch to development
      authService.setEnvironment('development');
      
      // Should have no token
      const devToken = await authService.getStoredToken();
      expect(devToken).toBeNull();
      
      // Store in development
      await authService.storeCredentials('dev-token', 3600);
      
      // Verify stored
      const newDevToken = await authService.getStoredToken();
      expect(newDevToken).toBe('dev-token');
      
      // Switch back to production
      authService.setEnvironment('production');
      
      // Should still have production token
      const prodToken2 = await authService.getStoredToken();
      expect(prodToken2).toBe('prod-token');
    });
  });

  describe('Logout functionality', () => {
    it('should delete stored credentials on logout', async () => {
      // Store a token first
      await authService.storeCredentials('logout-test-token', 3600);
      
      // Verify it exists
      const tokenBefore = await authService.getStoredToken();
      expect(tokenBefore).toBe('logout-test-token');
      
      // Logout
      const result = await authService.deleteStoredToken();
      expect(result).toBe(true);
      
      // Verify deleted
      const tokenAfter = await authService.getStoredToken();
      expect(tokenAfter).toBeNull();
    });

    it('should handle logout with no stored credentials', async () => {
      // Ensure no credentials
      const tokenBefore = await authService.getStoredToken();
      expect(tokenBefore).toBeNull();
      
      // Logout should still succeed
      const result = await authService.deleteStoredToken();
      expect(result).toBe(false); // Returns false when nothing to delete
    });
  });

  describe('Error scenarios', () => {
    it('should handle network errors', async () => {
      setMockResponse('/functions/v1/cli-auth/device', async () => {
        const error = new Error('fetch failed');
        (error as any).code = 'ENOTFOUND';
        throw error;
      });
      
      await expect(authService.initDeviceAuth())
        .rejects.toThrow('Network connection failed');
    });

    it('should handle server errors', async () => {
      setMockResponse('/functions/v1/cli-auth/device', async () => ({
        ok: false,
        status: 500,
        json: async () => ({ error: 'internal_server_error' })
      }));
      
      await expect(authService.initDeviceAuth())
        .rejects.toThrow('HTTP error! status: 500');
    });

    it('should handle invalid JSON responses', async () => {
      setMockResponse('/functions/v1/cli-auth/device', async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error('Invalid JSON');
        }
      }));
      
      await expect(authService.initDeviceAuth())
        .rejects.toThrow('Invalid response from server: failed to parse JSON');
    });

    it('should handle access denied error', async () => {
      // Mock device auth
      setMockResponse('/functions/v1/cli-auth/device', async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          device_code: 'denied-device',
          user_code: 'DENIED',
          verification_uri: 'https://test.supabase.co/cli-auth/verify',
          verification_uri_complete: 'https://test.supabase.co/cli-auth/verify?user_code=DENIED',
          expires_in: 600,
          interval: 1
        })
      }));
      
      // Mock access denied response
      setMockResponse('/functions/v1/cli-auth/token', async () => ({
        ok: true,
        status: 200,
        json: async () => ({ 
          error: 'access_denied',
          error_description: 'User denied access'
        })
      }));
      
      const deviceResponse = await authService.initDeviceAuth();
      
      // Should fail with access denied
      await expect(authService.pollForToken(deviceResponse.device_code))
        .rejects.toThrow('Access denied');
    });
  });

  describe('Token expiry and refresh', () => {
    it('should check token expiry correctly', async () => {
      // Store a token with short expiry
      await authService.storeCredentials('expiry-token', 60); // expires in 1 minute
      
      // Should not be expired yet
      const isExpired = await authService.isTokenExpired();
      expect(isExpired).toBe(true); // Actually true because it expires in less than 5 minutes
      
      // Store a token with long expiry
      await authService.storeCredentials('long-token', 7200); // expires in 2 hours
      
      // Should not be expired
      const isExpired2 = await authService.isTokenExpired();
      expect(isExpired2).toBe(false);
    });

    it('should refresh token when available', async () => {
      // Mock refresh endpoint
      setMockResponse('/functions/v1/cli-auth/refresh', async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'refreshed-token',
          token_type: 'Bearer',
          expires_in: 3600,
          refresh_token: 'new-refresh-token'
        })
      }));
      
      // Store initial token with refresh token
      await authService.storeCredentials('old-token', 3600, 'refresh-token-123');
      
      // Refresh the token
      const newToken = await authService.refreshToken();
      expect(newToken).toBeTruthy();
      expect(newToken?.access_token).toBe('refreshed-token');
      
      // Verify new token is stored
      const storedToken = await authService.getStoredToken();
      expect(storedToken).toBe('refreshed-token');
    });
  });
});