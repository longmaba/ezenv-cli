import { Command } from 'commander';
import { ListCommand } from '../../../src/commands/projects/list';
import { SelectCommand } from '../../../src/commands/projects/select';
import { ProjectService } from '../../../src/services/project.service';
import { ConfigService } from '../../../src/services/config.service';
import { CLIError } from '../../../src/utils/errors';
import chalk from 'chalk';

jest.mock('../../../src/services/project.service');
jest.mock('../../../src/services/config.service');
jest.mock('ora', () => {
  return jest.fn(() => ({
    start: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis(),
    succeed: jest.fn((text) => {
      console.log(text);
      return this;
    }),
    fail: jest.fn((text) => {
      console.error(text);
      return this;
    }),
    text: ''
  }));
});

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

describe('Projects Commands Integration', () => {
  let program: Command;
  let mockProjectService: jest.Mocked<ProjectService>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });

    mockProjectService = {
      listProjects: jest.fn(),
      getProject: jest.fn().mockImplementation((id) => {
        const project = mockProjects.find(p => p.id === id);
        if (!project) {
          const error = new CLIError('Project not found', 'NOT_FOUND');
          return Promise.reject(error);
        }
        return Promise.resolve(project);
      }),
      getSelectedProject: jest.fn(),
      clearCache: jest.fn()
    } as any;

    mockConfigService = {
      init: jest.fn().mockResolvedValue(undefined),
      setSelectedProject: jest.fn().mockResolvedValue(undefined),
      clearSelectedEnvironment: jest.fn().mockResolvedValue(undefined),
      getSelectedProject: jest.fn()
    } as any;

    jest.mocked(ProjectService).mockImplementation(() => mockProjectService);
    jest.mocked(ConfigService).mockImplementation(() => mockConfigService);

    program = new Command();
    program.exitOverride(); // Prevent actual process exit during tests
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe('list command', () => {
    let listCommand: ListCommand;

    beforeEach(() => {
      listCommand = new ListCommand();
      const projectsCommand = program.command('projects');
      listCommand.register(projectsCommand);
    });

    it('should list projects in table format', async () => {
      mockProjectService.listProjects.mockResolvedValueOnce({
        projects: mockProjects,
        total: 2,
        page: 1,
        limit: 20
      });

      await program.parseAsync(['node', 'test', 'projects', 'list']);

      expect(mockProjectService.listProjects).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        search: undefined
      });

      // Check that table was displayed (look for table borders)
      const output = consoleLogSpy.mock.calls.join('\n');
      expect(output).toContain('ID');
      expect(output).toContain('Name');
      expect(output).toContain('Team');
      expect(output).toContain('Role');
    });

    it('should output JSON when --json flag is used', async () => {
      const mockResponse = {
        projects: mockProjects,
        total: 2,
        page: 1,
        limit: 20
      };
      mockProjectService.listProjects.mockResolvedValueOnce(mockResponse);

      await program.parseAsync(['node', 'test', 'projects', 'list', '--json']);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        JSON.stringify(mockResponse, null, 2)
      );
    });

    it('should filter projects by name', async () => {
      mockProjectService.listProjects.mockResolvedValueOnce({
        projects: [mockProjects[0]],
        total: 1,
        page: 1,
        limit: 20
      });

      await program.parseAsync(['node', 'test', 'projects', 'list', '--filter', 'Test Project 1']);

      expect(mockProjectService.listProjects).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        search: 'Test Project 1'
      });
    });

    it('should handle pagination', async () => {
      mockProjectService.listProjects.mockResolvedValueOnce({
        projects: mockProjects,
        total: 100,
        page: 2,
        limit: 20
      });

      await program.parseAsync(['node', 'test', 'projects', 'list', '--page', '2', '--limit', '20']);

      expect(mockProjectService.listProjects).toHaveBeenCalledWith({
        page: 2,
        limit: 20,
        search: undefined
      });

      const output = consoleLogSpy.mock.calls.join('\n');
      expect(output).toContain('Page 2 of 5');
      expect(output).toContain('--page 3 for next');
    });

    it('should show message when no projects found', async () => {
      mockProjectService.listProjects.mockResolvedValueOnce({
        projects: [],
        total: 0,
        page: 1,
        limit: 20
      });

      await program.parseAsync(['node', 'test', 'projects', 'list']);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        chalk.yellow('No projects found. Create your first project at https://ezenv.dev')
      );
    });

    it('should handle authentication errors', async () => {
      const error = Object.create(Error.prototype);
      Object.assign(error, {
        status: 401,
        message: 'Authentication required',
        code: 'AUTH_EXPIRED',
        name: 'APIError'
      });
      mockProjectService.listProjects.mockRejectedValueOnce(error);

      await expect(
        program.parseAsync(['node', 'test', 'projects', 'list'])
      ).rejects.toThrow('process.exit');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        chalk.red('Authentication required')
      );
    });
  });

  describe('select command', () => {
    let selectCommand: SelectCommand;

    beforeEach(() => {
      selectCommand = new SelectCommand();
      const projectsCommand = program.command('projects');
      selectCommand.register(projectsCommand);
    });

    it('should select project by ID', async () => {
      mockProjectService.listProjects.mockResolvedValueOnce({
        projects: mockProjects,
        total: 2,
        page: 1,
        limit: 100
      });

      await program.parseAsync(['node', 'test', 'projects', 'select', 'proj-1']);

      expect(mockConfigService.setSelectedProject).toHaveBeenCalledWith('proj-1');
      expect(mockConfigService.clearSelectedEnvironment).toHaveBeenCalled();
      
      // Check that console.log was called
      const output = consoleLogSpy.mock.calls.flat().join('\n');
      expect(output).toContain('Selected project:');
      expect(output).toContain('Test Team');
      expect(output).toContain('admin');
      expect(output).toContain('ezenv env select');
    });

    it('should select project by name (case-insensitive)', async () => {
      mockProjectService.listProjects.mockResolvedValueOnce({
        projects: mockProjects,
        total: 2,
        page: 1,
        limit: 100
      });

      await program.parseAsync(['node', 'test', 'projects', 'select', 'test project 1']);

      expect(mockConfigService.setSelectedProject).toHaveBeenCalledWith('proj-1');
    });

    it('should show error when project not found', async () => {
      mockProjectService.listProjects.mockResolvedValueOnce({
        projects: mockProjects,
        total: 2,
        page: 1,
        limit: 100
      });

      await expect(
        program.parseAsync(['node', 'test', 'projects', 'select', 'non-existent'])
      ).rejects.toThrow('process.exit');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Project "non-existent" not found')
      );
    });

    it.skip('should handle API errors gracefully', async () => {
      const error = new Error('Access denied');
      (error as any).status = 403;
      (error as any).code = 'ACCESS_DENIED';
      mockProjectService.listProjects.mockRejectedValueOnce(error);

      try {
        await program.parseAsync(['node', 'test', 'projects', 'select', 'proj-1']);
      } catch (e) {
        // Expected to throw
      }

      // The error is logged by ora.fail() which our mock logs to console.error
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed')
      );
    });
  });
});