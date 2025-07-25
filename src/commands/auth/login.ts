import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { AuthService, Environment } from '../../services/auth.service';
import { CredentialService } from '../../services/credential.service';

export class LoginCommand {
  private authService: AuthService;
  private credentialService: CredentialService;

  constructor() {
    this.credentialService = new CredentialService();
    this.authService = new AuthService(this.credentialService);
  }

  register(program: Command): void {
    program
      .command('login')
      .description('Authenticate with EzEnv')
      .option('--no-browser', 'Don\'t automatically open browser')
      .option('-e, --env <environment>', 'Environment to authenticate with', 'production')
      .action(async (options) => {
        await this.execute(options);
      });
  }

  private async execute(options: { browser: boolean; env: string }): Promise<void> {
    // Validate and set environment
    const validEnvs: Environment[] = ['development', 'staging', 'production'];
    const environment = options.env as Environment;
    
    if (!validEnvs.includes(environment)) {
      console.error(chalk.red(`Invalid environment: ${options.env}`));
      console.log(chalk.gray(`Valid environments: ${validEnvs.join(', ')}`));
      process.exit(1);
    }
    
    this.authService.setEnvironment(environment);
    console.log(chalk.gray(`Authenticating with ${environment} environment`));
    
    const spinner = ora('Initializing authentication...').start();
    
    try {
      // Initialize device auth flow
      const deviceAuthResponse = await this.authService.initDeviceAuth();
      
      spinner.stop();
      
      // Display authentication instructions
      console.log(chalk.cyan('\n🔐 Authentication required'));
      console.log(chalk.white('\nPlease visit: ') + chalk.blue.underline(deviceAuthResponse.verification_uri));
      console.log(chalk.white('And enter code: ') + chalk.yellow.bold(deviceAuthResponse.user_code));
      
      // Open browser if not disabled
      if (options.browser) {
        try {
          await this.authService.openBrowser(deviceAuthResponse.verification_uri_complete);
        } catch (error) {
          // Browser opening failed, but continue with manual flow
          console.log(chalk.gray('\nCouldn\'t open browser automatically. Please visit the URL above.'));
        }
      }
      
      // Start polling for authentication
      const pollSpinner = ora('Waiting for authentication...').start();
      
      // Set up cancellation handler
      const cleanup = () => {
        pollSpinner.fail('Authentication cancelled');
        process.exit(0);
      };
      process.on('SIGINT', cleanup);
      
      try {
        const tokenResponse = await this.authService.pollForToken(deviceAuthResponse.device_code);
        pollSpinner.succeed('Authentication successful!');
        
        // Store credentials with metadata
        await this.authService.storeCredentials(
          tokenResponse.access_token,
          tokenResponse.expires_in,
          tokenResponse.refresh_token,
          tokenResponse.user_id
        );
        console.log(chalk.green(`✓ Logged in successfully to ${environment} environment`));
        
        if (this.credentialService.isUsingMemoryStorage()) {
          console.warn(chalk.yellow('\n⚠️  Using temporary memory storage'));
          console.warn(chalk.yellow('Credentials will be lost when this process exits'));
        }
        
        // Remove cancellation handler
        process.removeListener('SIGINT', cleanup);
      } catch (error) {
        pollSpinner.fail('Authentication failed');
        process.removeListener('SIGINT', cleanup);
        throw error;
      }
      
    } catch (error) {
      spinner.fail('Authentication failed');
      
      const err = error as Error & { code?: string; stack?: string };
      if (err.code === 'EXPIRED_TOKEN') {
        console.error(chalk.red('\nError: Authentication timed out'));
        console.log(chalk.gray('Please run "ezenv auth login" to try again'));
      } else if (err.code === 'ACCESS_DENIED') {
        console.error(chalk.red('\nError: Access was denied'));
        console.log(chalk.gray('Please ensure you have the correct permissions'));
      } else if (err.code === 'NETWORK_ERROR') {
        console.error(chalk.red('\nError: Network connection failed'));
        console.log(chalk.gray('Please check your internet connection and try again'));
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