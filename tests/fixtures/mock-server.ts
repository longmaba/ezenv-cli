import { setMockResponse } from '../__mocks__/node-fetch';
import type { TokenResponse } from '../../src/types';

export interface MockServerOptions {
  baseUrl?: string;
}

export class MockSupabaseServer {
  private baseUrl: string;
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
    // Email/Password auth endpoint
    setMockResponse('/auth/v1/token', async (url, options) => {
      // Parse query params from URL
      const urlObj = new URL(url, this.baseUrl);
      const grantType = urlObj.searchParams.get('grant_type');

      if (grantType === 'password') {
        const body = JSON.parse(options.body);
        const { email, password } = body;

        // Check for errors first
        if (this.networkErrors.has('/auth/v1/token')) {
          throw new Error('Network error');
        }
        
        const errorInfo = this.serverErrors.get('/auth/v1/token');
        if (errorInfo) {
          return {
            ok: false,
            status: errorInfo.status,
            json: async () => ({ error: errorInfo.error })
          };
        }

        // Simple validation
        if (!email || !password) {
          return {
            ok: false,
            status: 400,
            json: async () => ({ 
              error: 'invalid_request',
              error_description: 'Email and password are required' 
            })
          };
        }

        // Mock authentication logic
        if (email === 'test@example.com' && password === 'test123') {
          const token: TokenResponse = {
            access_token: `test_access_token_${Date.now()}`,
            refresh_token: `test_refresh_token_${Date.now()}`,
            token_type: 'Bearer',
            expires_in: 3600,
            user_id: '123e4567-e89b-12d3-a456-426614174000'
          };

          this.userTokens.set(token.access_token, token);
          
          return {
            ok: true,
            status: 200,
            json: async () => ({
              ...token,
              user: {
                id: '123e4567-e89b-12d3-a456-426614174000',
                email: email,
                created_at: new Date().toISOString()
              }
            })
          };
        } else {
          return {
            ok: false,
            status: 400,
            json: async () => ({ 
              error: 'invalid_grant',
              error_description: 'Invalid email or password' 
            })
          };
        }
      } else if (grantType === 'refresh_token') {
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
      }

      return {
        ok: false,
        status: 400,
        json: async () => ({ error: 'unsupported_grant_type' })
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

  }

  mockPasswordAuth(email: string, password: string, success: boolean = true): void {
    setMockResponse('/auth/v1/token?grant_type=password', async (url, options) => {
      const body = JSON.parse(options.body);
      
      if (body.email === email && body.password === password && success) {
        const token: TokenResponse = {
          access_token: `test_access_token_${Date.now()}`,
          refresh_token: `test_refresh_token_${Date.now()}`,
          token_type: 'Bearer',
          expires_in: 3600,
          user_id: '123e4567-e89b-12d3-a456-426614174000'
        };

        this.userTokens.set(token.access_token, token);
        
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ...token,
            user: {
              id: '123e4567-e89b-12d3-a456-426614174000',
              email: email,
              created_at: new Date().toISOString()
            }
          })
        };
      }
      
      return {
        ok: false,
        status: 400,
        json: async () => ({ 
          error: 'invalid_grant',
          error_description: 'Invalid email or password' 
        })
      };
    });
  }

  reset(): void {
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