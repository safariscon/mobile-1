export function roleLabel(user) {
  const role = String(user?.role || '').toLowerCase();
  if (role === 'admin') return 'Admin';
  if (['hotel', 'supplier', 'seller', 'provider', 'business'].includes(role)) return 'Service provider';
  return 'Customer';
}

export function userInitials(user) {
  const name = String(user?.name || user?.email || 'U').trim();
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export const PAGE_INNER = {
  admin_users: [
    { key: 'all', label: 'All users' },
    { key: 'providers', label: 'Service providers' },
    { key: 'customers', label: 'Customers' },
  ],
  admin_services: [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
  ],
  admin_bookings: [
    { key: 'bookings', label: 'Bookings' },
    { key: 'rebook', label: 'Re-book requests' },
    { key: 'verify', label: 'Verification' },
  ],
  seller_services: [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
  ],
  seller_bookings: [
    { key: 'bookings', label: 'Bookings' },
    { key: 'rebook', label: 'Re-book requests' },
    { key: 'verify', label: 'Verification' },
  ],
  seller_finance: [
    { key: 'finance', label: 'Finance' },
    { key: 'payout', label: 'Payout account' },
  ],
  settings: [
    { key: 'how-it-works', label: 'How it works' },
    { key: 'terms', label: 'Terms of use' },
    { key: 'privacy', label: 'Privacy policy' },
    { key: 'payments', label: 'Payments & cancellations' },
  ],
};

export const PAGES = {
  admin_analytics: { title: 'Analytics', subtitle: 'Marketplace activity.' },
  admin_users: { title: 'Users', subtitle: 'Manage system users.' },
  admin_services: { title: 'Services', subtitle: 'Review pending and approved listings.' },
  admin_bookings: { title: 'Bookings', subtitle: 'Manage bookings.' },
  admin_revenue: { title: 'Revenue', subtitle: 'Track payments and payouts.' },
  seller_analytics: { title: 'Analytics', subtitle: 'Your bookings, earnings, and service activity.' },
  seller_services: { title: 'Services', subtitle: 'Manage your pending and approved listings.' },
  seller_bookings: { title: 'Bookings', subtitle: 'Manage your bookings.' },
  seller_finance: { title: 'Finance', subtitle: 'Earnings, payouts, and payout account.' },
  bookings: { title: 'My bookings', subtitle: 'Manage your bookings.' },
  browse: { title: 'Browse services', subtitle: 'Search, filter, and book.' },
  profile: { title: 'Profile', subtitle: 'Your account.' },
  notifications: { title: 'Notifications', subtitle: 'Stay up to date.' },
  settings: { title: 'Settings', subtitle: 'Manage workspace preferences.' },
  home: { title: 'Home', subtitle: 'Explore SafarisCon.' },
};

export const ROLE_NAV = {
  admin: {
    home: 'admin_analytics',
    tabs: [
      { key: 'admin_analytics', label: 'Analytics', icon: 'bar-chart-2' },
      { key: 'admin_users', label: 'Users', icon: 'users' },
      { key: 'admin_services', label: 'Services', icon: 'layers' },
      { key: 'more', label: 'More', icon: 'more-horizontal' },
    ],
    more: [
      { key: 'admin_bookings', label: 'Bookings', icon: 'calendar' },
      { key: 'admin_revenue', label: 'Revenue', icon: 'credit-card' },
      { key: 'browse', label: 'Browse services', icon: 'grid' },
      { key: 'profile', label: 'Profile', icon: 'user' },
      { key: 'notifications', label: 'Notifications', icon: 'bell' },
      { key: 'settings', label: 'Settings', icon: 'settings' },
    ],
  },
  seller: {
    home: 'seller_analytics',
    tabs: [
      { key: 'seller_analytics', label: 'Analytics', icon: 'bar-chart-2' },
      { key: 'seller_services', label: 'Services', icon: 'layers' },
      { key: 'seller_bookings', label: 'Bookings', icon: 'calendar' },
      { key: 'more', label: 'More', icon: 'more-horizontal' },
    ],
    more: [
      { key: 'seller_finance', label: 'Finance', icon: 'credit-card' },
      { key: 'browse', label: 'Browse services', icon: 'grid' },
      { key: 'profile', label: 'Profile', icon: 'user' },
      { key: 'notifications', label: 'Notifications', icon: 'bell' },
      { key: 'settings', label: 'Settings', icon: 'settings' },
    ],
  },
  customer: {
    home: 'bookings',
    tabs: [
      { key: 'bookings', label: 'My bookings', icon: 'calendar' },
      { key: 'browse', label: 'Browse', icon: 'grid' },
      { key: 'profile', label: 'Profile', icon: 'user' },
      { key: 'more', label: 'More', icon: 'more-horizontal' },
    ],
    more: [
      { key: 'notifications', label: 'Notifications', icon: 'bell' },
      { key: 'settings', label: 'Settings', icon: 'settings' },
    ],
  },
  guest: {
    home: 'home',
    tabs: [
      { key: 'home', label: 'Home', icon: 'home' },
      { key: 'browse', label: 'Browse', icon: 'grid' },
    ],
    more: [],
  },
};

export function defaultSection(pageKey) {
  return PAGE_INNER[pageKey]?.[0]?.key || null;
}

export function navForUser({ isAdmin, isSeller, isAuthenticated }) {
  if (!isAuthenticated) return ROLE_NAV.guest;
  if (isAdmin) return ROLE_NAV.admin;
  if (isSeller) return ROLE_NAV.seller;
  return ROLE_NAV.customer;
}
