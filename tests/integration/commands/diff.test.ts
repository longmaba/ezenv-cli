import { DiffCommand } from '../../../src/commands/diff';
import { Command } from 'commander';

// Mock the environment variable for supabase URL
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';

jest.mock('../../../src/services/credential.service');
jest.mock('../../../src/services/config.service');
jest.mock('../../../src/services/api.service');
jest.mock('../../../src/services/file.service');
jest.mock('../../../src/services/diff.service');
jest.mock('../../../src/services/secrets.service');
jest.mock('../../../src/services/project.service');

describe('DiffCommand', () => {
  let diffCommand: DiffCommand;
  let mockConsoleLog: jest.SpyInstance;
  let mockConsoleError: jest.SpyInstance;
  let mockProcessExit: jest.SpyInstance;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Mock ConfigService
    const ConfigService = require('../../../src/services/config.service').ConfigService;
    ConfigService.prototype.init = jest.fn().mockResolvedValue(undefined);
    ConfigService.prototype.getSelectedProject = jest.fn().mockReturnValue('test-project');
    ConfigService.prototype.getSelectedEnvironment = jest.fn().mockReturnValue('development');

    // Mock SecretsService
    const SecretsService = require('../../../src/services/secrets.service').SecretsService;
    SecretsService.prototype.getSecrets = jest.fn();

    // Mock ProjectService
    const ProjectService = require('../../../src/services/project.service').ProjectService;
    ProjectService.prototype.getProject = jest.fn().mockResolvedValue({ id: 'test-project', name: 'Test Project' });

    // Mock FileService
    const FileService = require('../../../src/services/file.service').FileService;
    FileService.prototype.getEnvPath = jest.fn().mockResolvedValue('.env');
    FileService.prototype.readEnvFile = jest.fn();
    FileService.prototype.getLastSyncTime = jest.fn();

    // Mock DiffService
    const DiffService = require('../../../src/services/diff.service').DiffService;
    DiffService.prototype.compareSecrets = jest.fn();
    DiffService.prototype.formatDiff = jest.fn();

    diffCommand = new DiffCommand();

    mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
    mockProcessExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
    mockProcessExit.mockRestore();
  });

  describe('execute', () => {
    it('should show error when no project is selected', async () => {
      const ConfigService = require('../../../src/services/config.service').ConfigService;
      ConfigService.prototype.getSelectedProject.mockReturnValue(null);

      const command = new Command();
      diffCommand.register(command);
      
      await expect(command.parseAsync(['node', 'test', 'diff'])).rejects.toThrow('process.exit');
      
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('No project selected'));
    });

    it('should show error when no environment is selected', async () => {
      const ConfigService = require('../../../src/services/config.service').ConfigService;
      ConfigService.prototype.getSelectedProject.mockReturnValue('project-id');
      ConfigService.prototype.getSelectedEnvironment.mockReturnValue(null);

      const command = new Command();
      diffCommand.register(command);
      
      await expect(command.parseAsync(['node', 'test', 'diff'])).rejects.toThrow('process.exit');
      
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('No environment selected'));
    });

    it('should show diff with default inline format', async () => {
      const SecretsService = require('../../../src/services/secrets.service').SecretsService;
      const FileService = require('../../../src/services/file.service').FileService;
      const DiffService = require('../../../src/services/diff.service').DiffService;
      
      SecretsService.prototype.getSecrets.mockResolvedValue({ KEY1: 'new-value', KEY2: 'value2' });
      FileService.prototype.readEnvFile.mockResolvedValue({ KEY1: 'old-value', KEY3: 'removed' });
      FileService.prototype.getLastSyncTime.mockResolvedValue('2024-01-01T00:00:00Z');
      
      const diffResult = {
        added: { KEY2: 'value2' },
        modified: { KEY1: { old: 'old-value', new: 'new-value' } },
        removed: { KEY3: 'removed' },
        localOnly: {}
      };
      
      DiffService.prototype.compareSecrets.mockReturnValue(diffResult);
      DiffService.prototype.formatDiff.mockReturnValue('+ KEY2=value2\n~ KEY1\n  - old-value\n  + new-value\n- KEY3=removed');

      const command = new Command();
      diffCommand.register(command);
      
      await command.parseAsync(['node', 'test', 'diff']);
      
      expect(mockDiffService.formatDiff).toHaveBeenCalledWith(diffResult, {
        format: 'inline',
        colorize: true
      });
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('+ KEY2=value2'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Last synced: 2024-01-01T00:00:00Z'));
    });

    it('should show diff with side-by-side format', async () => {
      mockConfigService.load.mockResolvedValue({
        currentProject: 'project-id',
        currentEnvironment: 'development'
      } as any);

      mockApiService.getSecrets.mockResolvedValue({ KEY1: 'value1' });
      mockFileService.getEnvPath.mockResolvedValue('.env');
      mockFileService.readEnvFile.mockResolvedValue({ KEY1: 'value1' });
      
      mockDiffService.compareSecrets.mockReturnValue({
        added: { NEW: 'new' },
        modified: {},
        removed: {},
        localOnly: {}
      });
      mockDiffService.formatDiff.mockReturnValue('KEY | LOCAL | REMOTE | STATUS\nNEW | -     | new    | Added');

      const command = new Command();
      diffCommand.register(command);
      
      await command.parseAsync(['node', 'test', 'diff', '--format', 'side-by-side']);
      
      expect(mockDiffService.formatDiff).toHaveBeenCalledWith(expect.any(Object), {
        format: 'side-by-side',
        colorize: true
      });
    });

    it('should show diff with summary format', async () => {
      mockConfigService.load.mockResolvedValue({
        currentProject: 'project-id',
        currentEnvironment: 'development'
      } as any);

      mockApiService.getSecrets.mockResolvedValue({ KEY1: 'new' });
      mockFileService.getEnvPath.mockResolvedValue('.env');
      mockFileService.readEnvFile.mockResolvedValue({ KEY1: 'old' });
      
      mockDiffService.compareSecrets.mockReturnValue({
        added: {},
        modified: { KEY1: { old: 'old', new: 'new' } },
        removed: {},
        localOnly: {}
      });
      mockDiffService.formatDiff.mockReturnValue('Modified: 1');

      const command = new Command();
      diffCommand.register(command);
      
      await command.parseAsync(['node', 'test', 'diff', '--format', 'summary']);
      
      expect(mockDiffService.formatDiff).toHaveBeenCalledWith(expect.any(Object), {
        format: 'summary',
        colorize: true
      });
      expect(mockConsoleLog).toHaveBeenCalledWith('Modified: 1');
    });

    it('should handle no differences', async () => {
      mockConfigService.load.mockResolvedValue({
        currentProject: 'project-id',
        currentEnvironment: 'development'
      } as any);

      const secrets = { KEY1: 'value1', KEY2: 'value2' };
      mockApiService.getSecrets.mockResolvedValue(secrets);
      mockFileService.getEnvPath.mockResolvedValue('.env');
      mockFileService.readEnvFile.mockResolvedValue(secrets);
      
      mockDiffService.compareSecrets.mockReturnValue({
        added: {},
        modified: {},
        removed: {},
        localOnly: {}
      });
      mockDiffService.formatDiff.mockReturnValue('');

      const command = new Command();
      diffCommand.register(command);
      
      await command.parseAsync(['node', 'test', 'diff']);
      
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('No differences found'));
    });

    it('should disable colors with --no-color flag', async () => {
      mockConfigService.load.mockResolvedValue({
        currentProject: 'project-id',
        currentEnvironment: 'development'
      } as any);

      mockApiService.getSecrets.mockResolvedValue({ KEY1: 'new' });
      mockFileService.getEnvPath.mockResolvedValue('.env');
      mockFileService.readEnvFile.mockResolvedValue({ KEY1: 'old' });
      
      const diffResult = {
        added: {},
        modified: { KEY1: { old: 'old', new: 'new' } },
        removed: {},
        localOnly: {}
      };
      
      mockDiffService.compareSecrets.mockReturnValue(diffResult);
      mockDiffService.formatDiff.mockReturnValue('~ KEY1');

      const command = new Command();
      diffCommand.register(command);
      
      await command.parseAsync(['node', 'test', 'diff', '--no-color']);
      
      expect(mockDiffService.formatDiff).toHaveBeenCalledWith(diffResult, {
        format: 'inline',
        colorize: false
      });
    });

    it('should use specified environment', async () => {
      mockConfigService.load.mockResolvedValue({
        currentProject: 'project-id',
        currentEnvironment: 'development'
      } as any);

      mockApiService.getSecrets.mockResolvedValue({});
      mockFileService.getEnvPath.mockResolvedValue('.env');
      mockFileService.readEnvFile.mockResolvedValue({});
      
      mockDiffService.compareSecrets.mockReturnValue({
        added: {},
        modified: {},
        removed: {},
        localOnly: {}
      });
      mockDiffService.formatDiff.mockReturnValue('');

      const command = new Command();
      diffCommand.register(command);
      
      await command.parseAsync(['node', 'test', 'diff', '--env', 'production']);
      
      expect(mockApiService.getSecrets).toHaveBeenCalledWith('project-id', 'production');
    });
  });
});