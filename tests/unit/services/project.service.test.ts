import { ProjectService } from '../../../src/services/project.service';
import { AuthService } from '../../../src/services/auth.service';
import { CredentialService } from '../../../src/services/credential.service';
import { ConfigService } from '../../../src/services/config.service';
import { APIError, CLIError } from '../../../src/utils/errors';
import fetch from 'node-fetch';

jest.mock('node-fetch');
jest.mock('../../../src/services/auth.service');
jest.mock('../../../src/services/credential.service');
jest.mock('../../../src/services/config.service');

const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('ProjectService', () => {
  let projectService: ProjectService;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockCredentialService: jest.Mocked<CredentialService>;
  let mockConfigService: jest.Mocked<ConfigService>;

  const mockProjects = [
    {
      id: 'proj-1',
      name: 'Test Project 1',
      team_id: 'team-1',
      team: { id: 'team-1', name: 'Test Team' },
      user_role: 'admin' as const,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    },
    {
      id: 'proj-2',
      name: 'Test Project 2',
      team_id: 'team-2',
      team: { id: 'team-2', name: 'Another Team' },
      user_role: 'member' as const,
      created_at: '2024-01-02T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z'
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

    mockAuthService = {
      getStoredToken: jest.fn().mockResolvedValue('test-token')
    } as any;

    mockCredentialService = {} as any;

    mockConfigService = {
      init: jest.fn().mockResolvedValue(undefined),
      getSelectedProject: jest.fn(),
      setSelectedProject: jest.fn().mockResolvedValue(undefined),
      clearSelectedEnvironment: jest.fn().mockResolvedValue(undefined)
    } as any;

    // Mock the constructor dependencies
    jest.mocked(CredentialService).mockImplementation(() => mockCredentialService);
    jest.mocked(AuthService).mockImplementation(() => mockAuthService);
    jest.mocked(ConfigService).mockImplementation(() => mockConfigService);

    projectService = new ProjectService();
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  describe('listProjects', () => {
    it('should fetch and return projects successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockProjects,
        headers: {
          get: jest.fn().mockReturnValue('0-1/2')
        }
      } as any);

      const result = await projectService.listProjects();

      expect(result).toEqual({
        projects: mockProjects,
        total: 2,
        page: 1,
        limit: 20
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.supabase.co/rest/v1/projects?page=1&limit=20',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
            'apikey': 'test-anon-key',
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should handle search parameter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [mockProjects[0]],
        headers: {
          get: jest.fn().mockReturnValue('0-0/1')
        }
      } as any);

      const result = await projectService.listProjects({ search: 'Test Project 1' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('search=Test+Project+1'),
        expect.any(Object)
      );

      expect(result.projects).toHaveLength(1);
      expect(result.projects[0].name).toBe('Test Project 1');
    });

    it('should handle pagination parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockProjects,
        headers: {
          get: jest.fn().mockReturnValue('20-39/100')
        }
      } as any);

      const result = await projectService.listProjects({ page: 2, limit: 20 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('page=2&limit=20'),
        expect.any(Object)
      );

      expect(result).toEqual({
        projects: mockProjects,
        total: 100,
        page: 2,
        limit: 20
      });
    });

    it('should throw error when not authenticated', async () => {
      mockAuthService.getStoredToken.mockResolvedValueOnce(null);

      await expect(projectService.listProjects()).rejects.toThrow(
        new CLIError('Not authenticated', 'AUTH_REQUIRED')
      );
    });

    it('should handle 401 authentication expired error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized'
      } as any);

      await expect(projectService.listProjects()).rejects.toThrow(
        new APIError(401, 'Authentication expired', 'AUTH_EXPIRED')
      );
    });

    it('should handle 403 access denied error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => 'Forbidden'
      } as any);

      await expect(projectService.listProjects()).rejects.toThrow(
        new APIError(403, 'Access denied', 'ACCESS_DENIED')
      );
    });

    it('should cache results for 5 minutes', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockProjects,
        headers: {
          get: jest.fn().mockReturnValue('0-1/2')
        }
      } as any);

      // First call
      await projectService.listProjects();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call should use cache
      await projectService.listProjects();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Clear cache
      projectService.clearCache();

      // Third call should fetch again
      await projectService.listProjects();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('getProject', () => {
    it('should fetch and return a single project', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [mockProjects[0]]
      } as any);

      const result = await projectService.getProject('proj-1');

      expect(result).toEqual(mockProjects[0]);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.supabase.co/rest/v1/projects?id=eq.proj-1&select=*,team:teams(*)',
        expect.any(Object)
      );
    });

    it('should throw error when project not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      } as any);

      await expect(projectService.getProject('non-existent')).rejects.toThrow(
        new CLIError('Project not found', 'NOT_FOUND')
      );
    });
  });

  describe('getSelectedProject', () => {
    it('should return selected project when configured', async () => {
      mockConfigService.getSelectedProject.mockReturnValue('proj-1');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [mockProjects[0]]
      } as any);

      const result = await projectService.getSelectedProject();

      expect(result).toEqual(mockProjects[0]);
      expect(mockConfigService.init).toHaveBeenCalled();
    });

    it('should return null when no project selected', async () => {
      mockConfigService.getSelectedProject.mockReturnValue(undefined);

      const result = await projectService.getSelectedProject();

      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return null and clear environment when selected project not found', async () => {
      mockConfigService.getSelectedProject.mockReturnValue('proj-deleted');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      } as any);

      const result = await projectService.getSelectedProject();

      expect(result).toBeNull();
      expect(mockConfigService.setSelectedProject).toHaveBeenCalledWith('');
      expect(mockConfigService.clearSelectedEnvironment).toHaveBeenCalled();
    });
  });
});