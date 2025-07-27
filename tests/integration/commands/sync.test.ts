import { SyncCommand } from '../../../src/commands/sync';
import { Command } from 'commander';
import * as readline from 'readline';

// Mock the environment variable for supabase URL
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';

jest.mock('../../../src/services/credential.service');
jest.mock('../../../src/services/config.service');
jest.mock('../../../src/services/api.service');
jest.mock('../../../src/services/file.service');
jest.mock('../../../src/services/diff.service');
jest.mock('../../../src/services/secrets.service');
jest.mock('readline');

describe('SyncCommand', () => {
  let syncCommand: SyncCommand;
  let mockConsoleLog: jest.SpyInstance;
  let mockConsoleError: jest.SpyInstance;
  let mockProcessExit: jest.SpyInstance;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Mock ConfigService
    const ConfigService = require('../../../src/services/config.service').ConfigService;
    ConfigService.prototype.init = jest.fn().mockResolvedValue(undefined);
    ConfigService.prototype.getSelectedProject = jest.fn().mockReturnValue('project-id');
    ConfigService.prototype.getSelectedEnvironment = jest.fn().mockReturnValue('development');

    // Mock SecretsService
    const SecretsService = require('../../../src/services/secrets.service').SecretsService;
    SecretsService.prototype.getSecrets = jest.fn();

    // Mock FileService
    const FileService = require('../../../src/services/file.service').FileService;
    FileService.prototype.getEnvPath = jest.fn().mockResolvedValue('.env');
    FileService.prototype.readEnvFile = jest.fn();
    FileService.prototype.backupFile = jest.fn();
    FileService.prototype.writeEnvFile = jest.fn();

    // Mock DiffService
    const DiffService = require('../../../src/services/diff.service').DiffService;
    DiffService.prototype.compareSecrets = jest.fn();
    DiffService.prototype.formatDiff = jest.fn();
    DiffService.prototype.applyDiff = jest.fn();

    syncCommand = new SyncCommand();

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
      syncCommand.register(command);
      
      await expect(command.parseAsync(['node', 'test', 'sync'])).rejects.toThrow('process.exit');
      
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('No project selected'));
    });

    it('should show error when no environment is selected', async () => {
      const ConfigService = require('../../../src/services/config.service').ConfigService;
      ConfigService.prototype.getSelectedProject.mockReturnValue('project-id');
      ConfigService.prototype.getSelectedEnvironment.mockReturnValue(null);

      const command = new Command();
      syncCommand.register(command);
      
      await expect(command.parseAsync(['node', 'test', 'sync'])).rejects.toThrow('process.exit');
      
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('No environment selected'));
    });

    it('should handle case when environment is already up to date', async () => {
      const SecretsService = require('../../../src/services/secrets.service').SecretsService;
      const FileService = require('../../../src/services/file.service').FileService;
      const DiffService = require('../../../src/services/diff.service').DiffService;

      const secrets = { KEY1: 'value1', KEY2: 'value2' };
      SecretsService.prototype.getSecrets.mockResolvedValue(secrets);
      FileService.prototype.getEnvPath.mockResolvedValue('.env');
      FileService.prototype.readEnvFile.mockResolvedValue(secrets);
      
      DiffService.prototype.compareSecrets.mockReturnValue({
        added: {},
        modified: {},
        removed: {},
        localOnly: {}
      });

      const command = new Command();
      syncCommand.register(command);
      
      await command.parseAsync(['node', 'test', 'sync']);
      
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('already up to date'));
      expect(DiffService.prototype.applyDiff).not.toHaveBeenCalled();
    });

    it('should apply changes with auto-approve flag', async () => {
      const SecretsService = require('../../../src/services/secrets.service').SecretsService;
      const FileService = require('../../../src/services/file.service').FileService;
      const DiffService = require('../../../src/services/diff.service').DiffService;

      SecretsService.prototype.getSecrets.mockResolvedValue({ KEY1: 'new-value' });
      FileService.prototype.getEnvPath.mockResolvedValue('.env');
      FileService.prototype.readEnvFile.mockResolvedValue({ KEY1: 'old-value' });
      
      const diffResult = {
        added: {},
        modified: { KEY1: { old: 'old-value', new: 'new-value' } },
        removed: {},
        localOnly: {}
      };
      DiffService.prototype.compareSecrets.mockReturnValue(diffResult);
      DiffService.prototype.formatDiff.mockReturnValue('~ KEY1\n  - old-value\n  + new-value');

      const command = new Command();
      syncCommand.register(command);
      
      await command.parseAsync(['node', 'test', 'sync', '--auto-approve']);
      
      expect(DiffService.prototype.applyDiff).toHaveBeenCalledWith('.env', diffResult, expect.any(Object));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('synchronized'));
    });

    it('should prompt for confirmation without auto-approve', async () => {
      const SecretsService = require('../../../src/services/secrets.service').SecretsService;
      const FileService = require('../../../src/services/file.service').FileService;
      const DiffService = require('../../../src/services/diff.service').DiffService;

      SecretsService.prototype.getSecrets.mockResolvedValue({ KEY1: 'new-value' });
      FileService.prototype.getEnvPath.mockResolvedValue('.env');
      FileService.prototype.readEnvFile.mockResolvedValue({ KEY1: 'old-value' });
      
      const diffResult = {
        added: {},
        modified: { KEY1: { old: 'old-value', new: 'new-value' } },
        removed: {},
        localOnly: {}
      };
      DiffService.prototype.compareSecrets.mockReturnValue(diffResult);
      DiffService.prototype.formatDiff.mockReturnValue('~ KEY1\n  - old-value\n  + new-value');

      // Mock readline to answer 'yes'
      const mockRl = {
        question: jest.fn((_, cb) => cb('yes')),
        close: jest.fn()
      };
      (readline.createInterface as jest.Mock).mockReturnValue(mockRl);

      const command = new Command();
      syncCommand.register(command);
      
      await command.parseAsync(['node', 'test', 'sync']);
      
      expect(mockRl.question).toHaveBeenCalledWith(
        expect.stringContaining('Apply these changes?'),
        expect.any(Function)
      );
      expect(DiffService.prototype.applyDiff).toHaveBeenCalled();
    });

    it('should cancel sync when user says no', async () => {
      const SecretsService = require('../../../src/services/secrets.service').SecretsService;
      const FileService = require('../../../src/services/file.service').FileService;
      const DiffService = require('../../../src/services/diff.service').DiffService;

      SecretsService.prototype.getSecrets.mockResolvedValue({ KEY1: 'new-value' });
      FileService.prototype.getEnvPath.mockResolvedValue('.env');
      FileService.prototype.readEnvFile.mockResolvedValue({ KEY1: 'old-value' });
      
      DiffService.prototype.compareSecrets.mockReturnValue({
        added: {},
        modified: { KEY1: { old: 'old-value', new: 'new-value' } },
        removed: {},
        localOnly: {}
      });
      DiffService.prototype.formatDiff.mockReturnValue('~ KEY1');

      // Mock readline to answer 'no'
      const mockRl = {
        question: jest.fn((_, cb) => cb('no')),
        close: jest.fn()
      };
      (readline.createInterface as jest.Mock).mockReturnValue(mockRl);

      const command = new Command();
      syncCommand.register(command);
      
      await command.parseAsync(['node', 'test', 'sync']);
      
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('cancelled'));
      expect(DiffService.prototype.applyDiff).not.toHaveBeenCalled();
    });

    it('should show warning for local-only variables', async () => {
      const SecretsService = require('../../../src/services/secrets.service').SecretsService;
      const FileService = require('../../../src/services/file.service').FileService;
      const DiffService = require('../../../src/services/diff.service').DiffService;

      SecretsService.prototype.getSecrets.mockResolvedValue({ KEY1: 'value1' });
      FileService.prototype.getEnvPath.mockResolvedValue('.env');
      FileService.prototype.readEnvFile.mockResolvedValue({ 
        KEY1: 'value1',
        LOCAL_KEY: 'local-value'
      });
      
      DiffService.prototype.compareSecrets.mockReturnValue({
        added: {},
        modified: {},
        removed: {},
        localOnly: { LOCAL_KEY: 'local-value' }
      });
      DiffService.prototype.formatDiff.mockReturnValue('! LOCAL_KEY=local-value');

      const command = new Command();
      syncCommand.register(command);
      
      await command.parseAsync(['node', 'test', 'sync', '--auto-approve']);
      
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Local-only variables will be preserved'));
    });

    it('should create backup by default', async () => {
      const SecretsService = require('../../../src/services/secrets.service').SecretsService;
      const FileService = require('../../../src/services/file.service').FileService;
      const DiffService = require('../../../src/services/diff.service').DiffService;

      SecretsService.prototype.getSecrets.mockResolvedValue({ KEY1: 'new-value' });
      FileService.prototype.getEnvPath.mockResolvedValue('.env');
      FileService.prototype.readEnvFile.mockResolvedValue({ KEY1: 'old-value' });
      
      DiffService.prototype.compareSecrets.mockReturnValue({
        added: { KEY1: 'new-value' },
        modified: {},
        removed: {},
        localOnly: {}
      });
      DiffService.prototype.formatDiff.mockReturnValue('+ KEY1=new-value');

      const command = new Command();
      syncCommand.register(command);
      
      await command.parseAsync(['node', 'test', 'sync', '--auto-approve']);
      
      expect(FileService.prototype.backupFile).toHaveBeenCalledWith('.env');
    });

    it('should skip backup with --no-backup flag', async () => {
      const SecretsService = require('../../../src/services/secrets.service').SecretsService;
      const FileService = require('../../../src/services/file.service').FileService;
      const DiffService = require('../../../src/services/diff.service').DiffService;

      SecretsService.prototype.getSecrets.mockResolvedValue({ KEY1: 'new-value' });
      FileService.prototype.getEnvPath.mockResolvedValue('.env');
      FileService.prototype.readEnvFile.mockResolvedValue({});
      
      DiffService.prototype.compareSecrets.mockReturnValue({
        added: { KEY1: 'new-value' },
        modified: {},
        removed: {},
        localOnly: {}
      });
      DiffService.prototype.formatDiff.mockReturnValue('+ KEY1=new-value');

      const command = new Command();
      syncCommand.register(command);
      
      await command.parseAsync(['node', 'test', 'sync', '--auto-approve', '--no-backup']);
      
      expect(FileService.prototype.backupFile).not.toHaveBeenCalled();
    });
  });
});