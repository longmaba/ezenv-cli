import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { APIService } from '../services/api.service';
import { FileService } from '../services/file.service';
import { DiffService } from '../services/diff.service';
import { ConfigService } from '../services/config.service';
import { SecretsService } from '../services/secrets.service';
import { ProjectService } from '../services/project.service';
import { CredentialService } from '../services/credential.service';
import { handleCommandError } from '../utils/errors';
import { DiffOptions } from '../types';

export class DiffCommand {
  private apiService: APIService;
  private fileService: FileService;
  private diffService: DiffService;
  private configService: ConfigService;
  private secretsService: SecretsService;
  private projectService: ProjectService;
  private credentialService: CredentialService;

  constructor() {
    this.credentialService = CredentialService.getInstance();
    this.configService = new ConfigService();
    this.apiService = new APIService(this.credentialService, this.configService);
    this.fileService = new FileService();
    this.diffService = new DiffService();
    this.secretsService = new SecretsService(this.apiService);
    this.projectService = new ProjectService();
  }

  register(program: Command): void {
    program
      .command('diff')
      .description('Show differences between local and remote environment variables')
      .option(
        '-f, --format <format>',
        'Output format (inline, side-by-side, summary)',
        'inline'
      )
      .option('--no-color', 'Disable colored output')
      .option('-e, --env <environment>', 'Environment to compare (default: current)')
      .action(async (options) => {
        await this.execute(options);
      });
  }

  private async execute(options: {
    format: 'inline' | 'side-by-side' | 'summary';
    color: boolean;
    env?: string;
  }): Promise<void> {
    try {
      await this.configService.init();
      
      const projectId = this.configService.getSelectedProject();
      const environmentId = options.env || this.configService.getSelectedEnvironment();
      
      if (!projectId) {
        console.error(chalk.red('No project selected'));
        console.log(chalk.cyan('Run "ezenv projects select" to choose a project'));
        process.exit(1);
      }

      if (!environmentId) {
        console.error(chalk.red('No environment selected'));
        console.log(chalk.cyan('Run "ezenv env select" to choose an environment'));
        process.exit(1);
      }

      const spinner = ora(`Fetching secrets from ${environmentId}...`).start();

      try {
        const project = await this.projectService.getProject(projectId);
        const remoteSecrets = await this.secretsService.getSecrets(
          project.name,
          environmentId
        );
        spinner.succeed('Fetched remote secrets');

        const localPath = await this.fileService.getEnvPath();
        const localSecrets = await this.fileService.readEnvFile(localPath);

        const diffResult = this.diffService.compareSecrets(localSecrets, remoteSecrets);

        const diffOptions: DiffOptions = {
          format: options.format,
          colorize: options.color
        };

        const formatted = this.diffService.formatDiff(diffResult, diffOptions);

        if (formatted) {
          console.log(formatted);
        } else {
          console.log(chalk.green('✓ No differences found'));
        }

        const lastSync = await this.fileService.getLastSyncTime(localPath);
        if (lastSync) {
          console.log(chalk.gray(`\nLast synced: ${lastSync}`));
        }
      } catch (error) {
        spinner.fail('Failed to compare environments');
        throw error;
      }
    } catch (error) {
      await handleCommandError(error);
    }
  }
}