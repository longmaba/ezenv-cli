/**
 * Default configuration for EzEnv CLI
 * These defaults allow SaaS users to use the hosted service without configuration
 * Self-hosted users can override these with environment variables
 */

export const DEFAULT_CONFIG = {
  // Hosted EzEnv service defaults
  HOSTED_SUPABASE_URL: 'https://uqvlfpmnwjwsgoqyexyh.supabase.co',
  HOSTED_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdmxmcG1ud2p3c2dvcXlleHloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI5NzA5MTYsImV4cCI6MjA2ODU0NjkxNn0.PXv5rUkmoEgQplmixWyZATWwVIQTllUy-qaOPfj1TrQ',
  
  // Environment variable names
  ENV_VARS: {
    SUPABASE_URL: 'SUPABASE_URL',
    SUPABASE_ANON_KEY: 'SUPABASE_ANON_KEY',
    NEXT_PUBLIC_SUPABASE_URL: 'NEXT_PUBLIC_SUPABASE_URL',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  }
};

/**
 * Get Supabase configuration with fallback to hosted defaults
 */
export function getSupabaseConfig(): { url: string; anonKey: string; isUsingHosted: boolean } {
  // In test environment, return test defaults
  if (process.env.NODE_ENV === 'test') {
    return {
      url: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co',
      anonKey: process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key',
      isUsingHosted: false
    };
  }
  
  // Check for environment variables (supports both CLI and Next.js naming)
  const url = process.env[DEFAULT_CONFIG.ENV_VARS.SUPABASE_URL] || 
               process.env[DEFAULT_CONFIG.ENV_VARS.NEXT_PUBLIC_SUPABASE_URL] ||
               DEFAULT_CONFIG.HOSTED_SUPABASE_URL;
               
  const anonKey = process.env[DEFAULT_CONFIG.ENV_VARS.SUPABASE_ANON_KEY] || 
                  process.env[DEFAULT_CONFIG.ENV_VARS.NEXT_PUBLIC_SUPABASE_ANON_KEY] ||
                  DEFAULT_CONFIG.HOSTED_SUPABASE_ANON_KEY;
  
  const isUsingHosted = !process.env[DEFAULT_CONFIG.ENV_VARS.SUPABASE_URL] && 
                        !process.env[DEFAULT_CONFIG.ENV_VARS.NEXT_PUBLIC_SUPABASE_URL];
  
  return {
    url: url.replace(/\/$/, ''), // Remove trailing slash
    anonKey,
    isUsingHosted
  };
}