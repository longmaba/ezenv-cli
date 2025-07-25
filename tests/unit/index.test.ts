import { execSync } from 'child_process';
import { join } from 'path';

describe('CLI Initialization', () => {
  const cliPath = join(__dirname, '..', '..', 'src', 'index.ts');

  it('should display help text when run without arguments', () => {
    let output = '';
    try {
      output = execSync(`tsx ${cliPath}`, { encoding: 'utf-8' });
    } catch (error: any) {
      // CLI shows help on stderr when no arguments provided
      output = error.stderr || error.stdout || '';
    }
    
    expect(output).toContain('Usage: ezenv [options] [command]');
    expect(output).toContain('EzEnv CLI - Secure environment variable management from your terminal');
    expect(output).toContain('Commands:');
    expect(output).toContain('auth');
    expect(output).toContain('projects');
    expect(output).toContain('env');
    expect(output).toContain('pull');
    expect(output).toContain('init');
  });

  it('should display version when --version flag is used', () => {
    const output = execSync(`tsx ${cliPath} --version`, { encoding: 'utf-8' });
    expect(output.trim()).toBe('1.0.0');
  });

  it('should display version when -v flag is used', () => {
    const output = execSync(`tsx ${cliPath} -v`, { encoding: 'utf-8' });
    expect(output.trim()).toBe('1.0.0');
  });

  it('should display help when --help flag is used', () => {
    const output = execSync(`tsx ${cliPath} --help`, { encoding: 'utf-8' });
    
    expect(output).toContain('Usage: ezenv [options] [command]');
    expect(output).toContain('Options:');
    expect(output).toContain('-v, --version');
    expect(output).toContain('-d, --debug');
    expect(output).toContain('--no-color');
    expect(output).toContain('Examples:');
  });

  it('should handle debug flag', () => {
    const output = execSync(`tsx ${cliPath} --debug --help`, { encoding: 'utf-8' });
    expect(output).toContain('Usage: ezenv [options] [command]');
  });

  it('should handle no-color flag', () => {
    const output = execSync(`tsx ${cliPath} --no-color --help`, { encoding: 'utf-8' });
    expect(output).toContain('Usage: ezenv [options] [command]');
    // Output should not contain color codes
    expect(output).not.toMatch(/\x1b\[[0-9;]*m/);
  });

  it('should validate all commands are registered', () => {
    const output = execSync(`tsx ${cliPath} --help`, { encoding: 'utf-8' });
    
    // Verify all documented commands are present
    const expectedCommands = ['auth', 'projects', 'env', 'pull', 'init'];
    expectedCommands.forEach(cmd => {
      expect(output).toContain(cmd);
    });
  });
});