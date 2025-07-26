import { Command } from 'commander';
import { PullCommand } from '../../../src/commands/pull';
import { ConfigService } from '../../../src/services/config.service';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import chalk from 'chalk';

// Mock dependencies
jest.mock('../../../src/services/config.service');
jest.mock('../../../src/services/credential.service');
jest.mock('../../../src/services/api.service');
jest.mock('../../../src/services/project.service');
jest.mock('../../../src/services/environment.service');
jest.mock('inquirer');
jest.mock('ora');

describe('Pull Command Integration', () => {
  let tempDir: string;
  let program: Command;
  let pullCommand: PullCommand;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;

  beforeEach(async () => {
    // Create temp directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ezenv-test-'));
    
    // Setup spies
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });

    // Setup command
    program = new Command();
    program.exitOverride(); // Prevent process.exit in tests
    pullCommand = new PullCommand();
    pullCommand.register(program);
  });

  afterEach(async () => {
    // Cleanup
    await fs.rm(tempDir, { recursive: true, force: true });
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('successful pull', () => {
    beforeEach(() => {
      const { ConfigService } = require('../../../src/services/config.service');
      const { ProjectService } = require('../../../src/services/project.service');
      const { EnvironmentService } = require('../../../src/services/environment.service');
      const { APIService } = require('../../../src/services/api.service');
      
      // Mock config
      ConfigService.prototype.init = jest.fn().mockResolvedValue(undefined);
      ConfigService.prototype.getSelectedProject = jest.fn().mockReturnValue('project-123');
      ConfigService.prototype.getSelectedEnvironment = jest.fn().mockReturnValue('env-456');
      
      // Mock project service
      ProjectService.prototype.getProject = jest.fn().mockResolvedValue({
        id: 'project-123',
        name: 'my-project',
        team: { name: 'My Team' }
      });
      
      // Mock environment service
      EnvironmentService.prototype.listEnvironments = jest.fn().mockResolvedValue([
        { id: 'env-456', name: 'development', type: 'development' }
      ]);
      
      // Mock API service
      APIService.prototype.post = jest.fn().mockResolvedValue({
        secrets: {
          DATABASE_URL: 'postgresql://localhost:5432/db',
          API_KEY: 'sk-1234567890',
          DEBUG: 'true'
        }
      });
    });

    it('should pull secrets to default .env file', async () => {
      const envPath = path.join(tempDir, '.env');
      process.chdir(tempDir);
      
      await program.parseAsync(['node', 'test', 'pull']);
      
      // Check output
      expect(consoleLogSpy).toHaveBeenCalledWith(chalk.cyan('Current context:'));
      expect(consoleLogSpy).toHaveBeenCalledWith(chalk.gray('  Project: my-project'));
      expect(consoleLogSpy).toHaveBeenCalledWith(chalk.gray('  Environment: development\n'));
      expect(consoleLogSpy).toHaveBeenCalledWith(
        chalk.green('✓ Downloaded 3 environment variables')
      );
      
      // Check file contents
      const fileContent = await fs.readFile(envPath, 'utf-8');
      expect(fileContent).toContain('DATABASE_URL=postgresql://localhost:5432/db');
      expect(fileContent).toContain('API_KEY=sk-1234567890');
      expect(fileContent).toContain('DEBUG=true');
    });

    it('should pull secrets to custom output path', async () => {
      const customPath = path.join(tempDir, 'custom', '.env.local');
      
      await program.parseAsync(['node', 'test', 'pull', '--output', customPath]);
      
      // Check file was created in custom location
      const fileContent = await fs.readFile(customPath, 'utf-8');
      expect(fileContent).toContain('DATABASE_URL=postgresql://localhost:5432/db');
    });

    it('should support JSON format', async () => {
      const jsonPath = path.join(tempDir, 'secrets.json');
      
      await program.parseAsync(['node', 'test', 'pull', '--output', jsonPath, '--format', 'json']);
      
      const fileContent = await fs.readFile(jsonPath, 'utf-8');
      const parsed = JSON.parse(fileContent);
      expect(parsed).toEqual({
        DATABASE_URL: 'postgresql://localhost:5432/db',
        API_KEY: 'sk-1234567890',
        DEBUG: 'true'
      });
    });

    it('should support YAML format', async () => {
      const yamlPath = path.join(tempDir, 'secrets.yaml');
      
      await program.parseAsync(['node', 'test', 'pull', '--output', yamlPath, '--format', 'yaml']);
      
      const fileContent = await fs.readFile(yamlPath, 'utf-8');
      expect(fileContent).toContain('DATABASE_URL: postgresql://localhost:5432/db');
      expect(fileContent).toContain('API_KEY: sk-1234567890');
      expect(fileContent).toContain('DEBUG: true');
    });

    it('should support export format', async () => {
      const exportPath = path.join(tempDir, 'secrets.sh');
      
      await program.parseAsync(['node', 'test', 'pull', '--output', exportPath, '--format', 'export']);
      
      const fileContent = await fs.readFile(exportPath, 'utf-8');
      expect(fileContent).toContain('export DATABASE_URL="postgresql://localhost:5432/db"');
      expect(fileContent).toContain('export API_KEY="sk-1234567890"');
      expect(fileContent).toContain('export DEBUG="true"');
    });
  });

  describe('overwrite protection', () => {
    beforeEach(() => {
      const { ConfigService } = require('../../../src/services/config.service');
      const { ProjectService } = require('../../../src/services/project.service');
      const { EnvironmentService } = require('../../../src/services/environment.service');
      const { APIService } = require('../../../src/services/api.service');
      
      ConfigService.prototype.init = jest.fn().mockResolvedValue(undefined);
      ConfigService.prototype.getSelectedProject = jest.fn().mockReturnValue('project-123');
      ConfigService.prototype.getSelectedEnvironment = jest.fn().mockReturnValue('env-456');
      
      ProjectService.prototype.getProject = jest.fn().mockResolvedValue({
        id: 'project-123',
        name: 'my-project'
      });
      
      EnvironmentService.prototype.listEnvironments = jest.fn().mockResolvedValue([
        { id: 'env-456', name: 'development' }
      ]);
      
      APIService.prototype.post = jest.fn().mockResolvedValue({
        secrets: { KEY: 'value' }
      });
    });

    it('should prompt before overwriting existing file', async () => {
      const envPath = path.join(tempDir, '.env');
      await fs.writeFile(envPath, 'EXISTING=value');
      process.chdir(tempDir);
      
      const inquirer = require('inquirer');
      inquirer.prompt = jest.fn().mockResolvedValue({ confirmOverwrite: false });
      
      await program.parseAsync(['node', 'test', 'pull']);
      
      expect(inquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'confirm',
          name: 'confirmOverwrite',
          message: expect.stringContaining('.env already exists')
        })
      ]);
      
      // File should not be overwritten
      const fileContent = await fs.readFile(envPath, 'utf-8');
      expect(fileContent).toBe('EXISTING=value');
    });

    it('should skip prompt with --force flag', async () => {
      const envPath = path.join(tempDir, '.env');
      await fs.writeFile(envPath, 'EXISTING=value');
      process.chdir(tempDir);
      
      const inquirer = require('inquirer');
      inquirer.prompt = jest.fn();
      
      await program.parseAsync(['node', 'test', 'pull', '--force']);
      
      expect(inquirer.prompt).not.toHaveBeenCalled();
      
      // File should be overwritten
      const fileContent = await fs.readFile(envPath, 'utf-8');
      expect(fileContent).toBe('KEY=value');
    });

    it('should create backup before overwriting', async () => {
      const envPath = path.join(tempDir, '.env');
      await fs.writeFile(envPath, 'EXISTING=value');
      process.chdir(tempDir);
      
      const inquirer = require('inquirer');
      inquirer.prompt = jest.fn().mockResolvedValue({ confirmOverwrite: true });
      
      await program.parseAsync(['node', 'test', 'pull']);
      
      // Check backup was created
      const files = await fs.readdir(tempDir);
      const backupFile = files.find(f => f.startsWith('.env.backup.'));
      expect(backupFile).toBeDefined();
      
      if (backupFile) {
        const backupContent = await fs.readFile(path.join(tempDir, backupFile), 'utf-8');
        expect(backupContent).toBe('EXISTING=value');
      }
    });
  });

  describe('error handling', () => {
    it('should handle missing project selection', async () => {
      const { ConfigService } = require('../../../src/services/config.service');
      ConfigService.prototype.init = jest.fn().mockResolvedValue(undefined);
      ConfigService.prototype.getSelectedProject = jest.fn().mockReturnValue(null);
      ConfigService.prototype.getSelectedEnvironment = jest.fn().mockReturnValue('env-456');
      
      await expect(
        program.parseAsync(['node', 'test', 'pull'])
      ).rejects.toThrow('process.exit');
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        chalk.red('Error: No project or environment selected')
      );
    });

    it('should handle missing environment selection', async () => {
      const { ConfigService } = require('../../../src/services/config.service');
      ConfigService.prototype.init = jest.fn().mockResolvedValue(undefined);
      ConfigService.prototype.getSelectedProject = jest.fn().mockReturnValue('project-123');
      ConfigService.prototype.getSelectedEnvironment = jest.fn().mockReturnValue(null);
      
      await expect(
        program.parseAsync(['node', 'test', 'pull'])
      ).rejects.toThrow('process.exit');
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        chalk.red('Error: No project or environment selected')
      );
    });

    it('should handle invalid format', async () => {
      const { ConfigService } = require('../../../src/services/config.service');
      ConfigService.prototype.init = jest.fn().mockResolvedValue(undefined);
      ConfigService.prototype.getSelectedProject = jest.fn().mockReturnValue('project-123');
      ConfigService.prototype.getSelectedEnvironment = jest.fn().mockReturnValue('env-456');
      
      await expect(
        program.parseAsync(['node', 'test', 'pull', '--format', 'invalid'])
      ).rejects.toThrow('process.exit');
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        chalk.red('Error: Invalid format: invalid')
      );
    });

    it('should handle no write permissions', async () => {
      const { ConfigService } = require('../../../src/services/config.service');
      const { ProjectService } = require('../../../src/services/project.service');
      const { EnvironmentService } = require('../../../src/services/environment.service');
      
      ConfigService.prototype.init = jest.fn().mockResolvedValue(undefined);
      ConfigService.prototype.getSelectedProject = jest.fn().mockReturnValue('project-123');
      ConfigService.prototype.getSelectedEnvironment = jest.fn().mockReturnValue('env-456');
      
      ProjectService.prototype.getProject = jest.fn().mockResolvedValue({
        id: 'project-123',
        name: 'my-project'
      });
      
      EnvironmentService.prototype.listEnvironments = jest.fn().mockResolvedValue([
        { id: 'env-456', name: 'development' }
      ]);
      
      // Make directory read-only
      const readOnlyDir = path.join(tempDir, 'readonly');
      await fs.mkdir(readOnlyDir, { mode: 0o444 });
      
      await expect(
        program.parseAsync(['node', 'test', 'pull', '--output', path.join(readOnlyDir, '.env')])
      ).rejects.toThrow('process.exit');
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('No write permission')
      );
    });
  });

  describe('empty secrets', () => {
    beforeEach(() => {
      const { ConfigService } = require('../../../src/services/config.service');
      const { ProjectService } = require('../../../src/services/project.service');
      const { EnvironmentService } = require('../../../src/services/environment.service');
      const { APIService } = require('../../../src/services/api.service');
      
      ConfigService.prototype.init = jest.fn().mockResolvedValue(undefined);
      ConfigService.prototype.getSelectedProject = jest.fn().mockReturnValue('project-123');
      ConfigService.prototype.getSelectedEnvironment = jest.fn().mockReturnValue('env-456');
      
      ProjectService.prototype.getProject = jest.fn().mockResolvedValue({
        id: 'project-123',
        name: 'my-project'
      });
      
      EnvironmentService.prototype.listEnvironments = jest.fn().mockResolvedValue([
        { id: 'env-456', name: 'development' }
      ]);
      
      APIService.prototype.post = jest.fn().mockResolvedValue({
        secrets: {}
      });
    });

    it('should handle empty secrets response', async () => {
      const envPath = path.join(tempDir, '.env');
      process.chdir(tempDir);
      
      await program.parseAsync(['node', 'test', 'pull']);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        chalk.green('✓ Downloaded 0 environment variables')
      );
      
      // File should be created but empty
      const fileContent = await fs.readFile(envPath, 'utf-8');
      expect(fileContent).toBe('');
    });
  });
});