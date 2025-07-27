import { InitCommand } from '../../../src/commands/init';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { Command } from 'commander';

// Mock the environment variable for supabase URL
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';

// Mock all dependencies
jest.mock('../../../src/services/credential.service');
jest.mock('../../../src/services/auth.service');
jest.mock('../../../src/services/project.service');
jest.mock('../../../src/services/environment.service');
jest.mock('../../../src/services/secrets.service');
jest.mock('../../../src/services/file.service');
jest.mock('../../../src/services/config.service');
jest.mock('../../../src/services/api.service');
jest.mock('fs');
jest.mock('inquirer');
jest.mock('ora', () => {
  return jest.fn(() => ({
    start: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis(),
    succeed: jest.fn().mockReturnThis(),
    fail: jest.fn().mockReturnThis(),
    text: ''
  }));
});

const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;
const mockReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>;
const mockWriteFileSync = writeFileSync as jest.MockedFunction<typeof writeFileSync>;
const mockInquirer = inquirer as jest.Mocked<typeof inquirer>;

describe('InitCommand Integration', () => {
  let initCommand: InitCommand;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;
  let command: Command;

  const mockProject = {
    id: 'proj-123',
    name: 'Test Project',
    team: { id: 'team-123', name: 'Test Team' },
    created_at: '2024-01-01',
    updated_at: '2024-01-01'
  };

  const mockEnvironment = {
    id: 'env-123',
    name: 'development',
    project_id: 'proj-123',
    created_at: '2024-01-01',
    updated_at: '2024-01-25'
  };

  const mockSecrets = {
    API_KEY: 'test-key',
    DATABASE_URL: 'postgres://test'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup console spy
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation();

    // Mock AuthService
    const AuthService = require('../../../src/services/auth.service').AuthService;
    AuthService.prototype.isAuthenticated = jest.fn().mockResolvedValue(true);
    AuthService.prototype.authenticateWithPassword = jest.fn();
    AuthService.prototype.storeCredentials = jest.fn();

    // Mock ConfigService
    const ConfigService = require('../../../src/services/config.service').ConfigService;
    ConfigService.prototype.init = jest.fn().mockResolvedValue(undefined);
    ConfigService.prototype.getConfig = jest.fn().mockResolvedValue({});
    ConfigService.prototype.setSelectedProject = jest.fn();
    ConfigService.prototype.setSelectedEnvironment = jest.fn();
    ConfigService.prototype.save = jest.fn();

    // Mock ProjectService
    const ProjectService = require('../../../src/services/project.service').ProjectService;
    ProjectService.prototype.listProjects = jest.fn().mockResolvedValue({ projects: [mockProject] });
    ProjectService.prototype.getSelectedProject = jest.fn();

    // Mock EnvironmentService
    const EnvironmentService = require('../../../src/services/environment.service').EnvironmentService;
    EnvironmentService.prototype.listEnvironments = jest.fn().mockResolvedValue({ environments: [mockEnvironment] });

    // Mock SecretsService
    const SecretsService = require('../../../src/services/secrets.service').SecretsService;
    SecretsService.prototype.getSecrets = jest.fn().mockResolvedValue(mockSecrets);

    // Mock FileService
    const FileService = require('../../../src/services/file.service').FileService;
    FileService.prototype.writeEnvFile = jest.fn().mockResolvedValue(undefined);
    FileService.prototype.backupFile = jest.fn().mockResolvedValue(undefined);
    FileService.prototype.getEnvPath = jest.fn().mockReturnValue('.env');

    // Create command instance and register it
    initCommand = new InitCommand();
    command = new Command();
    command.exitOverride(); // Prevent process.exit in tests
    initCommand.register(command);
    
    // Setup default mocks
    mockExistsSync.mockReturnValue(false);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
    jest.clearAllMocks();
  });

  describe('Full Interactive Flow', () => {
    it('should complete full init flow when not authenticated', async () => {
      // User is not authenticated
      const AuthService = require('../../../src/services/auth.service').AuthService;
      AuthService.prototype.isAuthenticated.mockResolvedValueOnce(false).mockResolvedValue(true);
      
      // Mock auth flow
      mockInquirer.prompt
        .mockResolvedValueOnce({ shouldAuth: true }) // Confirm auth
        .mockResolvedValueOnce({ email: 'test@example.com' }) // Enter email
        .mockResolvedValueOnce({ password: 'password123' }) // Enter password
        .mockResolvedValueOnce({ selectedProject: mockProject }) // Select project
        .mockResolvedValueOnce({ selectedEnvironment: mockEnvironment }) // Select environment
        .mockResolvedValueOnce({ confirmEnv: true }); // Confirm environment
      
      AuthService.prototype.authenticateWithPassword.mockResolvedValue({
        access_token: 'token-123',
        refresh_token: 'refresh-123',
        user: {
          id: 'user-123',
          email: 'test@example.com'
        }
      });
      
      AuthService.prototype.storeCredentials.mockResolvedValue(undefined);

      // Execute command
      await command.parseAsync(['node', 'test', 'init']);

      // Verify auth flow
      expect(AuthService.prototype.isAuthenticated).toHaveBeenCalled();
      expect(AuthService.prototype.authenticateWithPassword).toHaveBeenCalledWith('test@example.com', 'password123');

      // Verify project/env selection
      const ProjectService = require('../../../src/services/project.service').ProjectService;
      const EnvironmentService = require('../../../src/services/environment.service').EnvironmentService;
      expect(ProjectService.prototype.listProjects).toHaveBeenCalled();
      expect(EnvironmentService.prototype.listEnvironments).toHaveBeenCalledWith('proj-123');

      // Verify file operations
      const SecretsService = require('../../../src/services/secrets.service').SecretsService;
      const FileService = require('../../../src/services/file.service').FileService;
      expect(SecretsService.prototype.getSecrets).toHaveBeenCalledWith('proj-123', 'development');
      expect(FileService.prototype.writeEnvFile).toHaveBeenCalled();
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining('.ezenvrc'),
        expect.stringContaining('"id": "proj-123"'),
        'utf-8'
      );

      // Verify success message
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('EzEnv initialized successfully!')
      );
    });

    it('should skip auth flow when already authenticated', async () => {
      mockInquirer.prompt
        .mockResolvedValueOnce({ selectedProject: mockProject })
        .mockResolvedValueOnce({ selectedEnvironment: mockEnvironment })
        .mockResolvedValueOnce({ confirmEnv: true });

      await command.parseAsync(['node', 'test', 'init']);

      const AuthService = require('../../../src/services/auth.service').AuthService;
      expect(AuthService.prototype.isAuthenticated).toHaveBeenCalled();
      expect(AuthService.prototype.authenticateWithPassword).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Already authenticated')
      );
    });

    it('should handle existing .env file with user confirmation', async () => {
      mockExistsSync
        .mockReturnValueOnce(false) // auth check
        .mockReturnValue(true); // .env exists
      mockInquirer.prompt
        .mockResolvedValueOnce({ selectedEnvironment: mockEnvironment })
        .mockResolvedValueOnce({ confirmEnv: true })
        .mockResolvedValueOnce({ shouldOverwrite: true }); // Confirm overwrite

      await command.parseAsync(['node', 'test', 'init']);

      const FileService = require('../../../src/services/file.service').FileService;
      expect(FileService.prototype.backupFile).toHaveBeenCalled();
      expect(FileService.prototype.writeEnvFile).toHaveBeenCalled();
    });

    it('should skip .env creation when user declines overwrite', async () => {
      mockExistsSync
        .mockReturnValueOnce(false) // auth check
        .mockReturnValue(true); // .env exists
      mockInquirer.prompt
        .mockResolvedValueOnce({ selectedEnvironment: mockEnvironment })
        .mockResolvedValueOnce({ confirmEnv: true })
        .mockResolvedValueOnce({ shouldOverwrite: false }); // Decline overwrite

      await command.parseAsync(['node', 'test', 'init']);

      const FileService = require('../../../src/services/file.service').FileService;
      expect(FileService.prototype.backupFile).not.toHaveBeenCalled();
      expect(FileService.prototype.writeEnvFile).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Keeping existing .env file')
      );
    });

    it('should update .gitignore when it exists', async () => {
      mockExistsSync
        .mockReturnValueOnce(false) // auth check
        .mockReturnValueOnce(false) // .env doesn't exist  
        .mockReturnValueOnce(true); // .gitignore exists
        
      mockReadFileSync.mockReturnValue(Buffer.from('node_modules\ndist\n'));
      
      mockInquirer.prompt
        .mockResolvedValueOnce({ selectedEnvironment: mockEnvironment })
        .mockResolvedValueOnce({ confirmEnv: true });

      await command.parseAsync(['node', 'test', 'init']);

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining('.gitignore'),
        expect.stringContaining('.env'),
        'utf-8'
      );
    });
  });

  describe('Non-Interactive Mode', () => {
    it('should complete init in non-interactive mode with all options', async () => {
      // Need to mock that the project exists
      const ProjectService = require('../../../src/services/project.service').ProjectService;
      ProjectService.prototype.listProjects.mockResolvedValue({ 
        projects: [{ ...mockProject, id: 'proj-123' }] 
      });
      
      // Need to mock that the environment exists
      const EnvironmentService = require('../../../src/services/environment.service').EnvironmentService;
      EnvironmentService.prototype.listEnvironments.mockResolvedValue({ 
        environments: [{ ...mockEnvironment, id: 'env-123' }] 
      });

      await command.parseAsync(['node', 'test', 'init', '--non-interactive', '--project', 'proj-123', '--environment', 'env-123']);

      expect(mockInquirer.prompt).not.toHaveBeenCalled();
      const SecretsService = require('../../../src/services/secrets.service').SecretsService;
      const FileService = require('../../../src/services/file.service').FileService;
      expect(SecretsService.prototype.getSecrets).toHaveBeenCalled();
      expect(FileService.prototype.writeEnvFile).toHaveBeenCalled();
    });

    it('should fail in non-interactive mode without project', async () => {
      await command.parseAsync(['node', 'test', 'init', '--non-interactive', '--environment', 'env-123']);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('--project is required in non-interactive mode')
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should fail in non-interactive mode when not authenticated', async () => {
      const AuthService = require('../../../src/services/auth.service').AuthService;
      AuthService.prototype.isAuthenticated.mockResolvedValue(false);

      await command.parseAsync(['node', 'test', 'init', '--non-interactive', '--project', 'proj-123', '--environment', 'env-123']);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Not authenticated')
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle no projects available', async () => {
      const ProjectService = require('../../../src/services/project.service').ProjectService;
      ProjectService.prototype.listProjects.mockResolvedValue({ projects: [] });

      await command.parseAsync(['node', 'test', 'init']);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('No projects found')
      );
    });

    it('should auto-select single project', async () => {
      mockInquirer.prompt
        .mockResolvedValueOnce({ selectedEnvironment: mockEnvironment })
        .mockResolvedValueOnce({ confirmEnv: true });

      await command.parseAsync(['node', 'test', 'init']);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Using project: Test Project')
      );
      expect(mockInquirer.prompt).not.toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Select a project:'
        })
      );
    });

    it('should handle user cancelling auth', async () => {
      const AuthService = require('../../../src/services/auth.service').AuthService;
      AuthService.prototype.isAuthenticated.mockResolvedValue(false);
      mockInquirer.prompt.mockResolvedValueOnce({ shouldAuth: false });

      await command.parseAsync(['node', 'test', 'init']);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Initialization cancelled')
      );
    });

    it('should handle user cancelling environment selection', async () => {
      mockInquirer.prompt
        .mockResolvedValueOnce({ selectedEnvironment: mockEnvironment })
        .mockResolvedValueOnce({ confirmEnv: false }); // Cancel environment

      await command.parseAsync(['node', 'test', 'init']);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('No environment selected. Initialization cancelled.')
      );
    });
  });
});