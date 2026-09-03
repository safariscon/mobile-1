import { Platform } from 'react-native';
import { isAuthApiPath, isJwtAuthError, isPaymentApiPath } from '../lib/session';

/** Default wait for normal API calls (ms). */
export const DEFAULT_TIMEOUT_MS = Number(process.env.EXPO_PUBLIC_API_TIMEOUT_MS) || 20000;

/** Auth / email OTP calls often wait on SMTP — give them more time. */
export const AUTH_TIMEOUT_MS = Number(process.env.EXPO_PUBLIC_AUTH_TIMEOUT_MS) || 45000;

const configuredBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
const isDevelopment = typeof __DEV__ !== 'undefined' && __DEV__;
const backendPort = String(process.env.EXPO_PUBLIC_API_PORT || '5000').trim() || '5000';

function getExpoLanHost() {
  try {
    // Prefer Metro / Expo Go host (e.g. 192.168.1.23:8081) so phone hits the PC LAN IP.
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    const Constants = require('expo-constants').default;
    const hostUri = Constants?.expoConfig?.hostUri
      || Constants?.manifest2?.extra?.expoGo?.debuggerHost
      || Constants?.manifest?.debuggerHost
      || Constants?.linkingUri;
    const host = String(hostUri || '')
      .replace(/^[a-z]+:\/\//i, '')
      .split('/')[0]
      .split(':')[0]
      .trim();
    if (host && host !== 'localhost' && host !== '127.0.0.1') return host;
  } catch (_error) {
    // expo-constants unavailable
  }
  return null;
}

function getWebLocalBackendUrl() {
  if (typeof window === 'undefined') return `http://localhost:${backendPort}/api`;
  const hostname = window.location?.hostname || 'localhost';
  return `http://${hostname}:${backendPort}/api`;
}

function lanBackendUrl(host) {
  return host ? `http://${host}:${backendPort}/api` : '';
}

const expoLanHost = getExpoLanHost();
const hardcodedLanFallback = '192.168.1.23';

const localBackendBaseUrl = Platform.select({
  android: lanBackendUrl(expoLanHost || hardcodedLanFallback),
  ios: lanBackendUrl(expoLanHost || hardcodedLanFallback),
  web: getWebLocalBackendUrl(),
  default: lanBackendUrl(expoLanHost || hardcodedLanFallback) || `http://localhost:${backendPort}/api`,
});

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function uniqueBaseUrls(urls) {
  return [...new Set(urls.map(normalizeBaseUrl).filter(Boolean))];
}

/**
 * Prefer:
 * 1) EXPO_PUBLIC_API_BASE_URL
 * 2) Metro/Expo LAN host (same IP as exp://192.168.x.x:8081)
 * 3) Hardcoded LAN fallback
 * Never put phone "localhost" first — that is the phone itself, not your PC.
 */
export const API_BASE_URLS = uniqueBaseUrls(
  isDevelopment
    ? [
        configuredBaseUrl,
        localBackendBaseUrl,
        lanBackendUrl(hardcodedLanFallback),
        Platform.OS === 'web' ? getWebLocalBackendUrl() : '',
      ]
    : [configuredBaseUrl, localBackendBaseUrl]
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

function resolveTimeoutMs(path, timeoutMs) {
  if (Number.isFinite(timeoutMs) && timeoutMs > 0) return timeoutMs;
  if (isAuthApiPath(path)) return AUTH_TIMEOUT_MS;
  return DEFAULT_TIMEOUT_MS;
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
        ? new Error(`Backend request timed out after ${Math.round(timeoutMs / 1000)}s at ${baseUrl}. Please check your connection and try again.`)
        : new Error(`Failed to fetch ${baseUrl}${path}. ${error.message || 'Backend is not reachable.'}`);
    }
  }
  throw lastError || new Error('Backend is not reachable');
}

export async function apiFetch(path, options = {}) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const { skipAuth, skipRefresh, signal, timeoutMs, ...fetchOptions } = options;
  const effectiveTimeoutMs = resolveTimeoutMs(normalizedPath, timeoutMs);
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

  const response = await requestWithFallback(normalizedPath, { ...fetchOptions, headers }, effectiveTimeoutMs, signal);
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
    return requestWithFallback(normalizedPath, { ...fetchOptions, headers: retryHeaders }, effectiveTimeoutMs, signal);
  }

  if (!isPaymentApiPath(normalizedPath) || jwtError) {
    sessionExpiredHandler?.();
  }

  return response;
}
