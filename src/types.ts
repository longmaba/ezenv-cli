export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  project_ref?: string;
}

export interface AuthConfig {
  supabaseUrl: string;
  loginUrl: string;
  clientId: string;
}

export interface LoginOptions {
  openBrowser?: boolean;
  signal?: AbortSignal;
}

export type Environment = 'development' | 'staging' | 'production' | 'test';

export interface DiffResult {
  added: Record<string, string>;
  modified: Record<string, { old: string; new: string }>;
  removed: Record<string, string>;
  localOnly: Record<string, string>;
  timestamp?: string;
}

export interface DiffOptions {
  format: 'inline' | 'side-by-side' | 'summary';
  colorize: boolean;
  contextLines?: number;
}