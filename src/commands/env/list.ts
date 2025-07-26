import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { EnvironmentService } from '../../services/environment.service';
import { ConfigService } from '../../services/config.service';
import { ProjectService } from '../../services/project.service';
import { formatRelativeTime } from '../../utils/formatters';
import { handleCommandError } from '../../utils/errors';

export class ListEnvironmentsCommand {
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
      .command('list')
      .alias('ls')
      .description('List all environments in the selected project')
      .option('--json', 'Output in JSON format')
      .action(async (options) => {
        try {
          await this.execute(options);
        } catch (error) {
          await handleCommandError(error);
        }
      });
  }

  private async execute(options: { json?: boolean }): Promise<void> {
    const spinner = ora('Loading environments...').start();

    try {
      // Check if project is selected
      const selectedProject = await this.projectService.getSelectedProject();
      if (!selectedProject) {
        spinner.fail('No project selected');
        console.error(chalk.red('\nError: No project selected'));
        console.log(chalk.cyan('Run "ezenv projects select <project-name>" to select a project'));
        process.exit(1);
      }

      // Get environments
      const environments = await this.environmentService.listEnvironments(selectedProject.id);
      spinner.stop();

      if (options.json) {
        console.log(JSON.stringify(environments, null, 2));
        return;
      }

      // Get selected environment
      const selectedEnv = await this.environmentService.getSelectedEnvironment();

      // Display header
      console.log(chalk.cyan('\n📋 Environments'));
      console.log(chalk.gray(`Project: ${selectedProject.name}\n`));

      if (environments.length === 0) {
        console.log(chalk.yellow('No environments found'));
        return;
      }

      // Display environments
      environments.forEach((env) => {
        const isSelected = selectedEnv?.id === env.id;
        const arrow = isSelected ? chalk.green('→') : ' ';
        const name = isSelected ? chalk.green(env.name) : chalk.white(env.name);
        
        // Type badge (infer from name)
        const envType = this.inferEnvironmentType(env.name);
        const typeBadge = this.getTypeBadge(envType);
        
        // Relative time
        const updatedTime = formatRelativeTime(env.updated_at);
        
        console.log(
          `${arrow} ${name} ${typeBadge} ${chalk.gray(`(updated ${updatedTime})`)}`
        );
      });

      // Show total count
      console.log(chalk.gray(`\nTotal: ${environments.length} environment${environments.length !== 1 ? 's' : ''}`));

    } catch (error) {
      spinner.fail('Failed to load environments');
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

  private getTypeBadge(type: string): string {
    switch (type) {
      case 'development':
        return chalk.blue('[DEV]');
      case 'staging':
        return chalk.yellow('[STAGE]');
      case 'production':
        return chalk.red('[PROD]');
      default:
        return chalk.gray(`[${type.toUpperCase()}]`);
    }
  }
}