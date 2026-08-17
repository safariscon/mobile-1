import { POLICY_TABS, SUPPORT_CONTACT } from './policyContent';

export const POLICY_PAGES = POLICY_TABS.map((tab) => ({
  key: tab.key,
  label: tab.label,
  path: `/${tab.key}`,
}));

export const SUPPORT_EMAIL = `mailto:${SUPPORT_CONTACT.email}`;
export const SUPPORT_PHONE = SUPPORT_CONTACT.phone;

export function webPolicyUrl(path) {
  const origin = String(process.env.EXPO_PUBLIC_WEB_ORIGIN || process.env.EXPO_PUBLIC_FRONTEND_URL || '').replace(/\/+$/, '');
  if (!origin) return path;
  return `${origin}${path}`;
}
