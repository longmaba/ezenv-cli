import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ProjectService, Project } from '../../services/project.service';
import { ConfigService } from '../../services/config.service';
import { handleCommandError, CLIError } from '../../utils/errors';

export class SelectCommand {
  private projectService: ProjectService;
  private configService: ConfigService;

  constructor() {
    this.projectService = new ProjectService();
    this.configService = new ConfigService();
  }

  register(program: Command): void {
    program
      .command('select <projectId>')
      .description('Select a project as active')
      .action(async (projectId: string) => {
        await this.execute(projectId);
      });
  }

  private async execute(projectId: string): Promise<void> {
    const spinner = ora('Validating project...').start();

    try {
      // First try to fetch by ID directly
      let project: Project | null = null;
      
      try {
        // Try as project ID first
        project = await this.projectService.getProject(projectId);
      } catch (idError) {
        // If not found by ID, search by name
        if (idError instanceof CLIError && idError.code === 'NOT_FOUND') {
          spinner.text = 'Searching by project name...';
          const response = await this.projectService.listProjects({ 
            limit: 100,
            search: projectId 
          });
          
          // Find exact match (case-insensitive)
          project = response.projects.find(p => 
            p.name.toLowerCase() === projectId.toLowerCase()
          ) || null;
          
          // If no exact match, but only one result, use it
          if (!project && response.projects.length === 1) {
            project = response.projects[0];
          }
        } else {
          throw idError;
        }
      }

      if (!project) {
        spinner.fail('Project not found');
        console.error(chalk.red(`\nError: Project "${projectId}" not found or you don't have access to it.`));
        console.log(chalk.gray('Run "ezenv projects list" to see available projects.'));
        process.exit(1);
      }

      spinner.text = 'Updating configuration...';

      await this.configService.setSelectedProject(project.id);
      await this.configService.clearSelectedEnvironment();

      spinner.succeed(`Selected project: ${chalk.green(project.name)}`);
      console.log(chalk.gray(`Team: ${project.team?.name || 'N/A'}`));
      console.log(chalk.gray(`Role: ${project.user_role || 'member'}`));
      console.log(chalk.cyan('\nNext: Run "ezenv env list" to see available environments'));
    } catch (error) {
      spinner.fail('Failed to select project');
      await handleCommandError(error);
    }
  }
}