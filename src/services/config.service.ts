import { promises as fs } from 'fs';
import * as path from 'path';
import type { AuthConfig, Environment } from '../types';

export interface Config {
  activeEnvironment: Environment;
  authConfig?: AuthConfig;
}

export class ConfigService {
  private configPath: string;
  private config: Config = {
    activeEnvironment: 'production'
  };

  constructor(baseDir: string = process.env.HOME || '') {
    this.configPath = path.join(baseDir, '.ezenv', 'config.json');
  }

  async init(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.configPath), { recursive: true });
      const data = await fs.readFile(this.configPath, 'utf-8');
      this.config = JSON.parse(data);
    } catch (error) {
      // Config doesn't exist yet, use defaults
      await this.save();
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

  private async save(): Promise<void> {
    await fs.mkdir(path.dirname(this.configPath), { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
  }
}