import { POLICY_TAB_KEYS, SUPPORT_CONTACT } from './policyContent';

export const POLICY_PAGES = POLICY_TAB_KEYS.map((tab) => ({
  key: tab.key,
  labelKey: tab.labelKey,
  path: `/${tab.key}`,
}));

export const SUPPORT_EMAIL = `mailto:${SUPPORT_CONTACT.email}`;
export const SUPPORT_PHONE = SUPPORT_CONTACT.phone;

export function webPolicyUrl(path) {
  const origin = String(process.env.EXPO_PUBLIC_WEB_ORIGIN || process.env.EXPO_PUBLIC_FRONTEND_URL || '').replace(/\/+$/, '');
  if (!origin) return path;
  return `${origin}${path}`;
}
