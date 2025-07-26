import { Command } from 'commander';
import { ListEnvironmentsCommand } from '../../../src/commands/env/list';
import { SelectEnvironmentCommand } from '../../../src/commands/env/select';
import { EnvironmentService } from '../../../src/services/environment.service';
import { ConfigService } from '../../../src/services/config.service';
import { ProjectService } from '../../../src/services/project.service';

// Mock console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const mockConsoleLog = jest.fn();
const mockConsoleError = jest.fn();

// Mock process.exit
const mockExit = jest.spyOn(process, 'exit').mockImplementation((code) => {
  throw new Error(`Process exited with code ${code}`);
});

// Mock ora
jest.mock('ora', () => {
  return jest.fn(() => ({
    start: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis(),
    succeed: jest.fn().mockReturnThis(),
    fail: jest.fn().mockReturnThis(),
  }));
});

jest.mock('../../../src/services/environment.service');
jest.mock('../../../src/services/config.service');
jest.mock('../../../src/services/project.service');

describe('Environment Commands', () => {
  let program: Command;
  let mockEnvironmentService: jest.Mocked<EnvironmentService>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockProjectService: jest.Mocked<ProjectService>;

  beforeEach(() => {
    jest.clearAllMocks();
    console.log = mockConsoleLog;
    console.error = mockConsoleError;
    
    program = new Command();
    program.exitOverride(); // Prevent actual process exit

    // Reset mocks
    mockEnvironmentService = new EnvironmentService({} as ConfigService) as jest.Mocked<EnvironmentService>;
    mockConfigService = new ConfigService() as jest.Mocked<ConfigService>;
    mockProjectService = new ProjectService() as jest.Mocked<ProjectService>;
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe('env list', () => {
    let listCommand: ListEnvironmentsCommand;

    beforeEach(() => {
      listCommand = new ListEnvironmentsCommand();
      const envCommand = program.command('env').description('Manage environments');
      listCommand.register(envCommand);
    });

    it('should list environments when project is selected', async () => {
      const mockProject = {
        id: 'proj1',
        name: 'Test Project',
        team_id: 'team1',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      const mockEnvironments = [
        {
          id: 'env1',
          project_id: 'proj1',
          name: 'development',
          type: 'development' as const,
          updated_at: new Date().toISOString()
        },
        {
          id: 'env2',
          project_id: 'proj1',
          name: 'production',
          type: 'production' as const,
          updated_at: new Date().toISOString()
        }
      ];

      (listCommand as any).projectService.getSelectedProject.mockResolvedValue(mockProject);
      (listCommand as any).environmentService.listEnvironments.mockResolvedValue(mockEnvironments);
      (listCommand as any).environmentService.getSelectedEnvironment.mockResolvedValue(mockEnvironments[0]);

      await program.parseAsync(['node', 'test', 'env', 'list']);

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('📋 Environments'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Test Project'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('development'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('production'));
    });

    it('should show error when no project is selected', async () => {
      (listCommand as any).projectService.getSelectedProject.mockResolvedValue(null);

      try {
        await program.parseAsync(['node', 'test', 'env', 'list']);
      } catch (error) {
        expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('No project selected'));
        expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('ezenv projects select'));
      }
    });

    it('should output JSON when --json flag is used', async () => {
      const mockProject = {
        id: 'proj1',
        name: 'Test Project',
        team_id: 'team1',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      const mockEnvironments = [
        {
          id: 'env1',
          project_id: 'proj1',
          name: 'development',
          type: 'development' as const,
          updated_at: '2024-01-01T00:00:00Z'
        }
      ];

      (listCommand as any).projectService.getSelectedProject.mockResolvedValue(mockProject);
      (listCommand as any).environmentService.listEnvironments.mockResolvedValue(mockEnvironments);

      await program.parseAsync(['node', 'test', 'env', 'list', '--json']);

      expect(mockConsoleLog).toHaveBeenCalledWith(JSON.stringify(mockEnvironments, null, 2));
    });
  });

  describe('env select', () => {
    let selectCommand: SelectEnvironmentCommand;

    beforeEach(() => {
      selectCommand = new SelectEnvironmentCommand();
      const envCommand = program.command('env').description('Manage environments');
      selectCommand.register(envCommand);
    });

    it('should select environment successfully', async () => {
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

      (selectCommand as any).projectService.getSelectedProject.mockResolvedValue(mockProject);
      (selectCommand as any).environmentService.resolveEnvironmentAlias.mockReturnValue('production');
      (selectCommand as any).environmentService.getEnvironment.mockResolvedValue(mockEnvironment);
      (selectCommand as any).environmentService.selectEnvironment.mockResolvedValue(undefined);

      await program.parseAsync(['node', 'test', 'env', 'select', 'production']);

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('✓ Environment selected successfully'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Test Project'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('production'));
    });

    it('should select environment using alias', async () => {
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

      (selectCommand as any).projectService.getSelectedProject.mockResolvedValue(mockProject);
      (selectCommand as any).environmentService.resolveEnvironmentAlias.mockReturnValue('production');
      (selectCommand as any).environmentService.getEnvironment.mockResolvedValue(mockEnvironment);
      (selectCommand as any).environmentService.selectEnvironment.mockResolvedValue(undefined);

      await program.parseAsync(['node', 'test', 'env', 'select', 'prod']);

      expect((selectCommand as any).environmentService.resolveEnvironmentAlias).toHaveBeenCalledWith('prod');
      expect((selectCommand as any).environmentService.selectEnvironment).toHaveBeenCalledWith('production');
    });

    it('should show error when environment not found', async () => {
      const mockProject = {
        id: 'proj1',
        name: 'Test Project',
        team_id: 'team1',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      const availableEnvironments = [
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
          updated_at: '2024-01-01T00:00:00Z'
        }
      ];

      (selectCommand as any).projectService.getSelectedProject.mockResolvedValue(mockProject);
      (selectCommand as any).environmentService.resolveEnvironmentAlias.mockReturnValue('nonexistent');
      (selectCommand as any).environmentService.getEnvironment.mockResolvedValue(null);
      (selectCommand as any).environmentService.listEnvironments.mockResolvedValue(availableEnvironments);

      try {
        await program.parseAsync(['node', 'test', 'env', 'select', 'nonexistent']);
      } catch (error) {
        expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('Environment "nonexistent" not found'));
        expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Available environments:'));
        expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('development'));
        expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('production'));
      }
    });
  });
});