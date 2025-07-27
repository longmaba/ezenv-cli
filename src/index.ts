#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as dotenv from 'dotenv';
import { getSupabaseConfig } from './config/defaults';

// Load environment variables from .env file in development
if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
  dotenv.config();
}

// Show startup notice if using hosted service and not in a subcommand that suppresses it
const shouldShowStartupNotice = () => {
  const args = process.argv.slice(2);
  // Don't show for help, version, or when no args
  if (args.length === 0 || args.includes('--help') || args.includes('-h') || 
      args.includes('--version') || args.includes('-v')) {
    return false;
  }
  return true;
};

if (shouldShowStartupNotice()) {
  const { isUsingHosted } = getSupabaseConfig();
  if (isUsingHosted && process.env.NODE_ENV !== 'test') {
    console.log(chalk.gray('Using EzEnv hosted service. Set SUPABASE_URL in .env for self-hosted.\n'));
  }
}
// Conditional import to avoid loading during tests without proper setup
interface AuthCommandType {
  new(): {
    register(program: Command): void;
  };
}
let LoginCommand: AuthCommandType | undefined;
let StatusCommand: AuthCommandType | undefined;
let LogoutCommand: AuthCommandType | undefined;

interface ProjectCommandType {
  new(): {
    register(program: Command): void;
  };
}
let ProjectListCommand: ProjectCommandType | undefined;
let ProjectSelectCommand: ProjectCommandType | undefined;

interface EnvCommandType {
  new(): {
    register(program: Command): void;
  };
}
let EnvListCommand: EnvCommandType | undefined;
let EnvSelectCommand: EnvCommandType | undefined;

interface StatusCommandType {
  new(): {
    register(program: Command): void;
  };
}
let StatusCommandClass: StatusCommandType | undefined;

interface PullCommandType {
  new(): {
    register(program: Command): void;
  };
}
let PullCommand: PullCommandType | undefined;

interface InitCommandType {
  new(): {
    register(program: Command): void;
  };
}
let InitCommand: InitCommandType | undefined;

interface DiffCommandType {
  new(): {
    register(program: Command): void;
  };
}
let DiffCommand: DiffCommandType | undefined;

interface SyncCommandType {
  new(): {
    register(program: Command): void;
  };
}
let SyncCommand: SyncCommandType | undefined;

if (process.env.NODE_ENV !== 'test') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  LoginCommand = require('./commands/auth/login').LoginCommand;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  StatusCommand = require('./commands/auth/status').StatusCommand;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  LogoutCommand = require('./commands/auth/logout').LogoutCommand;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ProjectListCommand = require('./commands/projects/list').ListCommand;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ProjectSelectCommand = require('./commands/projects/select').SelectCommand;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  EnvListCommand = require('./commands/env/list').ListEnvironmentsCommand;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  EnvSelectCommand = require('./commands/env/select').SelectEnvironmentCommand;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  StatusCommandClass = require('./commands/status').StatusCommand;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  PullCommand = require('./commands/pull').PullCommand;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  InitCommand = require('./commands/init').InitCommand;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  DiffCommand = require('./commands/diff').DiffCommand;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  SyncCommand = require('./commands/sync').SyncCommand;
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

// Parse args early to check for --no-color
const args = process.argv.slice(2);
if (args.includes('--no-color')) {
  chalk.level = 0; // Disable colors
}

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

// Projects command group
const projectsCommand = program
  .command('projects')
  .description('Manage projects');

// Register projects subcommands
if (ProjectListCommand) {
  const listCommand = new ProjectListCommand();
  listCommand.register(projectsCommand);
}
if (ProjectSelectCommand) {
  const selectCommand = new ProjectSelectCommand();
  selectCommand.register(projectsCommand);
}

// Environment command group
const envCommand = program
  .command('env')
  .description('Manage environments');

// Register env subcommands
if (EnvListCommand) {
  const listCommand = new EnvListCommand();
  listCommand.register(envCommand);
}
if (EnvSelectCommand) {
  const selectCommand = new EnvSelectCommand();
  selectCommand.register(envCommand);
}

// Status command
if (StatusCommandClass) {
  const statusCommand = new StatusCommandClass();
  statusCommand.register(program);
}

// Pull command
if (PullCommand) {
  const pullCommand = new PullCommand();
  pullCommand.register(program);
}

// Init command
if (InitCommand) {
  const initCommand = new InitCommand();
  initCommand.register(program);
}

// Diff command
if (DiffCommand) {
  const diffCommand = new DiffCommand();
  diffCommand.register(program);
}

// Sync command
if (SyncCommand) {
  const syncCommand = new SyncCommand();
  syncCommand.register(program);
}

// Only add colored help text if colors are enabled
const helpText = chalk.level > 0 ? `
${chalk.gray('Examples:')}
  $ ezenv auth login              # Authenticate with EzEnv
  $ ezenv auth status             # Check authentication status
  $ ezenv auth logout             # Log out from EzEnv
  $ ezenv projects list           # List all projects
  $ ezenv projects select         # Select a project interactively
  $ ezenv pull                    # Pull secrets to .env file
  $ ezenv init                    # Initialize project

${chalk.gray('For more information, visit:')} ${chalk.blue('https://ezenv.dev/docs/cli')}
` : `
Examples:
  $ ezenv auth login              # Authenticate with EzEnv
  $ ezenv auth status             # Check authentication status
  $ ezenv auth logout             # Log out from EzEnv
  $ ezenv projects list           # List all projects
  $ ezenv projects select         # Select a project interactively
  $ ezenv pull                    # Pull secrets to .env file
  $ ezenv init                    # Initialize project

For more information, visit: https://ezenv.dev/docs/cli
`;

program.addHelpText('after', helpText);

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}