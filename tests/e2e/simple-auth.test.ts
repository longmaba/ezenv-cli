import { AuthService } from '../../src/services/auth.service';
import { CredentialService } from '../../src/services/credential.service';
import { setMockResponse, clearAllMocks } from '../__mocks__/node-fetch';

describe('Simple Auth Flow Test', () => {
  let authService: AuthService;
  let credentialService: CredentialService;

  beforeEach(() => {
    clearAllMocks();
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    
    credentialService = new CredentialService();
    authService = new AuthService(credentialService);
  });

  afterEach(() => {
    delete process.env.SUPABASE_URL;
  });

  it('should complete auth flow', async () => {
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

    // Start device auth
    const deviceResponse = await authService.initDeviceAuth();
    expect(deviceResponse.device_code).toBe('test-device-123');
    expect(deviceResponse.user_code).toBe('TEST-CODE');

    // Mock token response - first pending, then success
    let callCount = 0;
    setMockResponse('/functions/v1/cli-auth/token', async () => {
      callCount++;
      if (callCount < 2) {
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
          access_token: 'test-token-123',
          token_type: 'Bearer',
          expires_in: 3600,
          refresh_token: 'refresh-123'
        })
      };
    });

    // Poll for token (should succeed on second attempt)
    const tokenResponse = await authService.pollForToken(deviceResponse.device_code);
    
    expect(tokenResponse.access_token).toBe('test-token-123');
    expect(callCount).toBe(2); // Should have polled twice
  });

  it('should handle network errors', async () => {
    // Mock network error
    setMockResponse('/functions/v1/cli-auth/device', async () => {
      const error = new Error('fetch failed');
      (error as any).code = 'ENOTFOUND';
      throw error;
    });

    await expect(authService.initDeviceAuth()).rejects.toThrow('Network connection failed');
  });

  it('should handle server errors', async () => {
    setMockResponse('/functions/v1/cli-auth/device', async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: 'internal_server_error' })
    }));

    await expect(authService.initDeviceAuth()).rejects.toThrow('HTTP error! status: 500');
  });
});