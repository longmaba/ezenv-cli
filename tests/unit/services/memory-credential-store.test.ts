import { MemoryCredentialStore } from '../../../src/services/memory-credential-store';

describe('MemoryCredentialStore', () => {
  let store: MemoryCredentialStore;

  beforeEach(() => {
    // Need to use require to avoid circular dependency issues in tests
    const { MemoryCredentialStore: Store } = require('../../../src/services/memory-credential-store');
    store = new Store();
  });

  describe('store', () => {
    it('should store credentials successfully', async () => {
      await store.store('test-service', 'test-account', 'test-password');
      
      const retrieved = await store.retrieve('test-service', 'test-account');
      expect(retrieved).toBe('test-password');
    });

    it('should overwrite existing credentials', async () => {
      await store.store('test-service', 'test-account', 'password1');
      await store.store('test-service', 'test-account', 'password2');
      
      const retrieved = await store.retrieve('test-service', 'test-account');
      expect(retrieved).toBe('password2');
    });
  });

  describe('retrieve', () => {
    it('should return null for non-existent credentials', async () => {
      const retrieved = await store.retrieve('non-existent', 'account');
      expect(retrieved).toBeNull();
    });

    it('should differentiate between services and accounts', async () => {
      await store.store('service1', 'account1', 'password1');
      await store.store('service1', 'account2', 'password2');
      await store.store('service2', 'account1', 'password3');
      
      expect(await store.retrieve('service1', 'account1')).toBe('password1');
      expect(await store.retrieve('service1', 'account2')).toBe('password2');
      expect(await store.retrieve('service2', 'account1')).toBe('password3');
    });
  });

  describe('delete', () => {
    it('should delete existing credentials', async () => {
      await store.store('test-service', 'test-account', 'test-password');
      
      const deleted = await store.delete('test-service', 'test-account');
      expect(deleted).toBe(true);
      
      const retrieved = await store.retrieve('test-service', 'test-account');
      expect(retrieved).toBeNull();
    });

    it('should return false when deleting non-existent credentials', async () => {
      const deleted = await store.delete('non-existent', 'account');
      expect(deleted).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all stored credentials', async () => {
      await store.store('service1', 'account1', 'password1');
      await store.store('service2', 'account2', 'password2');
      
      store.clear();
      
      expect(await store.retrieve('service1', 'account1')).toBeNull();
      expect(await store.retrieve('service2', 'account2')).toBeNull();
      expect(store.size()).toBe(0);
    });
  });

  describe('size', () => {
    it('should return the number of stored credentials', async () => {
      expect(store.size()).toBe(0);
      
      await store.store('service1', 'account1', 'password1');
      expect(store.size()).toBe(1);
      
      await store.store('service2', 'account2', 'password2');
      expect(store.size()).toBe(2);
      
      await store.delete('service1', 'account1');
      expect(store.size()).toBe(1);
    });
  });
});