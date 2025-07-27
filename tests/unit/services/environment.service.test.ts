import { EnvironmentService } from '../../../src/services/environment.service';
import { ConfigService } from '../../../src/services/config.service';
import { ProjectService } from '../../../src/services/project.service';
import { AuthService } from '../../../src/services/auth.service';
import { CredentialService } from '../../../src/services/credential.service';
import { APIError, CLIError } from '../../../src/utils/errors';
import fetch from 'node-fetch';

jest.mock('node-fetch');
jest.mock('../../../src/services/project.service');
jest.mock('../../../src/services/config.service');
jest.mock('../../../src/services/auth.service');
jest.mock('../../../src/services/credential.service');

const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('EnvironmentService', () => {
  let environmentService: EnvironmentService;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockProjectService: jest.Mocked<ProjectService>;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockCredentialService: jest.Mocked<CredentialService>;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    
    mockConfigService = {
      selectEnvironment: jest.fn(),
      getSelectedEnvironment: jest.fn(),
    } as any;
    
    mockProjectService = {
      getSelectedProject: jest.fn(),
    } as any;
    
    mockAuthService = {
      getStoredToken: jest.fn().mockResolvedValue('test-token'),
      setEnvironment: jest.fn(),
    } as any;
    
    mockCredentialService = {} as any;
    
    // Mock the constructor dependencies
    jest.mocked(ProjectService).mockImplementation(() => mockProjectService);
    jest.mocked(CredentialService).mockImplementation(() => mockCredentialService);
    jest.mocked(AuthService).mockImplementation(() => mockAuthService);
    jest.mocked(ConfigService).mockImplementation(() => mockConfigService);
    
    environmentService = new EnvironmentService(mockConfigService);
  });
  
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  describe('listEnvironments', () => {
    it('should fetch environments for a project', async () => {
      const mockEnvironments = [
        {
          id: 'env1',
          project_id: 'proj1',
          name: 'development',
          type: 'development' as const,
          updated_at: '2024-01-01T00:00:00Z',
          secrets_count: 10
        },
        {
          id: 'env2',
          project_id: 'proj1',
          name: 'production',
          type: 'production' as const,
          updated_at: '2024-01-02T00:00:00Z',
          secrets_count: 15
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockEnvironments,
      } as any);

      const result = await environmentService.listEnvironments('proj1');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('https://test.supabase.co/rest/v1/environments?project_id=eq.proj1'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
            'apikey': 'test-anon-key',
          }),
        })
      );
      expect(result).toEqual(mockEnvironments);
    });

    it('should throw CLIError when project not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => 'Access denied',
      } as any);

      await expect(environmentService.listEnvironments('invalid')).rejects.toThrow(CLIError);
    });
  });

  describe('resolveEnvironmentAlias', () => {
    it('should resolve common aliases', () => {
      expect(environmentService.resolveEnvironmentAlias('dev')).toBe('development');
      expect(environmentService.resolveEnvironmentAlias('stage')).toBe('staging');
      expect(environmentService.resolveEnvironmentAlias('prod')).toBe('production');
      expect(environmentService.resolveEnvironmentAlias('stg')).toBe('staging');
      expect(environmentService.resolveEnvironmentAlias('prd')).toBe('production');
    });

    it('should return original value if not an alias', () => {
      expect(environmentService.resolveEnvironmentAlias('development')).toBe('development');
      expect(environmentService.resolveEnvironmentAlias('custom')).toBe('custom');
    });

    it('should be case-insensitive', () => {
      expect(environmentService.resolveEnvironmentAlias('DEV')).toBe('development');
      expect(environmentService.resolveEnvironmentAlias('Prod')).toBe('production');
    });
  });

  describe('getEnvironment', () => {
    it('should find environment by name', async () => {
      const mockEnvironments = [
        {
          id: 'env1',
          project_id: 'proj1',
          name: 'development',
          type: 'development' as const,
          updated_at: '2024-01-01T00:00:00Z'
        },
        {
          id: 'env2',
          project_id: 'proj1',
          name: 'production',
          type: 'production' as const,
          updated_at: '2024-01-02T00:00:00Z'
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockEnvironments,
      } as any);

      const result = await environmentService.getEnvironment('proj1', 'production');

      expect(result).toEqual(mockEnvironments[1]);
    });

    it('should return null if environment not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as any);

      const result = await environmentService.getEnvironment('proj1', 'nonexistent');

      expect(result).toBeNull();
    });

    it('should be case-insensitive', async () => {
      const mockEnvironments = [
        {
          id: 'env1',
          project_id: 'proj1',
          name: 'Production',
          type: 'production' as const,
          updated_at: '2024-01-01T00:00:00Z'
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockEnvironments,
      } as any);

      const result = await environmentService.getEnvironment('proj1', 'production');

      expect(result).toEqual(mockEnvironments[0]);
    });
  });

  describe('selectEnvironment', () => {
    it('should select an environment successfully', async () => {
      const mockProject = {
        id: 'proj1',
        name: 'Test Project',
        team_id: 'team1',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      const mockEnvironment = {
        id: 'env1',
        project_id: 'proj1',
        name: 'production',
        type: 'production' as const,
        updated_at: '2024-01-01T00:00:00Z'
      };

      mockProjectService.getSelectedProject.mockResolvedValue(mockProject);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [mockEnvironment],
      } as any);
      mockConfigService.selectEnvironment.mockResolvedValue(undefined);

      await environmentService.selectEnvironment('production');

      expect(mockConfigService.selectEnvironment).toHaveBeenCalledWith(mockEnvironment);
    });

    it('should throw error if no project selected', async () => {
      mockProjectService.getSelectedProject.mockResolvedValue(null);

      await expect(environmentService.selectEnvironment('production')).rejects.toThrow(
        'No project selected'
      );
    });

    it('should throw error if environment not found', async () => {
      const mockProject = {
        id: 'proj1',
        name: 'Test Project',
        team_id: 'team1',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      mockProjectService.getSelectedProject.mockResolvedValue(mockProject);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as any);

      await expect(environmentService.selectEnvironment('nonexistent')).rejects.toThrow(
        'Environment "nonexistent" not found in project "Test Project"'
      );
    });
  });

  describe('getSelectedEnvironment', () => {
    it('should return selected environment', async () => {
      const mockEnvironment = {
        id: 'env1',
        project_id: 'proj1',
        name: 'production',
        type: 'production' as const,
        updated_at: '2024-01-01T00:00:00Z'
      };

      const mockProject = {
        id: 'proj1',
        name: 'Test Project',
        team_id: 'team1',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      mockConfigService.getSelectedEnvironment.mockReturnValue('env1');
      mockProjectService.getSelectedProject.mockResolvedValue(mockProject);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [mockEnvironment],
      } as any);

      const result = await environmentService.getSelectedEnvironment();

      expect(result).toEqual(mockEnvironment);
    });

    it('should return null if no environment selected', async () => {
      mockConfigService.getSelectedEnvironment.mockReturnValue(undefined);

      const result = await environmentService.getSelectedEnvironment();

      expect(result).toBeNull();
    });

    it('should return null if no project selected', async () => {
      mockConfigService.getSelectedEnvironment.mockReturnValue('env1');
      mockProjectService.getSelectedProject.mockResolvedValue(null);

      const result = await environmentService.getSelectedEnvironment();

      expect(result).toBeNull();
    });
  });
});