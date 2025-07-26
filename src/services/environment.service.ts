import fetch from 'node-fetch';
import { AuthService } from './auth.service';
import { ConfigService } from './config.service';
import { CredentialService } from './credential.service';
import { ProjectService } from './project.service';
import { APIError, CLIError } from '../utils/errors';
import { logger } from '../utils/logger';
import { getSupabaseConfig } from '../config/defaults';

export interface Environment {
  id: string;
  project_id: string;
  name: string;
  updated_at: string;
  created_at: string;
  secrets_count?: number;
}

export interface EnvironmentListResponse {
  environments: Environment[];
}

const ENV_ALIASES: Record<string, string> = {
  'dev': 'development',
  'develop': 'development',
  'stage': 'staging',
  'stg': 'staging',
  'prod': 'production',
  'prd': 'production'
};

export class EnvironmentService {
  private authService?: AuthService;
  private credentialService?: CredentialService;
  private projectService: ProjectService;
  private baseUrl: string;
  private anonKey: string;

  constructor(private configService: ConfigService) {
    this.projectService = new ProjectService();
    
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

  async listEnvironments(projectId: string): Promise<Environment[]> {
    try {
      logger.debug('Fetching environments for project', { projectId });
      
      // Get auth token
      const token = await this.getAuthService().getStoredToken();
      if (!token) {
        throw new CLIError('Not authenticated', 'AUTH_REQUIRED');
      }

      // Query environments from Supabase
      const response = await fetch(
        `${this.baseUrl}/rest/v1/environments?project_id=eq.${projectId}&order=name`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'apikey': this.anonKey,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          throw new APIError(401, 'Authentication expired', 'AUTH_EXPIRED');
        } else if (response.status === 403) {
          throw new CLIError(
            'You do not have access to this project',
            'ACCESS_DENIED',
            { projectId }
          );
        } else {
          const errorText = await response.text();
          throw new APIError(
            response.status,
            `Failed to fetch environments: ${errorText}`,
            'FETCH_ERROR'
          );
        }
      }

      const environments = await response.json() as Environment[];
      return environments;
    } catch (error) {
      if (error instanceof APIError || error instanceof CLIError) {
        throw error;
      }
      
      throw new CLIError(
        error instanceof Error ? error.message : 'Unknown error occurred',
        'UNKNOWN_ERROR'
      );
    }
  }

  async getEnvironment(projectId: string, envName: string): Promise<Environment | null> {
    try {
      const environments = await this.listEnvironments(projectId);
      return environments.find(env => 
        env.name.toLowerCase() === envName.toLowerCase()
      ) || null;
    } catch (error) {
      logger.error('Failed to get environment', { projectId, envName, error });
      throw error;
    }
  }

  async selectEnvironment(envName: string): Promise<void> {
    const selectedProject = await this.projectService.getSelectedProject();
    if (!selectedProject) {
      throw new CLIError(
        'No project selected',
        'NO_PROJECT_SELECTED'
      );
    }

    const environment = await this.getEnvironment(selectedProject.id, envName);
    if (!environment) {
      throw new CLIError(
        `Environment "${envName}" not found in project "${selectedProject.name}"`,
        'ENVIRONMENT_NOT_FOUND',
        { envName, projectName: selectedProject.name }
      );
    }

    await this.configService.selectEnvironment(environment);
    logger.info('Environment selected', { 
      environmentId: environment.id, 
      environmentName: environment.name 
    });
  }

  resolveEnvironmentAlias(alias: string): string {
    const lowercaseAlias = alias.toLowerCase();
    return ENV_ALIASES[lowercaseAlias] || alias;
  }

  async getSelectedEnvironment(): Promise<Environment | null> {
    const selectedEnvId = this.configService.getSelectedEnvironment();
    if (!selectedEnvId) {
      return null;
    }

    const selectedProject = await this.projectService.getSelectedProject();
    if (!selectedProject) {
      return null;
    }

    try {
      const environments = await this.listEnvironments(selectedProject.id);
      return environments.find(env => env.id === selectedEnvId) || null;
    } catch (error) {
      logger.error('Failed to get selected environment', { error });
      return null;
    }
  }
}