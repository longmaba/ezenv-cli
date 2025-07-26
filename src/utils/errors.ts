import chalk from 'chalk';

export class CLIError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'CLIError';
  }
}

export class APIError extends CLIError {
  constructor(
    public status: number,
    message: string,
    code: string,
    details?: unknown
  ) {
    super(message, code, details);
    this.name = 'APIError';
  }
}

export async function handleCommandError(error: unknown): Promise<void> {
  // Type guard for APIError
  if (error instanceof Error && 'status' in error && 'code' in error) {
    const apiError = error as APIError;
    if (apiError.status === 401) {
      console.error(chalk.red('Authentication required'));
      console.log(chalk.cyan('Run "ezenv auth login" to authenticate'));
    } else if (apiError.status === 403) {
      console.error(chalk.red('Access denied'));
      console.log(chalk.gray(apiError.message));
    } else {
      console.error(chalk.red(`Error: ${apiError.message}`));
    }
  } else if (error instanceof CLIError) {
    console.error(chalk.red(`Error: ${error.message}`));
    if (error.details) {
      console.error(chalk.gray(JSON.stringify(error.details, null, 2)));
    }
  } else if (error instanceof Error) {
    console.error(chalk.red(`Error: ${error.message}`));
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
  } else {
    console.error(chalk.red('Unexpected error occurred'));
    if (process.env.DEBUG) {
      console.error(error);
    }
  }
  
  process.exit(1);
}