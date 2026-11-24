const configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL || '')
  .trim()
  .replace(/\/+$/, '');

// Use localhost fallback ONLY in local Vite development (import.meta.env.DEV).
// In production builds (Vercel), Vite replaces import.meta.env.DEV with false and
// tree-shakes the localhost URL completely out of the bundle.
export const API_BASE_URL =
  configuredBaseUrl || (import.meta.env.DEV ? 'http://localhost:5000/api' : '');

export function getApiBaseUrl() {
  if (!API_BASE_URL) {
    throw new Error(
      'Smart Campus API URL is not configured. Please set VITE_API_BASE_URL in your deployment settings.'
    );
  }
  return API_BASE_URL;
}
