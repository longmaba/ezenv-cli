import { promises as fs } from 'fs';
import * as path from 'path';
import { ConfigService } from '../../../src/services/config.service';

jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn()
  }
}));

describe('ConfigService', () => {
  let configService: ConfigService;
  const mockHomeDir = '/home/test';
  const mockCwd = '/project/dir';

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.HOME = mockHomeDir;
    jest.spyOn(process, 'cwd').mockReturnValue(mockCwd);
    configService = new ConfigService(mockHomeDir);
  });

  afterEach(() => {
    delete process.env.HOME;
  });

  describe('init', () => {
    it('should create config directory and file if they do not exist', async () => {
      const mockFs = fs as jest.Mocked<typeof fs>;
      mockFs.readFile.mockRejectedValueOnce(new Error('ENOENT'));

      await configService.init();

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        path.join(mockHomeDir, '.ezenv'),
        { recursive: true }
      );
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join(mockHomeDir, '.ezenv', 'config.json'),
        expect.stringContaining('"activeEnvironment": "production"')
      );
    });

    it('should load existing config file', async () => {
      const mockFs = fs as jest.Mocked<typeof fs>;
      const existingConfig = {
        activeEnvironment: 'staging',
        cliConfig: {
          selected_project: 'existing-project',
          output_format: 'json',
          auto_update_check: false
        }
      };
      mockFs.readFile.mockImplementation((filePath) => {
        if (filePath === path.join(mockHomeDir, '.ezenv', 'config.json')) {
          return Promise.resolve(JSON.stringify(existingConfig));
        }
        return Promise.reject(new Error('ENOENT'));
      });

      await configService.init();

      expect(configService.getActiveEnvironment()).toBe('staging');
      expect(configService.getSelectedProject()).toBe('existing-project');
    });

    it('should load project-specific config from .ezenvrc', async () => {
      const mockFs = fs as jest.Mocked<typeof fs>;
      const globalConfig = {
        activeEnvironment: 'production'
      };
      const projectConfig = {
        selected_project: 'project-from-rc',
        selected_environment: 'staging'
      };

      mockFs.readFile.mockImplementation((filePath) => {
        if (filePath === path.join(mockHomeDir, '.ezenv', 'config.json')) {
          return Promise.resolve(JSON.stringify(globalConfig));
        } else if (filePath === path.join(mockCwd, '.ezenvrc')) {
          return Promise.resolve(JSON.stringify(projectConfig));
        }
        return Promise.reject(new Error('ENOENT'));
      });

      await configService.init();

      expect(configService.getSelectedProject()).toBe('project-from-rc');
      expect(configService.getSelectedEnvironment()).toBe('staging');
    });
  });

  describe('project selection', () => {
    it('should set and save selected project', async () => {
      const mockFs = fs as jest.Mocked<typeof fs>;
      mockFs.readFile.mockRejectedValue(new Error('ENOENT'));

      await configService.init();
      await configService.setSelectedProject('new-project-id');

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join(mockCwd, '.ezenvrc'),
        expect.stringContaining('"selected_project": "new-project-id"')
      );
      expect(configService.getSelectedProject()).toBe('new-project-id');
    });

    it('should clear selected environment when project changes', async () => {
      const mockFs = fs as jest.Mocked<typeof fs>;
      mockFs.readFile.mockRejectedValue(new Error('ENOENT'));

      await configService.init();
      await configService.setSelectedProject('project-1');
      await configService.clearSelectedEnvironment();

      const lastWriteCall = mockFs.writeFile.mock.calls.find(
        call => call[0] === path.join(mockCwd, '.ezenvrc')
      );
      expect(lastWriteCall?.[1]).not.toContain('selected_environment');
    });

    it('should override with --project flag', async () => {
      const mockFs = fs as jest.Mocked<typeof fs>;
      mockFs.readFile.mockRejectedValue(new Error('ENOENT'));

      // Simulate --project flag
      const originalArgv = process.argv;
      process.argv = ['node', 'ezenv', 'pull', '--project', 'override-project'];

      await configService.init();
      await configService.setSelectedProject('config-project');

      expect(configService.getSelectedProject()).toBe('override-project');

      process.argv = originalArgv;
    });
  });

  describe('environment management', () => {
    it('should set and get active environment', async () => {
      const mockFs = fs as jest.Mocked<typeof fs>;
      mockFs.readFile.mockRejectedValue(new Error('ENOENT'));

      await configService.init();
      await configService.setActiveEnvironment('staging' as any);

      expect(configService.getActiveEnvironment()).toBe('staging');
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join(mockHomeDir, '.ezenv', 'config.json'),
        expect.stringContaining('"activeEnvironment": "staging"')
      );
    });
  });

  describe('auth config', () => {
    it('should set and get auth config', async () => {
      const mockFs = fs as jest.Mocked<typeof fs>;
      mockFs.readFile.mockRejectedValue(new Error('ENOENT'));

      const authConfig = {
        supabaseUrl: 'https://test.supabase.co',
        loginUrl: 'https://app.ezenv.io/login',
        clientId: 'test-client-id'
      };

      await configService.init();
      await configService.setAuthConfig(authConfig);

      expect(configService.getAuthConfig()).toEqual(authConfig);
    });
  });
});