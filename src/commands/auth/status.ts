import { Command } from 'commander';
import chalk from 'chalk';
import { AuthService, Environment } from '../../services/auth.service';
import { CredentialService } from '../../services/credential.service';

export class StatusCommand {
  private authService: AuthService;
  private credentialService: CredentialService;

  constructor() {
    this.credentialService = new CredentialService();
    this.authService = new AuthService(this.credentialService);
  }

  register(program: Command): void {
    program
      .command('status')
      .description('Check authentication status')
      .option('-e, --env <environment>', 'Check specific environment', 'production')
      .option('-a, --all', 'Show status for all environments')
      .action(async (options) => {
        await this.execute(options);
      });
  }

  private async execute(options: { env: string; all: boolean }): Promise<void> {
    try {
      if (options.all) {
        await this.checkAllEnvironments();
      } else {
        // Validate environment
        const validEnvs: Environment[] = ['development', 'staging', 'production'];
        const environment = options.env as Environment;
        
        if (!validEnvs.includes(environment)) {
          console.error(chalk.red(`Invalid environment: ${options.env}`));
          console.log(chalk.gray(`Valid environments: ${validEnvs.join(', ')}`));
          process.exit(1);
        }

        await this.checkEnvironment(environment);
      }
    } catch (error) {
      const err = error as Error;
      console.error(chalk.red('Error checking authentication status:'), err.message);
      if (process.env.DEBUG) {
        console.error(chalk.gray(err.stack || ''));
      }
      process.exit(1);
    }
  }

  private async checkEnvironment(environment: Environment): Promise<void> {
    this.authService.setEnvironment(environment);
    
    const tokenData = await this.authService.getStoredTokenData();
    
    if (!tokenData) {
      console.log(chalk.red(`✗ Not authenticated in ${environment} environment`));
      console.log(chalk.gray('\nRun "ezenv auth login" to authenticate'));
      return;
    }

    // Check if token is expired
    const isExpired = await this.authService.isTokenExpired();
    
    if (isExpired) {
      console.log(chalk.yellow(`⚠️  Authentication expired in ${environment} environment`));
      
      // Try to refresh if we have a refresh token
      if (tokenData.refresh_token) {
        console.log(chalk.gray('Attempting to refresh token...'));
        const refreshed = await this.authService.refreshToken();
        
        if (refreshed) {
          console.log(chalk.green('✓ Token refreshed successfully'));
          return;
        } else {
          console.log(chalk.red('✗ Failed to refresh token'));
          console.log(chalk.gray('\nRun "ezenv auth login" to re-authenticate'));
          return;
        }
      } else {
        console.log(chalk.gray('\nRun "ezenv auth login" to re-authenticate'));
        return;
      }
    }

    // Token is valid
    console.log(chalk.green(`✓ Authenticated in ${environment} environment`));
    
    // Display additional info
    console.log(chalk.gray('\nAuthentication details:'));
    console.log(chalk.gray(`  Environment: ${tokenData.environment}`));
    console.log(chalk.gray(`  Expires at: ${new Date(tokenData.expires_at).toLocaleString()}`));
    
    if (tokenData.user_id) {
      console.log(chalk.gray(`  User ID: ${tokenData.user_id}`));
    }
    
    if (this.credentialService.isUsingMemoryStorage()) {
      console.warn(chalk.yellow('\n⚠️  Using temporary memory storage'));
      console.warn(chalk.yellow('Credentials are not persisted across sessions'));
    }
  }

  private async checkAllEnvironments(): Promise<void> {
    const environments: Environment[] = ['development', 'staging', 'production'];
    let hasAuth = false;

    console.log(chalk.cyan('Authentication Status:\n'));

    for (const env of environments) {
      this.authService.setEnvironment(env);
      const tokenData = await this.authService.getStoredTokenData();
      
      if (tokenData) {
        hasAuth = true;
        const isExpired = await this.authService.isTokenExpired();
        
        if (isExpired) {
          console.log(chalk.yellow(`⚠️  ${env}: Expired`));
        } else {
          console.log(chalk.green(`✓ ${env}: Authenticated`));
        }
        
        const expiresAt = new Date(tokenData.expires_at);
        console.log(chalk.gray(`   Expires: ${expiresAt.toLocaleString()}`));
      } else {
        console.log(chalk.gray(`✗ ${env}: Not authenticated`));
      }
      
      console.log();
    }

    if (!hasAuth) {
      console.log(chalk.gray('Run "ezenv auth login" to authenticate'));
    }
    
    if (this.credentialService.isUsingMemoryStorage()) {
      console.warn(chalk.yellow('\n⚠️  Using temporary memory storage'));
      console.warn(chalk.yellow('Credentials are not persisted across sessions'));
    }
  }
}