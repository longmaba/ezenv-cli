// Mock for getSupabaseConfig
export const mockGetSupabaseConfig = jest.fn().mockReturnValue({
  url: 'https://test.supabase.co',
  anonKey: 'test-anon-key',
  isUsingHosted: false
});

// Mock the entire defaults module
jest.mock('../../src/config/defaults', () => ({
  getSupabaseConfig: mockGetSupabaseConfig,
  DEFAULT_CONFIG: {
    HOSTED_SUPABASE_URL: 'https://hosted.supabase.co',
    HOSTED_SUPABASE_ANON_KEY: 'hosted-anon-key',
    ENV_VARS: {
      SUPABASE_URL: 'SUPABASE_URL',
      SUPABASE_ANON_KEY: 'SUPABASE_ANON_KEY',
      NEXT_PUBLIC_SUPABASE_URL: 'NEXT_PUBLIC_SUPABASE_URL',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    }
  }
}));