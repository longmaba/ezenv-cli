import keytar from 'keytar';
import chalk from 'chalk';
import { getPlatformName } from '../utils/platform';
import { MemoryCredentialStore, CredentialStore } from './memory-credential-store';

export interface StoredTokenData {
  access_token: string;
  expires_at: string;
  environment: 'development' | 'staging' | 'production';
  refresh_token?: string;
  user_id?: string;
}

export class CredentialService {
  private backingStore: CredentialStore | null = null;
  private useMemoryFallback = false;
  private static memoryStore = new MemoryCredentialStore();

  private async getStore(): Promise<CredentialStore> {
    if (this.backingStore) {
      return this.backingStore;
    }

    // Try to use keytar first
    if (!this.useMemoryFallback) {
      try {
        // Test keytar availability
        await keytar.getPassword('ezenv-test', 'test');
        this.backingStore = {
          store: (service: string, account: string, password: string) => 
            keytar.setPassword(service, account, password),
          retrieve: (service: string, account: string) => 
            keytar.getPassword(service, account),
          delete: (service: string, account: string) => 
            keytar.deletePassword(service, account),
        };
        
        const platform = getPlatformName();
        console.log(chalk.gray(`Using ${platform} credential store`));
        
        return this.backingStore;
      } catch (error) {
        console.warn(chalk.yellow('\n⚠️  System credential store unavailable'));
        console.warn(chalk.yellow('Falling back to memory storage (credentials will not persist)'));
        this.useMemoryFallback = true;
      }
    }

    // Fallback to memory store
    this.backingStore = CredentialService.memoryStore;
    return this.backingStore;
  }

  async store(service: string, account: string, password: string): Promise<void> {
    try {
      const store = await this.getStore();
      await store.store(service, account, password);
    } catch (error) {
      const err = error as Error;
      if (err.message?.includes('keychain') || err.message?.includes('credential')) {
        throw new Error('Failed to store credentials. Please ensure your system keychain is accessible.');
      }
      throw error;
    }
  }

  async retrieve(service: string, account: string): Promise<string | null> {
    try {
      const store = await this.getStore();
      return await store.retrieve(service, account);
    } catch (error) {
      const err = error as Error;
      if (err.message?.includes('keychain') || err.message?.includes('credential')) {
        throw new Error('Failed to retrieve credentials. Please ensure your system keychain is accessible.');
      }
      throw error;
    }
  }

  async delete(service: string, account: string): Promise<boolean> {
    try {
      const store = await this.getStore();
      return await store.delete(service, account);
    } catch (error) {
      const err = error as Error;
      if (err.message?.includes('keychain') || err.message?.includes('credential')) {
        throw new Error('Failed to delete credentials. Please ensure your system keychain is accessible.');
      }
      throw error;
    }
  }

  isUsingMemoryStorage(): boolean {
    return this.useMemoryFallback;
  }
}