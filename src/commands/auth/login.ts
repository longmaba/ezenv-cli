import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { AuthService, Environment } from '../../services/auth.service';
import { CredentialService } from '../../services/credential.service';
import { getSupabaseConfig } from '../../config/defaults';

export class LoginCommand {
  private authService?: AuthService;
  private credentialService?: CredentialService;

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
      .command('login')
      .description('Authenticate with EzEnv')
      .option('-e, --env <environment>', 'Environment to authenticate with', 'production')
      .action(async (options) => {
        await this.execute(options);
      });
  }

  private async execute(options: { env: string }): Promise<void> {
    // Validate and set environment
    const validEnvs: Environment[] = ['development', 'staging', 'production'];
    const environment = options.env as Environment;
    
    if (!validEnvs.includes(environment)) {
      console.error(chalk.red(`Invalid environment: ${options.env}`));
      console.log(chalk.gray(`Valid environments: ${validEnvs.join(', ')}`));
      process.exit(1);
    }
    
    const authService = this.getAuthService();
    authService.setEnvironment(environment);
    console.log(chalk.gray(`Authenticating with ${environment} environment`));
    
    // Show notice if using hosted service
    const { isUsingHosted } = getSupabaseConfig();
    if (isUsingHosted) {
      console.log(chalk.gray('Using EzEnv hosted service. Set SUPABASE_URL for self-hosted.'));
    }
    
    try {
      // Prompt for email
      const { email } = await inquirer.prompt([
        {
          type: 'input',
          name: 'email',
          message: 'Email:',
          validate: (input: string) => {
            // Basic email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(input)) {
              return 'Please enter a valid email address';
            }
            return true;
          }
        }
      ]);
      
      // Prompt for password (masked input)
      const { password } = await inquirer.prompt([
        {
          type: 'password',
          name: 'password',
          message: 'Password:',
          mask: '*'
        }
      ]);
      
      // Authenticate with Supabase
      const spinner = ora('Authenticating...').start();
      
      try {
        await authService.authenticateWithPassword(email, password);
        spinner.succeed('Authentication successful!');
        
        console.log(chalk.green(`✓ Logged in successfully to ${environment} environment`));
        
        if (this.credentialService?.isUsingMemoryStorage()) {
          console.warn(chalk.yellow('\n⚠️  Using temporary memory storage'));
          console.warn(chalk.yellow('Credentials will be lost when this process exits'));
        }
        
      } catch (error) {
        spinner.fail('Authentication failed');
        throw error;
      }
      
    } catch (error) {
      const err = error as Error & { code?: string; stack?: string };
      
      // Handle Ctrl+C gracefully
      if (err.message?.includes('User force closed') || err.name === 'ExitPromptError') {
        console.log(chalk.gray('\nAuthentication cancelled'));
        process.exit(0);
      }
      
      // Handle specific authentication errors
      if (err.code === 'INVALID_CREDENTIALS') {
        console.error(chalk.red('\nError: Invalid email or password'));
        console.log(chalk.gray('Please check your credentials and try again'));
      } else if (err.code === 'NETWORK_ERROR') {
        console.error(chalk.red('\nError: Network connection failed'));
        console.log(chalk.gray('Please check your internet connection and try again'));
      } else if (err.code === 'RATE_LIMITED') {
        console.error(chalk.red('\nError: Too many authentication attempts'));
        console.log(chalk.gray('Please wait a few minutes before trying again'));
      } else if (err.code === 'SERVER_ERROR') {
        console.error(chalk.red('\nError: Server error occurred'));
        console.log(chalk.gray('Please try again later or contact support'));
      } else {
        console.error(chalk.red('\nError: ' + (err.message || 'Unknown error occurred')));
        if (process.env.DEBUG) {
          console.error(chalk.gray(err.stack || ''));
        }
      }
      
      process.exit(1);
    }
  }
}