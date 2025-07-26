import { promises as fs } from 'fs';
import { dirname } from 'path';
import { CLIError } from '../utils/errors';
import { logger } from '../utils/logger';
import { randomBytes } from 'crypto';

export class FileService {
  async getEnvPath(): Promise<string> {
    return '.env';
  }

  async writeEnvFile(contentOrPath: string | Record<string, string>, pathOrData?: string | Record<string, string>): Promise<void> {
    // Support old signature: writeEnvFile(content: string, path: string)
    if (typeof contentOrPath === 'string' && typeof pathOrData === 'string') {
      return this.writeEnvFileContent(contentOrPath, pathOrData);
    }
    
    // New signature: writeEnvFile(path: string, data: Record<string, string>)
    if (typeof contentOrPath === 'string' && typeof pathOrData === 'object') {
      return this.writeEnvFileFromData(contentOrPath, pathOrData);
    }
    
    throw new Error('Invalid arguments to writeEnvFile');
  }

  async getLastSyncTime(path: string): Promise<string | null> {
    try {
      const content = await fs.readFile(path, 'utf8');
      const lines = content.split('\n');
      
      for (const line of lines) {
        const match = line.match(/^#\s*Synced from EzEnv on (.+)$/);
        if (match) {
          return match[1];
        }
      }
      
      return null;
    } catch {
      return null;
    }
  }

  private async writeEnvFileFromData(path: string, data: Record<string, string>): Promise<void> {
    const lines: string[] = [];
    
    // Add sync timestamp
    lines.push(`# Synced from EzEnv on ${new Date().toISOString()}`);
    lines.push('');
    
    // Add all key-value pairs
    for (const [key, value] of Object.entries(data)) {
      // Mark local-only variables
      if (key.startsWith('LOCAL_') || key.endsWith('_LOCAL')) {
        lines.push(`# Local-only variable`);
      }
      
      // Quote value if it contains spaces or special characters
      const needsQuotes = value.includes(' ') || value.includes('#') || value.includes('=');
      const formattedValue = needsQuotes ? `"${value}"` : value;
      lines.push(`${key}=${formattedValue}`);
    }
    
    const content = lines.join('\n') + '\n';
    await this.writeEnvFileContent(content, path);
  }

  private async writeEnvFileContent(content: string, path: string): Promise<void> {
    try {
      // Ensure directory exists
      const dir = dirname(path);
      await fs.mkdir(dir, { recursive: true });

      // Write atomically (write to temp file, then rename)
      const tempPath = `${path}.${randomBytes(6).toString('hex')}.tmp`;
      
      try {
        await fs.writeFile(tempPath, content, 'utf8');
        await fs.rename(tempPath, path);
      } catch (error) {
        // Clean up temp file if it exists
        try {
          await fs.unlink(tempPath);
        } catch {
          // Ignore cleanup errors
        }
        throw error;
      }

      logger.debug('File written successfully', { path });
    } catch (error) {
      logger.error('Failed to write file', { path, error });
      throw new CLIError(
        `Failed to write file: ${path}`,
        'FILE_WRITE_FAILED',
        { path }
      );
    }
  }

  async readEnvFile(path: string): Promise<Record<string, string>> {
    try {
      const content = await fs.readFile(path, 'utf8');
      const result: Record<string, string> = {};

      // Parse .env format
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const [key, ...valueParts] = trimmed.split('=');
        if (key) {
          const value = valueParts.join('=');
          // Remove quotes if present
          result[key] = value.replace(/^["']|["']$/g, '');
        }
      }

      return result;
    } catch (error) {
      logger.error('Failed to read file', { path, error });
      throw new CLIError(
        `Failed to read file: ${path}`,
        'FILE_READ_FAILED',
        { path }
      );
    }
  }

  async backupFile(path: string): Promise<void> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `${path}.backup.${timestamp}`;
      await fs.copyFile(path, backupPath);
      logger.debug('File backed up', { original: path, backup: backupPath });
    } catch (error) {
      logger.error('Failed to backup file', { path, error });
      // Don't throw - backup failure shouldn't stop the operation
    }
  }

  async checkWritePermission(path: string): Promise<boolean> {
    try {
      // Check directory write permission
      const dir = dirname(path);
      
      // If directory doesn't exist, check parent directory
      try {
        await fs.access(dir, fs.constants.W_OK);
      } catch {
        // Try to check parent directory
        const parentDir = dirname(dir);
        await fs.access(parentDir, fs.constants.W_OK);
      }

      // If file exists, check file write permission
      try {
        await fs.access(path, fs.constants.F_OK);
        await fs.access(path, fs.constants.W_OK);
      } catch (error) {
        // File doesn't exist is OK
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          return false;
        }
      }

      return true;
    } catch (error) {
      logger.debug('No write permission', { path, error });
      return false;
    }
  }
}