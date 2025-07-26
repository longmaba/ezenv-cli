import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
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
      .command('select [projectId]')
      .description('Select a project as active (interactive if no project ID provided)')
      .action(async (projectId?: string) => {
        await this.execute(projectId);
      });
  }

  private async execute(projectId?: string): Promise<void> {
    try {
      let project: Project | null = null;

      if (projectId) {
        // Non-interactive mode: use provided project ID
        const spinner = ora('Validating project...').start();
        
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
        
        spinner.stop();
      } else {
        // Interactive mode: show project list
        const spinner = ora('Fetching projects...').start();
        
        const response = await this.projectService.listProjects({ limit: 100 });
        spinner.stop();
        
        if (response.projects.length === 0) {
          console.log(chalk.yellow('No projects found. Create your first project at https://ezenv.dev'));
          return;
        }

        // Get current selected project
        await this.configService.init();
        const currentProjectId = this.configService.getSelectedProject();
        
        // Prepare choices for inquirer
        const choices = response.projects.map(p => ({
          name: `${p.name} ${chalk.gray(`(${p.team?.name || 'N/A'} - ${p.user_role || 'member'}`)}${p.id === currentProjectId ? chalk.green(' [current]') : ''}`,
          value: p.id,
          short: p.name
        }));

        // Show interactive prompt
        const answer = await inquirer.prompt([
          {
            type: 'list',
            name: 'projectId',
            message: 'Select a project:',
            choices,
            pageSize: 10
          }
        ]);

        project = response.projects.find(p => p.id === answer.projectId) || null;
      }

      if (!project) {
        console.error(chalk.red('Error: Failed to select project'));
        process.exit(1);
      }

      // Update configuration
      const updateSpinner = ora('Updating configuration...').start();
      
      await this.configService.setSelectedProject(project.id);
      await this.configService.clearSelectedEnvironment();

      updateSpinner.succeed(`Selected project: ${chalk.green(project.name)}`);
      console.log(chalk.gray(`Team: ${project.team?.name || 'N/A'}`));
      console.log(chalk.gray(`Role: ${project.user_role || 'member'}`));
      console.log(chalk.cyan('\nNext: Run "ezenv env select" to choose an environment'));
    } catch (error) {
      await handleCommandError(error);
    }
  }
}