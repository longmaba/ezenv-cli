import fetch from 'node-fetch';
import { AuthService } from './auth.service';
import { CredentialService } from './credential.service';
import { ConfigService } from './config.service';
import { APIError, CLIError } from '../utils/errors';
import { getSupabaseConfig } from '../config/defaults';

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

interface RawProjectResponse {
  id: string;
  name: string;
  team_id: string;
  created_at: string;
  updated_at: string;
  team?: {
    id: string;
    name: string;
    team_members?: Array<{
      role: 'admin' | 'manager' | 'member';
    }>;
  };
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
  private authService?: AuthService;
  private credentialService?: CredentialService;
  private configService: ConfigService;
  private cache: Map<string, { data: ProjectListResponse; timestamp: number }> = new Map();
  private readonly CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.configService = new ConfigService();
    
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
    }
    return this.authService;
  }

  async listProjects(options: ListOptions = {}): Promise<ProjectListResponse> {
    const { page = 1, limit = 20, search } = options;
    const cacheKey = `${page}-${limit}-${search || ''}`;
    
    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TIMEOUT) {
      return cached.data;
    }

    // Get stored token and user info
    const authService = this.getAuthService();
    const token = await authService.getStoredToken();
    if (!token) {
      throw new CLIError('Not authenticated', 'AUTH_REQUIRED');
    }
    
    const tokenData = await authService.getStoredTokenData();
    const userId = tokenData?.user_id;
    
    if (!userId) {
      throw new CLIError('User ID not found in authentication data', 'AUTH_ERROR');
    }

    try {
      // Build query parameters for Supabase
      const offset = (page - 1) * limit;
      const params = new URLSearchParams({
        offset: offset.toString(),
        limit: limit.toString(),
      });
      if (search) {
        // Supabase uses column filters for search
        params.append('name', `ilike.*${search}*`);
      }

      // Add select to include team information and user's role from team_members
      // This query gets projects with their teams and the current user's role in each team
      params.append('select', '*,team:teams!inner(id,name,team_members!inner(role))');
      
      // Filter team_members to only show current user's role
      params.append('team.team_members.user_id', `eq.${userId}`);
      
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

      const rawProjects = await response.json() as RawProjectResponse[];
      
      // Process projects to extract user role from nested structure
      const projects: Project[] = rawProjects.map(project => {
        const userRole = project.team?.team_members?.[0]?.role || 'member';
        
        return {
          id: project.id,
          name: project.name,
          team_id: project.team_id,
          team: project.team ? {
            id: project.team.id,
            name: project.team.name
          } : undefined,
          user_role: userRole as 'admin' | 'manager' | 'member',
          created_at: project.created_at,
          updated_at: project.updated_at
        };
      });
      
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
    const authService = this.getAuthService();
    const token = await authService.getStoredToken();
    if (!token) {
      throw new CLIError('Not authenticated', 'AUTH_REQUIRED');
    }
    
    const tokenData = await authService.getStoredTokenData();
    const userId = tokenData?.user_id;
    
    if (!userId) {
      throw new CLIError('User ID not found in authentication data', 'AUTH_ERROR');
    }

    try {
      const response = await fetch(`${this.baseUrl}/rest/v1/projects?id=eq.${projectId}&select=*,team:teams!inner(id,name,team_members!inner(role))&team.team_members.user_id=eq.${userId}`, {
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

      const rawProjects = await response.json() as RawProjectResponse[];
      if (rawProjects.length === 0) {
        throw new CLIError('Project not found', 'NOT_FOUND');
      }
      
      const project = rawProjects[0];
      const userRole = project.team?.team_members?.[0]?.role || 'member';
      
      return {
        id: project.id,
        name: project.name,
        team_id: project.team_id,
        team: project.team ? {
          id: project.team.id,
          name: project.team.name
        } : undefined,
        user_role: userRole as 'admin' | 'manager' | 'member',
        created_at: project.created_at,
        updated_at: project.updated_at
      };
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