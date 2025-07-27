import fetch from 'node-fetch';
import { AuthService } from './auth.service';
import { CredentialService } from './credential.service';
import { APIError, CLIError } from '../utils/errors';
import { logger } from '../utils/logger';
import { getSupabaseConfig } from '../config/defaults';

export interface GetSecretsRequest {
  projectName: string;
  environmentName: string;
}

export interface GetSecretsResponse {
  secrets: Record<string, string>;
}

export class SecretsService {
  private authService?: AuthService;
  private credentialService?: CredentialService;
  private baseUrl: string;
  private anonKey: string;

  constructor(_apiService?: unknown) {
    // _apiService parameter kept for backward compatibility but not used
    const { url, anonKey } = getSupabaseConfig();
    this.baseUrl = url;
    this.anonKey = anonKey;
  }

  private getAuthService(): AuthService {
    if (!this.credentialService) {
      this.credentialService = CredentialService.getInstance();
    }
    if (!this.authService) {
      this.authService = new AuthService(this.credentialService);
      this.authService.setEnvironment('production');
    }
    return this.authService;
  }

  async getSecrets(projectNameOrId: string, environmentNameOrId: string): Promise<Record<string, string>> {
    try {
      logger.debug('Fetching secrets', { projectNameOrId, environmentNameOrId });

      // Get auth token
      const token = await this.getAuthService().getStoredToken();
      if (!token) {
        throw new CLIError('Not authenticated', 'AUTH_REQUIRED');
      }

      let projectId: string;
      let environmentId: string;

      // Check if projectNameOrId is a UUID (has dashes in UUID format)
      const isProjectUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectNameOrId);
      
      if (isProjectUuid) {
        projectId = projectNameOrId;
      } else {
        // Get project by name
        const projectResponse = await fetch(
          `${this.baseUrl}/rest/v1/projects?name=eq.${encodeURIComponent(projectNameOrId)}&select=id`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'apikey': this.anonKey,
              'Content-Type': 'application/json',
            }
          }
        );

        if (!projectResponse.ok) {
          throw new APIError(projectResponse.status, 'Failed to fetch project', 'PROJECT_FETCH_ERROR');
        }

        const projects = await projectResponse.json() as Array<{ id: string }>;
        if (projects.length === 0) {
          throw new CLIError('Project not found', 'PROJECT_NOT_FOUND');
        }

        projectId = projects[0].id;
      }

      // Check if environmentNameOrId is a UUID
      const isEnvironmentUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(environmentNameOrId);
      
      if (isEnvironmentUuid) {
        environmentId = environmentNameOrId;
      } else {
        // Get environment by name and project ID
        const envResponse = await fetch(
          `${this.baseUrl}/rest/v1/environments?project_id=eq.${projectId}&name=eq.${encodeURIComponent(environmentNameOrId)}&select=id`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'apikey': this.anonKey,
              'Content-Type': 'application/json',
            }
          }
        );

        if (!envResponse.ok) {
          throw new APIError(envResponse.status, 'Failed to fetch environment', 'ENV_FETCH_ERROR');
        }

        const environments = await envResponse.json() as Array<{ id: string }>;
        if (environments.length === 0) {
          throw new CLIError('Environment not found', 'ENV_NOT_FOUND');
        }

        environmentId = environments[0].id;
      }

      // Call Edge Function to get decrypted secrets
      const secretsResponse = await fetch(
        `${this.baseUrl}/functions/v1/get-secrets`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'apikey': this.anonKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            projectId,
            environmentId
          })
        }
      );

      if (!secretsResponse.ok) {
        if (secretsResponse.status === 401) {
          throw new APIError(401, 'Authentication expired', 'AUTH_EXPIRED');
        } else if (secretsResponse.status === 403) {
          throw new APIError(403, 'Access denied', 'ACCESS_DENIED');
        } else if (secretsResponse.status === 404) {
          const error = await secretsResponse.json();
          throw new APIError(404, error.error || 'Not found', 'NOT_FOUND');
        } else {
          const errorText = await secretsResponse.text();
          throw new APIError(
            secretsResponse.status,
            `Failed to fetch secrets: ${errorText}`,
            'FETCH_ERROR'
          );
        }
      }

      const response = await secretsResponse.json() as { secrets: Record<string, string> };
      const secrets = response.secrets || {};
      
      // Never log secret values
      logger.debug('Secrets fetched successfully', { 
        count: Object.keys(secrets).length 
      });

      return secrets;
    } catch (error) {
      if (error instanceof APIError || error instanceof CLIError) {
        throw error;
      }

      logger.error('Failed to fetch secrets', error);
      throw new CLIError(
        'Failed to fetch secrets',
        'SECRETS_FETCH_FAILED',
        { projectNameOrId, environmentNameOrId }
      );
    }
  }
}