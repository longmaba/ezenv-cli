import fetch from 'node-fetch';
import { AuthService } from './auth.service';
import { CredentialService } from './credential.service';
import { ConfigService } from './config.service';
import { APIError, CLIError } from '../utils/errors';

export interface Project {
  id: string;
  name: string;
  team_id: string;
  team?: {
    id: string;
    name: string;
  };
  user_role?: 'admin' | 'manager' | 'member';
  created_at: string;
  updated_at: string;
}

export interface ProjectListResponse {
  projects: Project[];
  total: number;
  page: number;
  limit: number;
}

export interface ListOptions {
  page?: number;
  limit?: number;
  search?: string;
}

export class ProjectService {
  private baseUrl: string;
  private anonKey: string;
  private authService: AuthService;
  private configService: ConfigService;
  private cache: Map<string, { data: ProjectListResponse; timestamp: number }> = new Map();
  private readonly CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

  constructor() {
    const credentialService = new CredentialService();
    this.authService = new AuthService(credentialService);
    this.configService = new ConfigService();
    
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL environment variable is required');
    }
    this.baseUrl = supabaseUrl.replace(/\/$/, '');
    
    this.anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!this.anonKey) {
      console.warn('SUPABASE_ANON_KEY not found. API requests may fail.');
    }
  }

  async listProjects(options: ListOptions = {}): Promise<ProjectListResponse> {
    const { page = 1, limit = 20, search } = options;
    const cacheKey = `${page}-${limit}-${search || ''}`;
    
    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TIMEOUT) {
      return cached.data;
    }

    // Get stored token
    const token = await this.authService.getStoredToken();
    if (!token) {
      throw new CLIError('Not authenticated', 'AUTH_REQUIRED');
    }

    try {
      // Build query parameters
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (search) {
        params.append('search', search);
      }

      const response = await fetch(`${this.baseUrl}/rest/v1/projects?${params}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'apikey': this.anonKey,
          'Content-Type': 'application/json',
          'Prefer': 'count=exact'
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new APIError(401, 'Authentication expired', 'AUTH_EXPIRED');
        } else if (response.status === 403) {
          throw new APIError(403, 'Access denied', 'ACCESS_DENIED');
        } else {
          const errorText = await response.text();
          throw new APIError(
            response.status,
            `Failed to fetch projects: ${errorText}`,
            'FETCH_ERROR'
          );
        }
      }

      const projects = await response.json() as Project[];
      
      // Get total count from response headers
      const rangeHeader = response.headers.get('content-range');
      const total = rangeHeader ? parseInt(rangeHeader.split('/')[1], 10) : projects.length;

      const result: ProjectListResponse = {
        projects,
        total,
        page,
        limit,
      };

      // Cache the result
      this.cache.set(cacheKey, { data: result, timestamp: Date.now() });

      return result;
    } catch (error) {
      if (error instanceof APIError || error instanceof CLIError) {
        throw error;
      }
      
      if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
        throw new CLIError('Network connection failed', 'NETWORK_ERROR');
      }
      
      throw new CLIError(
        error instanceof Error ? error.message : 'Unknown error occurred',
        'UNKNOWN_ERROR'
      );
    }
  }

  async getProject(projectId: string): Promise<Project> {
    const token = await this.authService.getStoredToken();
    if (!token) {
      throw new CLIError('Not authenticated', 'AUTH_REQUIRED');
    }

    try {
      const response = await fetch(`${this.baseUrl}/rest/v1/projects?id=eq.${projectId}&select=*,team:teams(*)`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'apikey': this.anonKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new APIError(401, 'Authentication expired', 'AUTH_EXPIRED');
        } else if (response.status === 403) {
          throw new APIError(403, 'Access denied to project', 'ACCESS_DENIED');
        } else {
          throw new APIError(
            response.status,
            'Failed to fetch project',
            'FETCH_ERROR'
          );
        }
      }

      const projects = await response.json() as Project[];
      if (projects.length === 0) {
        throw new CLIError('Project not found', 'NOT_FOUND');
      }

      return projects[0];
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

  async getSelectedProject(): Promise<Project | null> {
    await this.configService.init();
    const selectedProjectId = this.configService.getSelectedProject();
    
    if (!selectedProjectId) {
      return null;
    }

    try {
      return await this.getProject(selectedProjectId);
    } catch (error) {
      if (error instanceof CLIError && (error.code === 'NOT_FOUND' || error.code === 'ACCESS_DENIED')) {
        // Selected project no longer exists or user lost access
        await this.configService.setSelectedProject('');
        await this.configService.clearSelectedEnvironment();
        return null;
      }
      throw error;
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}