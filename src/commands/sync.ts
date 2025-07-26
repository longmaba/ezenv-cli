import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as readline from 'readline';
import { APIService } from '../services/api.service';
import { FileService } from '../services/file.service';
import { DiffService } from '../services/diff.service';
import { ConfigService } from '../services/config.service';
import { SecretsService } from '../services/secrets.service';
import { CredentialService } from '../services/credential.service';
import { logger } from '../utils/logger';
import { handleCommandError } from '../utils/errors';
import { DiffOptions } from '../types';

export class SyncCommand {
  private apiService: APIService;
  private fileService: FileService;
  private diffService: DiffService;
  private configService: ConfigService;
  private secretsService: SecretsService;
  private credentialService: CredentialService;

  constructor() {
    this.credentialService = CredentialService.getInstance();
    this.configService = new ConfigService();
    this.apiService = new APIService(this.credentialService, this.configService);
    this.fileService = new FileService();
    this.diffService = new DiffService();
    this.secretsService = new SecretsService(this.apiService);
  }

  register(program: Command): void {
    program
      .command('sync')
      .description('Sync local environment variables with remote values')
      .option('--auto-approve', 'Skip confirmation prompt')
      .option('-e, --env <environment>', 'Environment to sync (default: current)')
      .option('--no-backup', 'Skip creating backup file')
      .action(async (options) => {
        await this.execute(options);
      });
  }

  private async execute(options: {
    autoApprove?: boolean;
    env?: string;
    backup: boolean;
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

      const spinner = ora(`Fetching secrets...`).start();

      try {
        // Pass the IDs directly - SecretsService will handle them as UUIDs
        const remoteSecrets = await this.secretsService.getSecrets(
          projectId,
          environmentId
        );
        spinner.succeed('Fetched remote secrets');

        const localPath = await this.fileService.getEnvPath();
        const localSecrets = await this.fileService.readEnvFile(localPath);

        const diffResult = this.diffService.compareSecrets(localSecrets, remoteSecrets);

        // Check if there are any changes
        const hasChanges = 
          Object.keys(diffResult.added).length > 0 ||
          Object.keys(diffResult.modified).length > 0 ||
          Object.keys(diffResult.removed).length > 0;

        if (!hasChanges && Object.keys(diffResult.localOnly).length === 0) {
          console.log(chalk.green('✓ Your environment is already up to date'));
          return;
        }

        // Display the diff
        console.log(chalk.cyan('\nChanges to be applied:'));
        const diffOptions: DiffOptions = {
          format: 'inline',
          colorize: true
        };
        const formatted = this.diffService.formatDiff(diffResult, diffOptions);
        if (formatted) {
          console.log(formatted);
        }

        // Show warning about local variables if any
        if (Object.keys(diffResult.localOnly).length > 0) {
          console.log(chalk.yellow('\n⚠ Local-only variables will be preserved'));
        }

        // Ask for confirmation unless auto-approve
        if (!options.autoApprove) {
          const confirmed = await this.promptConfirmation();
          if (!confirmed) {
            console.log(chalk.gray('Sync cancelled'));
            return;
          }
        }

        // Create backup if requested
        if (options.backup) {
          await this.createBackup(localPath);
        }

        // Apply the changes
        const applySpinner = ora('Applying changes...').start();
        await this.diffService.applyDiff(localPath, diffResult, this.fileService);
        applySpinner.succeed('Changes applied successfully');

        console.log(chalk.green('✓ Environment synchronized'));
        
        // Show backup location if created
        if (options.backup) {
          const backupFiles = await this.getBackupFiles(localPath);
          if (backupFiles.length > 0) {
            console.log(chalk.gray(`Backup saved to: ${backupFiles[0]}`));
          }
        }

      } catch (error) {
        spinner.fail('Sync failed');
        throw error;
      }
    } catch (error) {
      await handleCommandError(error);
    }
  }

  private async promptConfirmation(): Promise<boolean> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question(chalk.cyan('\nApply these changes? (yes/no): '), (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
      });
    });
  }

  private async createBackup(envPath: string): Promise<void> {
    try {
      await this.fileService.backupFile(envPath);
      
      // Clean up old backups (keep only last 5)
      await this.cleanupOldBackups(envPath);
    } catch (error) {
      logger.error('Failed to create backup', error);
      // Don't fail the sync if backup fails
    }
  }

  private async cleanupOldBackups(envPath: string): Promise<void> {
    try {
      const backupFiles = await this.getBackupFiles(envPath);
      
      // Sort by timestamp (newest first)
      backupFiles.sort().reverse();
      
      // Remove old backups
      const toRemove = backupFiles.slice(5);
      for (const file of toRemove) {
        try {
          const fs = await import('fs/promises');
          await fs.unlink(file);
          logger.debug('Removed old backup', { file });
        } catch (error) {
          logger.error('Failed to remove backup', { file, error });
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup backups', error);
    }
  }

  private async getBackupFiles(envPath: string): Promise<string[]> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const dir = path.dirname(envPath);
      const basename = path.basename(envPath);
      
      const files = await fs.readdir(dir);
      return files
        .filter(f => f.startsWith(`${basename}.backup.`))
        .map(f => path.join(dir, f));
    } catch {
      return [];
    }
  }
}