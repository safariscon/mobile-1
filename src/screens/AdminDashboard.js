import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import BookingQrScanner from '../components/BookingQrScanner';
import { lightColors } from '../theme/colors';
import useThemedStyles from '../theme/useThemedStyles';

let colors = lightColors;
let styles;

const ADMIN_TABS = [
  ['businesses', 'admin.tabs.businesses'],
  ['announcement', 'admin.tabs.announcement'],
  ['booking-rules', 'admin.tabs.bookingRules'],
  ['register-business', 'admin.tabs.addSeller'],
  ['users', 'admin.tabs.users'],
  ['services', 'admin.tabs.services'],
  ['bookings', 'admin.tabs.bookings'],
  ['rebook-requests', 'admin.tabs.rebookRequests'],
  ['verification', 'admin.tabs.verification'],
  ['revenue', 'admin.tabs.revenue'],
  ['analytics', 'admin.tabs.analytics'],
  ['storage', 'admin.tabs.storage'],
  ['activity', 'admin.tabs.activity'],
];

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

function extractBookingLookup(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const verifyMatch = text.match(/\/verify\/([^/?#]+)/i);
  if (verifyMatch?.[1]) return decodeURIComponent(verifyMatch[1]);
  return text.replace(/^.*\/verify\//i, '').trim();
}

async function readJson(response) {
  return response.json().catch(() => ({}));
}

export default function AdminDashboard({ tab }) {
  const themed = useThemedStyles(createStyles);
  colors = themed.colors;
  styles = themed.styles;
  const { t } = useTranslation();
  const { token, isAuthenticated } = useAuth();
  const defaultMarketplaceSettings = useMemo(() => ({
    ...DEFAULT_SETTINGS,
    bookingRules: [t('admin.defaultRuleAccurate'), t('admin.defaultRuleBalance')],
  }), [t]);
  const [activeTab, setActiveTab] = useState(tab === 'stats' ? 'analytics' : 'businesses');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
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
  const [onboardingCredentials, setOnboardingCredentials] = useState(null);
  const [verificationLookup, setVerificationLookup] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [verifiedBooking, setVerifiedBooking] = useState(null);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [decision, setDecision] = useState({ totalPrice: '', commissionPercentage: '10', paymentReason: t('admin.defaultPaymentReason') });
  const [analytics, setAnalytics] = useState(null);
  const [storage, setStorage] = useState(null);

  useEffect(() => {
    setActiveTab(tab === 'stats' ? 'analytics' : 'businesses');
  }, [tab]);

  const request = useCallback(async (path, options = {}) => {
    const response = await apiFetch(path, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await readJson(response);
    if (!response.ok) throw new Error(t('backend.returned', { status: response.status }));
    return data;
  }, [token]);

  const loadData = useCallback(async (silent = false) => {
    if (!isAuthenticated || !token) return;
    if (!silent) setLoading(true);
    setError('');
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
    } catch (requestError) {
      setError(t('admin.loadFailed'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [defaultMarketplaceSettings, isAuthenticated, request, t, token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const refresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const runAction = async (action, successMessage) => {
    setSaving(true);
    setError('');
    setInfo('');
    try {
      const response = await action();
      setInfo(successMessage || t('admin.saved'));
      await loadData(true);
      return response;
    } catch (requestError) {
      setError(t('admin.actionFailed'));
      return null;
    } finally {
      setSaving(false);
    }
  };

  const reviewBusiness = (businessId, status) => runAction(
    () => request(`/admin/businesses/${businessId}/verification`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }),
    status === 'approved' ? t('admin.businessPosted') : t('admin.businessRejected')
  );

  const reviewBusinessImages = (businessId, action) => runAction(
    () => request(`/admin/businesses/${businessId}/image-review`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    }),
    action === 'approve' ? 'Business images approved and published.' : 'Business images rejected.'
  );

  const deleteBusiness = (businessId) => {
    Alert.alert(t('admin.deleteBusinessTitle'), t('admin.deleteBusinessText'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('actions.delete'), style: 'destructive', onPress: () => runAction(() => request(`/admin/businesses/${businessId}`, { method: 'DELETE' }), t('admin.businessDeleted')) },
    ]);
  };

  const deleteUser = (userId) => {
    Alert.alert(t('admin.deleteUserTitle'), t('admin.deleteUserText'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('actions.delete'), style: 'destructive', onPress: () => runAction(() => request(`/admin/users/${userId}`, { method: 'DELETE' }), t('admin.userDeleted')) },
    ]);
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
      () => request(`/admin/booking-verification/${encodeURIComponent(lookup)}`),
      t('admin.bookingFound')
    ).then((response) => {
      if (response?.booking) setVerifiedBooking(response.booking);
      return response;
    });
  };

  const verifyBooking = () => verifyBookingLookup(verificationLookup);

  const handleQrScan = (data) => verifyBookingLookup(data);

  const markCommissionCollected = (transaction) => runAction(
    () => request(`/admin/transactions/${transaction._id}/commission`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commissionStatus: 'collected' }),
    }),
    t('admin.commissionCollected')
  );

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

  const loadStorage = () => runAction(
    () => request('/admin/storage/overview'),
    t('admin.storageRefreshed')
  ).then((response) => {
    if (response) setStorage(response);
  });

  const loadAnalytics = () => runAction(async () => {
    const [overview, serviceRows, payments] = await Promise.all([
      request('/admin/analytics/overview'),
      request('/admin/analytics/services'),
      request('/admin/analytics/payments'),
    ]);
    return { message: t('admin.analyticsRefreshed'), overview, serviceRows, payments };
  }).then((response) => {
    if (response) setAnalytics(response);
  });

  const revenueByType = useMemo(() => bookings.reduce((acc, booking) => {
    const type = booking.businessId?.businessType || booking.businessType || 'marketplace';
    acc[type] = (acc[type] || 0) + Number(booking.totalPrice || 0);
    return acc;
  }, {}), [bookings]);

  const currentAnnouncement = announcementForm.items?.[0] || { text: '', linkLabel: '', linkUrl: '' };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.primary]} />}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>{t('admin.eyebrow')}</Text>
            <Text style={styles.title}>{t('admin.title')}</Text>
            <Text style={styles.text}>{t('admin.description')}</Text>
          </View>
          <TouchableOpacity style={styles.refreshButton} onPress={() => loadData()} activeOpacity={0.84}>
            <Feather name="refresh-cw" size={15} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.metrics}>
          <Metric label={t('admin.tabs.users')} value={stats.totalUsers ?? users.length} />
          <Metric label={t('admin.tabs.businesses')} value={stats.totalBusinesses ?? businesses.length} />
          <Metric label={t('admin.tabs.bookings')} value={stats.totalBookings ?? bookings.length} />
          <Metric label={t('admin.tabs.revenue')} value={formatMoney(stats.totalRevenue || transactionSummary?.totalReceived || 0)} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {ADMIN_TABS.map(([key, titleKey]) => (
            <TouchableOpacity key={key} style={[styles.tabButton, activeTab === key && styles.tabButtonActive]} onPress={() => setActiveTab(key)} activeOpacity={0.84}>
              <Text style={[styles.tabText, activeTab === key && styles.tabTextActive]}>{t(titleKey)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {!!info && <Text style={styles.infoText}>{info}</Text>}
        {!!error && <Text style={styles.errorText}>{error}</Text>}
        {loading ? <ActivityIndicator color={colors.primary} size="large" style={{ marginVertical: 18 }} /> : null}

        {activeTab === 'businesses' && (
          <Section title={t('admin.tabs.businesses')}>
            {businesses.map((business) => (
              <Card key={business._id || business.id}>
                <Text style={styles.cardTitle}>{business.businessName || business.name}</Text>
                <Text style={styles.cardMeta}>{business.businessType || business.type} - {business.location || business.locationDetails?.district || t('common.rwanda')}</Text>
                <Text style={styles.cardText}>{business.description || t('admin.noDescription')}</Text>
                <Badge value={business.approvalStatus || business.verificationStatus || business.status || 'pending'} />
                {business.imageReviewStatus === 'pending_image_review' ? <Badge value="pending image review" /> : null}
                {business.imageReviewStatus === 'rejected' ? <Badge value="images rejected" /> : null}
                <View style={styles.actionRow}>
                  <SmallButton label={t('actions.view')} onPress={() => setSelectedBusiness(business)} />
                  <SmallButton label={t('actions.post')} tone="success" onPress={() => reviewBusiness(business._id || business.id, 'approved')} />
                  <SmallButton label={t('actions.reject')} tone="danger" onPress={() => reviewBusiness(business._id || business.id, 'rejected')} />
                  {business.imageReviewStatus === 'pending_image_review' ? <SmallButton label="Approve images" tone="success" onPress={() => reviewBusinessImages(business._id || business.id, 'approve')} /> : null}
                  {business.imageReviewStatus === 'pending_image_review' ? <SmallButton label="Reject images" tone="danger" onPress={() => reviewBusinessImages(business._id || business.id, 'reject')} /> : null}
                  <SmallButton label={t('actions.delete')} tone="muted" onPress={() => deleteBusiness(business._id || business.id)} />
                </View>
              </Card>
            ))}
          </Section>
        )}

        {activeTab === 'announcement' && (
          <Section title={t('admin.tabs.announcement')}>
            <ToggleRow label={t('admin.enabled')} value={announcementForm.enabled} onChange={(value) => setAnnouncementForm((current) => ({ ...current, enabled: value }))} />
            <Field label={t('admin.announcementText')} value={currentAnnouncement.text} onChangeText={(text) => setAnnouncementForm((current) => ({ ...current, items: [{ ...currentAnnouncement, text }] }))} multiline />
            <Field label={t('admin.linkLabel')} value={currentAnnouncement.linkLabel} onChangeText={(linkLabel) => setAnnouncementForm((current) => ({ ...current, items: [{ ...currentAnnouncement, linkLabel }] }))} />
            <Field label={t('admin.linkUrl')} value={currentAnnouncement.linkUrl} onChangeText={(linkUrl) => setAnnouncementForm((current) => ({ ...current, items: [{ ...currentAnnouncement, linkUrl }] }))} autoCapitalize="none" />
            <Field label={t('admin.rotationSeconds')} value={String(announcementForm.intervalSeconds)} onChangeText={(intervalSeconds) => setAnnouncementForm((current) => ({ ...current, intervalSeconds }))} keyboardType="number-pad" />
            <PrimaryButton label={t('admin.saveAnnouncement')} loading={saving} onPress={saveAnnouncement} />
          </Section>
        )}

        {activeTab === 'booking-rules' && (
          <Section title={t('admin.tabs.bookingRules')}>
            <ModeSelector value={marketplaceSettings.bookingMode || 'manual'} onChange={(bookingMode) => saveMarketplaceSettings({ ...marketplaceSettings, bookingMode })} />
            <Field label={t('admin.defaultCommission')} value={String(marketplaceSettings.defaultCommissionPercentage ?? 10)} onChangeText={(value) => setMarketplaceSettings((current) => ({ ...current, defaultCommissionPercentage: value }))} keyboardType="number-pad" />
            <Field label={t('admin.rulesOneLine')} value={(marketplaceSettings.bookingRules || []).join('\n')} onChangeText={(text) => setMarketplaceSettings((current) => ({ ...current, bookingRules: text.split('\n') }))} multiline />
            <PrimaryButton label={t('admin.saveRules')} loading={saving} onPress={() => saveMarketplaceSettings()} />
          </Section>
        )}

        {activeTab === 'register-business' && (
          <Section title={t('admin.tabs.addSeller')}>
            <Field label={t('admin.providerName')} value={providerForm.providerName} onChangeText={(providerName) => setProviderForm((current) => ({ ...current, providerName }))} />
            <Field label={t('admin.providerEmail')} value={providerForm.providerEmail} onChangeText={(providerEmail) => setProviderForm((current) => ({ ...current, providerEmail }))} autoCapitalize="none" keyboardType="email-address" />
            <PrimaryButton label={t('admin.createSeller')} loading={saving} onPress={createSeller} />
            {onboardingCredentials ? (
              <View style={styles.noticeBox}>
                <Text style={styles.cardTitle}>{t('admin.generatedCredentials')}</Text>
                <Text style={styles.cardText}>{t('admin.sellerId')}: {onboardingCredentials.sellerId}</Text>
                <Text style={styles.cardText}>{t('common.password')}: {onboardingCredentials.generatedPassword}</Text>
              </View>
            ) : null}
          </Section>
        )}

        {activeTab === 'users' && (
          <Section title={t('admin.tabs.users')}>
            {users.map((user) => (
              <Card key={user._id || user.id}>
                <Text style={styles.cardTitle}>{user.name || t('admin.unnamedUser')}</Text>
                <Text style={styles.cardMeta}>{user.email}</Text>
                <Text style={styles.cardText}>{t('admin.role')}: {['hotel', 'supplier'].includes(user.role) ? t('admin.provider') : user.role}</Text>
                <Text style={styles.cardText}>{t('admin.providerId')}: {user.sellerId || '-'}</Text>
                <SmallButton label={t('actions.delete')} tone="danger" onPress={() => deleteUser(user._id || user.id)} />
              </Card>
            ))}
          </Section>
        )}

        {activeTab === 'services' && (
          <Section title={t('admin.tabs.services')}>
            {services.map((service) => (
              <Card key={service._id || service.id}>
                <Text style={styles.cardTitle}>{service.title || service.name}</Text>
                <Text style={styles.cardMeta}>{service.serviceType || service.category} - {service.status || 'available'}</Text>
                <Text style={styles.cardText}>{t('admin.availability')}: {service.availabilityText || service.availableQuantity || 0}</Text>
                <ModeSelector value={service.bookingMode || 'manual'} onChange={(mode) => updateServiceMode(service, mode)} compact />
              </Card>
            ))}
          </Section>
        )}

        {activeTab === 'bookings' && (
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
                    paymentReason: booking.paymentReason || '30% deposit to confirm booking and unlock provider details.',
                  });
                }} />
              </Card>
            ))}
          </Section>
        )}

        {activeTab === 'rebook-requests' && (
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

        {activeTab === 'verification' && (
          <Section title={t('admin.verifyBooking')}>
            <Field label={t('admin.verifyLookup')} value={verificationLookup} onChangeText={setVerificationLookup} autoCapitalize="characters" />
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.scanButton} onPress={() => setScannerOpen(true)} activeOpacity={0.84}>
                <Feather name="camera" size={16} color={colors.primaryDark} />
                <Text style={styles.scanButtonText}>Scan QR</Text>
              </TouchableOpacity>
              <View style={styles.verifyAction}>
                <PrimaryButton label={t('admin.verifyBooking')} loading={saving} onPress={verifyBooking} />
              </View>
            </View>
            {verifiedBooking ? (
              <Card>
                <Text style={styles.cardTitle}>{verifiedBooking.bookingCode || verifiedBooking._id}</Text>
                <Text style={styles.cardText}>{t('admin.customer')}: {verifiedBooking.touristId?.name || verifiedBooking.touristId?.email || '-'}</Text>
                <Text style={styles.cardText}>{t('admin.status')}: {label(verifiedBooking.status)}</Text>
                <Text style={styles.cardText}>{t('admin.payment')}: {label(verifiedBooking.paymentStatus)}</Text>
              </Card>
            ) : null}
          </Section>
        )}

        {activeTab === 'revenue' && (
          <Section title={t('admin.tabs.revenue')}>
            <View style={styles.metrics}>
              <Metric label={t('admin.received')} value={formatMoney(transactionSummary?.totalReceived || 0)} />
              <Metric label={t('admin.commission')} value={formatMoney(transactionSummary?.commissionEarned || 0)} />
              <Metric label={t('admin.due')} value={formatMoney(transactionSummary?.commissionDue || 0)} />
            </View>
            {Object.entries(revenueByType).map(([type, total]) => <Metric key={type} label={label(type)} value={formatMoney(total)} />)}
            {transactions.map((tx) => (
              <Card key={tx._id || tx.transactionId}>
                <Text style={styles.cardTitle}>{tx.transactionId || tx._id}</Text>
                <Text style={styles.cardText}>{t('admin.booking')}: {tx.bookingId?.bookingCode || tx.bookingId?._id || '-'}</Text>
                <Text style={styles.cardText}>{t('admin.deposit')}: {formatMoney(tx.amount)}</Text>
                <Text style={styles.cardText}>{t('admin.commission')}: {formatMoney(tx.commissionAmount)}</Text>
                {tx.commissionStatus === 'collected' ? <Badge value={t('admin.collected')} /> : <SmallButton label={t('admin.markCollected')} tone="success" onPress={() => markCommissionCollected(tx)} />}
              </Card>
            ))}
          </Section>
        )}

        {activeTab === 'analytics' && (
          <Section title={t('admin.analyticsDashboard')}>
            <PrimaryButton label={t('admin.refreshAnalytics')} loading={saving} onPress={loadAnalytics} />
            <View style={styles.metrics}>
              <Metric label={t('admin.views')} value={analytics?.overview?.summary?.views || 0} />
              <Metric label={t('admin.formsOpened')} value={analytics?.overview?.summary?.bookingFormsOpened || 0} />
              <Metric label={t('admin.submitted')} value={analytics?.overview?.summary?.bookingSubmitted || 0} />
              <Metric label={t('admin.payments')} value={analytics?.overview?.summary?.paymentSuccess || 0} />
            </View>
            {(analytics?.serviceRows?.services || []).slice(0, 20).map((service) => (
              <Card key={service.serviceId || service.serviceName}>
                <Text style={styles.cardTitle}>{service.serviceName}</Text>
                <Text style={styles.cardText}>{t('admin.views')}: {service.views || 0} - {t('admin.submitted')}: {service.bookingSubmitted || 0} - {t('admin.paid')}: {service.paymentSuccess || 0}</Text>
              </Card>
            ))}
          </Section>
        )}

        {activeTab === 'storage' && (
          <Section title={t('admin.storageOverview')}>
            <PrimaryButton label={t('admin.refreshStorage')} loading={saving} onPress={loadStorage} />
            <View style={styles.metrics}>
              <Metric label={t('admin.mongoUsed')} value={`${Number(storage?.mongodb?.storageUsedMB || 0).toLocaleString()} MB`} />
              <Metric label={t('admin.mongoDocs')} value={storage?.mongodb?.totalDocuments || 0} />
              <Metric label={t('admin.cloudinaryUsed')} value={`${Number(storage?.cloudinary?.storageUsedGB || 0).toLocaleString()} GB`} />
              <Metric label={t('admin.files')} value={storage?.cloudinary?.totalFiles || 0} />
            </View>
          </Section>
        )}

        {activeTab === 'activity' && (
          <Section title={t('admin.liveActivity')}>
            {[...bookings.slice(0, 10), ...services.slice(0, 10), ...businesses.slice(0, 10)].map((item, index) => (
              <Card key={`${item._id || item.id || index}-activity`}>
                <Text style={styles.cardTitle}>{item.bookingCode || item.title || item.name || t('admin.activityItem')}</Text>
                <Text style={styles.cardText}>{label(item.status || item.approvalStatus || item.paymentStatus || t('admin.updated'))}</Text>
                <Text style={styles.cardMeta}>{item.updatedAt ? new Date(item.updatedAt).toLocaleString() : item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'}</Text>
              </Card>
            ))}
          </Section>
        )}
      </ScrollView>

      <BusinessModal business={selectedBusiness} onClose={() => setSelectedBusiness(null)} />
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
    </View>
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
      <TextInput placeholderTextColor="#98A2B3" style={[styles.input, multiline && styles.textArea]} multiline={multiline} {...props} />
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
    <View style={[styles.modeRow, compact && { marginTop: 10 }]}>
      {['manual', 'automatic', 'service-level'].filter((mode) => !compact || mode !== 'service-level').map((mode) => (
        <TouchableOpacity key={mode} style={[styles.modeButton, value === mode && styles.modeActive]} onPress={() => onChange(mode)} activeOpacity={0.84}>
          <Text style={[styles.modeText, value === mode && styles.modeTextActive]}>{modeLabel(mode)}</Text>
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
          <ModalHeader title={t('admin.businessDetails')} onClose={onClose} />
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
  content: { padding: 16, paddingTop: 58, paddingBottom: 30 },
  header: { alignItems: 'flex-start', flexDirection: 'row', gap: 10 },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  title: { color: colors.text, fontSize: 25, fontWeight: '900', marginTop: 4 },
  text: { color: colors.muted, fontSize: 13, fontWeight: '700', lineHeight: 19, marginTop: 5 },
  refreshButton: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, height: 38, justifyContent: 'center', width: 38 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 14 },
  metricCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, flexGrow: 1, minWidth: '47%', padding: 12 },
  metricLabel: { color: colors.muted, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  metricValue: { color: colors.primary, fontSize: 17, fontWeight: '900', marginTop: 5 },
  tabs: { gap: 8, paddingVertical: 14 },
  tabButton: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9 },
  tabButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { color: colors.text, fontSize: 12, fontWeight: '900' },
  tabTextActive: { color: colors.white },
  section: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, padding: 12 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '900', marginBottom: 10 },
  card: { backgroundColor: colors.surfaceMuted, borderRadius: 8, marginBottom: 10, padding: 12 },
  cardTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  cardMeta: { color: colors.primaryDark, fontSize: 12, fontWeight: '800', marginTop: 3 },
  cardText: { color: colors.text, fontSize: 12, fontWeight: '700', lineHeight: 18, marginTop: 5 },
  badge: { alignSelf: 'flex-start', backgroundColor: colors.primaryLight, borderRadius: 999, marginTop: 9, paddingHorizontal: 9, paddingVertical: 5 },
  badgeText: { color: colors.primaryDark, fontSize: 10, fontWeight: '900' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  smallButton: { alignItems: 'center', borderRadius: 8, minHeight: 36, justifyContent: 'center', paddingHorizontal: 11, paddingVertical: 8 },
  primaryButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 8, minHeight: 44, justifyContent: 'center', marginTop: 12 },
  primaryButtonText: { color: colors.white, fontSize: 13, fontWeight: '900' },
  primarySmallButton: { backgroundColor: colors.primary },
  successSmallButton: { backgroundColor: colors.successSurface },
  dangerSmallButton: { backgroundColor: colors.dangerSurface },
  mutedSmallButton: { backgroundColor: colors.surfaceMuted },
  smallButtonText: { color: colors.text, fontSize: 12, fontWeight: '900' },
  scanButton: { alignItems: 'center', backgroundColor: colors.primaryLight, borderColor: colors.primary, borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 7, minHeight: 44, justifyContent: 'center', paddingHorizontal: 14 },
  scanButtonText: { color: colors.primaryDark, fontSize: 13, fontWeight: '900' },
  verifyAction: { flex: 1, minWidth: 170 },
  infoText: { backgroundColor: colors.successSurface, borderRadius: 8, color: colors.success, fontSize: 12, fontWeight: '900', marginBottom: 10, padding: 10 },
  errorText: { backgroundColor: colors.dangerSurface, borderRadius: 8, color: colors.danger, fontSize: 12, fontWeight: '900', marginBottom: 10, padding: 10 },
  fieldWrap: { marginTop: 10 },
  fieldLabel: { color: colors.text, fontSize: 11, fontWeight: '900', marginBottom: 5 },
  input: { backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderRadius: 8, borderWidth: 1, color: colors.text, fontSize: 13, fontWeight: '700', minHeight: 42, paddingHorizontal: 11, paddingVertical: 9 },
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
  noticeBox: { backgroundColor: colors.primaryLight, borderRadius: 8, marginTop: 12, padding: 12 },
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
