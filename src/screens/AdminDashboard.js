import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { languages, setAppLanguage } from '../i18n';
import { useAppDialog } from '../components/AppDialog';
import BookingQrScanner from '../components/BookingQrScanner';
import BookingVerifyForm from '../components/BookingVerifyForm';
import VerifiedBookingCard from '../components/VerifiedBookingCard';
import BookingDetailCards from '../components/BookingDetailCards';
import { extractBookingLookup } from '../lib/bookingVerification';
import OverflowMenu, { MenuTrigger } from '../components/OverflowMenu';
import PolicyLinks from '../components/PolicyLinks';
import ServiceDetailsView from '../components/ServiceDetailsView';
import {
  deleteAdminServiceCategory,
  fetchAdminServiceCategories,
  updateAdminServiceCategory,
} from '../api/categories';
import { normalizeServiceDetail } from '../lib/serviceMapper';
import { realtimeUserRooms, useRealtimeRefresh } from '../lib/realtime';
import { lightColors } from '../theme/colors';
import useThemedStyles from '../theme/useThemedStyles';
import { isDraftListing, matchesServiceFilter, reviewStatusOf } from '../lib/listings';
import { baseInputStyle } from '../theme/inputStyles';

let colors = lightColors;
let styles;

const ADMIN_PAGE_META = {
  businesses: {
    title: 'Welcome admin',
    description: 'Review services, providers, bookings, and marketplace operations from one mobile workspace.',
    icon: 'layers',
  },
  services: { title: 'Booking modes', description: 'Check published services, availability, booking modes, and catalog quality.', icon: 'sliders' },
  users: { title: 'Users', description: 'Manage customers, admins, and provider accounts in the marketplace.', icon: 'users' },
  'register-business': { title: 'Service providers', description: 'Create provider accounts and share onboarding credentials.', icon: 'user-plus' },
  bookings: { title: 'Bookings', description: 'Review customer booking requests, approvals, payments, and verification state.', icon: 'calendar' },
  'rebook-requests': { title: 'Re-book requests', description: 'Manage re-booking, cancellation, refunds, and seller notification requests.', icon: 'repeat' },
  verification: { title: 'Verify booking', description: 'Scan or enter booking verification tokens and codes.', icon: 'check-square' },
  insights: { title: 'Insights', description: 'View analytics, revenue, conversion rates, and recent platform activity.', icon: 'bar-chart-2' },
  notifications: { title: 'Notifications', description: 'Manage the announcement messages shown to public users.', icon: 'bell' },
  settings: { title: 'Settings', description: 'Change app language, theme, booking mode, rules, commission defaults, and service categories.', icon: 'settings' },
};

function normalizeAdminTab(tab) {
  if (tab === 'home') return 'businesses';
  if (tab === 'stats') return 'insights';
  return ADMIN_PAGE_META[tab] ? tab : 'businesses';
}

const DEFAULT_ANNOUNCEMENT = {
  enabled: true,
  intervalSeconds: 5,
  items: [{ text: '', linkLabel: '', linkUrl: '' }],
};

const DEFAULT_SETTINGS = {
  defaultCommissionPercentage: 10,
  bookingMode: 'manual',
  bookingRules: [],
};

function formatMoney(value) {
  return `RWF ${Number(value || 0).toLocaleString()}`;
}

