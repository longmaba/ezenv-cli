import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import { ProjectService } from '../../services/project.service';
import { handleCommandError } from '../../utils/errors';

export class ListCommand {
  private projectService: ProjectService;

  constructor() {
    this.projectService = new ProjectService();
  }

  register(program: Command): void {
    program
      .command('list')
      .description('List all accessible projects')
      .option('--json', 'Output in JSON format')
      .option('--filter <search>', 'Filter projects by name (case-insensitive)')
      .option('--page <number>', 'Page number for pagination', '1')
      .option('--limit <number>', 'Number of items per page', '20')
      .action(async (options) => {
        await this.execute(options);
      });
  }

  private async execute(options: {
    json?: boolean;
    filter?: string;
    page: string;
    limit: string;
  }): Promise<void> {
    const page = parseInt(options.page, 10);
    const limit = parseInt(options.limit, 10);

    if (isNaN(page) || page < 1) {
      console.error(chalk.red('Error: Page must be a positive number'));
      process.exit(1);
    }

    if (isNaN(limit) || limit < 1 || limit > 100) {
      console.error(chalk.red('Error: Limit must be between 1 and 100'));
      process.exit(1);
    }
    
    // Validate filter if provided
    if (options.filter && options.filter.length > 100) {
      console.error(chalk.red('Error: Filter string is too long (max 100 characters)'));
      process.exit(1);
    }

    const spinner = !options.json ? ora('Fetching projects...').start() : null;

    try {
      const response = await this.projectService.listProjects({
        page,
        limit,
        search: options.filter
      });

      if (spinner) spinner.stop();

      if (options.json) {
        console.log(JSON.stringify(response, null, 2));
        return;
      }

      if (response.projects.length === 0) {
        if (options.filter) {
          console.log(chalk.yellow('No projects found matching your filter.'));
        } else {
          console.log(chalk.yellow('No projects found. Create your first project at https://app.ezenv.io'));
        }
        return;
      }

      const table = new Table({
        head: [
          chalk.cyan('ID'),
          chalk.cyan('Name'),
          chalk.cyan('Team'),
          chalk.cyan('Role')
        ],
        colWidths: [38, 30, 25, 10],
        wordWrap: true
      });

      response.projects.forEach(project => {
        table.push([
          project.id,
          project.name,
          project.team?.name || 'N/A',
          project.user_role || 'member'
        ]);
      });

      console.log(table.toString());

      if (response.total > limit) {
        const totalPages = Math.ceil(response.total / limit);
        console.log(
          chalk.gray(`\nPage ${page} of ${totalPages} (${response.total} total projects)`)
        );
        
        const hints: string[] = [];
        if (page > 1) {
          hints.push(`--page ${page - 1} for previous`);
        }
        if (page < totalPages) {
          hints.push(`--page ${page + 1} for next`);
        }
        
        if (hints.length > 0) {
          console.log(
            chalk.gray(`Run "ezenv projects list ${hints.join(' | ')}"`)
          );
        }
      }
    } catch (error) {
      if (spinner) spinner.fail('Failed to fetch projects');
      await handleCommandError(error);
    }
  }
}