import { InitService } from '../../../src/services/init.service';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

jest.mock('fs');

describe('InitService', () => {
  let service: InitService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new InitService();
  });

  describe('createConfigFile', () => {
    it('should create config file with project and environment info', async () => {
      const mockContext = {
        isAuthenticated: true,
        selectedProject: {
          id: 'proj-123',
          name: 'Test Project',
          team: { id: 'team-123', name: 'Test Team' },
          created_at: '2024-01-01',
          updated_at: '2024-01-01'
        },
        selectedEnvironment: {
          id: 'env-123',
          name: 'development',
          project_id: 'proj-123',
          created_at: '2024-01-01',
          updated_at: '2024-01-01'
        },
        envFilePath: '.env',
        configFilePath: '.ezenvrc'
      };

      await service.createConfigFile(mockContext);

      expect(writeFileSync).toHaveBeenCalledWith(
        '.ezenvrc',
        JSON.stringify({
          project: {
            id: 'proj-123',
            name: 'Test Project'
          },
          environment: {
            id: 'env-123',
            name: 'development'
          }
        }, null, 2) + '\n',
        'utf-8'
      );
    });

    it('should throw error if project is not selected', async () => {
      const mockContext = {
        isAuthenticated: true,
        selectedProject: undefined,
        selectedEnvironment: {
          id: 'env-123',
          name: 'development',
          project_id: 'proj-123',
          created_at: '2024-01-01',
          updated_at: '2024-01-01'
        },
        envFilePath: '.env',
        configFilePath: '.ezenvrc'
      };

      await expect(service.createConfigFile(mockContext))
        .rejects.toThrow('Project and environment must be selected');
    });

    it('should throw error if environment is not selected', async () => {
      const mockContext = {
        isAuthenticated: true,
        selectedProject: {
          id: 'proj-123',
          name: 'Test Project',
          team: { id: 'team-123', name: 'Test Team' },
          created_at: '2024-01-01',
          updated_at: '2024-01-01'
        },
        selectedEnvironment: undefined,
        envFilePath: '.env',
        configFilePath: '.ezenvrc'
      };

      await expect(service.createConfigFile(mockContext))
        .rejects.toThrow('Project and environment must be selected');
    });
  });

  describe('getDefaultPaths', () => {
    it('should return default paths for env and config files', () => {
      const paths = service.getDefaultPaths();
      
      expect(paths.envFilePath).toBe(resolve('.env'));
      expect(paths.configFilePath).toBe(resolve('.ezenvrc'));
    });
  });

  describe('validateNonInteractiveOptions', () => {
    it('should validate successfully with both project and environment', () => {
      expect(() => {
        service.validateNonInteractiveOptions({
          project: 'proj-123',
          environment: 'env-123'
        });
      }).not.toThrow();
    });

    it('should throw error if project is missing', () => {
      expect(() => {
        service.validateNonInteractiveOptions({
          environment: 'env-123'
        });
      }).toThrow('--project is required in non-interactive mode');
    });

    it('should throw error if environment is missing', () => {
      expect(() => {
        service.validateNonInteractiveOptions({
          project: 'proj-123'
        });
      }).toThrow('--environment is required in non-interactive mode');
    });
  });
});