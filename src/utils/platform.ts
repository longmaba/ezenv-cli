import { platform } from 'os';

export type Platform = 'darwin' | 'win32' | 'linux' | 'unknown';

export function detectPlatform(): Platform {
  const platformName = platform();
  switch (platformName) {
    case 'darwin':
    case 'win32':
      return platformName;
    case 'linux':
    case 'freebsd':
    case 'openbsd':
    case 'sunos':
      return 'linux';
    default:
      return 'unknown';
  }
}

export function getPlatformName(): string {
  const platformType = detectPlatform();
  switch (platformType) {
    case 'darwin':
      return 'macOS';
    case 'win32':
      return 'Windows';
    case 'linux':
      return 'Linux';
    default:
      return 'Unknown';
  }
}