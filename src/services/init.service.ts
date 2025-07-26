import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { Project } from './project.service';
import { Environment } from './environment.service';

export interface InitContext {
  isAuthenticated: boolean;
  selectedProject?: Project;
  selectedEnvironment?: Environment;
  envFilePath: string;
  configFilePath: string;
}

export interface InitConfig {
  project: {
    id: string;
    name: string;
  };
  environment: {
    id: string;
    name: string;
  };
}

export class InitService {
  async createConfigFile(context: InitContext): Promise<void> {
    if (!context.selectedProject || !context.selectedEnvironment) {
      throw new Error('Project and environment must be selected');
    }

    const config: InitConfig = {
      project: {
        id: context.selectedProject.id,
        name: context.selectedProject.name
      },
      environment: {
        id: context.selectedEnvironment.id,
        name: context.selectedEnvironment.name
      }
    };

    writeFileSync(
      context.configFilePath,
      JSON.stringify(config, null, 2) + '\n',
      'utf-8'
    );
  }

  getDefaultPaths(): { envFilePath: string; configFilePath: string } {
    return {
      envFilePath: resolve('.env'),
      configFilePath: resolve('.ezenvrc')
    };
  }

  validateNonInteractiveOptions(options: { project?: string; environment?: string }): void {
    if (!options.project) {
      throw new Error('--project is required in non-interactive mode');
    }
    if (!options.environment) {
      throw new Error('--environment is required in non-interactive mode');
    }
  }
}