export interface DeviceAuthResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}

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