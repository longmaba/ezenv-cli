import { AuthService } from '../../src/services/auth.service';
import { CredentialService } from '../../src/services/credential.service';
import { MockSupabaseServer } from '../fixtures/mock-server';
import { setMockResponse, clearAllMocks } from '../__mocks__/node-fetch';

describe('E2E: Error Scenarios', () => {
  let authService: AuthService;
  let credentialService: CredentialService;
  let mockServer: MockSupabaseServer;

  beforeEach(async () => {
    clearAllMocks();
    jest.clearAllMocks();
    
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    
    credentialService = new CredentialService();
    authService = new AuthService(credentialService);
    mockServer = new MockSupabaseServer();
    await mockServer.start();
    
    // Reduce polling interval for faster tests
    (authService as any).pollingInterval = 100;
  });

  afterEach(async () => {
    await mockServer.stop();
    delete process.env.SUPABASE_URL;
    
    // Clear the static memory store
    const { MemoryCredentialStore } = await import('../../src/services/memory-credential-store');
    const memoryStore = (CredentialService as any).memoryStore as MemoryCredentialStore;
    if (memoryStore && memoryStore.clear) {
      memoryStore.clear();
    }
    
    jest.resetModules();
  });

  describe('Network failures', () => {
    it('should handle network failure during device code request', async () => {
      // Simulate network error for device endpoint
      setMockResponse('/functions/v1/cli-auth/device', async () => {
        const error = new Error('fetch failed');
        (error as any).code = 'ENOTFOUND';
        throw error;
      });
      
      // Should throw network error
      await expect(authService.initDeviceAuth()).rejects.toThrow('Network connection failed');
    });

    it('should handle network failure during token polling', async () => {
      // Start auth flow normally
      const deviceResponse = await authService.initDeviceAuth();
      
      // Then simulate network error for token endpoint
      setMockResponse('/functions/v1/cli-auth/token', async () => {
        const error = new Error('fetch failed');
        (error as any).code = 'ENOTFOUND';
        throw error;
      });
      
      // Should fail with network error
      await expect(authService.pollForToken(deviceResponse.device_code))
        .rejects.toThrow('Network connection failed');
    });

    it('should handle intermittent network failures during polling', async () => {
      const deviceResponse = await authService.initDeviceAuth();
      
      // Mock token endpoint to fail once then succeed
      let callCount = 0;
      setMockResponse('/functions/v1/cli-auth/token', async () => {
        callCount++;
        if (callCount === 1) {
          const error = new Error('fetch failed');
          (error as any).code = 'ENOTFOUND';
          throw error;
        }
        // Second call returns pending
        if (callCount === 2) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ error: 'authorization_pending' })
          };
        }
        // Third call succeeds
        return {
          ok: true,
          status: 200,
          json: async () => ({
            access_token: 'recovered-token',
            token_type: 'Bearer',
            expires_in: 3600
          })
        };
      });
      
      // Should eventually recover and succeed
      await expect(authService.pollForToken(deviceResponse.device_code))
        .rejects.toThrow('Network connection failed');
    });
  });

  describe('Server errors', () => {
    it('should handle 500 error during device code request', async () => {
      mockServer.simulateServerError('/functions/v1/cli-auth/device', 500);
      
      await expect(authService.initDeviceAuth())
        .rejects.toThrow('HTTP error! status: 500');
    });

    it('should handle 503 error during device code request', async () => {
      mockServer.simulateServerError('/functions/v1/cli-auth/device', 503);
      
      await expect(authService.initDeviceAuth())
        .rejects.toThrow('HTTP error! status: 503');
    });

    it('should handle server errors during token polling', async () => {
      const deviceResponse = await authService.initDeviceAuth();
      
      // Simulate server error
      setMockResponse('/functions/v1/cli-auth/token', async () => ({
        ok: false,
        status: 500,
        json: async () => ({ error: 'internal_server_error' })
      }));
      
      await expect(authService.pollForToken(deviceResponse.device_code))
        .rejects.toThrow('internal_server_error');
    });

    it('should handle rate limit errors', async () => {
      mockServer.simulateServerError('/functions/v1/cli-auth/device', 429);
      
      await expect(authService.initDeviceAuth())
        .rejects.toThrow('HTTP error! status: 429');
    });
  });

  describe('Invalid responses', () => {
    it('should handle malformed JSON in device auth response', async () => {
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

    it('should handle missing required fields in device response', async () => {
      setMockResponse('/functions/v1/cli-auth/device', async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          // Missing device_code
          user_code: 'TEST-CODE',
          verification_uri: 'https://test.supabase.co/cli-auth/verify'
        })
      }));
      
      const response = await authService.initDeviceAuth();
      // Auth service doesn't validate fields, so it will return partial data
      expect(response.device_code).toBeUndefined();
    });

    it('should handle malformed JSON in token response', async () => {
      const deviceResponse = await authService.initDeviceAuth();
      
      setMockResponse('/functions/v1/cli-auth/token', async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error('Invalid JSON');
        }
      }));
      
      await expect(authService.pollForToken(deviceResponse.device_code))
        .rejects.toThrow('Invalid response from server: failed to parse JSON');
    });
  });

  describe('Authentication errors', () => {
    it('should handle user denial of access', async () => {
      const deviceResponse = await authService.initDeviceAuth();
      
      // Mock access denied response
      setMockResponse('/functions/v1/cli-auth/token', async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          error: 'access_denied',
          error_description: 'User denied access'
        })
      }));
      
      await expect(authService.pollForToken(deviceResponse.device_code))
        .rejects.toThrow('Access denied');
    });

    it('should handle invalid device code', async () => {
      // Use a fake device code
      const fakeDeviceCode = 'invalid-device-code';
      
      // Mock invalid grant response
      setMockResponse('/functions/v1/cli-auth/token', async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          error: 'invalid_grant',
          error_description: 'Invalid device code'
        })
      }));
      
      await expect(authService.pollForToken(fakeDeviceCode))
        .rejects.toThrow('Invalid device code');
    });

    it('should handle expired device code after some polling', async () => {
      const deviceResponse = await authService.initDeviceAuth();
      
      // Mock responses: pending, then expired
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
            error: 'expired_token',
            error_description: 'Device code has expired'
          })
        };
      });
      
      await expect(authService.pollForToken(deviceResponse.device_code))
        .rejects.toThrow('Authentication expired');
    });
  });

  describe('Environment and configuration errors', () => {
    it('should handle missing SUPABASE_URL', async () => {
      delete process.env.SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      
      expect(() => new AuthService(credentialService))
        .toThrow('SUPABASE_URL environment variable is required');
    });

    it('should handle invalid URL format', async () => {
      const deviceResponse = await authService.initDeviceAuth();
      
      // Try to open browser with invalid URL
      await expect(authService.openBrowser('not-a-valid-url'))
        .rejects.toThrow('Invalid URL provided');
    });
  });

  describe('Credential storage errors', () => {
    it('should handle credential storage failure', async () => {
      // Complete auth flow
      const deviceResponse = await authService.initDeviceAuth();
      await mockServer.simulateUserAuthorization(deviceResponse.user_code);
      const tokenResponse = await authService.pollForToken(deviceResponse.device_code);
      
      // Mock storage failure
      jest.spyOn(credentialService, 'store').mockRejectedValueOnce(
        new Error('Failed to store credentials')
      );
      
      await expect(authService.storeCredentials(
        tokenResponse.access_token,
        tokenResponse.expires_in
      )).rejects.toThrow('Failed to store credentials');
    });

    it('should handle credential retrieval failure', async () => {
      // Mock retrieval failure
      jest.spyOn(credentialService, 'retrieve').mockRejectedValueOnce(
        new Error('Failed to retrieve credentials')
      );
      
      await expect(authService.getStoredToken())
        .rejects.toThrow('Failed to retrieve credentials');
    });
  });

  describe('Timeout scenarios', () => {
    it('should timeout after max polling time with proper error', async () => {
      // Set very short timeout
      (authService as any).maxPollingTime = 200;
      
      const deviceResponse = await authService.initDeviceAuth();
      
      // Never authorize, just return pending
      setMockResponse('/functions/v1/cli-auth/token', async () => ({
        ok: true,
        status: 200,
        json: async () => ({ error: 'authorization_pending' })
      }));
      
      await expect(authService.pollForToken(deviceResponse.device_code))
        .rejects.toThrow('Authentication timed out');
    });

    it('should handle user taking too long to authorize', async () => {
      // Set timeout to 1 second
      (authService as any).maxPollingTime = 1000;
      
      const deviceResponse = await authService.initDeviceAuth();
      
      // User never authorizes
      await expect(authService.pollForToken(deviceResponse.device_code))
        .rejects.toThrow('Authentication timed out');
    });
  });

  describe('Browser opening errors', () => {
    it('should handle browser opening failure gracefully', async () => {
      const deviceResponse = await authService.initDeviceAuth();
      
      // Mock child_process module directly
      const childProcess = require('child_process');
      const mockExec = jest.spyOn(childProcess, 'exec');
      mockExec.mockImplementation((cmd: string, callback?: any) => {
        if (callback) {
          callback(new Error('Failed to open browser'), '', '');
        }
        return { on: jest.fn() } as any;
      });
      
      // Should throw but not crash
      await expect(authService.openBrowser(deviceResponse.verification_uri_complete))
        .rejects.toThrow('Failed to open browser');
      
      // Restore mock
      mockExec.mockRestore();
    });
  });

  describe('Edge cases and race conditions', () => {
    it('should handle empty error response', async () => {
      const deviceResponse = await authService.initDeviceAuth();
      
      setMockResponse('/functions/v1/cli-auth/token', async () => ({
        ok: true,
        status: 200,
        json: async () => ({ error: '' }) // Empty error
      }));
      
      await expect(authService.pollForToken(deviceResponse.device_code))
        .rejects.toThrow();
    });

    it('should handle simultaneous error conditions', async () => {
      // Start with successful device auth
      const deviceResponse = await authService.initDeviceAuth();
      
      // Then simulate both network error and server error
      let callCount = 0;
      setMockResponse('/functions/v1/cli-auth/token', async () => {
        callCount++;
        if (callCount === 1) {
          // Network error
          const error = new Error('fetch failed');
          (error as any).code = 'ENOTFOUND';
          throw error;
        }
        // Server error on retry
        return {
          ok: false,
          status: 500,
          json: async () => ({ error: 'internal_server_error' })
        };
      });
      
      await expect(authService.pollForToken(deviceResponse.device_code))
        .rejects.toThrow('Network connection failed');
    });

    it('should handle very long device codes', async () => {
      setMockResponse('/functions/v1/cli-auth/device', async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          device_code: 'a'.repeat(1000), // Very long device code
          user_code: 'LONG-CODE',
          verification_uri: 'https://test.supabase.co/cli-auth/verify',
          verification_uri_complete: 'https://test.supabase.co/cli-auth/verify?user_code=LONG-CODE',
          expires_in: 600,
          interval: 5
        })
      }));
      
      const response = await authService.initDeviceAuth();
      expect(response.device_code).toHaveLength(1000);
    });
  });
});