import { Platform } from 'react-native';
import { isAuthApiPath, isJwtAuthError, isPaymentApiPath } from '../lib/session';

const configuredBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
const isDevelopment = typeof __DEV__ !== 'undefined' && __DEV__;

function getWebLocalBackendUrl() {
  if (typeof window === 'undefined') return 'http://localhost:5000/api';
  const hostname = window.location?.hostname || 'localhost';
  return `http://${hostname}:5000/api`;
}

const localBackendBaseUrl = Platform.select({
  android: 'http://192.168.184.9:5000/api',
  web: getWebLocalBackendUrl(),
  default: 'http://localhost:5000/api',
});

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

export function getApiOrigin(baseUrl = API_BASE_URL) {
  return String(baseUrl || '').replace(/\/api\/?$/, '');
}

export const endpoints = {
  hotels: '/hotels',
  services: '/marketplace/services',
  serviceDetails: (serviceId) => `/marketplace/services/${encodeURIComponent(serviceId)}`,
};

let authTokenProvider = () => null;
let refreshSessionHandler = null;
let sessionExpiredHandler = null;
let termsRequiredHandler = null;

export function setAuthTokenProvider(provider) {
  authTokenProvider = typeof provider === 'function' ? provider : () => null;
}

export function setRefreshSessionHandler(handler) {
  refreshSessionHandler = typeof handler === 'function' ? handler : null;
}

export function setSessionExpiredHandler(handler) {
  sessionExpiredHandler = typeof handler === 'function' ? handler : null;
}

export function setTermsRequiredHandler(handler) {
  termsRequiredHandler = typeof handler === 'function' ? handler : null;
}

async function peekJson(response) {
  try {
    return await response.clone().json();
  } catch (_error) {
    return {};
  }
}

async function requestOnce(baseUrl, path, fetchOptions, timeoutMs, signal) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const forwardAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', forwardAbort, { once: true });
  }
  try {
    return await fetch(`${baseUrl}${path}`, {
      ...fetchOptions,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
    if (signal) signal.removeEventListener?.('abort', forwardAbort);
  }
}

async function requestWithFallback(path, fetchOptions, timeoutMs, signal) {
  let lastError;
  for (const baseUrl of API_BASE_URLS) {
    try {
      return await requestOnce(baseUrl, path, fetchOptions, timeoutMs, signal);
    } catch (error) {
      lastError = error.name === 'AbortError'
        ? new Error(`Backend request timed out at ${baseUrl}. Please check your connection and try again.`)
        : new Error(`Failed to fetch ${baseUrl}${path}. ${error.message || 'Backend is not reachable.'}`);
    }
  }
  throw lastError || new Error('Backend is not reachable');
}

export async function apiFetch(path, options = {}) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const { skipAuth, skipRefresh, signal, timeoutMs = 6000, ...fetchOptions } = options;
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

  const response = await requestWithFallback(normalizedPath, { ...fetchOptions, headers }, timeoutMs, signal);
  const data = await peekJson(response);

  if (response.status === 403 && data?.code === 'TERMS_NOT_ACCEPTED') {
    termsRequiredHandler?.();
  }

  if (response.status !== 401 || skipAuth || skipRefresh) {
    return response;
  }

  if (isAuthApiPath(normalizedPath)) {
    return response;
  }

  const jwtError = isJwtAuthError(data, response.status);
  if (isPaymentApiPath(normalizedPath) && !jwtError) {
    return response;
  }

  const refreshed = await refreshSessionHandler?.();
  if (refreshed) {
    const retryHeaders = { ...headers };
    const nextToken = authTokenProvider();
    if (nextToken) retryHeaders.Authorization = `Bearer ${nextToken}`;
    return requestWithFallback(normalizedPath, { ...fetchOptions, headers: retryHeaders }, timeoutMs, signal);
  }

  if (!isPaymentApiPath(normalizedPath) || jwtError) {
    sessionExpiredHandler?.();
  }

  return response;
}
