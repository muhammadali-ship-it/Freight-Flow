// Environment configuration utility
export const env = {
  // API URL for direct requests (not proxied)
  API_URL: import.meta.env.VITE_API_URL || 
    (import.meta.env.MODE === 'production' 
      ? 'https://freight-flow-steel.vercel.app' 
      : 'http://localhost:5000'),
  
  // API base URL for requests
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 
    (import.meta.env.MODE === 'production' 
      ? 'https://freight-flow-steel.vercel.app/api' 
      : '/api'), // Use proxy in development by default
  
  // Whether we're in development mode
  isDevelopment: import.meta.env.MODE === 'development',
  
  // Whether we're in production mode
  isProduction: import.meta.env.MODE === 'production',
  
  // Whether to use direct URLs (bypass proxy)
  useDirectUrls: !!import.meta.env.VITE_API_BASE_URL,
} as const;

// Helper function to build API URLs
export function buildApiUrl(endpoint: string): string {
  // Remove leading slash if present
  let cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  
  // Remove /api prefix if present (to avoid double /api)
  if (cleanEndpoint.startsWith('api/')) {
    cleanEndpoint = cleanEndpoint.slice(4);
  }
  
  // If VITE_API_BASE_URL is explicitly set, always use it
  if (import.meta.env.VITE_API_BASE_URL) {
    return `${env.API_BASE_URL}/${cleanEndpoint}`;
  }
  
  // In development without explicit VITE_API_BASE_URL, use proxy (relative URLs)
  if (env.isDevelopment) {
    return `/api/${cleanEndpoint}`;
  }
  
  // In production, use full URL
  return `${env.API_BASE_URL}/${cleanEndpoint}`;
}