function label(value) {
  return String(value || '-').replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function listingBelongsToUser(listing, person) {
  const ids = [person?._id, person?.id, person?.sellerId, person?.providerId].filter(Boolean).map(String);
  const emails = [person?.email].filter(Boolean).map((value) => String(value).toLowerCase());
  const listingIds = [
    listing?.sellerId,
    listing?.providerId,
    listing?.ownerId,
    listing?.userId,
    listing?.createdBy,
    listing?.owner?._id,
    listing?.seller?._id,
    listing?.user?._id,
  ].filter(Boolean).map(String);
  if (listingIds.some((id) => ids.includes(id))) return true;
  const listingEmails = [listing?.email, listing?.ownerEmail, listing?.sellerEmail, listing?.user?.email]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
  return listingEmails.some((email) => emails.includes(email));
}

function isServiceProvider(person) {
  const role = String(person?.role || '').toLowerCase();
  if (['hotel', 'supplier', 'seller', 'provider', 'business'].includes(role)) return true;
  return Boolean(person?.sellerId || person?.providerId);
}

function providerIdOf(person) {
  return person?.sellerId || person?.providerId || '';
}

async function readJson(response) {
  return response.json().catch(() => ({}));
}

export default function AdminDashboard({ tab, hideChrome = false, section = 'all' }) {
  const themed = useThemedStyles(createStyles);
  colors = themed.colors;
  styles = themed.styles;
  const { i18n, t } = useTranslation();
  const { token, isAuthenticated, user } = useAuth();
  const { mode, setThemeMode } = useTheme();
  const defaultMarketplaceSettings = useMemo(() => ({
    ...DEFAULT_SETTINGS,
    bookingRules: [t('admin.defaultRuleAccurate'), t('admin.defaultRuleBalance')],
  }), [t]);
  const [activeTab, setActiveTab] = useState(() => normalizeAdminTab(tab));
  const [languageOpen, setLanguageOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const { dialogNode, showResult, askConfirm, closeDialog } = useAppDialog();
  const [overflow, setOverflow] = useState({ visible: false, title: 'Actions', items: [] });
  const [stats, setStats] = useState({});
  const [businesses, setBusinesses] = useState([]);
  const [services, setServices] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [rebookRequests, setRebookRequests] = useState([]);
  const [transactionSummary, setTransactionSummary] = useState(null);
  const [announcementForm, setAnnouncementForm] = useState(DEFAULT_ANNOUNCEMENT);
  const [marketplaceSettings, setMarketplaceSettings] = useState(defaultMarketplaceSettings);
  const [providerForm, setProviderForm] = useState({ providerName: '', providerEmail: '' });
  const [showProviderForm, setShowProviderForm] = useState(false);
  const [onboardingCredentials, setOnboardingCredentials] = useState(null);
  const [verificationLookup, setVerificationLookup] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [verifiedBooking, setVerifiedBooking] = useState(null);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [decision, setDecision] = useState({ totalPrice: '', commissionPercentage: '10', paymentReason: t('admin.defaultPaymentReason') });
  const [approvalForm, setApprovalForm] = useState({
    cancelWindowHours: '6',
    cancelPenaltyPercent: '20',
    platformCommissionPercent: '10',
    notes: '',
    reason: '',
  });
  const [serviceCategories, setServiceCategories] = useState([]);
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    slug: '',
    group: 'Other',
    supportsOptions: true,
  });
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    setActiveTab(normalizeAdminTab(tab));
  }, [tab]);

  useEffect(() => {
    if (section !== 'providers' && activeTab !== 'register-business') {
      setShowProviderForm(false);
    }
  }, [section, activeTab]);

  const request = useCallback(async (path, options = {}) => {
    const response = await apiFetch(path, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await readJson(response);
    if (!response.ok) throw new Error(data.message || data.error || t('backend.returned', { status: response.status }));
    return data;
  }, [t, token]);

  const requestFirst = useCallback(async (paths, options = {}) => {
    let lastError = null;
    for (const path of paths) {
      const response = await apiFetch(path, {
        ...options,
        headers: {
          ...(options.headers || {}),
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await readJson(response);
      if (response.ok) return data;
      lastError = new Error(data.message || data.error || t('backend.returned', { status: response.status }));
      if (![404, 405].includes(response.status)) throw lastError;
    }
    throw lastError || new Error(t('admin.actionFailed'));
  }, [t, token]);

  const requestDelete = useCallback(async (paths, body) => {
    let lastError = null;
    for (const path of paths) {
      const attempts = [
        { method: 'DELETE' },
        body ? { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : null,
      ].filter(Boolean);
      for (const options of attempts) {
        const response = await apiFetch(path, {
          ...options,
          headers: {
            ...(options.headers || {}),
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await readJson(response);
        if (response.ok) return data;
        lastError = new Error(data.message || data.error || t('backend.returned', { status: response.status }));
        if ([404, 405].includes(response.status)) break;
        if ([400, 411, 415, 422].includes(response.status) && !options.body && body) continue;
        throw lastError;
      }
    }
    throw lastError || new Error(t('admin.actionFailed'));
  }, [t, token]);

  const loadData = useCallback(async (silent = false) => {
    if (!isAuthenticated || !token) return;
    if (!silent) setLoading(true);
    try {
      const [statsResp, businessResp, serviceResp, bookingResp, userResp, transactionResp, rebookResp] = await Promise.all([
        request('/admin/dashboard-stats'),
        request('/admin/businesses'),
        request('/admin/services?page=1&limit=20'),
        request('/admin/bookings?page=1&limit=20'),
        request('/admin/users?page=1&limit=20'),
        request('/admin/transactions?page=1&limit=20'),
        request('/rebook/admin?page=1'),
      ]);

      setStats(statsResp || {});
      setBusinesses(businessResp.businesses || businessResp.hotels || []);
      setServices(serviceResp.services || serviceResp.items || []);
      setBookings(bookingResp.bookings || bookingResp.items || []);
      setUsers(userResp.users || userResp.items || []);
      setTransactions(transactionResp.transactions || transactionResp.items || []);
      setTransactionSummary(transactionResp.summary || null);
      setRebookRequests(rebookResp.requests || []);

      const [announcementResp, settingsResp] = await Promise.all([
        apiFetch('/announcement').then(readJson).catch(() => ({})),
        apiFetch('/marketplace-settings').then(readJson).catch(() => ({})),
      ]);
      const items = announcementResp.announcements?.length
        ? announcementResp.announcements
        : announcementResp.announcement?.text
          ? [announcementResp.announcement]
          : DEFAULT_ANNOUNCEMENT.items;
      setAnnouncementForm({
        enabled: announcementResp.enabled ?? announcementResp.announcement?.enabled ?? true,
        intervalSeconds: String(announcementResp.intervalSeconds || 5),
        items: items.slice(0, 5),
      });
      setMarketplaceSettings(settingsResp.settings || defaultMarketplaceSettings);
      const categories = await fetchAdminServiceCategories().catch(() => []);
      setServiceCategories(categories);
    } catch (requestError) {
      showResult(t('common.error'), requestError.message || t('admin.loadFailed'), 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [defaultMarketplaceSettings, isAuthenticated, request, showResult, t, token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const realtimeRooms = useMemo(() => realtimeUserRooms(user, { admin: true }), [user]);
  const refreshFromRealtime = useCallback(() => {
    loadData(true);
  }, [loadData]);
  useRealtimeRefresh({
    enabled: isAuthenticated,
    rooms: realtimeRooms,
    events: ['booking:changed', 'service:changed', 'hotel:changed', 'catalog:changed', 'notification:new'],
    onRefresh: refreshFromRealtime,
  });

  const refresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const runAction = async (action, successMessage, { silent = false } = {}) => {
    setSaving(true);
    try {
      const response = await action();
      await loadData(true);
      if (!silent && successMessage) {
        showResult(t('common.success'), successMessage, 'success');
      }
      return response;
    } catch (requestError) {
      showResult(t('common.error'), requestError.message || t('admin.actionFailed'), 'error');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const reviewBusiness = (businessId, status, { confirm = false } = {}) => {
    const run = () => runAction(
      () => requestFirst([`/admin/businesses/${businessId}/approval`, `/admin/businesses/${businessId}/verification`], {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(status === 'approved' ? { status, commissionPercentage: Number(marketplaceSettings.defaultCommissionPercentage || 10) } : { status }),
      }),
      status === 'approved' ? 'Service approved.' : 'Service rejected.'
    );
    if (!confirm) return run();
    askConfirm({
      title: status === 'approved' ? 'Approve this service?' : 'Reject this service?',
      message: status === 'approved'
        ? 'This service will be posted to the marketplace.'
        : 'The provider will be notified and the service will not stay public.',
      confirmLabel: status === 'approved' ? t('actions.approve') : t('actions.reject'),
      destructive: status !== 'approved',
      onConfirm: () => {
        closeDialog();
        run();
      },
    });
    return null;
  };

  const reviewBusinessImages = (businessId, action) => runAction(
    () => request(`/admin/businesses/${businessId}/image-review`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    }),
    action === 'approve' ? 'Service images approved and published.' : 'Service images rejected.'
  );

  const deactivateProviderListings = async (person) => {
    const payload = JSON.stringify({
      status: 'unavailable',
      inventoryStatus: 'unavailable',
      availabilityStatus: 'unavailable',
      active: false,
      published: false,
    });
    const ownedBusinesses = businesses.filter((item) => listingBelongsToUser(item, person));
    const ownedServices = services.filter((item) => listingBelongsToUser(item, person));
    const options = { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: payload };
    await Promise.allSettled([
      ...ownedBusinesses.map((item) => requestFirst([
        `/admin/businesses/${item._id || item.id}/availability`,
        `/admin/businesses/${item._id || item.id}`,
      ], options)),
      ...ownedServices.map((item) => requestFirst([
        `/admin/services/${item._id || item.id}`,
        `/admin/businesses/${item._id || item.id}`,
      ], options)),
    ]);
  };

  const deleteBusiness = (business) => {
    const id = business._id || business.id;
    askConfirm({
      title: 'Delete this service?',
      message: 'The service provider will be emailed about this action. The service will be removed from the marketplace.',
      confirmLabel: t('actions.delete'),
      destructive: true,
      onConfirm: () => {
        closeDialog();
        runAction(
          () => requestDelete(
            [`/admin/businesses/${id}`, `/admin/services/${id}`],
            { notifyEmail: true, emailUser: true }
          ),
          'Service deleted.'
        );
      },
    });
  };

  const deleteUser = (person) => {
    const userId = person?._id || person?.id;
    const provider = isServiceProvider(person);
    askConfirm({
      title: provider ? 'Delete this service provider?' : 'Delete this customer?',
      message: provider
        ? `${person.name || person.email} will be emailed about this deletion. All of their services will be set to inactive and unavailable, and they will no longer appear in the marketplace.`
        : `${person.name || person.email} will be emailed about this deletion. They will not be able to sign in again until they register a new account.`,
      confirmLabel: t('actions.delete'),
      destructive: true,
      onConfirm: () => {
        closeDialog();
        runAction(async () => {
          if (provider) await deactivateProviderListings(person);
          return requestDelete([`/admin/users/${userId}`], {
            notifyEmail: true,
            emailUser: true,
            deactivateServices: provider,
            setServicesUnavailable: provider,
            setServicesInactive: provider,
          });
        }, t('admin.userDeleted'));
      },
    });
  };

  const bulkDeleteUsers = () => {
    if (!selectedUserIds.length) return;
    const selectedUsers = users.filter((item) => selectedUserIds.includes(item._id || item.id));
    const hasProvider = selectedUsers.some((item) => isServiceProvider(item));
    askConfirm({
      title: `Delete ${selectedUserIds.length} users?`,
      message: hasProvider
        ? 'Each selected user will be emailed. Service providers’ listings will be set inactive and unavailable.'
        : 'Each selected user will be emailed. Customers will not be able to sign in again until they register a new account.',
      confirmLabel: t('actions.delete'),
      destructive: true,
      onConfirm: () => {
        closeDialog();
        runAction(async () => {
          await Promise.allSettled(selectedUsers.filter(isServiceProvider).map((item) => deactivateProviderListings(item)));
          return request('/admin/users/bulk', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userIds: selectedUserIds,
              notifyEmail: true,
              emailUser: true,
              deactivateServices: hasProvider,
              setServicesUnavailable: hasProvider,
              setServicesInactive: hasProvider,
            }),
          });
        }, 'Selected users deleted.').then((response) => {
          if (response) setSelectedUserIds([]);
        });
      },
    });
  };

  const markCommissionCollected = (transaction) => runAction(
    () => request(`/admin/transactions/${transaction._id || transaction.id || transaction.transactionId}/commission`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commissionStatus: 'collected' }),
    }),
    'Commission marked collected.'
  );

  const syncPayout = (transaction) => runAction(
    () => request(`/admin/payouts/${transaction.payoutId || transaction._id || transaction.id}/sync`, { method: 'POST' }),
    'Payout sync requested.'
  );

  const reviewService = (serviceId, status, { confirm = false } = {}) => {
    const body = status === 'approved'
      ? {
          status: 'approved',
          cancelWindowHours: Number(approvalForm.cancelWindowHours) || 6,
          cancelPenaltyPercent: Number(approvalForm.cancelPenaltyPercent),
          platformCommissionPercent: Number(approvalForm.platformCommissionPercent),
          notes: approvalForm.notes || undefined,
        }
      : {
          status: 'rejected',
          reason: String(approvalForm.reason || '').trim() || 'Incomplete listing',
        };

    if (status === 'approved') {
      if (!Number.isFinite(body.cancelPenaltyPercent) || body.cancelPenaltyPercent < 0) {
        showResult(t('common.error'), 'Cancel penalty % is required.', 'error');
        return null;
      }
      if (!Number.isFinite(body.platformCommissionPercent) || body.platformCommissionPercent < 0) {
        showResult(t('common.error'), 'Platform commission % is required.', 'error');
        return null;
      }
    }

    const run = () => runAction(
      () => request(`/admin/services/${serviceId}/approval`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
      status === 'approved' ? 'Service approved.' : 'Service rejected.'
    );
    if (!confirm) return run();
    askConfirm({
      title: status === 'approved' ? 'Approve this service?' : 'Reject this service?',
      message: status === 'approved'
        ? `Approve with ${body.cancelPenaltyPercent}% cancel penalty and ${body.platformCommissionPercent}% commission.`
        : 'The service provider will be notified and the listing will be rejected.',
      confirmLabel: status === 'approved' ? t('actions.approve') : t('actions.reject'),
      destructive: status !== 'approved',
      onConfirm: () => {
        closeDialog();
        run();
      },
    });
    return null;
  };

  const loadServiceCategories = () => runAction(
    async () => {
      const list = await fetchAdminServiceCategories();
      setServiceCategories(list);
      return list;
    },
    '',
    { silent: true }
  );

  const saveCategory = () => runAction(async () => {
    throw new Error('Categories are platform-defined. Activate or deactivate an existing domain instead of creating custom fields.');
  }, '');

  const toggleCategoryActive = (category) => runAction(async () => {
    if (category.isActive === false) {
      await updateAdminServiceCategory(category._id || category.id, { ...category, isActive: true });
    } else {
      await deleteAdminServiceCategory(category._id || category.id);
    }
    await loadServiceCategories();
  }, 'Category updated.');

  const openServiceReview = (service) => {
    setSelectedService(normalizeServiceDetail(service));
    setApprovalForm({
      cancelWindowHours: String(service?.cancelWindowHours || service?.cancellationPolicy?.windowHours || 6),
      cancelPenaltyPercent: String(service?.cancelPenaltyPercent ?? service?.cancellationPolicy?.penaltyPercent ?? 20),
      platformCommissionPercent: String(service?.platformCommissionPercent ?? service?.commissionPercentage ?? marketplaceSettings.defaultCommissionPercentage ?? 10),
      notes: service?.agreementTerms?.notes || '',
      reason: '',
    });
    return runAction(
      () => request(`/admin/services/${service._id || service.id}`),
      '',
      { silent: true }
    ).then((response) => {
      if (response?.service || response) {
        const details = normalizeServiceDetail(response?.service || response);
        setSelectedService(details);
        setApprovalForm((current) => ({
          ...current,
          cancelWindowHours: String(details.cancelWindowHours || current.cancelWindowHours),
          cancelPenaltyPercent: String(details.cancelPenaltyPercent || current.cancelPenaltyPercent),
          platformCommissionPercent: String(details.platformCommissionPercent || current.platformCommissionPercent),
        }));
      }
    });
  };

  const saveAnnouncement = () => runAction(
    () => request('/admin/announcement', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...announcementForm,
        intervalSeconds: Number(announcementForm.intervalSeconds) || 5,
      }),
    }),
    t('admin.announcementUpdated')
  );

  const saveMarketplaceSettings = (nextSettings = marketplaceSettings) => runAction(
    () => request('/admin/marketplace-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nextSettings),
    }),
    t('admin.settingsUpdated')
  ).then((response) => {
    if (response?.settings) setMarketplaceSettings(response.settings);
  });

  const createSeller = () => runAction(
    () => request('/admin/sellers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(providerForm),
    }),
    t('admin.sellerCreated')
  ).then((response) => {
    if (response?.credentials) setOnboardingCredentials(response.credentials);
    if (response) setProviderForm({ providerName: '', providerEmail: '' });
  });

  const updateServiceMode = (service, bookingMode) => runAction(
    () => request(`/admin/businesses/${service._id || service.id}/booking-mode`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingMode }),
    }),
    t('admin.bookingModeUpdated')
  );

  const approveBooking = () => runAction(
    () => {
      const businessId = selectedBooking.preferredHotelId?._id || selectedBooking.hotelId?._id || selectedBooking.businessId?._id;
      if (!businessId) throw new Error(t('admin.noBusiness'));
      return request(`/admin/bookings/${selectedBooking._id || selectedBooking.id}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          totalPrice: Number(decision.totalPrice),
          commissionPercentage: Number(decision.commissionPercentage),
          paymentReason: decision.paymentReason,
        }),
      });
    },
    t('admin.bookingApproved')
  ).then((response) => {
    if (response) setSelectedBooking(null);
  });

  const rejectBooking = () => runAction(
    () => request(`/admin/bookings/${selectedBooking._id || selectedBooking.id}/reject`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: decision.paymentReason || t('admin.defaultRejectReason') }),
    }),
    t('admin.bookingRejected')
  ).then((response) => {
    if (response) setSelectedBooking(null);
  });

  const verifyBookingLookup = (lookupValue) => {
    const lookup = extractBookingLookup(lookupValue);
    if (!lookup) return Promise.resolve(null);
    setVerificationLookup(lookup);
    return runAction(
      async () => {
        try {
          return await request(`/admin/booking-verification/${encodeURIComponent(lookup)}`);
        } catch (_error) {
          return request(`/verify/${encodeURIComponent(lookup)}`);
        }
      },
      t('admin.bookingFound')
    ).then((response) => {
      if (response?.booking) {
        const booking = response.booking;
        setVerifiedBooking({
          ...booking,
          bookingId: booking.bookingId || booking._id || booking.id,
          customerName: booking.customerName || booking.user?.name || booking.touristId?.name,
          customerEmail: booking.customerEmail || booking.user?.email || booking.touristId?.email,
          customerPhone: booking.customerPhone || booking.user?.phone || booking.touristId?.phone,
          amountPaid: booking.amountPaid ?? booking.amount,
          paid: booking.paid,
        });
      }
      return response;
    });
  };

  const verifyBooking = () => verifyBookingLookup(verificationLookup);

  const handleQrScan = (data) => verifyBookingLookup(data);

  const approveRebookRequest = (requestItem) => runAction(
    () => request(`/rebook/${requestItem._id || requestItem.id}/approve`, { method: 'POST' }),
    'Re-book request approved.'
  );

  const rejectRebookRequest = (requestItem) => runAction(
    () => request(`/rebook/${requestItem._id || requestItem.id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Rejected by admin from mobile dashboard.' }),
    }),
    'Re-book request rejected.'
  );

  const approveRebookRefund = (requestItem) => runAction(
    () => request(`/rebook/${requestItem._id || requestItem.id}/refund`, { method: 'POST' }),
    'Refund approved.'
  );

  const markRebookSellerNotified = (requestItem) => runAction(
    () => request(`/rebook/${requestItem._id || requestItem.id}/mark-seller-notified`, { method: 'POST' }),
    'Seller notification marked.'
  );

  const loadAnalytics = (options = {}) => runAction(async () => {
    const [overview, serviceRows, payments] = await Promise.all([
      request('/admin/analytics/overview'),
      request('/admin/analytics/services'),
      request('/admin/analytics/payments'),
    ]);
    return { overview, serviceRows, payments };
  }, t('admin.analyticsRefreshed'), { silent: !!options.silent }).then((response) => {
    if (response) setAnalytics(response);
  });

  useEffect(() => {
    if (activeTab === 'insights' && !analytics && !saving) {
      loadAnalytics({ silent: true });
    }
  }, [activeTab, analytics, saving]);

  const providerUsers = useMemo(
    () => users.filter((item) => isServiceProvider(item)),
    [users]
  );
  const visibleUsers = useMemo(() => {
    if (section === 'providers') return users.filter((item) => isServiceProvider(item));
    if (section === 'customers') return users.filter((item) => !isServiceProvider(item) && item.role !== 'admin');
    return users;
  }, [section, users]);
  const visibleBusinesses = useMemo(
    () => businesses.filter((item) => !isDraftListing(item) && matchesServiceFilter(item, section || 'all')),
    [businesses, section]
  );
  const visibleServices = useMemo(
    () => services.filter((item) => !isDraftListing(item)),
    [services]
  );
  const openOverflow = (title, items) => setOverflow({ visible: true, title, items: items.filter(Boolean) });
  const closeOverflow = () => setOverflow({ visible: false, title: 'Actions', items: [] });

  const openBusinessMenu = (business) => {
    const status = reviewStatusOf(business);
    const approved = ['approved', 'posted'].includes(status);
    const rejected = status === 'rejected';
    const canDelete = approved || rejected;
    const id = business._id || business.id;
    openOverflow(business.businessName || business.name || 'Service', [
      { key: 'view', icon: 'eye', label: t('actions.view'), onPress: () => setSelectedBusiness(business) },
      !approved ? { key: 'approve', icon: 'check-circle', label: t('actions.approve'), onPress: () => reviewBusiness(id, 'approved', { confirm: true }) } : null,
      !rejected ? { key: 'reject', icon: 'x-circle', label: t('actions.reject'), onPress: () => reviewBusiness(id, 'rejected', { confirm: true }) } : null,
      business.imageReviewStatus === 'pending_image_review'
        ? { key: 'approve-images', icon: 'image', label: 'Approve images', onPress: () => reviewBusinessImages(id, 'approve') }
        : null,
      business.imageReviewStatus === 'pending_image_review'
        ? { key: 'reject-images', icon: 'slash', label: 'Reject images', onPress: () => reviewBusinessImages(id, 'reject') }
        : null,
      canDelete ? { key: 'delete', icon: 'trash-2', label: t('actions.delete'), destructive: true, onPress: () => deleteBusiness(business) } : null,
    ]);
  };

  const openUserMenu = (account) => {
    openOverflow(account.name || account.email || t('admin.unnamedUser'), [
      { key: 'delete', icon: 'trash-2', label: t('actions.delete'), destructive: true, onPress: () => deleteUser(account) },
    ]);
  };

  const openListingMenu = (service) => {
    const status = String(serviceStatusValue(service)).toLowerCase();
    const approved = ['approved', 'posted', 'available'].includes(status);
    const rejected = status === 'rejected';
    openOverflow(service.title || service.name || t('admin.unnamedUser'), [
      { key: 'review', icon: 'eye', label: t('admin.reviewService'), onPress: () => openServiceReview(service) },
      !approved ? { key: 'approve', icon: 'check-circle', label: t('actions.approve'), onPress: () => reviewService(service._id || service.id, 'approved', { confirm: true }) } : null,
      !rejected ? { key: 'reject', icon: 'x-circle', label: t('actions.reject'), onPress: () => reviewService(service._id || service.id, 'rejected', { confirm: true }) } : null,
    ]);
  };
  const pendingCount = businesses.filter((item) => !isDraftListing(item) && reviewStatusOf(item) === 'pending').length;
  const currentAnnouncement = announcementForm.items?.[0] || { text: '', linkLabel: '', linkUrl: '' };
  const activePage = ADMIN_PAGE_META[activeTab] || ADMIN_PAGE_META.businesses;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.primary]} />}
      >
        {hideChrome ? null : (
        <View style={styles.header}>
          <View style={styles.brandIcon}>
            <Text style={styles.brandIconText}>S</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>SafarisCon</Text>
            <Text style={styles.title}>{activePage.title}</Text>
            <Text style={styles.text}>{activePage.description}</Text>
          </View>
          <TouchableOpacity style={styles.refreshButton} onPress={() => setActiveTab('notifications')} activeOpacity={0.84}>
            <Feather name="bell" size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>
        )}

        {activeTab === 'insights' ? <View style={styles.metrics}>
          <Metric label={t('admin.tabs.users')} value={stats.totalUsers ?? users.length} />
          <Metric label={t('admin.tabs.services')} value={stats.totalServices ?? stats.totalBusinesses ?? visibleBusinesses.length} />
          <Metric label={t('admin.tabs.bookings')} value={stats.totalBookings ?? bookings.length} />
          <Metric label={t('admin.tabs.revenue')} value={formatMoney(stats.totalRevenue || transactionSummary?.totalReceived || 0)} />
          <Metric label="Pending" value={pendingCount} />
        </View> : null}

        {loading ? <ActivityIndicator color={colors.primary} size="large" style={{ marginVertical: 18 }} /> : null}

        {activeTab === 'businesses' && (
          <Section title={t('admin.tabs.services')}>
            {!visibleBusinesses.length && !loading ? <Text style={styles.cardText}>{t('admin.noServices')}</Text> : null}
            {visibleBusinesses.map((business) => {
              const status = reviewStatusOf(business);
              return (
                <View key={business._id || business.id} style={styles.reviewCard}>
                  <TouchableOpacity onPress={() => setSelectedBusiness(business)} activeOpacity={0.88}>
                    <View style={styles.reviewTitleRow}>
                      <Text style={styles.reviewTitle}>{business.businessName || business.name || 'Untitled service'}</Text>
                      <View style={[styles.statusPill, styles[`statusPill${statusTone(status)}`]]}>
                        <Text style={[styles.statusPillText, styles[`statusPillText${statusTone(status)}`]]}>{label(status)}</Text>
                      </View>
                      <MenuTrigger onPress={() => openBusinessMenu(business)} />
                    </View>
                    <Text style={styles.reviewMeta}>{label(business.businessType || business.type || 'Service')}</Text>
                    <Text style={styles.reviewLocation} numberOfLines={2}>
                      {business.location || [business.locationDetails?.district, business.locationDetails?.sector].filter(Boolean).join(', ') || t('common.rwanda')}
                    </Text>
                    <Text style={styles.reviewText} numberOfLines={3}>{business.description || t('admin.noDescription')}</Text>
                    {business.imageReviewStatus === 'pending_image_review' ? <Text style={styles.statusNote}>New images are waiting for review.</Text> : null}
                    {business.imageReviewStatus === 'rejected' ? <Text style={styles.statusNoteDanger}>New images were rejected.</Text> : null}
                  </TouchableOpacity>
                </View>
              );
            })}
          </Section>
        )}

        {activeTab === 'notifications' && (
          <Section title="Notifications">
            <ToggleRow label={t('admin.enabled')} value={announcementForm.enabled} onChange={(value) => setAnnouncementForm((current) => ({ ...current, enabled: value }))} />
            <Field label={t('admin.announcementText')} value={currentAnnouncement.text} onChangeText={(text) => setAnnouncementForm((current) => ({ ...current, items: [{ ...currentAnnouncement, text }] }))} multiline />
            <Field label={t('admin.linkLabel')} value={currentAnnouncement.linkLabel} onChangeText={(linkLabel) => setAnnouncementForm((current) => ({ ...current, items: [{ ...currentAnnouncement, linkLabel }] }))} />
            <Field label={t('admin.linkUrl')} value={currentAnnouncement.linkUrl} onChangeText={(linkUrl) => setAnnouncementForm((current) => ({ ...current, items: [{ ...currentAnnouncement, linkUrl }] }))} autoCapitalize="none" />
            <Field label={t('admin.rotationSeconds')} value={String(announcementForm.intervalSeconds)} onChangeText={(intervalSeconds) => setAnnouncementForm((current) => ({ ...current, intervalSeconds }))} keyboardType="number-pad" />
            <PrimaryButton label={t('admin.saveAnnouncement')} loading={saving} onPress={saveAnnouncement} />
          </Section>
        )}

        {activeTab === 'settings' && (
          <Section title="Settings">
            <Text style={styles.settingsGroupTitle}>Appearance</Text>
            <View style={styles.settingsGrid}>
              {['light', 'dark'].map((themeMode) => {
                const active = mode === themeMode;
                return (
                  <TouchableOpacity key={themeMode} style={[styles.settingChoice, active && styles.settingChoiceActive]} onPress={() => setThemeMode(themeMode)} activeOpacity={0.84}>
                    <Feather name={themeMode === 'dark' ? 'moon' : 'sun'} size={17} color={active ? colors.white : colors.primary} />
                    <Text style={[styles.settingChoiceText, active && styles.settingChoiceTextActive]}>{themeMode === 'dark' ? 'Dark' : 'Light'}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.settingsGroupTitle}>Language</Text>
            <TouchableOpacity style={styles.dropdownField} onPress={() => setLanguageOpen(true)} activeOpacity={0.84}>
              <View style={styles.dropdownLeft}>
                <Feather name="globe" size={17} color={colors.primary} />
                <Text style={styles.dropdownText}>
                  {languages.find((language) => i18n.resolvedLanguage === language.code || i18n.language === language.code)?.nativeName || 'English'}
                </Text>
              </View>
              <Feather name="chevron-down" size={18} color={colors.muted} />
            </TouchableOpacity>

            <Text style={styles.settingsGroupTitle}>{t('admin.tabs.bookingRules')}</Text>
            <ModeSelector value={marketplaceSettings.bookingMode || 'manual'} onChange={(bookingMode) => saveMarketplaceSettings({ ...marketplaceSettings, bookingMode })} />
            <Field label={t('admin.defaultCommission')} value={String(marketplaceSettings.defaultCommissionPercentage ?? 10)} onChangeText={(value) => setMarketplaceSettings((current) => ({ ...current, defaultCommissionPercentage: value }))} keyboardType="number-pad" />
            <Field label={t('admin.rulesOneLine')} value={(marketplaceSettings.bookingRules || []).join('\n')} onChangeText={(text) => setMarketplaceSettings((current) => ({ ...current, bookingRules: text.split('\n') }))} multiline />
            <PrimaryButton label={t('admin.saveRules')} loading={saving} onPress={() => saveMarketplaceSettings()} />

            <Text style={styles.settingsGroupTitle}>Service categories</Text>
            <Text style={styles.cardText}>
              Categories are platform-defined (Accommodation, Transport, Experiences, Dining, Venues). Admin can only activate or deactivate them.
            </Text>
            {serviceCategories.map((category) => (
              <Card key={category._id || category.id || category.slug}>
                <Text style={styles.cardTitle}>{category.name}</Text>
                <Text style={styles.cardMeta}>{(category.domainLabel || category.group || 'Other')} · {category.slug}</Text>
                <Text style={styles.cardText}>
                  {category.inventoryLabelPlural || (category.supportsOptions === false ? 'Single price' : 'Inventory')} · {category.isActive === false ? 'Inactive' : 'Active'}
                </Text>
                <View style={styles.actionRow}>
                  <SmallButton
                    label={category.isActive === false ? 'Reactivate' : 'Deactivate'}
                    tone={category.isActive === false ? 'success' : 'danger'}
                    onPress={() => toggleCategoryActive(category)}
                  />
                </View>
              </Card>
            ))}

            <Text style={styles.settingsGroupTitle}>Policies</Text>
            <PolicyLinks />
          </Section>
        )}

        {activeTab === 'register-business' && (
          <Section title="Service providers">
            <Text style={styles.settingsGroupTitle}>Existing providers</Text>
            {!providerUsers.length ? <Text style={styles.cardText}>No service providers yet.</Text> : null}
            {providerUsers.map((provider) => (
              <Card key={provider._id || provider.id || provider.email}>
                <Text style={styles.cardTitle}>{provider.name || provider.providerName || provider.email || t('admin.unnamedUser')}</Text>
                <Text style={styles.cardMeta}>{provider.email || '-'}</Text>
                <Text style={styles.cardText}>{t('admin.providerId')}: {provider.sellerId || provider.providerId || '-'}</Text>
                <Text style={styles.cardText}>{t('admin.role')}: {label(provider.role)}</Text>
                <Text style={styles.cardText}>Status: {label(provider.businessStatus || provider.businessReviewStatus || provider.status || 'active')}</Text>
                <View style={styles.actionRow}>
                  <SmallButton label="Manage account" onPress={() => setActiveTab('users')} />
                  <SmallButton label={t('actions.delete')} tone="danger" onPress={() => deleteUser(provider)} />
                </View>
              </Card>
            ))}

            {showProviderForm ? (
              <View style={styles.providerFormCard}>
                <Text style={styles.providerFormTitle}>{t('admin.addNewProvider')}</Text>
                <Field label={t('admin.providerName')} value={providerForm.providerName} onChangeText={(providerName) => setProviderForm((current) => ({ ...current, providerName }))} />
                <Field label={t('admin.providerEmail')} value={providerForm.providerEmail} onChangeText={(providerEmail) => setProviderForm((current) => ({ ...current, providerEmail }))} autoCapitalize="none" keyboardType="email-address" />
                <PrimaryButton label={t('admin.createSeller')} loading={saving} onPress={createSeller} />
                <TouchableOpacity style={styles.cancelTextButton} onPress={() => {
                  setShowProviderForm(false);
                  setProviderForm({ providerName: '', providerEmail: '' });
                  setOnboardingCredentials(null);
                }} activeOpacity={0.75}>
                  <Text style={styles.cancelTextButtonLabel}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                {onboardingCredentials ? (
                  <View style={styles.noticeBox}>
                    <Text style={styles.cardTitle}>{t('admin.generatedCredentials')}</Text>
                    <Text style={styles.cardText}>{t('admin.sellerId')}: {onboardingCredentials.sellerId}</Text>
                    <Text style={styles.cardText}>{t('common.password')}: {onboardingCredentials.generatedPassword}</Text>
                  </View>
                ) : null}
              </View>
            ) : (
              <TouchableOpacity style={styles.addProviderButton} onPress={() => setShowProviderForm(true)} activeOpacity={0.84}>
                <Feather name="user-plus" size={16} color={colors.white} />
                <Text style={styles.addProviderButtonText}>{t('admin.addNewProvider')}</Text>
              </TouchableOpacity>
            )}
          </Section>
        )}

        {activeTab === 'users' && (
          <Section title={t('admin.tabs.users')}>
            {section === 'providers' ? (
              <>
                {showProviderForm ? (
                  <View style={styles.providerFormCard}>
                    <Text style={styles.providerFormTitle}>{t('admin.createProviderTitle')}</Text>
                    <Field label={t('admin.providerName')} value={providerForm.providerName} onChangeText={(providerName) => setProviderForm((current) => ({ ...current, providerName }))} />
                    <Field label={t('admin.providerEmail')} value={providerForm.providerEmail} onChangeText={(providerEmail) => setProviderForm((current) => ({ ...current, providerEmail }))} autoCapitalize="none" keyboardType="email-address" />
                    <PrimaryButton label={t('admin.createSeller')} loading={saving} onPress={createSeller} />
                    <TouchableOpacity style={styles.cancelTextButton} onPress={() => {
                      setShowProviderForm(false);
                      setProviderForm({ providerName: '', providerEmail: '' });
                      setOnboardingCredentials(null);
                    }} activeOpacity={0.75}>
                      <Text style={styles.cancelTextButtonLabel}>{t('common.cancel')}</Text>
                    </TouchableOpacity>
                    {onboardingCredentials ? (
                      <View style={styles.noticeBox}>
                        <Text style={styles.cardTitle}>{t('admin.generatedCredentials')}</Text>
                        <Text style={styles.cardText}>{t('admin.sellerId')}: {onboardingCredentials.sellerId}</Text>
                        <Text style={styles.cardText}>{t('common.password')}: {onboardingCredentials.generatedPassword}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <TouchableOpacity style={styles.addProviderButton} onPress={() => setShowProviderForm(true)} activeOpacity={0.84}>
                    <Feather name="user-plus" size={16} color={colors.white} />
                    <Text style={styles.addProviderButtonText}>{t('admin.addNewProvider')}</Text>
                  </TouchableOpacity>
                )}
                <Text style={styles.providerListHeading}>{t('admin.tabs.users')}</Text>
              </>
            ) : null}
            {selectedUserIds.length ? <PrimaryButton label={`Delete selected (${selectedUserIds.length})`} loading={saving} onPress={bulkDeleteUsers} /> : null}
            {visibleUsers.map((account) => {
              const userId = account._id || account.id;
              const selected = selectedUserIds.includes(userId);
              const providerId = providerIdOf(account);
              return (
                <View key={userId} style={styles.userCard}>
                  <TouchableOpacity
                    style={styles.userCheck}
                    onPress={() => setSelectedUserIds((current) => selected ? current.filter((id) => id !== userId) : [...current, userId])}
                    activeOpacity={0.84}
                  >
                    <View style={[styles.checkbox, selected && styles.checkboxActive]}>
                      {selected ? <Feather name="check" size={13} color={colors.white} /> : null}
                    </View>
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <View style={styles.userTitleRow}>
                      <Text style={[styles.cardTitle, { flex: 1 }]}>{account.name || t('admin.unnamedUser')}</Text>
                      <MenuTrigger onPress={() => openUserMenu(account)} />
                    </View>
                    <Text style={styles.cardMeta}>{account.email}</Text>
                    <Text style={styles.cardText}>{t('admin.role')}: {['hotel', 'supplier'].includes(account.role) ? t('admin.provider') : account.role}</Text>
                    {providerId ? <Text style={styles.cardText}>{t('admin.providerId')}: {providerId}</Text> : null}
                  </View>
                </View>
              );
            })}
          </Section>
        )}

        {activeTab === 'services' && (
          <Section title="Booking modes">
            {!services.length && !loading ? <Text style={styles.cardText}>{t('admin.noServices')}</Text> : null}
            {visibleServices.map((service) => (
              <AdminServiceCard
                key={service._id || service.id}
                service={service}
                onReview={() => openServiceReview(service)}
                onOpenMenu={() => openListingMenu(service)}
                onChangeMode={(mode) => updateServiceMode(service, mode)}
              />
            ))}
          </Section>
        )}

        {activeTab === 'bookings' && (!section || section === 'bookings') && (
          <Section title={t('admin.tabs.bookings')}>
            {bookings.map((booking) => (
              <Card key={booking._id || booking.id}>
                <Text style={styles.cardTitle}>{booking.bookingCode || booking._id}</Text>
                <Text style={styles.cardMeta}>{booking.touristId?.name || booking.touristId?.email || t('admin.customer')}</Text>
                <Text style={styles.cardText}>{booking.destinationPlace || booking.bookingDetails?.serviceName || t('customerBookings.booking')} - {label(booking.status)}</Text>
                <Text style={styles.cardText}>{t('admin.payment')}: {label(booking.paymentStatus || 'unpaid')}</Text>
                <SmallButton label={t('actions.viewDecide')} onPress={() => {
                  setSelectedBooking(booking);
                  setDecision({
                    totalPrice: String(booking.totalPrice || booking.bookingDetails?.listedPriceRwf || ''),
                    commissionPercentage: String(booking.commissionPercentage || marketplaceSettings.defaultCommissionPercentage || 10),
                    paymentReason: booking.paymentReason || 'Pay in full. Money is held until the cancel window ends.',
                  });
                }} />
              </Card>
            ))}
          </Section>
        )}

        {activeTab === 'bookings' && section === 'rebook' && (
          <Section title="Manage Re-book Requests">
            {!rebookRequests.length ? <Text style={styles.cardText}>No re-book requests yet.</Text> : null}
            {rebookRequests.map((requestItem) => (
              <Card key={requestItem._id || requestItem.id}>
                <Text style={styles.cardTitle}>{requestItem.serviceId?.name || requestItem.serviceId?.businessName || 'Service'}</Text>
                <Text style={styles.cardMeta}>{requestItem.requestType === 'rebook' ? 'Re-book' : 'Cancel'} - {label(requestItem.status)}</Text>
                <Text style={styles.cardText}>Booking: {requestItem.originalBookingId?.bookingCode || requestItem.originalBookingId?._id || '-'}</Text>
                <Text style={styles.cardText}>Customer: {requestItem.customerId?.name || requestItem.customerId?.email || '-'}</Text>
                <Text style={styles.cardText}>Deadline: {requestItem.deadlineAt ? new Date(requestItem.deadlineAt).toLocaleString() : '-'}</Text>
                <Text style={styles.cardText}>Re-book ID: {requestItem.rebookId || 'Not generated'}</Text>
                <Text style={styles.cardText}>Reason: {requestItem.reason || '-'}</Text>
                <Text style={styles.cardText}>Seller: {requestItem.sellerNotified ? 'Notified' : 'Not notified'} {requestItem.sellerConfirmedUnavailable ? '- unavailable confirmed' : ''}</Text>
                {Array.isArray(requestItem.auditLogs) && requestItem.auditLogs.length ? (
                  <View style={styles.noticeBox}>
                    <Text style={styles.cardTitle}>Timeline</Text>
                    {requestItem.auditLogs.slice(-5).map((log, index) => (
                      <Text key={`${log.event}-${index}`} style={styles.cardText}>{label(log.event)} - {log.at ? new Date(log.at).toLocaleString() : '-'}</Text>
                    ))}
                  </View>
                ) : null}
                <View style={styles.actionRow}>
                  {['pending', 'cancel_requested'].includes(requestItem.status) ? <SmallButton label="Approve" tone="success" onPress={() => approveRebookRequest(requestItem)} /> : null}
                  {['pending', 'cancel_requested'].includes(requestItem.status) ? <SmallButton label={t('actions.reject')} tone="danger" onPress={() => rejectRebookRequest(requestItem)} /> : null}
                  {requestItem.status === 'refund_requested' ? <SmallButton label="Approve refund" tone="success" onPress={() => approveRebookRefund(requestItem)} /> : null}
                  {!requestItem.sellerNotified ? <SmallButton label="Mark seller notified" onPress={() => markRebookSellerNotified(requestItem)} /> : null}
                </View>
              </Card>
            ))}
          </Section>
        )}

        {activeTab === 'bookings' && section === 'verify' && (
          <View style={styles.verifyPage}>
            <View style={styles.verifyHero}>
              <View style={styles.verifyHeroIcon}>
                <Feather name="shield" size={20} color={colors.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.verifyTitle}>{t('admin.verifyBooking')}</Text>
                <Text style={styles.verifySubtitle}>{t('admin.verifyLookup')}</Text>
              </View>
            </View>
            <BookingVerifyForm
              value={verificationLookup}
              onChangeText={setVerificationLookup}
              onVerify={verifyBooking}
              onScan={() => setScannerOpen(true)}
              loading={saving}
              label={t('admin.verifyLookup')}
            />
            {verifiedBooking ? <VerifiedBookingCard booking={verifiedBooking} /> : null}
          </View>
        )}

        {activeTab === 'insights' && (
          <Section title="Insights">
            <View style={styles.insightActions}>
              <PrimaryButton label={t('admin.refreshAnalytics')} loading={saving} onPress={() => loadAnalytics()} />
            </View>
            <View style={styles.metrics}>
              <Metric label={t('admin.views')} value={analytics?.overview?.summary?.views || 0} />
              <Metric label={t('admin.formsOpened')} value={analytics?.overview?.summary?.bookingFormsOpened || 0} />
              <Metric label={t('admin.submitted')} value={analytics?.overview?.summary?.bookingSubmitted || 0} />
              <Metric label={t('admin.payments')} value={analytics?.overview?.summary?.paymentSuccess || 0} />
            </View>
            <View style={styles.metrics}>
              <Metric
                label="View to form"
                value={`${Math.round(((analytics?.overview?.summary?.bookingFormsOpened || 0) / Math.max(1, analytics?.overview?.summary?.views || 0)) * 100)}%`}
              />
              <Metric
                label="Form to booking"
                value={`${Math.round(((analytics?.overview?.summary?.bookingSubmitted || 0) / Math.max(1, analytics?.overview?.summary?.bookingFormsOpened || 0)) * 100)}%`}
              />
              <Metric
                label="Payment success"
                value={`${Math.round(((analytics?.overview?.summary?.paymentSuccess || 0) / Math.max(1, (analytics?.overview?.summary?.paymentSuccess || 0) + (analytics?.overview?.summary?.paymentFailed || 0))) * 100)}%`}
              />
            </View>
            {(analytics?.serviceRows?.services || []).slice(0, 20).map((service) => (
              <Card key={service.serviceId || service.serviceName}>
                <Text style={styles.cardTitle}>{service.serviceName}</Text>
                <Text style={styles.cardText}>{t('admin.views')}: {service.views || 0} - {t('admin.submitted')}: {service.bookingSubmitted || 0} - {t('admin.paid')}: {service.paymentSuccess || 0}</Text>
              </Card>
            ))}
          </Section>
        )}

        {activeTab === 'revenue' && (
          <Section title="Revenue">
            <View style={styles.metrics}>
              <Metric label="Gross booking payments" value={formatMoney(transactionSummary?.totalReceived || stats.totalRevenue || 0)} />
              <Metric label="Platform revenue" value={formatMoney(transactionSummary?.commissionEarned || 0)} />
              <Metric label="Provider payables" value={formatMoney(transactionSummary?.providerPayables || transactionSummary?.payoutsDue || 0)} />
              <Metric label="Pending payouts" value={formatMoney(transactionSummary?.pendingPayouts || transactionSummary?.commissionDue || 0)} />
            </View>
            {transactions.map((tx) => (
              <Card key={tx._id || tx.transactionId}>
                <Text style={styles.cardTitle}>{tx.transactionId || tx._id}</Text>
                <Text style={styles.cardText}>{t('admin.payment')}: {formatMoney(tx.amount)} - {t('admin.commission')}: {formatMoney(tx.commissionAmount)}</Text>
                <Text style={styles.cardText}>Commission status: {label(tx.commissionStatus || 'due')}</Text>
                <View style={styles.actionRow}>
                  <SmallButton label="Mark collected" tone="success" onPress={() => markCommissionCollected(tx)} />
                  {tx.payoutId || tx._id ? <SmallButton label="Sync payout" onPress={() => syncPayout(tx)} /> : null}
                </View>
              </Card>
            ))}
          </Section>
        )}

      </ScrollView>

      <LanguagePickerModal
        visible={languageOpen}
        onClose={() => setLanguageOpen(false)}
        currentLanguage={i18n.resolvedLanguage || i18n.language}
        onSelect={(languageCode) => {
          setAppLanguage(languageCode);
          setLanguageOpen(false);
        }}
      />

      <BusinessModal business={selectedBusiness} onClose={() => setSelectedBusiness(null)} />
      <ServiceDetailsView
        visible={Boolean(selectedService)}
        service={selectedService}
        loading={saving}
        showProvider
        showPrivateFields
        title="Service review"
        onClose={() => setSelectedService(null)}
        footer={(
          <View style={{ gap: 10 }}>
            <Text style={styles.settingsGroupTitle}>Agreement terms (required to approve)</Text>
            <Field
              label="Cancel window (hours)"
              value={String(approvalForm.cancelWindowHours)}
              onChangeText={(cancelWindowHours) => setApprovalForm((current) => ({ ...current, cancelWindowHours }))}
              keyboardType="number-pad"
            />
            <Field
              label="Cancel penalty %"
              value={String(approvalForm.cancelPenaltyPercent)}
              onChangeText={(cancelPenaltyPercent) => setApprovalForm((current) => ({ ...current, cancelPenaltyPercent }))}
              keyboardType="number-pad"
            />
            <Field
              label="Platform commission %"
              value={String(approvalForm.platformCommissionPercent)}
              onChangeText={(platformCommissionPercent) => setApprovalForm((current) => ({ ...current, platformCommissionPercent }))}
              keyboardType="number-pad"
            />
            <Field
              label="Notes"
              value={approvalForm.notes}
              onChangeText={(notes) => setApprovalForm((current) => ({ ...current, notes }))}
            />
            <Field
              label="Reject reason"
              value={approvalForm.reason}
              onChangeText={(reason) => setApprovalForm((current) => ({ ...current, reason }))}
            />
            <View style={styles.actionRow}>
              <SmallButton label={t('actions.approve')} tone="success" onPress={() => reviewService(selectedService?._id || selectedService?.id, 'approved').then((response) => { if (response) setSelectedService(null); })} />
              <SmallButton label={t('actions.reject')} tone="danger" onPress={() => {
                const serviceId = selectedService?._id || selectedService?.id;
                askConfirm({
                  title: 'Reject this service?',
                  message: 'The service provider will be notified and the listing will be rejected.',
                  confirmLabel: t('actions.reject'),
                  destructive: true,
                  onConfirm: () => {
                    closeDialog();
                    reviewService(serviceId, 'rejected').then((response) => { if (response) setSelectedService(null); });
                  },
                });
              }} />
            </View>
          </View>
        )}
      />
      <BookingQrScanner
        visible={scannerOpen}
        title={t('admin.verifyBooking')}
        onClose={() => setScannerOpen(false)}
        onScan={handleQrScan}
      />
      <BookingDecisionModal
        booking={selectedBooking}
        decision={decision}
        setDecision={setDecision}
        saving={saving}
        onClose={() => setSelectedBooking(null)}
        onApprove={approveBooking}
        onReject={rejectBooking}
      />
      <OverflowMenu
        visible={overflow.visible}
        title={overflow.title}
        items={overflow.items}
        onClose={closeOverflow}
      />
      {dialogNode}
    </View>
  );
}

function LanguagePickerModal({ visible, currentLanguage, onClose, onSelect }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.dropdownBackdrop} activeOpacity={1} onPress={onClose}>
        <View style={styles.dropdownSheet}>
          <Text style={styles.dropdownTitle}>Change language</Text>
          {languages.map((language) => {
            const active = currentLanguage === language.code;
            return (
              <TouchableOpacity key={language.code} style={[styles.languageOption, active && styles.languageOptionActive]} onPress={() => onSelect(language.code)} activeOpacity={0.84}>
                <Text style={[styles.languageOptionCode, active && styles.languageOptionTextActive]}>{language.shortLabel}</Text>
                <Text style={[styles.languageOptionText, active && styles.languageOptionTextActive]}>{language.nativeName}</Text>
                {active ? <Feather name="check" size={17} color={colors.white} /> : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Card({ children }) {
  return <View style={styles.card}>{children}</View>;
}

function serviceImageUri(service) {
  if (Array.isArray(service?.images) && service.images[0]) return service.images[0];
  return service?.coverImage || service?.image || service?.thumbnail || null;
}

function serviceProviderName(service) {
  return service?.businessName || service?.hotelName || service?.providerName || service?.sellerName || service?.ownerName || '';
}

function serviceLocationText(service) {
  return [
    service?.generalLocation,
    service?.serviceLocation?.city,
    service?.serviceLocation?.country,
    service?.location,
  ].filter(Boolean).join(' · ');
}

function serviceStatusValue(service) {
  return service?.status || service?.approvalStatus || 'available';
}

function statusTone(status) {
  const value = String(status || '').toLowerCase();
  if (['unavailable', 'rejected', 'inactive', 'blocked'].includes(value)) return 'danger';
  if (value.includes('pending') || value.includes('review')) return 'warning';
  return 'success';
}

function AdminServiceCard({ service, onReview, onChangeMode, onOpenMenu }) {
  const { t } = useTranslation();
  const imageUri = serviceImageUri(service);
  const status = serviceStatusValue(service);
  const tone = statusTone(status);
  const remaining = service.availabilityText || service.availableQuantity || service.quantityRemaining || 0;
  const providerName = serviceProviderName(service);
  const locationText = serviceLocationText(service);

  return (
    <View style={styles.serviceCard}>
      <TouchableOpacity style={styles.serviceTop} onPress={onReview} activeOpacity={0.88}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.serviceThumb} />
        ) : (
          <View style={styles.serviceThumbFallback}>
            <Feather name="layers" size={22} color={colors.primary} />
          </View>
        )}
        <View style={styles.serviceBody}>
          <View style={styles.serviceTitleRow}>
            <Text style={styles.serviceTitle} numberOfLines={2}>{service.title || service.name || t('admin.unnamedUser')}</Text>
            <View style={[styles.statusPill, styles[`statusPill${tone}`]]}>
              <Text style={[styles.statusPillText, styles[`statusPillText${tone}`]]}>{label(status)}</Text>
            </View>
            {onOpenMenu ? <MenuTrigger onPress={onOpenMenu} /> : null}
          </View>
          <Text style={styles.serviceCategory} numberOfLines={1}>{label(service.categoryName || service.categorySlug || service.serviceType || service.category || t('common.services'))}</Text>
          {providerName ? <Text style={styles.serviceProvider} numberOfLines={1}>{providerName}</Text> : null}
          {locationText ? <Text style={styles.serviceLocation} numberOfLines={1}>{locationText}</Text> : null}
          <View style={styles.serviceMetaRow}>
            <View style={styles.remainingChip}>
              <Feather name="package" size={12} color={colors.muted} />
              <Text style={styles.remainingChipText}>{t('seller.remaining', { count: remaining })}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>

      <View style={styles.serviceModeBlock}>
        <Text style={styles.serviceModeLabel}>{t('admin.bookingMode')}</Text>
        <ModeSelector value={service.bookingMode || 'manual'} onChange={onChangeMode} compact />
      </View>
    </View>
  );
}

function Metric({ label, value }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function Badge({ value }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{label(value)}</Text>
    </View>
  );
}

function SmallButton({ label: text, tone = 'primary', onPress }) {
  return (
    <TouchableOpacity style={[styles.smallButton, styles[`${tone}SmallButton`]]} onPress={onPress} activeOpacity={0.84}>
      <Text style={[styles.smallButtonText, tone === 'primary' && { color: colors.white }]}>{text}</Text>
    </TouchableOpacity>
  );
}

function PrimaryButton({ label: text, loading, onPress }) {
  return (
    <TouchableOpacity style={[styles.primaryButton, loading && { opacity: 0.7 }]} onPress={onPress} disabled={loading} activeOpacity={0.86}>
      {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>{text}</Text>}
    </TouchableOpacity>
  );
}

function Field({ label: fieldLabel, multiline, ...props }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{fieldLabel}</Text>
      <TextInput placeholderTextColor={colors.muted} style={[styles.input, multiline && styles.textArea]} multiline={multiline} {...props} />
    </View>
  );
}

function ToggleRow({ label: rowLabel, value, onChange }) {
  return (
    <TouchableOpacity style={styles.toggleRow} onPress={() => onChange(!value)} activeOpacity={0.84}>
      <View style={[styles.checkbox, value && styles.checkboxActive]}>
        {value ? <Feather name="check" size={13} color={colors.white} /> : null}
      </View>
      <Text style={styles.toggleLabel}>{rowLabel}</Text>
    </TouchableOpacity>
  );
}

function ModeSelector({ value, onChange, compact }) {
  const { t } = useTranslation();
  const modeLabel = (mode) => {
    if (mode === 'manual') return t('admin.manual');
    if (mode === 'automatic') return t('admin.automatic');
    return t('admin.serviceLevel');
  };

  return (
    <View style={compact ? styles.modeTrack : styles.modeRow}>
      {['manual', 'automatic', 'service-level'].filter((mode) => !compact || mode !== 'service-level').map((mode) => (
        <TouchableOpacity
          key={mode}
          style={[compact ? styles.modeChip : styles.modeButton, value === mode && (compact ? styles.modeChipActive : styles.modeActive)]}
          onPress={() => onChange(mode)}
          activeOpacity={0.84}
        >
          <Text style={[compact ? styles.modeChipText : styles.modeText, value === mode && styles.modeTextActive]}>{modeLabel(mode)}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function BusinessModal({ business, onClose }) {
  const { t } = useTranslation();
  if (!business) return null;
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalScreen}>
        <ScrollView contentContainerStyle={styles.modalContent}>
          <ModalHeader title="Service details" onClose={onClose} />
          <Detail label={t('admin.name')} value={business.businessName || business.name} />
          <Detail label={t('admin.type')} value={business.businessType || business.type} />
          <Detail label={t('admin.status')} value={business.approvalStatus || business.verificationStatus || business.status} />
          <Detail label="Image review" value={business.imageReviewStatus || 'none'} />
          <Detail label="Image rejection reason" value={business.imageReviewRejectedReason || '-'} />
          <Detail label={t('admin.location')} value={business.location || [business.locationDetails?.district, business.locationDetails?.sector].filter(Boolean).join(', ')} />
          <Detail label={t('admin.descriptionLabel')} value={business.description} />
          <Detail label={t('admin.payout')} value={business.payoutDetails?.accountNumber || '-'} />
          {Array.isArray(business.images) && business.images.length ? (
            <View style={styles.previewRow}>
              {business.images.slice(0, 3).map((image) => <Image key={image} source={{ uri: image }} style={styles.previewImage} />)}
            </View>
          ) : null}
          {Array.isArray(business.pendingImages) && business.pendingImages.length ? (
            <>
              <Text style={styles.fieldLabel}>Pending images for review</Text>
              <View style={styles.previewRow}>
                {business.pendingImages.slice(0, 3).map((image) => <Image key={image} source={{ uri: image }} style={[styles.previewImage, styles.pendingPreviewImage]} />)}
              </View>
            </>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

function BookingDecisionModal({ booking, decision, setDecision, saving, onClose, onApprove, onReject }) {
  const { t } = useTranslation();
  if (!booking) return null;
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalScreen}>
        <ScrollView contentContainerStyle={styles.modalContent}>
          <ModalHeader title={t('admin.bookingDecision')} onClose={onClose} />
          <Detail label={t('admin.booking')} value={booking.bookingCode || booking._id} />
          <Detail label={t('admin.customer')} value={booking.touristId?.name || booking.touristId?.email || '-'} />
          <Detail label={t('admin.service')} value={booking.destinationPlace || booking.bookingDetails?.serviceName || '-'} />
          <Detail label={t('admin.status')} value={booking.status} />
          <BookingDetailCards details={booking.bookingDetails} />
          <Field label={t('admin.totalPrice')} value={decision.totalPrice} onChangeText={(totalPrice) => setDecision((current) => ({ ...current, totalPrice }))} keyboardType="number-pad" />
          <Field label={t('admin.commissionPercent')} value={decision.commissionPercentage} onChangeText={(commissionPercentage) => setDecision((current) => ({ ...current, commissionPercentage }))} keyboardType="number-pad" />
          <Field label={t('admin.paymentReason')} value={decision.paymentReason} onChangeText={(paymentReason) => setDecision((current) => ({ ...current, paymentReason }))} multiline />
          <View style={styles.actionRow}>
            <SmallButton label={t('actions.approve')} tone="success" onPress={onApprove} />
            <SmallButton label={t('actions.reject')} tone="danger" onPress={onReject} />
          </View>
          {saving ? <ActivityIndicator color={colors.primary} style={{ marginTop: 12 }} /> : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

function ModalHeader({ title, onClose }) {
  return (
    <View style={styles.modalHeader}>
      <Text style={styles.modalTitle}>{title}</Text>
      <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.84}>
        <Feather name="x" size={18} color={colors.text} />
      </TouchableOpacity>
    </View>
  );
}

function Detail({ label: detailLabel, value }) {
  return (
    <View style={styles.detailBox}>
      <Text style={styles.detailLabel}>{detailLabel}</Text>
      <Text style={styles.detailValue}>{String(value || '-')}</Text>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingTop: 12, paddingBottom: 24 },
  header: { alignItems: 'flex-start', flexDirection: 'row', gap: 10 },
  brandIcon: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 10, height: 38, justifyContent: 'center', width: 38 },
  brandIconText: { color: colors.white, fontSize: 18, fontWeight: '900' },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  title: { color: colors.text, fontSize: 25, fontWeight: '900', marginTop: 4 },
  text: { color: colors.muted, fontSize: 13, fontWeight: '700', lineHeight: 19, marginTop: 5 },
  refreshButton: { alignItems: 'center', backgroundColor: colors.primaryLight, borderRadius: 10, height: 38, justifyContent: 'center', width: 38 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8, marginBottom: 4 },
  metricCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 14, borderWidth: 1, flexGrow: 1, minWidth: '47%', padding: 16 },
  metricLabel: { color: colors.muted, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  metricValue: { color: colors.primary, fontSize: 20, fontWeight: '900', marginTop: 8 },
  tabs: { gap: 8, paddingVertical: 14 },
  tabButton: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9 },
  tabButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { color: colors.text, fontSize: 12, fontWeight: '900' },
  tabTextActive: { color: colors.white },
  section: { paddingTop: 14 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '900', marginBottom: 12 },
  insightSubTitle: { color: colors.textStrong, fontSize: 14, fontWeight: '900', marginTop: 18, marginBottom: 4 },
  insightActions: { marginBottom: 14 },
  createForm: { marginBottom: 18, paddingBottom: 6 },
  providerFormCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
    padding: 16,
  },
  providerFormTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 4,
  },
  addProviderButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 20,
    minHeight: 48,
  },
  addProviderButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '900',
  },
  cancelTextButton: {
    alignItems: 'center',
    marginTop: 10,
    paddingVertical: 6,
  },
  cancelTextButtonLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
  },
  providerListHeading: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  userTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  statusNote: { color: colors.warning, fontSize: 12, fontWeight: '700', marginTop: 8 },
  statusNoteDanger: { color: colors.danger, fontSize: 12, fontWeight: '700', marginTop: 8 },
  card: { backgroundColor: colors.surface, borderRadius: 8, marginBottom: 10, padding: 12 },
  cardTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  cardMeta: { color: colors.primaryDark, fontSize: 12, fontWeight: '800', marginTop: 3 },
  cardText: { color: colors.text, fontSize: 12, fontWeight: '700', lineHeight: 18, marginTop: 5 },
  badge: { alignSelf: 'flex-start', backgroundColor: colors.primaryLight, borderRadius: 999, marginTop: 9, paddingHorizontal: 9, paddingVertical: 5 },
  badgeText: { color: colors.primaryDark, fontSize: 10, fontWeight: '900' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  smallButton: { alignItems: 'center', borderRadius: 8, minHeight: 36, justifyContent: 'center', paddingHorizontal: 11, paddingVertical: 8 },
  primaryButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 12, minHeight: 46, justifyContent: 'center', marginTop: 16 },
  primaryButtonText: { color: colors.white, fontSize: 13, fontWeight: '900' },
  primarySmallButton: { backgroundColor: colors.primary },
  successSmallButton: { backgroundColor: colors.successSurface },
  dangerSmallButton: { backgroundColor: colors.dangerSurface },
  mutedSmallButton: { backgroundColor: colors.surfaceMuted },
  smallButtonText: { color: colors.text, fontSize: 12, fontWeight: '900' },
  verifyPage: { paddingTop: 0 },
  verifyHero: { alignItems: 'center', flexDirection: 'row', gap: 12, marginBottom: 14 },
  verifyHeroIcon: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 14, height: 44, justifyContent: 'center', width: 44 },
  verifyTitle: { color: colors.textStrong || colors.text, fontSize: 22, fontWeight: '900' },
  verifySubtitle: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 2 },
  infoText: { backgroundColor: colors.successSurface, borderRadius: 8, color: colors.success, fontSize: 12, fontWeight: '900', marginBottom: 10, padding: 10 },
  errorText: { backgroundColor: colors.dangerSurface, borderRadius: 8, color: colors.danger, fontSize: 12, fontWeight: '900', marginBottom: 10, padding: 10 },
  fieldWrap: { marginTop: 10 },
  fieldLabel: { color: colors.text, fontSize: 11, fontWeight: '900', marginBottom: 5 },
  input: { ...baseInputStyle(colors), borderRadius: 8, borderWidth: 1, fontSize: 13, fontWeight: '700', minHeight: 42, paddingHorizontal: 11, paddingVertical: 9 },
  textArea: { minHeight: 92, textAlignVertical: 'top' },
  toggleRow: { alignItems: 'center', flexDirection: 'row', gap: 9, marginTop: 10 },
  checkbox: { alignItems: 'center', borderColor: colors.border, borderRadius: 5, borderWidth: 1, height: 22, justifyContent: 'center', width: 22 },
  checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  toggleLabel: { color: colors.text, fontSize: 13, fontWeight: '800' },
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  modeButton: { borderColor: colors.border, borderRadius: 8, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 8 },
  modeActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  modeText: { color: colors.text, fontSize: 12, fontWeight: '900' },
  modeTextActive: { color: colors.white },
  modeTrack: { backgroundColor: colors.surfaceMuted, borderRadius: 10, flexDirection: 'row', padding: 4 },
  modeChip: { alignItems: 'center', borderRadius: 8, flex: 1, minHeight: 36, justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 8 },
  modeChipActive: { backgroundColor: colors.primary },
  modeChipText: { color: colors.muted, fontSize: 12, fontWeight: '900' },
  serviceCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 14, borderWidth: 1, marginBottom: 12, overflow: 'hidden', padding: 12 },
  serviceTop: { flexDirection: 'row', gap: 12 },
  serviceThumb: { backgroundColor: colors.surfaceMuted, borderRadius: 12, height: 84, width: 84 },
  serviceThumbFallback: { alignItems: 'center', backgroundColor: colors.primaryLight, borderRadius: 12, height: 84, justifyContent: 'center', width: 84 },
  serviceBody: { flex: 1, minWidth: 0 },
  serviceTitleRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 8 },
  serviceTitle: { color: colors.text, flex: 1, fontSize: 16, fontWeight: '900' },
  serviceCategory: { color: colors.muted, fontSize: 12, fontWeight: '800', marginTop: 4, textTransform: 'capitalize' },
  serviceProvider: { color: colors.text, fontSize: 12, fontWeight: '700', marginTop: 3 },
  serviceLocation: { color: colors.muted, fontSize: 11, fontWeight: '700', marginTop: 2 },
  serviceMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  remainingChip: { alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: 999, flexDirection: 'row', gap: 5, paddingHorizontal: 9, paddingVertical: 5 },
  remainingChipText: { color: colors.text, fontSize: 11, fontWeight: '800' },
  statusPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  statusPillsuccess: { backgroundColor: colors.successSurface },
  statusPillwarning: { backgroundColor: colors.warningSurface },
  statusPilldanger: { backgroundColor: colors.dangerSurface },
  statusPillText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  statusPillTextsuccess: { color: colors.success },
  statusPillTextwarning: { color: colors.warning },
  statusPillTextdanger: { color: colors.danger },
  serviceModeBlock: { borderTopColor: colors.border, borderTopWidth: 1, marginTop: 12, paddingTop: 12 },
  serviceModeLabel: { color: colors.muted, fontSize: 10, fontWeight: '900', marginBottom: 8, textTransform: 'uppercase' },
  reviewButton: { alignItems: 'center', backgroundColor: colors.primaryLight, borderRadius: 10, flexDirection: 'row', justifyContent: 'center', marginTop: 10, minHeight: 42, paddingHorizontal: 12 },
  reviewButtonText: { color: colors.primaryDark, fontSize: 13, fontWeight: '900' },
  reviewCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 14, borderWidth: 1, marginBottom: 12, padding: 14 },
  reviewTitleRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 8 },
  reviewTitle: { color: colors.text, flex: 1, fontSize: 16, fontWeight: '900' },
  reviewMeta: { color: colors.muted, fontSize: 12, fontWeight: '800', marginTop: 6, textTransform: 'capitalize' },
  reviewLocation: { color: colors.text, fontSize: 12, fontWeight: '700', lineHeight: 18, marginTop: 4 },
  reviewText: { color: colors.muted, fontSize: 12, fontWeight: '700', lineHeight: 18, marginTop: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  actionChip: { alignItems: 'center', borderRadius: 999, flexDirection: 'row', gap: 6, minHeight: 38, paddingHorizontal: 12, paddingVertical: 8 },
  actionChipText: { fontSize: 12, fontWeight: '900' },
  userCard: { alignItems: 'flex-start', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 12, marginBottom: 10, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1 },
  userCheck: { paddingTop: 2 },
  noticeBox: { backgroundColor: colors.primaryLight, borderRadius: 8, marginTop: 12, padding: 12 },
  settingsGroupTitle: { color: colors.text, fontSize: 13, fontWeight: '900', marginTop: 14, marginBottom: 8 },
  settingsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  settingChoice: { alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: 8, flexDirection: 'row', gap: 7, minHeight: 44, paddingHorizontal: 12, width: '48%' },
  settingChoiceActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  settingChoiceText: { color: colors.text, fontSize: 12, fontWeight: '900' },
  settingChoiceTextActive: { color: colors.white },
  dropdownField: { alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', minHeight: 48, paddingHorizontal: 12 },
  dropdownLeft: { alignItems: 'center', flexDirection: 'row', gap: 9 },
  dropdownText: { color: colors.text, fontSize: 13, fontWeight: '900' },
  dropdownBackdrop: { alignItems: 'center', backgroundColor: 'rgba(2, 6, 23, 0.36)', flex: 1, justifyContent: 'center', padding: 22 },
  dropdownSheet: { backgroundColor: colors.surface, borderRadius: 16, padding: 14, width: '100%' },
  dropdownTitle: { color: colors.textStrong, fontSize: 16, fontWeight: '900', marginBottom: 8 },
  languageOption: { alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: 10, flexDirection: 'row', gap: 10, marginTop: 8, minHeight: 48, paddingHorizontal: 12 },
  languageOptionActive: { backgroundColor: colors.primary },
  languageOptionCode: { color: colors.primary, fontSize: 12, fontWeight: '900', width: 34 },
  languageOptionText: { color: colors.text, flex: 1, fontSize: 14, fontWeight: '900' },
  languageOptionTextActive: { color: colors.white },
  modalScreen: { flex: 1, backgroundColor: colors.background },
  modalContent: { padding: 16, paddingTop: 44, paddingBottom: 28 },
  modalHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: '900' },
  closeButton: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, height: 34, justifyContent: 'center', width: 34 },
  previewRow: { flexDirection: 'row', gap: 8, marginBottom: 12, marginTop: 4 },
  previewImage: { backgroundColor: colors.border, borderRadius: 8, height: 92, width: 92 },
  pendingPreviewImage: { borderColor: '#F59E0B', borderWidth: 2 },
  detailBox: { backgroundColor: colors.surface, borderRadius: 8, marginBottom: 9, padding: 12 },
  detailLabel: { color: colors.muted, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  detailValue: { color: colors.text, fontSize: 13, fontWeight: '800', lineHeight: 18, marginTop: 5 },
});
