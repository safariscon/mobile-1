import * as Linking from 'expo-linking';
import { isSafeInAppPath } from './session';

export function createAppPath(path = '/dashboard/bookings') {
  return Linking.createURL(path.startsWith('/') ? path.slice(1) : path);
}

function queryFromSearch(search = '') {
  const params = new URLSearchParams(String(search || '').replace(/^\?/, ''));
  const result = {};
  params.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

function parseHttpUrl(url) {
  try {
    const parsed = new URL(url);
    return {
      path: parsed.pathname || '/',
      query: queryFromSearch(parsed.search),
    };
  } catch (_error) {
    return null;
  }
}

export function parseAppLink(url) {
  if (!url) return null;
  const parsed = Linking.parse(url) || {};
  const http = parseHttpUrl(url);
  const query = { ...(http?.query || {}), ...(parsed.queryParams || {}) };
  const rawPath = `/${String(parsed.path || http?.path || '').replace(/^\/+/, '')}`;
  const path = rawPath === '/' && query.redirect ? String(query.redirect) : rawPath;
  return { url, path, query };
}

export function resolveSafeRedirect(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (isSafeInAppPath(raw)) return raw;
  const parsed = parseHttpUrl(raw);
  if (parsed?.query?.redirect && isSafeInAppPath(parsed.query.redirect)) return parsed.query.redirect;
  if (parsed?.path && isSafeInAppPath(parsed.path)) {
    const search = new URLSearchParams(parsed.query).toString();
    return search ? `${parsed.path}?${search}` : parsed.path;
  }
  return '';
}

export function mapDeepLink(url) {
  const parsed = parseAppLink(url);
  if (!parsed) return null;
  const redirect = resolveSafeRedirect(parsed.query.redirect || parsed.query.next || parsed.path);
  const target = redirect || parsed.path;
  const params = new URLSearchParams(target.split('?')[1] || '');
  Object.entries(parsed.query).forEach(([key, value]) => {
    if (!params.has(key) && value) params.set(key, String(value));
  });
  const pathname = target.split('?')[0];
  const bookingId = params.get('bookingId') || '';
  const sellerId = params.get('sellerId') || '';

  if (pathname.includes('provider-register') || pathname.includes('provider/complete')) {
    return { type: 'provider-register', sellerId, path: target };
  }
  if (pathname.includes('business-register')) {
    return { type: 'business-register', path: target };
  }
  if (pathname.includes('/dashboard/seller/bookings') || pathname.includes('seller/bookings')) {
    return { type: 'seller-booking', bookingId, path: target };
  }
  if (pathname.includes('/dashboard/bookings') || pathname === '/bookings' || pathname.endsWith('/bookings')) {
    return { type: 'customer-booking', bookingId, path: target };
  }
  if (pathname.includes('/login')) {
    return { type: 'login', path: resolveSafeRedirect(params.get('redirect') || params.get('next') || ''), query: parsed.query };
  }
  if (redirect && redirect.split('?')[0] !== pathname) {
    return mapDeepLink(createAppPath(redirect));
  }
  return { type: 'unknown', path: target, query: parsed.query };
}
