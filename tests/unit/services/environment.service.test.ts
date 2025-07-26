import { EnvironmentService } from '../../../src/services/environment.service';
import { ConfigService } from '../../../src/services/config.service';
import { APIService } from '../../../src/services/api.service';
import { ProjectService } from '../../../src/services/project.service';
import { APIError, CLIError } from '../../../src/utils/errors';

jest.mock('../../../src/services/api.service');
jest.mock('../../../src/services/project.service');
jest.mock('../../../src/services/config.service');

describe('EnvironmentService', () => {
  let environmentService: EnvironmentService;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockApiService: jest.Mocked<APIService>;
  let mockProjectService: jest.Mocked<ProjectService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfigService = new ConfigService() as jest.Mocked<ConfigService>;
    environmentService = new EnvironmentService(mockConfigService);
    
    // Access the mocked services
    mockApiService = (environmentService as any).apiService;
    mockProjectService = (environmentService as any).projectService;
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

      mockApiService.request.mockResolvedValue({ environments: mockEnvironments });

      const result = await environmentService.listEnvironments('proj1');

      expect(mockApiService.request).toHaveBeenCalledWith('GET', '/projects/proj1/environments');
      expect(result).toEqual(mockEnvironments);
    });

    it('should throw CLIError when project not found', async () => {
      mockApiService.request.mockRejectedValue(
        new APIError(404, 'Project not found', 'NOT_FOUND')
      );

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

      mockApiService.request.mockResolvedValue({ environments: mockEnvironments });

      const result = await environmentService.getEnvironment('proj1', 'production');

      expect(result).toEqual(mockEnvironments[1]);
    });

    it('should return null if environment not found', async () => {
      mockApiService.request.mockResolvedValue({ environments: [] });

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

      mockApiService.request.mockResolvedValue({ environments: mockEnvironments });

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
      mockApiService.request.mockResolvedValue({ environments: [mockEnvironment] });
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
      mockApiService.request.mockResolvedValue({ environments: [] });

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
      mockApiService.request.mockResolvedValue({ environments: [mockEnvironment] });

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