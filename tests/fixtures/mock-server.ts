import { setMockResponse } from '../__mocks__/node-fetch';
import type { DeviceAuthResponse, TokenResponse } from '../../src/types';

export interface MockServerOptions {
  baseUrl?: string;
}

export class MockSupabaseServer {
  private baseUrl: string;
  private deviceCodes: Map<string, { userCode: string; authorized: boolean; expired: boolean }> = new Map();
  private userTokens: Map<string, TokenResponse> = new Map();
  private networkErrors: Set<string> = new Set();
  private serverErrors: Map<string, { status: number; error: string }> = new Map();

  constructor(options: MockServerOptions = {}) {
    this.baseUrl = options.baseUrl || 'https://test.supabase.co';
  }

  async start(): Promise<void> {
    this.setupDefaultHandlers();
  }

  async stop(): Promise<void> {
    this.reset();
  }

  private setupDefaultHandlers() {
    // Device auth endpoint
    setMockResponse('/functions/v1/cli-auth/device', async (url, options) => {
      // Check for errors first
      if (this.networkErrors.has('/functions/v1/cli-auth/device')) {
        throw new Error('Network error');
      }
      
      const errorInfo = this.serverErrors.get('/functions/v1/cli-auth/device');
      if (errorInfo) {
        return {
          ok: false,
          status: errorInfo.status,
          json: async () => ({ error: errorInfo.error })
        };
      }

      const deviceCode = `device_${Date.now()}`;
      const userCode = `${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      
      this.deviceCodes.set(deviceCode, { userCode, authorized: false, expired: false });
      
      return {
        ok: true,
        status: 200,
        json: async () => ({
          device_code: deviceCode,
          user_code: userCode,
          verification_uri: `${this.baseUrl}/cli-auth/verify`,
          verification_uri_complete: `${this.baseUrl}/cli-auth/verify?user_code=${userCode}`,
          expires_in: 600,
          interval: 1
        })
      };
    });

    // Token exchange endpoint
    setMockResponse('/functions/v1/cli-auth/token', async (url, options) => {
      // Check for errors first
      if (this.networkErrors.has('/functions/v1/cli-auth/token')) {
        throw new Error('Network error');
      }
      
      const errorInfo = this.serverErrors.get('/functions/v1/cli-auth/token');
      if (errorInfo) {
        return {
          ok: false,
          status: errorInfo.status,
          json: async () => ({ error: errorInfo.error })
        };
      }

      const body = JSON.parse(options.body);
      const deviceCode = body.device_code;
      
      const device = this.deviceCodes.get(deviceCode || '');
      if (!device) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ 
            error: 'invalid_grant', 
            error_description: 'Invalid device code' 
          })
        };
      }

      if (device.expired) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ 
            error: 'expired_token', 
            error_description: 'Device code has expired' 
          })
        };
      }

      if (!device.authorized) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ error: 'authorization_pending' })
        };
      }

      const token: TokenResponse = {
        access_token: `test_access_token_${Date.now()}`,
        refresh_token: `test_refresh_token_${Date.now()}`,
        token_type: 'Bearer',
        expires_in: 3600,
        project_ref: 'test_project'
      };

      this.userTokens.set(token.access_token, token);
      return {
        ok: true,
        status: 200,
        json: async () => token
      };
    });

    // User endpoint for status check
    setMockResponse('/auth/v1/user', async (url, options) => {
      const authHeader = options?.headers?.['Authorization'] || options?.headers?.['authorization'];
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return {
          ok: false,
          status: 401,
          json: async () => ({ error: 'unauthorized' })
        };
      }

      const token = authHeader.substring(7);
      if (this.userTokens.has(token)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: '123e4567-e89b-12d3-a456-426614174000',
            email: 'test@example.com',
            created_at: new Date().toISOString()
          })
        };
      }

      return {
        ok: false,
        status: 401,
        json: async () => ({ error: 'invalid_token' })
      };
    });

    // Refresh token endpoint
    setMockResponse('/functions/v1/cli-auth/refresh', async (url, options) => {
      const body = JSON.parse(options.body);
      const refreshToken = body.refresh_token;

      if (!refreshToken) {
        return {
          ok: false,
          status: 400,
          json: async () => ({ error: 'invalid_request' })
        };
      }

      // Generate new tokens
      const token: TokenResponse = {
        access_token: `refreshed_access_token_${Date.now()}`,
        refresh_token: `refreshed_refresh_token_${Date.now()}`,
        token_type: 'Bearer',
        expires_in: 3600
      };

      this.userTokens.set(token.access_token, token);
      return {
        ok: true,
        status: 200,
        json: async () => token
      };
    });
  }

  mockDeviceAuth(response: Partial<DeviceAuthResponse>): void {
    setMockResponse('/functions/v1/cli-auth/device', async () => ({
      ok: true,
      status: 200,
      json: async () => response
    }));
  }

  mockTokenExchange(deviceCode: string, response: TokenResponse | { error: string }): void {
    setMockResponse('/functions/v1/cli-auth/token', async (url, options) => {
      const body = JSON.parse(options.body);
      
      if (body.device_code === deviceCode) {
        if ('error' in response) {
          return {
            ok: true,
            status: 200,
            json: async () => response
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => response
        };
      }
      
      return {
        ok: true,
        status: 200,
        json: async () => ({ error: 'invalid_grant' })
      };
    });
  }

  async simulateUserAuthorization(userCode: string): Promise<void> {
    // Find device by user code
    for (const [deviceCode, device] of this.deviceCodes.entries()) {
      if (device.userCode === userCode) {
        device.authorized = true;
        return;
      }
    }
    throw new Error(`User code ${userCode} not found`);
  }

  simulateDeviceExpiry(deviceCode: string): void {
    const device = this.deviceCodes.get(deviceCode);
    if (device) {
      device.expired = true;
    }
  }

  reset(): void {
    this.deviceCodes.clear();
    this.userTokens.clear();
    this.networkErrors.clear();
    this.serverErrors.clear();
    this.setupDefaultHandlers();
  }

  // Helper for simulating network errors
  simulateNetworkError(endpoint: string): void {
    this.networkErrors.add(endpoint);
    setMockResponse(endpoint, async () => {
      throw new Error('fetch failed');
    });
  }

  // Helper for simulating server errors
  simulateServerError(endpoint: string, status: number = 500): void {
    this.serverErrors.set(endpoint, { status, error: 'internal_server_error' });
    setMockResponse(endpoint, async () => ({
      ok: false,
      status,
      json: async () => ({ error: 'internal_server_error' })
    }));
  }
}