import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { SecretsService } from '../services/secrets.service';
import { ConfigService } from '../services/config.service';
import { CredentialService } from '../services/credential.service';
import { APIService } from '../services/api.service';
import { ProjectService } from '../services/project.service';
import { EnvironmentService } from '../services/environment.service';
import { FileService } from '../services/file.service';
import { handleCommandError, CLIError } from '../utils/errors';
import { formatSecrets, OutputFormat } from '../utils/formatters';
import { existsSync } from 'fs';
import { resolve } from 'path';
import inquirer from 'inquirer';

export class PullCommand {
  private secretsService: SecretsService;
  private configService: ConfigService;
  private fileService: FileService;
  private projectService: ProjectService;
  private environmentService: EnvironmentService;

  constructor() {
    this.configService = new ConfigService();
    const credentialService = CredentialService.getInstance();
    const apiService = new APIService(credentialService, this.configService);
    this.secretsService = new SecretsService(apiService);
    this.fileService = new FileService();
    this.projectService = new ProjectService();
    this.environmentService = new EnvironmentService(this.configService);
  }

  register(program: Command): void {
    program
      .command('pull')
      .description('Download environment variables for current project/environment')
      .option('-o, --output <path>', 'output file path (default: .env)')
      .option('-f, --format <format>', 'output format: env, json, yaml, export (default: env)')
      .option('--force', 'skip overwrite confirmation')
      .action(async (options) => {
        await this.execute(options);
      });
  }

  private async execute(options: {
    output?: string;
    format?: string;
    force?: boolean;
  }): Promise<void> {
    try {
      // Initialize config
      await this.configService.init();
      
      // Validate project and environment are selected
      const projectId = this.configService.getSelectedProject();
      const environmentId = this.configService.getSelectedEnvironment();
      
      if (!projectId || !environmentId) {
        throw new CLIError(
          'No project or environment selected',
          'CONFIG_INCOMPLETE',
          { 
            hasProject: !!projectId,
            hasEnvironment: !!environmentId
          }
        );
      }

      // Get project and environment details
      const project = await this.projectService.getProject(projectId);
      const environments = await this.environmentService.listEnvironments(projectId);
      const environment = environments.find(env => env.id === environmentId);
      
      if (!environment) {
        throw new CLIError(
          'Selected environment not found',
          'ENVIRONMENT_NOT_FOUND',
          { environmentId }
        );
      }
      
      // Show current context
      console.log(chalk.cyan('Current context:'));
      console.log(chalk.gray(`  Project: ${project.name}`));
      console.log(chalk.gray(`  Environment: ${environment.name}\n`));

      // Determine output path
      const outputPath = resolve(options.output || '.env');
      
      // Validate format
      const format = (options.format || 'env') as OutputFormat;
      const validFormats: OutputFormat[] = ['env', 'json', 'yaml', 'export'];
      if (!validFormats.includes(format)) {
        throw new CLIError(
          `Invalid format: ${format}`,
          'INVALID_FORMAT',
          { validFormats }
        );
      }

      // Check file permissions
      const hasWritePermission = await this.fileService.checkWritePermission(outputPath);
      if (!hasWritePermission) {
        throw new CLIError(
          `No write permission for: ${outputPath}`,
          'NO_WRITE_PERMISSION'
        );
      }

      // Check if file exists and handle overwrite
      if (existsSync(outputPath) && !options.force) {
        const { confirmOverwrite } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmOverwrite',
            message: `File ${chalk.yellow(outputPath)} already exists. Overwrite?`,
            default: false
          }
        ]);

        if (!confirmOverwrite) {
          console.log(chalk.yellow('Pull cancelled.'));
          return;
        }

        // Create backup
        await this.fileService.backupFile(outputPath);
      }

      // Fetch secrets
      const spinner = ora('Fetching secrets...').start();
      
      const secrets = await this.secretsService.getSecrets(
        projectId,
        environmentId
      );

      spinner.text = 'Writing secrets to file...';

      // Format and write secrets
      const formattedContent = formatSecrets(secrets, format);
      await this.fileService.writeEnvFile(formattedContent, outputPath);

      spinner.succeed('Secrets downloaded successfully!');
      
      // Display summary
      const secretCount = Object.keys(secrets).length;
      console.log(chalk.green(`\n✓ Downloaded ${secretCount} environment variable${secretCount === 1 ? '' : 's'}`));
      console.log(chalk.gray(`  File: ${outputPath}`));
      console.log(chalk.gray(`  Format: ${format}`));
      
    } catch (error) {
      await handleCommandError(error);
    }
  }
}