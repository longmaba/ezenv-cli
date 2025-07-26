import { EventEmitter } from 'events';
import { AuthService } from '../../src/services/auth.service';
import { CredentialService } from '../../src/services/credential.service';
import { MockSupabaseServer } from './mock-server';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { setMockResponse, clearAllMocks } from '../__mocks__/node-fetch';

export interface AuthTestContext {
  authService: AuthService;
  credentialService: CredentialService;
  mockServer: MockSupabaseServer;
  tempDir: string;
  originalEnv: NodeJS.ProcessEnv;
}

export class AuthTestHelper extends EventEmitter {
  private authService: AuthService;

  constructor(private context: AuthTestContext) {
    super();
    this.authService = context.authService;
  }

  async runAuthFlow(options: Partial<{
    email?: string;
    password?: string;
    shouldSucceed?: boolean;
  }> = {}): Promise<void> {
    const { 
      email = 'test@example.com', 
      password = 'test123',
      shouldSucceed = true 
    } = options;
    
    // Mock the password auth response
    this.context.mockServer.mockPasswordAuth(email, password, shouldSucceed);
    
    // Run authentication
    await this.authService.authenticateWithPassword(email, password);
  }

  // Helper to set up test environment
  static async setupTestEnvironment(tempDir?: string): Promise<AuthTestContext> {
    const testDir = tempDir || await fs.mkdtemp(path.join(os.tmpdir(), 'ezenv-test-'));
    
    // Clear all mocks
    jest.clearAllMocks();
    clearAllMocks();
    
    const mockServer = new MockSupabaseServer({
      baseUrl: 'https://test.supabase.co'
    });
    await mockServer.start();

    // Save original env vars
    const originalEnv = { ...process.env };
    
    // Set test environment variables
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.HOME = testDir;

    const credentialService = new CredentialService();
    const authService = new AuthService(credentialService);

    return {
      authService,
      credentialService,
      mockServer,
      tempDir: testDir,
      originalEnv
    };
  }

  static async teardownTestEnvironment(context: AuthTestContext): Promise<void> {
    await context.mockServer.stop();
    
    // Restore original env vars
    Object.keys(process.env).forEach(key => {
      if (!(key in context.originalEnv)) {
        delete process.env[key];
      }
    });
    Object.assign(process.env, context.originalEnv);
    
    // Clean up temp directory
    try {
      await fs.rm(context.tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
    
    // Clear mocks
    clearAllMocks();
  }
}

// Mock implementations for testing
export const mockConsole = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
};

export function mockConsoleOutput() {
  const originalConsole = { ...console };
  
  beforeEach(() => {
    console.log = mockConsole.log;
    console.error = mockConsole.error;
    console.warn = mockConsole.warn;
    console.info = mockConsole.info;
    
    // Clear mocks
    Object.values(mockConsole).forEach(mock => mock.mockClear());
  });

  afterEach(() => {
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
    console.info = originalConsole.info;
  });

  return mockConsole;
}

// Mock keytar for cross-platform testing
export function mockKeytar() {
  const store = new Map<string, string>();
  
  return {
    getPassword: jest.fn(async (service: string, account: string) => {
      return store.get(`${service}:${account}`) || null;
    }),
    setPassword: jest.fn(async (service: string, account: string, password: string) => {
      store.set(`${service}:${account}`, password);
    }),
    deletePassword: jest.fn(async (service: string, account: string) => {
      return store.delete(`${service}:${account}`);
    }),
    findCredentials: jest.fn(async (service: string) => {
      const credentials: Array<{ account: string; password: string }> = [];
      for (const [key, password] of store.entries()) {
        if (key.startsWith(`${service}:`)) {
          const account = key.substring(service.length + 1);
          credentials.push({ account, password });
        }
      }
      return credentials;
    }),
    clear: () => store.clear()
  };
}

// Helper to simulate different platform behaviors
export function mockPlatform(platform: 'darwin' | 'win32' | 'linux') {
  const originalPlatform = process.platform;
  
  beforeEach(() => {
    Object.defineProperty(process, 'platform', {
      value: platform,
      configurable: true
    });
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      configurable: true
    });
  });
}

// Helper for time-based tests
export function useFakeTimers() {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  return {
    advanceBy: (ms: number) => jest.advanceTimersByTime(ms),
    runAllTimers: () => jest.runAllTimers(),
    runOnlyPendingTimers: () => jest.runOnlyPendingTimers()
  };
}