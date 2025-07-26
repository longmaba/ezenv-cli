export interface LogLevel {
  ERROR: 'error';
  WARN: 'warn';
  INFO: 'info';
  DEBUG: 'debug';
}

export interface Logger {
  error(message: string, context?: unknown): void;
  warn(message: string, context?: unknown): void;
  info(message: string, context?: unknown): void;
  debug(message: string, context?: unknown): void;
}

class ConsoleLogger implements Logger {
  private isDebugMode(): boolean {
    return process.env.DEBUG === 'true' || process.argv.includes('--debug') || process.argv.includes('-d');
  }

  private log(level: string, message: string, context?: unknown): void {
    if (level === 'debug' && !this.isDebugMode()) {
      return;
    }

    const timestamp = new Date().toISOString();
    const logEntry: Record<string, unknown> = {
      timestamp,
      level,
      message
    };
    
    if (context) {
      logEntry.context = context;
    }

    if (this.isDebugMode()) {
      console.error(JSON.stringify(logEntry));
    } else if (level === 'error' || level === 'warn') {
      console.error(`[${level.toUpperCase()}] ${message}`);
    }
  }

  error(message: string, context?: unknown): void {
    this.log('error', message, context);
  }

  warn(message: string, context?: unknown): void {
    this.log('warn', message, context);
  }

  info(message: string, context?: unknown): void {
    this.log('info', message, context);
  }

  debug(message: string, context?: unknown): void {
    this.log('debug', message, context);
  }
}

export const logger = new ConsoleLogger();