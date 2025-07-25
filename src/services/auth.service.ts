import fetch from 'node-fetch';
import { exec } from 'child_process';
import { platform } from 'os';
import { CredentialService, StoredTokenData } from './credential.service';

export interface DeviceAuthResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  user_id?: string;
}

interface ErrorResponse {
  error: string;
  error_description?: string;
}

export type Environment = 'development' | 'staging' | 'production';

export class AuthService {
  private baseUrl: string;
  private pollingInterval: number = 5000; // 5 seconds
  private maxPollingTime: number = 600000; // 10 minutes
  private currentEnvironment: Environment = 'production';

  constructor(private credentialService: CredentialService) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL environment variable is required. Please set it to your Supabase project URL.');
    }
    // Remove trailing slash if present
    this.baseUrl = supabaseUrl.replace(/\/$/, '');
  }

  async initDeviceAuth(): Promise<DeviceAuthResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/functions/v1/cli-auth/device`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      let data: DeviceAuthResponse;
      try {
        data = await response.json() as DeviceAuthResponse;
      } catch (parseError) {
        throw new Error('Invalid response from server: failed to parse JSON');
      }
      return data;
    } catch (error) {
      const err = error as Error & { code?: string };
      if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
        const networkError = new Error('Network connection failed');
        (networkError as Error & { code?: string }).code = 'NETWORK_ERROR';
        throw networkError;
      }
      throw error;
    }
  }

  async pollForToken(deviceCode: string): Promise<TokenResponse> {
    const startTime = Date.now();

    while (Date.now() - startTime < this.maxPollingTime) {
      try {
        const response = await fetch(`${this.baseUrl}/functions/v1/cli-auth/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ device_code: deviceCode }),
        });

        let data: TokenResponse | ErrorResponse;
        try {
          data = await response.json() as TokenResponse | ErrorResponse;
        } catch (parseError) {
          throw new Error('Invalid response from server: failed to parse JSON');
        }

        // Check if it's an error response
        if ('error' in data) {
          if (data.error === 'authorization_pending') {
            // Continue polling
            await new Promise(resolve => setTimeout(resolve, this.pollingInterval));
            continue;
          } else if (data.error === 'expired_token') {
            const error = new Error('Authentication expired');
            (error as Error & { code?: string }).code = 'EXPIRED_TOKEN';
            throw error;
          } else if (data.error === 'access_denied') {
            const error = new Error('Access denied');
            (error as Error & { code?: string }).code = 'ACCESS_DENIED';
            throw error;
          } else {
            throw new Error(data.error_description || data.error);
          }
        }

        // Success - we have a token response
        return data as TokenResponse;
      } catch (error) {
        const err = error as Error & { code?: string };
        if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
          const networkError = new Error('Network connection failed');
          (networkError as Error & { code?: string }).code = 'NETWORK_ERROR';
          throw networkError;
        }
        throw error;
      }
    }

    // Timeout reached
    const error = new Error('Authentication timed out');
    (error as Error & { code?: string }).code = 'EXPIRED_TOKEN';
    throw error;
  }

  async openBrowser(url: string): Promise<void> {
    // Validate URL to prevent command injection
    try {
      new URL(url);
    } catch {
      throw new Error('Invalid URL provided');
    }

    return new Promise((resolve, reject) => {
      const platformName = platform();
      let command: string;
      let args: string[];

      switch (platformName) {
        case 'darwin':
          command = 'open';
          args = [url];
          break;
        case 'win32':
          command = 'cmd.exe';
          args = ['/c', 'start', '', url];
          break;
        default:
          // Linux and others
          command = 'xdg-open';
          args = [url];
      }

      const child = exec(`${command} ${args.map(arg => `"${arg.replace(/"/g, '\\"')}"`).join(' ')}`, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });

      // Ensure the child process is cleaned up
      child.on('error', reject);
    });
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

  async storeCredentials(token: string, expiresIn?: number, refreshToken?: string, userId?: string): Promise<void> {
    const expiresAt = expiresIn 
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : new Date(Date.now() + 3600 * 1000).toISOString(); // Default 1 hour

    const tokenData: StoredTokenData = {
      access_token: token,
      expires_at: expiresAt,
      environment: this.currentEnvironment,
      refresh_token: refreshToken,
      user_id: userId
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
      const response = await fetch(`${this.baseUrl}/functions/v1/cli-auth/refresh`, {
        method: 'POST',
        headers: {
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
        data.user_id || tokenData.user_id
      );

      return data;
    } catch (error) {
      if (process.env.DEBUG) {
        console.error('Token refresh error:', error);
      }
      return null;
    }
  }
}