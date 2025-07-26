import { InitCommand } from '../../../src/commands/init';
import { AuthService } from '../../../src/services/auth.service';
import { ProjectService } from '../../../src/services/project.service';
import { EnvironmentService } from '../../../src/services/environment.service';
import { SecretsService } from '../../../src/services/secrets.service';
import { FileService } from '../../../src/services/file.service';
import { ConfigService } from '../../../src/services/config.service';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import inquirer from 'inquirer';
import chalk from 'chalk';

// Mock all dependencies
jest.mock('../../../src/services/auth.service');
jest.mock('../../../src/services/project.service');
jest.mock('../../../src/services/environment.service');
jest.mock('../../../src/services/secrets.service');
jest.mock('../../../src/services/file.service');
jest.mock('../../../src/services/config.service');
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
  let mockAuthService: jest.Mocked<AuthService>;
  let mockProjectService: jest.Mocked<ProjectService>;
  let mockEnvironmentService: jest.Mocked<EnvironmentService>;
  let mockSecretsService: jest.Mocked<SecretsService>;
  let mockFileService: jest.Mocked<FileService>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let consoleLogSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;

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
    consoleLogSpy = jest.spyOn(console, 'error').mockImplementation();
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Process exit');
    });

    // Create command instance
    initCommand = new InitCommand();
    
    // Get mocked services
    mockAuthService = (initCommand as any).authService;
    mockProjectService = (initCommand as any).projectService;
    mockEnvironmentService = (initCommand as any).environmentService;
    mockSecretsService = (initCommand as any).secretsService;
    mockFileService = (initCommand as any).fileService;
    mockConfigService = (initCommand as any).configService;

    // Setup default mocks
    mockConfigService.init.mockResolvedValue(undefined);
    mockAuthService.isAuthenticated.mockResolvedValue(true);
    mockProjectService.listProjects.mockResolvedValue([mockProject]);
    mockEnvironmentService.listEnvironments.mockResolvedValue([mockEnvironment]);
    mockSecretsService.getSecrets.mockResolvedValue(mockSecrets);
    mockFileService.writeEnvFile.mockResolvedValue(undefined);
    mockFileService.backupFile.mockResolvedValue(undefined);
    mockExistsSync.mockReturnValue(false);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe('Full Interactive Flow', () => {
    it('should complete full init flow when not authenticated', async () => {
      // User is not authenticated
      mockAuthService.isAuthenticated.mockResolvedValue(false);
      
      // Mock auth flow
      mockInquirer.prompt
        .mockResolvedValueOnce({ shouldAuth: true }) // Confirm auth
        .mockResolvedValueOnce({ selectedProject: mockProject }) // Select project
        .mockResolvedValueOnce({ selectedEnvironment: mockEnvironment }) // Select environment
        .mockResolvedValueOnce({ confirmEnv: true }); // Confirm environment
      
      mockAuthService.initDeviceAuth.mockResolvedValue({
        deviceCode: 'device-123',
        userCode: 'USER-CODE',
        verificationUri: 'https://ezenv.dev/device'
      });
      
      mockAuthService.pollForToken.mockResolvedValue({
        access_token: 'token-123',
        expires_at: Date.now() + 3600000
      });
      
      mockAuthService.storeCredentials.mockResolvedValue(undefined);
      mockAuthService.openBrowser.mockResolvedValue(undefined);

      // Execute command
      await initCommand['execute']({});

      // Verify auth flow
      expect(mockAuthService.isAuthenticated).toHaveBeenCalled();
      expect(mockAuthService.initDeviceAuth).toHaveBeenCalled();
      expect(mockAuthService.pollForToken).toHaveBeenCalledWith('device-123');
      expect(mockAuthService.storeCredentials).toHaveBeenCalled();

      // Verify project/env selection
      expect(mockProjectService.listProjects).toHaveBeenCalled();
      expect(mockEnvironmentService.listEnvironments).toHaveBeenCalledWith('proj-123');

      // Verify file operations
      expect(mockSecretsService.getSecrets).toHaveBeenCalledWith('Test Project', 'development');
      expect(mockFileService.writeEnvFile).toHaveBeenCalled();
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

      await initCommand['execute']({});

      expect(mockAuthService.isAuthenticated).toHaveBeenCalled();
      expect(mockAuthService.initDeviceAuth).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Already authenticated')
      );
    });

    it('should handle existing .env file with user confirmation', async () => {
      mockExistsSync.mockReturnValue(true);
      mockInquirer.prompt
        .mockResolvedValueOnce({ selectedProject: mockProject })
        .mockResolvedValueOnce({ selectedEnvironment: mockEnvironment })
        .mockResolvedValueOnce({ confirmEnv: true })
        .mockResolvedValueOnce({ shouldOverwrite: true }); // Confirm overwrite

      await initCommand['execute']({});

      expect(mockFileService.backupFile).toHaveBeenCalled();
      expect(mockFileService.writeEnvFile).toHaveBeenCalled();
    });

    it('should skip .env creation when user declines overwrite', async () => {
      mockExistsSync.mockReturnValue(true);
      mockInquirer.prompt
        .mockResolvedValueOnce({ selectedProject: mockProject })
        .mockResolvedValueOnce({ selectedEnvironment: mockEnvironment })
        .mockResolvedValueOnce({ confirmEnv: true })
        .mockResolvedValueOnce({ shouldOverwrite: false }); // Decline overwrite

      await initCommand['execute']({});

      expect(mockFileService.backupFile).not.toHaveBeenCalled();
      expect(mockFileService.writeEnvFile).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Skipping .env file creation')
      );
    });

    it('should update .gitignore when it exists', async () => {
      mockExistsSync
        .mockReturnValueOnce(false) // .env doesn't exist
        .mockReturnValueOnce(true); // .gitignore exists
        
      mockReadFileSync.mockReturnValue(Buffer.from('node_modules\ndist\n'));
      
      mockInquirer.prompt
        .mockResolvedValueOnce({ selectedProject: mockProject })
        .mockResolvedValueOnce({ selectedEnvironment: mockEnvironment })
        .mockResolvedValueOnce({ confirmEnv: true });

      await initCommand['execute']({});

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining('.gitignore'),
        expect.stringContaining('.env'),
        'utf-8'
      );
    });
  });

  describe('Non-Interactive Mode', () => {
    it('should complete init in non-interactive mode with all options', async () => {
      await initCommand['execute']({
        nonInteractive: true,
        project: 'proj-123',
        environment: 'env-123'
      });

      expect(mockInquirer.prompt).not.toHaveBeenCalled();
      expect(mockSecretsService.getSecrets).toHaveBeenCalled();
      expect(mockFileService.writeEnvFile).toHaveBeenCalled();
    });

    it('should fail in non-interactive mode without project', async () => {
      await expect(initCommand['execute']({
        nonInteractive: true,
        environment: 'env-123'
      })).rejects.toThrow();

      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should fail in non-interactive mode when not authenticated', async () => {
      mockAuthService.isAuthenticated.mockResolvedValue(false);

      await expect(initCommand['execute']({
        nonInteractive: true,
        project: 'proj-123',
        environment: 'env-123'
      })).rejects.toThrow();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Not authenticated')
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle no projects available', async () => {
      mockProjectService.listProjects.mockResolvedValue([]);

      await initCommand['execute']({});

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('No projects found')
      );
    });

    it('should auto-select single project', async () => {
      mockInquirer.prompt
        .mockResolvedValueOnce({ selectedEnvironment: mockEnvironment })
        .mockResolvedValueOnce({ confirmEnv: true });

      await initCommand['execute']({});

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
      mockAuthService.isAuthenticated.mockResolvedValue(false);
      mockInquirer.prompt.mockResolvedValueOnce({ shouldAuth: false });

      await initCommand['execute']({});

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Initialization cancelled')
      );
    });

    it('should handle user cancelling environment selection', async () => {
      mockInquirer.prompt
        .mockResolvedValueOnce({ selectedProject: mockProject })
        .mockResolvedValueOnce({ selectedEnvironment: mockEnvironment })
        .mockResolvedValueOnce({ confirmEnv: false }); // Cancel environment

      await initCommand['execute']({});

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('No environment selected')
      );
    });
  });
});