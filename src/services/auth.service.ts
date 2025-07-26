import fetch from 'node-fetch';
import { CredentialService, StoredTokenData } from './credential.service';
import { getSupabaseConfig } from '../config/defaults';

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  user_id?: string;
}

export type Environment = 'development' | 'staging' | 'production';

export class AuthService {
  private baseUrl: string;
  private currentEnvironment: Environment = 'production';
  private supabaseAnonKey: string;
  
  // Constants for retry logic
  private static readonly MAX_RETRY_ATTEMPTS = 3;
  private static readonly RETRY_BASE_DELAY_MS = 1000;

  constructor(private credentialService: CredentialService) {
    const { url, anonKey } = getSupabaseConfig();
    this.baseUrl = url;
    this.supabaseAnonKey = anonKey;
  }




  setEnvironment(environment: Environment): void {
    this.currentEnvironment = environment;
  }

  getEnvironment(): Environment {
    return this.currentEnvironment;
  }

  private getServiceName(): string {
    return `ezenv-cli-${this.currentEnvironment}`;
  }

  async storeCredentials(token: string, expiresIn?: number, refreshToken?: string, userId?: string, userEmail?: string): Promise<void> {
    const expiresAt = expiresIn 
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : new Date(Date.now() + 3600 * 1000).toISOString(); // Default 1 hour

    const tokenData: StoredTokenData = {
      access_token: token,
      expires_at: expiresAt,
      environment: this.currentEnvironment,
      refresh_token: refreshToken,
      user_id: userId,
      user_email: userEmail
    };

    await this.credentialService.store(
      this.getServiceName(),
      'token_data',
      JSON.stringify(tokenData)
    );
  }

  async getStoredTokenData(): Promise<StoredTokenData | null> {
    const data = await this.credentialService.retrieve(
      this.getServiceName(),
      'token_data'
    );
    
    if (!data) {
      return null;
    }

    try {
      return JSON.parse(data) as StoredTokenData;
    } catch {
      // Handle old format tokens
      return {
        access_token: data,
        expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
        environment: this.currentEnvironment
      };
    }
  }

  async getStoredToken(): Promise<string | null> {
    const tokenData = await this.getStoredTokenData();
    return tokenData?.access_token || null;
  }

  async deleteStoredToken(): Promise<boolean> {
    return await this.credentialService.delete(
      this.getServiceName(),
      'token_data'
    );
  }

  async isTokenExpired(): Promise<boolean> {
    const tokenData = await this.getStoredTokenData();
    if (!tokenData) {
      return true;
    }

    const expiresAt = new Date(tokenData.expires_at);
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    // Token is expired or will expire in less than 5 minutes
    return expiresAt <= fiveMinutesFromNow;
  }

  async refreshToken(): Promise<TokenResponse | null> {
    const tokenData = await this.getStoredTokenData();
    if (!tokenData?.refresh_token) {
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: {
          'apikey': this.supabaseAnonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: tokenData.refresh_token }),
      });

      if (!response.ok) {
        // Log refresh failure in debug mode for troubleshooting
        if (process.env.DEBUG) {
          console.error(`Token refresh failed with status: ${response.status}`);
        }
        return null;
      }

      let data: TokenResponse;
      try {
        data = await response.json() as TokenResponse;
      } catch (parseError) {
        if (process.env.DEBUG) {
          console.error('Failed to parse refresh token response:', parseError);
        }
        return null;
      }
      
      // Store the new token
      await this.storeCredentials(
        data.access_token,
        data.expires_in,
        data.refresh_token || tokenData.refresh_token,
        data.user_id || tokenData.user_id,
        tokenData.user_email
      );

      return data;
    } catch (error) {
      if (process.env.DEBUG) {
        console.error('Token refresh error:', error);
      }
      return null;
    }
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      const token = await this.getStoredToken();
      if (!token) {
        return false;
      }

      // Check if token is expired
      const tokenData = await this.getStoredTokenData();
      if (tokenData && tokenData.expires_at) {
        const expiresAt = new Date(tokenData.expires_at);
        if (expiresAt < new Date()) {
          // Try to refresh if we have a refresh token
          if (tokenData.refresh_token) {
            const newToken = await this.refreshToken();
            return !!newToken;
          }
          return false;
        }
      }

      return true;
    } catch (error) {
      if (process.env.DEBUG) {
        console.error('Authentication check error:', error);
      }
      return false;
    }
  }

  async authenticateWithPassword(email: string, password: string): Promise<void> {
    let retryCount = 0;
    
    while (retryCount < AuthService.MAX_RETRY_ATTEMPTS) {
      try {
        const response = await fetch(`${this.baseUrl}/auth/v1/token?grant_type=password`, {
          method: 'POST',
          headers: {
            'apikey': this.supabaseAnonKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            password,
            gotrue_meta_security: {}
          }),
        });

      if (!response.ok) {
        const errorData = await response.text();
        let errorMessage = 'Authentication failed';
        let errorCode = 'UNKNOWN_ERROR';

        // Parse error response
        try {
          const parsedError = JSON.parse(errorData);
          errorMessage = parsedError.error_description || parsedError.msg || parsedError.error || errorMessage;
          
          // Map Supabase error codes to our error codes
          errorCode = this.mapAuthError(response, errorMessage);
        } catch {
          // If error response is not JSON, use default message
        }

        const error = new Error(errorMessage);
        (error as Error & { code?: string }).code = errorCode;
        throw error;
      }

      interface AuthResponseData {
        access_token: string;
        expires_in: number;
        refresh_token?: string;
        user?: {
          id?: string;
          email?: string;
        };
      }
      const data = await response.json() as AuthResponseData;
      
      // Store credentials
      await this.storeCredentials(
        data.access_token,
        data.expires_in,
        data.refresh_token,
        data.user?.id,
        data.user?.email || email
      );
      return; // Success, exit the retry loop
    } catch (error) {
      const err = error as Error & { code?: string };
      if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
        // Network error - retry after delay
        retryCount++;
        if (retryCount < AuthService.MAX_RETRY_ATTEMPTS) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, retryCount - 1) * AuthService.RETRY_BASE_DELAY_MS;
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        const networkError = new Error('Network connection failed');
        (networkError as Error & { code?: string }).code = 'NETWORK_ERROR';
        throw networkError;
      }
      throw error;
    }
    }
  }

  async logout(): Promise<void> {
    await this.deleteStoredToken();
  }

  private mapAuthError(response: { status: number }, errorMessage: string): string {
    if (response.status === 400 && errorMessage.toLowerCase().includes('invalid')) {
      return 'INVALID_CREDENTIALS';
    } else if (response.status === 429) {
      return 'RATE_LIMITED';
    } else if (response.status >= 500) {
      return 'SERVER_ERROR';
    }
    return 'UNKNOWN_ERROR';
  }

  async getCurrentUser(): Promise<unknown | null> {
    const tokenData = await this.getStoredTokenData();
    if (!tokenData?.access_token) {
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/auth/v1/user`, {
        method: 'GET',
        headers: {
          'apikey': this.supabaseAnonKey,
          'Authorization': `Bearer ${tokenData.access_token}`,
        },
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      if (process.env.DEBUG) {
        console.error('Get current user error:', error);
      }
      return null;
    }
  }
}