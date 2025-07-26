import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { AuthService } from '../services/auth.service';
import { ConfigService } from '../services/config.service';
import { CredentialService } from '../services/credential.service';
import { APIService } from '../services/api.service';
import { ProjectService } from '../services/project.service';
import { EnvironmentService } from '../services/environment.service';
import { SecretsService } from '../services/secrets.service';
import { FileService } from '../services/file.service';
import { handleCommandError, CLIError } from '../utils/errors';
import { formatSecrets } from '../utils/formatters';
import { existsSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { GitignoreManager } from '../utils/gitignore';
import { Project } from '../services/project.service';
import { Environment } from '../services/environment.service';

interface InitOptions {
  nonInteractive?: boolean;
  project?: string;
  environment?: string;
  output?: string;
}

interface InitContext {
  isAuthenticated: boolean;
  selectedProject?: Project;
  selectedEnvironment?: Environment;
  envFilePath: string;
  configFilePath: string;
}

export class InitCommand {
  private authService?: AuthService;
  private configService: ConfigService;
  private projectService: ProjectService;
  private environmentService: EnvironmentService;
  private secretsService?: SecretsService;
  private fileService: FileService;

  private credentialService?: CredentialService;
  private apiService?: APIService;

  constructor() {
    this.configService = new ConfigService();
    this.projectService = new ProjectService();
    this.environmentService = new EnvironmentService(this.configService);
    this.fileService = new FileService();
  }

  private getAuthService(): AuthService {
    if (!this.credentialService) {
      this.credentialService = CredentialService.getInstance();
    }
    if (!this.authService) {
      this.authService = new AuthService(this.credentialService);
    }
    return this.authService;
  }

  private getSecretsService(): SecretsService {
    if (!this.credentialService) {
      this.credentialService = CredentialService.getInstance();
    }
    if (!this.apiService) {
      this.apiService = new APIService(this.credentialService, this.configService);
    }
    if (!this.secretsService) {
      this.secretsService = new SecretsService(this.apiService);
    }
    return this.secretsService;
  }

  register(program: Command): void {
    program
      .command('init')
      .description('Initialize EzEnv in current directory with interactive setup')
      .option('--non-interactive', 'skip interactive prompts (requires --project and --environment)')
      .option('-p, --project <id>', 'project ID (for non-interactive mode)')
      .option('-e, --environment <id>', 'environment ID (for non-interactive mode)')
      .option('-o, --output <path>', 'output file path (default: .env)')
      .action(async (options) => {
        await this.execute(options);
      });
  }

  private async execute(options: InitOptions): Promise<void> {
    try {
      console.log(chalk.cyan('\n🚀 Initializing EzEnv...\n'));

      // Initialize context
      const context: InitContext = {
        isAuthenticated: false,
        envFilePath: resolve(options.output || '.env'),
        configFilePath: resolve('.ezenvrc')
      };

      // Initialize config service
      await this.configService.init();

      // Step 1: Check authentication
      context.isAuthenticated = await this.checkAndHandleAuth(options);
      if (!context.isAuthenticated) {
        console.log(chalk.yellow('\nInitialization cancelled. Please authenticate first.'));
        return;
      }

      // Step 2: Select project
      context.selectedProject = await this.selectProject(options);
      if (!context.selectedProject) {
        console.log(chalk.yellow('\nNo project selected. Initialization cancelled.'));
        return;
      }

      // Step 3: Select environment
      context.selectedEnvironment = await this.selectEnvironment(
        context.selectedProject.id,
        options
      );
      if (!context.selectedEnvironment) {
        console.log(chalk.yellow('\nNo environment selected. Initialization cancelled.'));
        return;
      }

      // Step 4: Download and write secrets
      await this.downloadAndWriteSecrets(context, options);

      // Step 5: Create .ezenvrc file
      await this.createConfigFile(context);

      // Step 6: Update .gitignore
      await this.updateGitignore();

      // Step 7: Display success message
      this.displaySuccessMessage(context);

    } catch (error) {
      await handleCommandError(error);
    }
  }

  private async checkAndHandleAuth(options: InitOptions): Promise<boolean> {
    const spinner = ora('Checking authentication status...').start();
    
    try {
      const isAuthenticated = await this.getAuthService().isAuthenticated();
      spinner.stop();

      if (isAuthenticated) {
        console.log(chalk.green('✓ Already authenticated'));
        return true;
      }

      if (options.nonInteractive) {
        throw new CLIError(
          'Not authenticated. Run "ezenv auth login" first.',
          'AUTH_REQUIRED'
        );
      }

      // Prompt for authentication
      const { shouldAuth } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'shouldAuth',
          message: 'You need to authenticate first. Would you like to login now?',
          default: true
        }
      ]);

      if (!shouldAuth) {
        return false;
      }

      // Trigger login flow
      console.log(chalk.cyan('\n🔐 Starting authentication flow...\n'));
      
      // Prompt for email
      const { email } = await inquirer.prompt([
        {
          type: 'input',
          name: 'email',
          message: 'Email:',
          validate: (input: string) => {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(input)) {
              return 'Please enter a valid email address';
            }
            return true;
          }
        }
      ]);
      
      // Prompt for password
      const { password } = await inquirer.prompt([
        {
          type: 'password',
          name: 'password',
          message: 'Password:',
          mask: '*'
        }
      ]);
      
      const authSpinner = ora('Authenticating...').start();
      await this.getAuthService().authenticateWithPassword(email, password);
      authSpinner.succeed('Authentication successful!');
      
      console.log(chalk.green('✓ Logged in successfully\n'));
      
      return true;

    } catch (error) {
      spinner.fail('Authentication check failed');
      throw error;
    }
  }

  private async selectProject(options: InitOptions): Promise<Project | undefined> {
    if (options.nonInteractive) {
      if (!options.project) {
        throw new CLIError(
          '--project is required in non-interactive mode',
          'MISSING_PROJECT'
        );
      }
      // Fetch and return specific project
      const projects = await this.projectService.listProjects();
      const project = projects.projects.find(p => p.id === options.project);
      if (!project) {
        throw new CLIError(
          `Project ${options.project} not found`,
          'PROJECT_NOT_FOUND'
        );
      }
      return project;
    }

    const spinner = ora('Fetching projects...').start();
    
    try {
      const projects = await this.projectService.listProjects();
      spinner.stop();

      if (projects.projects.length === 0) {
        console.log(chalk.yellow('No projects found. Please create a project first.'));
        return undefined;
      }

      if (projects.projects.length === 1) {
        console.log(chalk.gray(`Using project: ${projects.projects[0].name}`));
        return projects.projects[0];
      }

      // Interactive selection
      const { selectedProject } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedProject',
          message: 'Select a project:',
          choices: projects.projects.map(p => ({
            name: `${p.name} ${chalk.gray(`(${p.team?.name || 'No team'})`)}`,
            value: p
          }))
        }
      ]);

      return selectedProject;

    } catch (error) {
      spinner.fail('Failed to fetch projects');
      throw error;
    }
  }

  private async selectEnvironment(
    projectId: string,
    options: InitOptions
  ): Promise<Environment | undefined> {
    if (options.nonInteractive) {
      if (!options.environment) {
        throw new CLIError(
          '--environment is required in non-interactive mode',
          'MISSING_ENVIRONMENT'
        );
      }
      // Fetch and return specific environment
      const environments = await this.environmentService.listEnvironments(projectId);
      const environment = environments.find(e => e.id === options.environment);
      if (!environment) {
        throw new CLIError(
          `Environment ${options.environment} not found`,
          'ENVIRONMENT_NOT_FOUND'
        );
      }
      return environment;
    }

    const spinner = ora('Fetching environments...').start();
    
    try {
      const environments = await this.environmentService.listEnvironments(projectId);
      spinner.stop();

      if (environments.length === 0) {
        console.log(chalk.yellow('No environments found for this project.'));
        return undefined;
      }

      // Find development environment or use first one
      const defaultEnv = environments.find(e => e.name.toLowerCase() === 'development') || environments[0];

      const { selectedEnvironment } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedEnvironment',
          message: 'Select an environment:',
          default: defaultEnv,
          choices: environments.map(env => ({
            name: `${env.name} ${chalk.gray(`(last updated: ${new Date(env.updated_at).toLocaleDateString()})`)}`,
            value: env
          }))
        }
      ]);

      // Confirm selection
      const { confirmEnv } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmEnv',
          message: `Use ${chalk.cyan(selectedEnvironment.name)} environment?`,
          default: true
        }
      ]);

      return confirmEnv ? selectedEnvironment : undefined;

    } catch (error) {
      spinner.fail('Failed to fetch environments');
      throw error;
    }
  }

  private async downloadAndWriteSecrets(
    context: InitContext,
    options: InitOptions
  ): Promise<void> {
    if (!context.selectedProject || !context.selectedEnvironment) {
      throw new CLIError('Project and environment must be selected', 'INVALID_CONTEXT');
    }

    // Check if .env exists
    if (existsSync(context.envFilePath) && !options.nonInteractive) {
      const { shouldOverwrite } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'shouldOverwrite',
          message: `File ${chalk.yellow(context.envFilePath)} already exists. Overwrite?`,
          default: false
        }
      ]);

      if (!shouldOverwrite) {
        console.log(chalk.yellow('Skipping .env file creation.'));
        return;
      }

      // Create backup
      await this.fileService.backupFile(context.envFilePath);
    }

    const spinner = ora('Downloading secrets...').start();

    try {
      const secrets = await this.getSecretsService().getSecrets(
        context.selectedProject.name,
        context.selectedEnvironment.name
      );

      spinner.text = 'Writing .env file...';

      const formattedContent = formatSecrets(secrets, 'env');
      await this.fileService.writeEnvFile(formattedContent, context.envFilePath);

      spinner.succeed(`Secrets written to ${chalk.green(context.envFilePath)}`);
      
      const secretCount = Object.keys(secrets).length;
      console.log(chalk.gray(`  ${secretCount} environment variable${secretCount === 1 ? '' : 's'} downloaded`));

    } catch (error) {
      spinner.fail('Failed to download secrets');
      throw error;
    }
  }

  private async createConfigFile(context: InitContext): Promise<void> {
    if (!context.selectedProject || !context.selectedEnvironment) {
      throw new CLIError('Project and environment must be selected', 'INVALID_CONTEXT');
    }

    const config = {
      project: {
        id: context.selectedProject.id,
        name: context.selectedProject.name
      },
      environment: {
        id: context.selectedEnvironment.id,
        name: context.selectedEnvironment.name
      }
    };

    const spinner = ora('Creating .ezenvrc configuration...').start();

    try {
      writeFileSync(
        context.configFilePath,
        JSON.stringify(config, null, 2) + '\n',
        'utf-8'
      );

      spinner.succeed(`Configuration saved to ${chalk.green('.ezenvrc')}`);

    } catch (error) {
      spinner.fail('Failed to create configuration file');
      throw error;
    }
  }

  private async updateGitignore(): Promise<void> {
    const gitignoreManager = new GitignoreManager();
    
    if (!gitignoreManager.exists()) {
      return; // No .gitignore, nothing to update
    }

    try {
      const hadEntry = gitignoreManager.hasEntry('.env');
      const success = gitignoreManager.addEntry('.env', 'EzEnv');
      
      if (success && !hadEntry) {
        console.log(chalk.gray('✓ Added .env to .gitignore'));
      }
    } catch (error) {
      // Non-critical error, just log
      console.log(chalk.yellow('⚠ Could not update .gitignore'));
    }
  }

  private displaySuccessMessage(context: InitContext): void {
    console.log(chalk.green('\n✨ EzEnv initialized successfully!\n'));
    
    console.log(chalk.cyan('Summary:'));
    console.log(chalk.gray(`  Project: ${context.selectedProject?.name}`));
    console.log(chalk.gray(`  Environment: ${context.selectedEnvironment?.name}`));
    console.log(chalk.gray(`  Files created: ${context.envFilePath}, .ezenvrc`));
    
    console.log(chalk.cyan('\nNext steps:'));
    console.log(chalk.gray('  1. Review your .env file'));
    console.log(chalk.gray('  2. Use "ezenv pull" to update secrets'));
    console.log(chalk.gray('  3. Use "ezenv env list" to switch environments'));
    console.log(chalk.gray('  4. Use "ezenv status" to check current context'));
    
    console.log(chalk.cyan('\nUseful commands:'));
    console.log(chalk.gray('  ezenv pull              # Download latest secrets'));
    console.log(chalk.gray('  ezenv env select        # Switch environments'));
    console.log(chalk.gray('  ezenv projects list     # View all projects'));
    console.log(chalk.gray('  ezenv --help            # Show all commands'));
    
    console.log(chalk.blue('\nHappy coding! 🚀\n'));
  }
}