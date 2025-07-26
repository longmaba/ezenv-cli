import { SyncCommand } from '../../../src/commands/sync';
import { ApiService } from '../../../src/services/api.service';
import { FileService } from '../../../src/services/file.service';
import { DiffService } from '../../../src/services/diff.service';
import { ConfigService } from '../../../src/services/config.service';
import { Command } from 'commander';
import * as readline from 'readline';

jest.mock('../../../src/services/api.service');
jest.mock('../../../src/services/file.service');
jest.mock('../../../src/services/diff.service');
jest.mock('../../../src/services/config.service');
jest.mock('readline');

describe('SyncCommand', () => {
  let syncCommand: SyncCommand;
  let mockApiService: jest.Mocked<ApiService>;
  let mockFileService: jest.Mocked<FileService>;
  let mockDiffService: jest.Mocked<DiffService>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockConsoleLog: jest.SpyInstance;
  let mockConsoleError: jest.SpyInstance;
  let mockProcessExit: jest.SpyInstance;

  beforeEach(() => {
    mockApiService = {
      getSecrets: jest.fn()
    } as any;
    mockFileService = {
      getEnvPath: jest.fn(),
      readEnvFile: jest.fn(),
      backupFile: jest.fn(),
      writeEnvFile: jest.fn()
    } as any;
    mockDiffService = {
      compareSecrets: jest.fn(),
      formatDiff: jest.fn(),
      applyDiff: jest.fn()
    } as any;
    mockConfigService = {
      load: jest.fn()
    } as any;

    syncCommand = new SyncCommand(
      mockApiService,
      mockFileService,
      mockDiffService,
      mockConfigService
    );

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
      mockConfigService.load.mockResolvedValue({
        currentProject: null,
        currentEnvironment: 'development'
      } as any);

      const command = new Command();
      syncCommand.register(command);
      
      await expect(command.parseAsync(['node', 'test', 'sync'])).rejects.toThrow('process.exit');
      
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('No project selected'));
    });

    it('should show error when no environment is selected', async () => {
      mockConfigService.load.mockResolvedValue({
        currentProject: 'project-id',
        currentEnvironment: null
      } as any);

      const command = new Command();
      syncCommand.register(command);
      
      await expect(command.parseAsync(['node', 'test', 'sync'])).rejects.toThrow('process.exit');
      
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('No environment selected'));
    });

    it('should handle case when environment is already up to date', async () => {
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

      const command = new Command();
      syncCommand.register(command);
      
      await command.parseAsync(['node', 'test', 'sync']);
      
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('already up to date'));
      expect(mockDiffService.applyDiff).not.toHaveBeenCalled();
    });

    it('should apply changes with auto-approve flag', async () => {
      mockConfigService.load.mockResolvedValue({
        currentProject: 'project-id',
        currentEnvironment: 'development'
      } as any);

      mockApiService.getSecrets.mockResolvedValue({ KEY1: 'new-value' });
      mockFileService.getEnvPath.mockResolvedValue('.env');
      mockFileService.readEnvFile.mockResolvedValue({ KEY1: 'old-value' });
      
      const diffResult = {
        added: {},
        modified: { KEY1: { old: 'old-value', new: 'new-value' } },
        removed: {},
        localOnly: {}
      };
      mockDiffService.compareSecrets.mockReturnValue(diffResult);
      mockDiffService.formatDiff.mockReturnValue('~ KEY1\n  - old-value\n  + new-value');

      const command = new Command();
      syncCommand.register(command);
      
      await command.parseAsync(['node', 'test', 'sync', '--auto-approve']);
      
      expect(mockDiffService.applyDiff).toHaveBeenCalledWith('.env', diffResult, mockFileService);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('synchronized'));
    });

    it('should prompt for confirmation without auto-approve', async () => {
      mockConfigService.load.mockResolvedValue({
        currentProject: 'project-id',
        currentEnvironment: 'development'
      } as any);

      mockApiService.getSecrets.mockResolvedValue({ KEY1: 'new-value' });
      mockFileService.getEnvPath.mockResolvedValue('.env');
      mockFileService.readEnvFile.mockResolvedValue({ KEY1: 'old-value' });
      
      const diffResult = {
        added: {},
        modified: { KEY1: { old: 'old-value', new: 'new-value' } },
        removed: {},
        localOnly: {}
      };
      mockDiffService.compareSecrets.mockReturnValue(diffResult);
      mockDiffService.formatDiff.mockReturnValue('~ KEY1\n  - old-value\n  + new-value');

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
      expect(mockDiffService.applyDiff).toHaveBeenCalled();
    });

    it('should cancel sync when user says no', async () => {
      mockConfigService.load.mockResolvedValue({
        currentProject: 'project-id',
        currentEnvironment: 'development'
      } as any);

      mockApiService.getSecrets.mockResolvedValue({ KEY1: 'new-value' });
      mockFileService.getEnvPath.mockResolvedValue('.env');
      mockFileService.readEnvFile.mockResolvedValue({ KEY1: 'old-value' });
      
      mockDiffService.compareSecrets.mockReturnValue({
        added: {},
        modified: { KEY1: { old: 'old-value', new: 'new-value' } },
        removed: {},
        localOnly: {}
      });
      mockDiffService.formatDiff.mockReturnValue('~ KEY1');

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
      expect(mockDiffService.applyDiff).not.toHaveBeenCalled();
    });

    it('should show warning for local-only variables', async () => {
      mockConfigService.load.mockResolvedValue({
        currentProject: 'project-id',
        currentEnvironment: 'development'
      } as any);

      mockApiService.getSecrets.mockResolvedValue({ KEY1: 'value1' });
      mockFileService.getEnvPath.mockResolvedValue('.env');
      mockFileService.readEnvFile.mockResolvedValue({ 
        KEY1: 'value1',
        LOCAL_KEY: 'local-value'
      });
      
      mockDiffService.compareSecrets.mockReturnValue({
        added: {},
        modified: {},
        removed: {},
        localOnly: { LOCAL_KEY: 'local-value' }
      });
      mockDiffService.formatDiff.mockReturnValue('! LOCAL_KEY=local-value');

      const command = new Command();
      syncCommand.register(command);
      
      await command.parseAsync(['node', 'test', 'sync', '--auto-approve']);
      
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Local-only variables will be preserved'));
    });

    it('should create backup by default', async () => {
      mockConfigService.load.mockResolvedValue({
        currentProject: 'project-id',
        currentEnvironment: 'development'
      } as any);

      mockApiService.getSecrets.mockResolvedValue({ KEY1: 'new-value' });
      mockFileService.getEnvPath.mockResolvedValue('.env');
      mockFileService.readEnvFile.mockResolvedValue({ KEY1: 'old-value' });
      
      mockDiffService.compareSecrets.mockReturnValue({
        added: { KEY1: 'new-value' },
        modified: {},
        removed: {},
        localOnly: {}
      });
      mockDiffService.formatDiff.mockReturnValue('+ KEY1=new-value');

      const command = new Command();
      syncCommand.register(command);
      
      await command.parseAsync(['node', 'test', 'sync', '--auto-approve']);
      
      expect(mockFileService.backupFile).toHaveBeenCalledWith('.env');
    });

    it('should skip backup with --no-backup flag', async () => {
      mockConfigService.load.mockResolvedValue({
        currentProject: 'project-id',
        currentEnvironment: 'development'
      } as any);

      mockApiService.getSecrets.mockResolvedValue({ KEY1: 'new-value' });
      mockFileService.getEnvPath.mockResolvedValue('.env');
      mockFileService.readEnvFile.mockResolvedValue({});
      
      mockDiffService.compareSecrets.mockReturnValue({
        added: { KEY1: 'new-value' },
        modified: {},
        removed: {},
        localOnly: {}
      });
      mockDiffService.formatDiff.mockReturnValue('+ KEY1=new-value');

      const command = new Command();
      syncCommand.register(command);
      
      await command.parseAsync(['node', 'test', 'sync', '--auto-approve', '--no-backup']);
      
      expect(mockFileService.backupFile).not.toHaveBeenCalled();
    });
  });
});