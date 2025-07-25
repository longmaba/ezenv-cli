import { Command } from 'commander';
import chalk from 'chalk';
import { AuthService, Environment } from '../../services/auth.service';
import { CredentialService } from '../../services/credential.service';

export class LogoutCommand {
  private authService: AuthService;
  private credentialService: CredentialService;

  constructor() {
    this.credentialService = new CredentialService();
    this.authService = new AuthService(this.credentialService);
  }

  register(program: Command): void {
    program
      .command('logout')
      .description('Log out from EzEnv')
      .option('-e, --env <environment>', 'Log out from specific environment', 'production')
      .option('-a, --all', 'Log out from all environments')
      .action(async (options) => {
        await this.execute(options);
      });
  }

  private async execute(options: { env: string; all: boolean }): Promise<void> {
    try {
      if (options.all) {
        await this.logoutAllEnvironments();
      } else {
        // Validate environment
        const validEnvs: Environment[] = ['development', 'staging', 'production'];
        const environment = options.env as Environment;
        
        if (!validEnvs.includes(environment)) {
          console.error(chalk.red(`Invalid environment: ${options.env}`));
          console.log(chalk.gray(`Valid environments: ${validEnvs.join(', ')}`));
          process.exit(1);
        }

        await this.logoutEnvironment(environment);
      }
    } catch (error) {
      const err = error as Error;
      console.error(chalk.red('Error during logout:'), err.message);
      if (process.env.DEBUG) {
        console.error(chalk.gray(err.stack || ''));
      }
      process.exit(1);
    }
  }

  private async logoutEnvironment(environment: Environment): Promise<void> {
    this.authService.setEnvironment(environment);
    
    const tokenData = await this.authService.getStoredTokenData();
    
    if (!tokenData) {
      console.log(chalk.yellow(`Not logged in to ${environment} environment`));
      return;
    }

    const deleted = await this.authService.deleteStoredToken();
    
    if (deleted) {
      console.log(chalk.green(`✓ Successfully logged out from ${environment} environment`));
    } else {
      console.log(chalk.yellow(`⚠️  No credentials found for ${environment} environment`));
    }
  }

  private async logoutAllEnvironments(): Promise<void> {
    const environments: Environment[] = ['development', 'staging', 'production'];
    let loggedOutCount = 0;

    console.log(chalk.cyan('Logging out from all environments...\n'));

    for (const env of environments) {
      this.authService.setEnvironment(env);
      const tokenData = await this.authService.getStoredTokenData();
      
      if (tokenData) {
        const deleted = await this.authService.deleteStoredToken();
        if (deleted) {
          console.log(chalk.green(`✓ Logged out from ${env}`));
          loggedOutCount++;
        } else {
          console.log(chalk.yellow(`⚠️  Failed to log out from ${env}`));
        }
      } else {
        console.log(chalk.gray(`- ${env}: Not logged in`));
      }
    }

    if (loggedOutCount > 0) {
      console.log(chalk.green(`\n✓ Successfully logged out from ${loggedOutCount} environment(s)`));
    } else {
      console.log(chalk.yellow('\nNo active sessions found'));
    }
  }
}