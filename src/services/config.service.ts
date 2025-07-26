import { promises as fs } from 'fs';
import * as path from 'path';
import type { AuthConfig, Environment } from '../types';

export interface CLIConfiguration {
  selected_project?: string;
  selected_environment?: string;
  output_format: 'env' | 'json' | 'yaml' | 'export';
  auto_update_check: boolean;
  last_update_check?: string;
}

export interface Config {
  activeEnvironment: Environment;
  authConfig?: AuthConfig;
  cliConfig?: CLIConfiguration;
}

export class ConfigService {
  private configPath: string;
  private ezenvrcPath: string;
  private config: Config = {
    activeEnvironment: 'production',
    cliConfig: {
      output_format: 'env',
      auto_update_check: true
    }
  };

  constructor(baseDir: string = process.env.HOME || '') {
    this.configPath = path.join(baseDir, '.ezenv', 'config.json');
    this.ezenvrcPath = path.join(process.cwd(), '.ezenvrc');
  }

  async init(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.configPath), { recursive: true });
      const data = await fs.readFile(this.configPath, 'utf-8');
      this.config = { ...this.config, ...JSON.parse(data) };
    } catch (error) {
      // Config doesn't exist yet, use defaults
      await this.save();
    }

    // Load project-specific config from .ezenvrc if it exists
    try {
      const ezenvrcData = await fs.readFile(this.ezenvrcPath, 'utf-8');
      const projectConfig = JSON.parse(ezenvrcData);
      if (projectConfig.selected_project || projectConfig.selected_environment) {
        this.config.cliConfig = {
          ...this.config.cliConfig,
          ...projectConfig
        };
      }
    } catch (error) {
      // .ezenvrc doesn't exist or is invalid, ignore
    }
  }

  async setActiveEnvironment(env: Environment): Promise<void> {
    this.config.activeEnvironment = env;
    await this.save();
  }

  getActiveEnvironment(): Environment {
    return this.config.activeEnvironment;
  }

  async setAuthConfig(authConfig: AuthConfig): Promise<void> {
    this.config.authConfig = authConfig;
    await this.save();
  }

  getAuthConfig(): AuthConfig | undefined {
    return this.config.authConfig;
  }

  async setSelectedProject(projectId: string): Promise<void> {
    if (!this.config.cliConfig) {
      this.config.cliConfig = {
        output_format: 'env',
        auto_update_check: true
      };
    }
    this.config.cliConfig.selected_project = projectId;
    await this.saveEzenvrc();
  }

  async clearSelectedEnvironment(): Promise<void> {
    if (this.config.cliConfig) {
      delete this.config.cliConfig.selected_environment;
      await this.saveEzenvrc();
    }
  }

  getSelectedProject(): string | undefined {
    // Check for --project flag override
    const projectFlag = process.argv.find((arg, index) => 
      (arg === '--project' || arg === '-p') && process.argv[index + 1]
    );
    if (projectFlag) {
      const flagIndex = process.argv.indexOf(projectFlag);
      return process.argv[flagIndex + 1];
    }

    return this.config.cliConfig?.selected_project;
  }

  getSelectedEnvironment(): string | undefined {
    return this.config.cliConfig?.selected_environment;
  }

  private async save(): Promise<void> {
    await fs.mkdir(path.dirname(this.configPath), { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
  }

  private async saveEzenvrc(): Promise<void> {
    if (!this.config.cliConfig) return;
    
    const ezenvrcConfig = {
      selected_project: this.config.cliConfig.selected_project,
      selected_environment: this.config.cliConfig.selected_environment
    };
    
    await fs.writeFile(this.ezenvrcPath, JSON.stringify(ezenvrcConfig, null, 2));
  }
}