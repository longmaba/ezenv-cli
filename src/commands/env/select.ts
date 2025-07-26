import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { EnvironmentService } from '../../services/environment.service';
import { ConfigService } from '../../services/config.service';
import { ProjectService } from '../../services/project.service';
import { handleCommandError } from '../../utils/errors';
import { logger } from '../../utils/logger';

export class SelectEnvironmentCommand {
  private environmentService: EnvironmentService;
  private configService: ConfigService;
  private projectService: ProjectService;

  constructor() {
    this.configService = new ConfigService();
    this.environmentService = new EnvironmentService(this.configService);
    this.projectService = new ProjectService();
  }

  register(program: Command): void {
    program
      .command('select [environment]')
      .description('Select an environment in the current project (interactive if no environment provided)')
      .action(async (environment?: string) => {
        try {
          await this.execute(environment);
        } catch (error) {
          await handleCommandError(error);
        }
      });
  }

  private async execute(envName?: string): Promise<void> {
    try {
      // Check if project is selected
      const selectedProject = await this.projectService.getSelectedProject();
      if (!selectedProject) {
        console.error(chalk.red('Error: No project selected'));
        console.log(chalk.cyan('Run "ezenv projects select" to select a project'));
        process.exit(1);
      }

      let selectedEnvironment;

      if (envName) {
        // Non-interactive mode
        const spinner = ora('Selecting environment...').start();
        
        // Resolve alias if needed
        const resolvedEnvName = this.environmentService.resolveEnvironmentAlias(envName);

        // Get environment
        const environment = await this.environmentService.getEnvironment(
          selectedProject.id,
          resolvedEnvName
        );

        if (!environment) {
          spinner.fail('Environment not found');
          console.error(chalk.red(`\nError: Environment "${envName}" not found`));
          
          // Show available environments
          const environments = await this.environmentService.listEnvironments(selectedProject.id);
          if (environments.length > 0) {
            console.log(chalk.cyan('\nAvailable environments:'));
            environments.forEach(env => {
              console.log(`  - ${env.name}`);
            });
            
            // Show aliases hint
            console.log(chalk.gray('\nYou can also use aliases: dev, stage, prod'));
          }
          process.exit(1);
        }
        
        selectedEnvironment = environment;
        spinner.stop();
      } else {
        // Interactive mode
        const spinner = ora('Fetching environments...').start();
        
        // Get all environments
        const environments = await this.environmentService.listEnvironments(selectedProject.id);
        spinner.stop();
        
        if (environments.length === 0) {
          console.log(chalk.yellow('No environments found for this project.'));
          return;
        }

        // Get current selected environment
        await this.configService.init();
        const currentEnvName = this.configService.getSelectedEnvironment();
        
        // Prepare choices for inquirer
        const choices = environments.map(env => {
          const envType = this.inferEnvironmentType(env.name);
          return {
            name: `${env.name} ${chalk.gray(`(${envType})`)}${env.name === currentEnvName ? chalk.green(' [current]') : ''}`,
            value: env.name,
            short: env.name
          };
        });

        // Show interactive prompt
        const answer = await inquirer.prompt([
          {
            type: 'list',
            name: 'environment',
            message: 'Select an environment:',
            choices,
            pageSize: 10
          }
        ]);

        selectedEnvironment = environments.find(env => env.name === answer.environment);
      }

      if (!selectedEnvironment) {
        console.error(chalk.red('Error: Failed to select environment'));
        process.exit(1);
      }

      // Select environment
      const updateSpinner = ora('Updating configuration...').start();
      await this.environmentService.selectEnvironment(selectedEnvironment.name);
      updateSpinner.succeed('Environment selected');

      // Show confirmation
      console.log(chalk.green('\n✓ Environment selected successfully'));
      console.log(chalk.gray(`Project: ${selectedProject.name}`));
      console.log(chalk.gray(`Environment: ${selectedEnvironment.name} (${this.inferEnvironmentType(selectedEnvironment.name)})`));
      console.log(chalk.cyan('\nNext: Run "ezenv pull" to download environment variables'));

      // Clear cached secrets
      logger.debug('Clearing cached secrets after environment change');

    } catch (error) {
      throw error;
    }
  }

  private inferEnvironmentType(name: string): string {
    const lowercaseName = name.toLowerCase();
    if (lowercaseName.includes('dev') || lowercaseName.includes('development')) {
      return 'development';
    } else if (lowercaseName.includes('stag') || lowercaseName.includes('staging')) {
      return 'staging';
    } else if (lowercaseName.includes('prod') || lowercaseName.includes('production')) {
      return 'production';
    }
    return name;
  }
}