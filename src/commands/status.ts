import { Command } from 'commander';
import chalk from 'chalk';
import { ConfigService } from '../services/config.service';
import { ProjectService } from '../services/project.service';
import { EnvironmentService } from '../services/environment.service';
import { AuthService } from '../services/auth.service';
import { CredentialService } from '../services/credential.service';
import { handleCommandError } from '../utils/errors';

export class StatusCommand {
  private configService: ConfigService;
  private projectService: ProjectService;
  private environmentService: EnvironmentService;
  private authService?: AuthService;
  private credentialService?: CredentialService;

  constructor() {
    this.configService = new ConfigService();
    this.projectService = new ProjectService();
    this.environmentService = new EnvironmentService(this.configService);
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

  register(program: Command): void {
    program
      .command('status')
      .description('Show current context (authentication, project, environment)')
      .action(async () => {
        try {
          await this.execute();
        } catch (error) {
          await handleCommandError(error);
        }
      });
  }

  private async execute(): Promise<void> {
    console.log(chalk.cyan('\n🔍 EzEnv Status\n'));

    // Initialize config service to load .ezenvrc
    await this.configService.init();

    // Check authentication (default to production environment)
    const authService = this.getAuthService();
    authService.setEnvironment('production');
    const isAuthenticated = await authService.isAuthenticated();
    
    if (isAuthenticated) {
      console.log(chalk.green('✓ Authenticated'));
    } else {
      console.log(chalk.red('✗ Not authenticated'));
      console.log(chalk.gray('  Run "ezenv auth login" to authenticate'));
    }

    // Check selected project
    const selectedProject = await this.projectService.getSelectedProject();
    if (selectedProject) {
      console.log(chalk.green(`✓ Project: ${selectedProject.name}`));
      console.log(chalk.gray(`  ID: ${selectedProject.id}`));
      if (selectedProject.team) {
        console.log(chalk.gray(`  Team: ${selectedProject.team.name}`));
      }
    } else {
      console.log(chalk.yellow('⚠ No project selected'));
      console.log(chalk.gray('  Run "ezenv projects select <project>" to select a project'));
    }

    // Check selected environment
    if (selectedProject) {
      const selectedEnv = await this.environmentService.getSelectedEnvironment();
      if (selectedEnv) {
        console.log(chalk.green(`✓ Environment: ${selectedEnv.name}`));
        console.log(chalk.gray(`  ID: ${selectedEnv.id}`));
      } else {
        console.log(chalk.yellow('⚠ No environment selected'));
        console.log(chalk.gray('  Run "ezenv env select <environment>" to select an environment'));
      }
    }

    console.log('');
  }
}