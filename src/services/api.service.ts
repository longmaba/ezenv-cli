import { CredentialService } from './credential.service';
import { ConfigService } from './config.service';
import { AuthService } from './auth.service';
import { APIError, CLIError } from '../utils/errors';
import { logger } from '../utils/logger';

export interface RequestOptions {
  headers?: Record<string, string>;
  body?: unknown;
}

export class APIService {
  private baseUrl: string;
  private authService: AuthService;

  constructor(
    credentialService: CredentialService,
    configService: ConfigService
  ) {
    const env = configService.getActiveEnvironment();
    this.baseUrl = env === 'production' 
      ? 'https://api.ezenv.dev'
      : env === 'staging'
      ? 'https://api-staging.ezenv.dev'
      : 'http://localhost:8000';
    
    // Create AuthService with production environment as default
    this.authService = new AuthService(credentialService);
    this.authService.setEnvironment('production');
  }

  async request<T>(
    method: string,
    path: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    
    // Get auth token using AuthService
    const authToken = await this.authService.getStoredToken();
    if (!authToken) {
      throw new CLIError('Not authenticated', 'NOT_AUTHENTICATED');
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      ...options.headers
    };

    logger.debug(`API Request: ${method} ${url}`, { headers: { ...headers, Authorization: 'Bearer [REDACTED]' } });

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined
      });

      const responseData = await response.json() as Record<string, unknown>;

      if (!response.ok) {
        throw new APIError(
          response.status,
          (responseData.message as string) || 'API request failed',
          (responseData.code as string) || 'API_ERROR',
          responseData.details
        );
      }

      return responseData as T;
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      
      logger.error('API request failed', { error, url, method });
      throw new CLIError('Failed to connect to API', 'CONNECTION_ERROR', { error });
    }
  }

  async get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('GET', path, options);
  }

  async post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('POST', path, { ...options, body });
  }

  async put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('PUT', path, { ...options, body });
  }

  async delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('DELETE', path, options);
  }
}