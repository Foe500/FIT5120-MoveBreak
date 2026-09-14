// Resolves the API endpoint from deployment configuration, with a local-development fallback.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
