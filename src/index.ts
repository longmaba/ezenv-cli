#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync } from 'fs';
import { join } from 'path';
// Conditional import to avoid loading during tests without proper setup
interface AuthCommandType {
  new(): {
    register(program: Command): void;
  };
}
let LoginCommand: AuthCommandType | undefined;
let StatusCommand: AuthCommandType | undefined;
let LogoutCommand: AuthCommandType | undefined;

if (process.env.NODE_ENV !== 'test') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  LoginCommand = require('./commands/auth/login').LoginCommand;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  StatusCommand = require('./commands/auth/status').StatusCommand;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  LogoutCommand = require('./commands/auth/logout').LogoutCommand;
}

// Read package.json with proper error handling
let packageJson: { version: string; description: string };
try {
  const packageJsonPath = join(__dirname, '..', 'package.json');
  packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
} catch (error) {
  console.error(chalk.red('Error: Unable to read package.json'));
  process.exit(1);
}

const program = new Command();

program
  .name('ezenv')
  .description(packageJson.description)
  .version(packageJson.version, '-v, --version', 'output the current version')
  .option('-d, --debug', 'output extra debugging information')
  .option('--no-color', 'disable color output');

// Auth command group
const authCommand = program
  .command('auth')
  .description('Manage authentication');

// Register auth subcommands
if (LoginCommand) {
  const loginCommand = new LoginCommand();
  loginCommand.register(authCommand);
}
if (StatusCommand) {
  const statusCommand = new StatusCommand();
  statusCommand.register(authCommand);
}
if (LogoutCommand) {
  const logoutCommand = new LogoutCommand();
  logoutCommand.register(authCommand);
}

program
  .command('projects')
  .description('Manage projects')
  .action(() => {
    console.log(chalk.yellow('Project commands coming soon!'));
  });

program
  .command('env')
  .description('Manage environments')
  .action(() => {
    console.log(chalk.yellow('Environment commands coming soon!'));
  });

program
  .command('pull')
  .description('Pull secrets from EzEnv')
  .action(() => {
    console.log(chalk.yellow('Pull command coming soon!'));
  });

program
  .command('init')
  .description('Initialize EzEnv in current directory')
  .action(() => {
    console.log(chalk.yellow('Init command coming soon!'));
  });

program.addHelpText('after', `
${chalk.gray('Examples:')}
  $ ezenv auth login              # Authenticate with EzEnv
  $ ezenv auth status             # Check authentication status
  $ ezenv auth logout             # Log out from EzEnv
  $ ezenv projects list           # List all projects
  $ ezenv pull                    # Pull secrets to .env file
  $ ezenv init                    # Initialize project

${chalk.gray('For more information, visit:')} ${chalk.blue('https://ezenv.io/docs/cli')}
`);

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}