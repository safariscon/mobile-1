import { Platform } from 'react-native';

const configuredBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
const isDevelopment = typeof __DEV__ !== 'undefined' && __DEV__;

function getWebLocalBackendUrl() {
  if (typeof window === 'undefined') return 'http://localhost:5000/api';
  const hostname = window.location?.hostname || 'localhost';
  return `http://${hostname}:5000/api`;
}

const localBackendBaseUrl = Platform.select({
  android: 'http://192.168.88.117:5000/api',
  web: getWebLocalBackendUrl(),
  default: 'http://localhost:5000/api',
});

// Use an ADB bridge for the local API so a physical phone does not try the
// emulator-only 10.0.2.2 address. The Android npm script creates this bridge.
// Production builds only use the configured hosted API.
const androidDevelopmentBaseUrl = 'http://localhost:5000/api';

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function uniqueBaseUrls(urls) {
  return [...new Set(urls.map(normalizeBaseUrl).filter(Boolean))];
}

export const API_BASE_URLS = uniqueBaseUrls(
  Platform.OS === 'android'
    ? isDevelopment
      ? [configuredBaseUrl, androidDevelopmentBaseUrl, localBackendBaseUrl]
      : [configuredBaseUrl]
    : [localBackendBaseUrl, configuredBaseUrl]
);

export const API_BASE_URL = API_BASE_URLS[0];

export const endpoints = {
  hotels: '/hotels',
  services: '/marketplace/services',
  serviceDetails: (serviceId) => `/marketplace/services/${encodeURIComponent(serviceId)}`,
};

let authTokenProvider = () => null;
export function setAuthTokenProvider(provider) {
  authTokenProvider = typeof provider === 'function' ? provider : () => null;
}

export async function apiFetch(path, options = {}) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const { skipAuth, signal, timeoutMs = 6000, ...fetchOptions } = options;
  const headers = {
    ...(fetchOptions.headers || {}),
  };
  if (typeof fetchOptions.body === 'string' && !headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = 'application/json';
  }
  const authToken = skipAuth ? null : authTokenProvider();
  if (authToken && !headers.Authorization) {
    headers.Authorization = `Bearer ${authToken}`;
  }
  let lastError;

  for (const baseUrl of API_BASE_URLS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const forwardAbort = () => controller.abort();
    if (signal) {
      if (signal.aborted) controller.abort();
      else signal.addEventListener('abort', forwardAbort, { once: true });
    }
    try {
      const response = await fetch(`${baseUrl}${normalizedPath}`, {
        ...fetchOptions,
        headers,
        signal: controller.signal,
      });
      return response;
    } catch (error) {
      lastError = error.name === 'AbortError'
        ? new Error(`Backend request timed out at ${baseUrl}. Please check your connection and try again.`)
        : new Error(`Failed to fetch ${baseUrl}${normalizedPath}. ${error.message || 'Backend is not reachable.'}`);
    } finally {
      clearTimeout(timeoutId);
      if (signal) signal.removeEventListener?.('abort', forwardAbort);
    }
  }

  throw lastError || new Error('Backend is not reachable');
}



