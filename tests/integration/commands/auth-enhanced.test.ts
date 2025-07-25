import { StatusCommand } from '../../../src/commands/auth/status';
import { LogoutCommand } from '../../../src/commands/auth/logout';
import { AuthService } from '../../../src/services/auth.service';
import { CredentialService } from '../../../src/services/credential.service';
import { Command } from 'commander';

// Mock the services
jest.mock('../../../src/services/auth.service');
jest.mock('../../../src/services/credential.service');

const mockAuthService = AuthService as jest.MockedClass<typeof AuthService>;
const mockCredentialService = CredentialService as jest.MockedClass<typeof CredentialService>;

describe('Auth Commands Integration', () => {
  let mockAuthInstance: jest.Mocked<AuthService>;
  let mockCredentialInstance: jest.Mocked<CredentialService>;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock instances
    mockCredentialInstance = {
      store: jest.fn(),
      retrieve: jest.fn(),
      delete: jest.fn(),
      isUsingMemoryStorage: jest.fn(() => false),
    } as any;
    
    mockAuthInstance = {
      setEnvironment: jest.fn(),
      getEnvironment: jest.fn(() => 'production'),
      getStoredTokenData: jest.fn(),
      isTokenExpired: jest.fn(),
      refreshToken: jest.fn(),
      deleteStoredToken: jest.fn(),
    } as any;
    
    // Set up mock implementations
    mockCredentialService.mockImplementation(() => mockCredentialInstance);
    mockAuthService.mockImplementation(() => mockAuthInstance);
    
    // Spy on console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('StatusCommand', () => {
    let statusCommand: StatusCommand;
    let program: Command;

    beforeEach(() => {
      statusCommand = new StatusCommand();
      program = new Command();
      statusCommand.register(program);
    });

    it('should show authenticated status for valid token', async () => {
      const tokenData = {
        access_token: 'valid-token',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        environment: 'production' as const,
        user_id: 'user-123'
      };

      mockAuthInstance.getStoredTokenData.mockResolvedValueOnce(tokenData);
      mockAuthInstance.isTokenExpired.mockResolvedValueOnce(false);

      await program.parseAsync(['node', 'test', 'status']);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('✓ Authenticated in production environment')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('User ID: user-123')
      );
    });

    it('should show not authenticated when no token exists', async () => {
      mockAuthInstance.getStoredTokenData.mockResolvedValueOnce(null);

      await program.parseAsync(['node', 'test', 'status']);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('✗ Not authenticated in production environment')
      );
    });

    it('should attempt token refresh when expired', async () => {
      const tokenData = {
        access_token: 'expired-token',
        expires_at: new Date(Date.now() - 3600000).toISOString(),
        environment: 'production' as const,
        refresh_token: 'refresh-token'
      };

      mockAuthInstance.getStoredTokenData.mockResolvedValueOnce(tokenData);
      mockAuthInstance.isTokenExpired.mockResolvedValueOnce(true);
      mockAuthInstance.refreshToken.mockResolvedValueOnce({
        access_token: 'new-token',
        token_type: 'Bearer',
        expires_in: 3600
      });

      await program.parseAsync(['node', 'test', 'status']);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('✓ Token refreshed successfully')
      );
    });

    it('should check all environments with --all flag', async () => {
      mockAuthInstance.getStoredTokenData
        .mockResolvedValueOnce({
          access_token: 'dev-token',
          expires_at: new Date(Date.now() + 3600000).toISOString(),
          environment: 'development' as const
        })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          access_token: 'prod-token',
          expires_at: new Date(Date.now() + 3600000).toISOString(),
          environment: 'production' as const
        });

      mockAuthInstance.isTokenExpired.mockResolvedValue(false);

      await program.parseAsync(['node', 'test', 'status', '--all']);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('✓ development: Authenticated')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('✗ staging: Not authenticated')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('✓ production: Authenticated')
      );
    });
  });

  describe('LogoutCommand', () => {
    let logoutCommand: LogoutCommand;
    let program: Command;

    beforeEach(() => {
      logoutCommand = new LogoutCommand();
      program = new Command();
      logoutCommand.register(program);
    });

    it('should logout from specific environment', async () => {
      mockAuthInstance.getStoredTokenData.mockResolvedValueOnce({
        access_token: 'token',
        expires_at: new Date().toISOString(),
        environment: 'production' as const
      });
      mockAuthInstance.deleteStoredToken.mockResolvedValueOnce(true);

      await program.parseAsync(['node', 'test', 'logout']);

      expect(mockAuthInstance.setEnvironment).toHaveBeenCalledWith('production');
      expect(mockAuthInstance.deleteStoredToken).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('✓ Successfully logged out from production environment')
      );
    });

    it('should show message when not logged in', async () => {
      mockAuthInstance.getStoredTokenData.mockResolvedValueOnce(null);

      await program.parseAsync(['node', 'test', 'logout']);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Not logged in to production environment')
      );
    });

    it('should logout from all environments with --all flag', async () => {
      mockAuthInstance.getStoredTokenData
        .mockResolvedValueOnce({ // dev
          access_token: 'dev-token',
          expires_at: new Date().toISOString(),
          environment: 'development' as const
        })
        .mockResolvedValueOnce(null) // staging
        .mockResolvedValueOnce({ // prod
          access_token: 'prod-token',
          expires_at: new Date().toISOString(),
          environment: 'production' as const
        });

      mockAuthInstance.deleteStoredToken
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      await program.parseAsync(['node', 'test', 'logout', '--all']);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('✓ Logged out from development')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('- staging: Not logged in')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('✓ Logged out from production')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('✓ Successfully logged out from 2 environment(s)')
      );
    });

    it('should validate environment parameter', async () => {
      await program.parseAsync(['node', 'test', 'logout', '--env', 'invalid']);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid environment: invalid')
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });
});