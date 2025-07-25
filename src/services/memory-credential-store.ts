export interface CredentialStore {
  store(service: string, account: string, password: string): Promise<void>;
  retrieve(service: string, account: string): Promise<string | null>;
  delete(service: string, account: string): Promise<boolean>;
}

export class MemoryCredentialStore implements CredentialStore {
  private storage: Map<string, string> = new Map();

  private getKey(service: string, account: string): string {
    return `${service}:${account}`;
  }

  async store(service: string, account: string, password: string): Promise<void> {
    const key = this.getKey(service, account);
    this.storage.set(key, password);
  }

  async retrieve(service: string, account: string): Promise<string | null> {
    const key = this.getKey(service, account);
    return this.storage.get(key) || null;
  }

  async delete(service: string, account: string): Promise<boolean> {
    const key = this.getKey(service, account);
    return this.storage.delete(key);
  }

  clear(): void {
    this.storage.clear();
  }

  size(): number {
    return this.storage.size;
  }
}