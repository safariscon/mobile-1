import { useEffect, useState, useCallback, useMemo } from 'react';
import { ActivityIndicator, Alert, Image, Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { DateTimeField, MultilineField, NumberField, SelectField as ModalSelectField, TextField } from '../components/FormFields';
import { useAppDialog } from '../components/AppDialog';
import OverflowMenu, { MenuTrigger } from '../components/OverflowMenu';
import ServiceDetailsView from '../components/ServiceDetailsView';
import ServiceLocationPicker from '../components/ServiceLocationPicker';
import WorldLocationFields from '../components/WorldLocationFields';
import {
  completeVerifiedSellerBooking,
  confirmRebookUnavailable,
  deleteSellerService,
  fetchSellerBookings,
  fetchSellerFinance,
  fetchSellerOverview,
  fetchSellerPaymentProviders,
  fetchSellerPayoutDetails,
  fetchSellerRebookRequests,
  fetchSellerService,
  fetchSellerServiceOptions,
  fetchSellerServices,
  lookupSellerBookingVerification,
  saveSellerPayoutDetails,
  updateSellerBookingStatus,
  updateSellerService,
  verifySellerBookingCode,
} from '../api/seller';
import { fetchServiceCategories, serviceCategoryId, serviceCategoryLabel } from '../api/categories';
import { fetchMarketplaceSettings } from '../api/services';
import ServiceEditorModal from '../components/ServiceEditorModal';
import { normalizeServiceDetail } from '../lib/serviceMapper';
import { useAuth } from '../context/AuthContext';
import { realtimeUserRooms, useRealtimeRefresh } from '../lib/realtime';
import { lightColors } from '../theme/colors';
import { baseInputStyle } from '../theme/inputStyles';
import useThemedStyles from '../theme/useThemedStyles';
import { isDraftListing, matchesServiceFilter } from '../lib/listings';

let colors = lightColors;
let styles;

function getSaveErrorMessage(error, fallback) {
  const message = String(error?.message || '').trim();
  return message || fallback;
}

export default function SellerDashboard({ tab, section = 'bookings', hideChrome = false, focusBookingId }) {
  const themed = useThemedStyles(createStyles);
  colors = themed.colors;
  styles = themed.styles;
  const { t } = useTranslation();
  const { token, isAuthenticated, user } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Verification states
  const [verificationCode, setVerificationCode] = useState('');
  const [verifiedBooking, setVerifiedBooking] = useState(null);
  const [verifyError, setVerifyError] = useState('');
  const [verifySuccess, setVerifySuccess] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);

  // Stats overview states
  const [stats, setStats] = useState({
    totalBookings: 0,
    totalRevenue: 0,
    activeBookings: 0,
    completedBookings: 0,
    cancellationRate: 0,
    lowAvailability: 0,
    pendingServices: 0,
    approvedServices: 0,
    businesses: 0,
    activeBusinesses: 0,
    listings: 0,
    heldPayout: 0,
    failedPayout: 0,
    pendingPayout: 0,
  });
  const [overview, setOverview] = useState(null);
  const [finance, setFinance] = useState({ summary: {}, transactions: [] });
  const [payoutDetails, setPayoutDetails] = useState({ method: 'momo', providerId: 'mtn', accountName: '', accountNumber: '' });
  const [payoutProviders, setPayoutProviders] = useState({ mobileMoneyProviders: [], bankProviders: [] });
  const [savingPayout, setSavingPayout] = useState(false);
  const [marketplaceSettings, setMarketplaceSettings] = useState({ bookingMode: 'manual' });
  const [bookings, setBookings] = useState([]);
  const [services, setServices] = useState([]);
  const [serviceCategories, setServiceCategories] = useState([]);
  const [catalogCategoryId, setCatalogCategoryId] = useState('');
  const [businessEditorOpen, setBusinessEditorOpen] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState(null);
  const [editingOptions, setEditingOptions] = useState([]);
  const [rebookRequests, setRebookRequests] = useState([]);
  const [overflow, setOverflow] = useState({ visible: false, title: 'Actions', items: [] });
  const [viewService, setViewService] = useState(null);
  const [viewServiceLoading, setViewServiceLoading] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [reviewBooking, setReviewBooking] = useState(null);
  const [reviewForm, setReviewForm] = useState({ totalPrice: '', paymentDeadlineHours: '24', paymentReason: 'Approved service payment', note: '', reason: '' });
  const { dialogNode, showResult, askConfirm, closeDialog } = useAppDialog();

  const loadData = useCallback(async (silent = false) => {
    if (!isAuthenticated) return;
    if (!silent) setLoading(true);
    setError('');

    try {
      const [overviewData, servicesList, bookingsList, financeData, payout, providers, settings, categoriesPayload] = await Promise.all([
        fetchSellerOverview().catch(() => ({})),
        fetchSellerServices().catch(() => []),
        fetchSellerBookings().catch(() => []),
        fetchSellerFinance().catch(() => ({ summary: {}, transactions: [] })),
        fetchSellerPayoutDetails().catch(() => ({})),
        fetchSellerPaymentProviders().catch(() => ({ mobileMoneyProviders: [], bankProviders: [] })),
        fetchMarketplaceSettings().catch(() => ({ bookingMode: 'manual' })),
        fetchServiceCategories({ seller: true }).catch(() => ({ categories: [] })),
      ]);

      const cleanServices = (servicesList || []).filter((item) => !isDraftListing(item));
      const cleanBookings = bookingsList || [];
      setOverview(overviewData);
      setServices(cleanServices);
      setBookings(cleanBookings);
      setServiceCategories(categoriesPayload.categories || []);
      setFinance(financeData);
      setPayoutDetails({
        method: String(payout?.method || 'momo').toLowerCase().includes('bank') ? 'bank' : 'momo',
        providerId: payout?.providerId || 'mtn',
        accountName: payout?.accountName || '',
        accountNumber: payout?.accountNumber || payout?.msisdn || '',
      });
      setPayoutProviders(providers);
      setMarketplaceSettings(settings || { bookingMode: 'manual' });

      if (tab === 'bookings' || tab === 'analytics') setData(cleanBookings);
      if (tab === 'catalog' || tab === 'finance' || tab === 'analytics') {
        if (tab !== 'bookings') setData(cleanServices);
      }
      if (tab === 'bookings' && (section === 'rebook' || !section)) {
        const requests = await fetchSellerRebookRequests().catch(() => []);
        setRebookRequests(requests);
      }

      const completed = cleanBookings.filter((b) => b.status === 'completed' || b.paymentStatus === 'completed' || b.paymentStatus === 'paid');
      const cancelled = cleanBookings.filter((b) => String(b.status || '').includes('cancel'));
      const active = cleanBookings.filter((b) => ['pending', 'reviewing', 'requested', 'confirmed'].includes(String(b.status || '').toLowerCase()));
      const summary = financeData.summary || {};
      setStats({
        totalBookings: overviewData?.stats?.bookings || cleanBookings.length,
        totalRevenue: overviewData?.stats?.earnings || summary.grossCollected || 0,
        activeBookings: overviewData?.stats?.activeBookings || active.length,
        completedBookings: completed.length,
        cancellationRate: cleanBookings.length ? Math.round((cancelled.length / cleanBookings.length) * 100) : 0,
        lowAvailability: cleanServices.filter((item) => Number(item.availableQuantity ?? item.quantityRemaining ?? 0) <= 1).length,
        pendingServices: cleanServices.filter((item) => String(item.approvalStatus || item.status || '').includes('pending')).length,
        approvedServices: cleanServices.filter((item) => ['approved', 'available'].includes(String(item.approvalStatus || item.status || ''))).length,
        businesses: cleanServices.length,
        activeBusinesses: cleanServices.filter((item) => item.status === 'available').length,
        listings: overviewData?.stats?.services || cleanServices.length,
        heldPayout: summary.heldPayout || summary.pendingPayout || overviewData?.stats?.pendingPayout || overviewData?.stats?.heldPayout || 0,
        failedPayout: summary.failedPayout || 0,
        pendingPayout: summary.pendingPayout || overviewData?.stats?.pendingPayout || 0,
      });
    } catch (err) {
      showResult(t('common.error'), err.message || t('customerBookings.loadFailed'), 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated, section, showResult, t, tab]);

  useEffect(() => {
    loadData();
    if (section !== 'verify') {
      setVerificationCode('');
      setVerifiedBooking(null);
      setVerifyError('');
      setVerifySuccess('');
    }
  }, [tab, section, loadData]);

  useEffect(() => {
    if (!focusBookingId || !bookings.length) return;
    const match = bookings.find((item) => String(item._id || item.id) === String(focusBookingId));
    if (!match) return;
    const status = String(match.status || '').toLowerCase();
    if (['pending', 'reviewing', 'requested'].includes(status)) openBookingReview(match);
    else setSelectedBooking(match);
  }, [focusBookingId, bookings]);

  const realtimeRooms = useMemo(() => realtimeUserRooms(user, { business: true }), [user]);
  const refreshFromRealtime = useCallback(() => {
    loadData(true);
  }, [loadData]);
  useRealtimeRefresh({
    enabled: isAuthenticated,
    rooms: realtimeRooms,
    events: ['booking:changed', 'service:changed', 'hotel:changed', 'notification:new'],
    onRefresh: refreshFromRealtime,
  });

  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const handleUpdateStatus = async (bookingId, body) => {
    setLoading(true);
    try {
      await updateSellerBookingStatus(bookingId, body);
      showResult(t('common.success'), 'Booking updated.');
      setReviewBooking(null);
      setSelectedBooking(null);
      await loadData(true);
    } catch (err) {
      showResult(t('common.error'), err.message || t('backend.statusUpdateFailed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const openBookingReview = (booking) => {
    setReviewBooking(booking);
    setReviewForm({
      totalPrice: String(booking.totalPrice || booking.bookingDetails?.listedPriceRwf || ''),
      paymentDeadlineHours: String(booking.paymentDeadlineHours || 24),
      paymentReason: booking.paymentReason || 'Approved service payment',
      note: '',
      reason: '',
    });
  };

  const approveReviewedBooking = () => {
    if (!reviewBooking) return;
    const totalPrice = Number(reviewForm.totalPrice);
    if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
      showResult(t('common.error'), 'Enter a valid final price in RWF.', 'error');
      return;
    }
    handleUpdateStatus(reviewBooking._id || reviewBooking.id, {
      status: 'confirmed',
      totalPrice,
      paymentDeadlineHours: Number(reviewForm.paymentDeadlineHours) || 24,
      paymentReason: reviewForm.paymentReason || 'Approved service payment',
      note: reviewForm.note || undefined,
    });
  };

  const rejectReviewedBooking = () => {
    if (!reviewBooking) return;
    if (!String(reviewForm.reason || '').trim()) {
      showResult(t('common.error'), 'Rejection reason is required.', 'error');
      return;
    }
    handleUpdateStatus(reviewBooking._id || reviewBooking.id, {
      status: 'cancelled',
      reason: reviewForm.reason.trim(),
    });
  };

  const cancelConfirmedBooking = (booking) => {
    askConfirm({
      title: 'Cancel this booking?',
      message: 'The confirmed booking will be cancelled.',
      confirmLabel: t('common.cancel'),
      destructive: true,
      onConfirm: () => {
        closeDialog();
        handleUpdateStatus(booking._id || booking.id, { status: 'cancelled' });
      },
    });
  };

  const handleVerifyCode = async () => {
    const lookup = String(verificationCode || '').trim();
    if (!lookup) return;
    setVerifyLoading(true);
    setVerifyError('');
    setVerifySuccess('');
    setVerifiedBooking(null);

    try {
      let booking;
      if (lookup.includes('/verify/') || lookup.length > 24) {
        const tokenPart = lookup.includes('/verify/') ? lookup.split('/verify/').pop() : lookup;
        booking = await lookupSellerBookingVerification(tokenPart);
      } else {
        booking = await verifySellerBookingCode(lookup);
      }
      setVerifiedBooking(booking);
      showResult(t('common.success'), t('seller.verifyValid'));
    } catch (err) {
      showResult(t('common.error'), err.message || t('backend.invalidCode'), 'error');
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleCompleteStay = async () => {
    if (!verifiedBooking) return;
    setVerifyLoading(true);
    try {
      await completeVerifiedSellerBooking({
        bookingId: verifiedBooking.bookingId || verifiedBooking._id || verifiedBooking.id,
        code: verificationCode.includes('/verify/') ? verificationCode.split('/verify/').pop() : verificationCode,
      });
      showResult(t('common.success'), t('seller.checkInDone'));
      setVerifiedBooking(null);
      setVerificationCode('');
      await loadData(true);
    } catch (err) {
      showResult(t('common.error'), err.message || t('backend.checkInFailed'), 'error');
    } finally {
      setVerifyLoading(false);
    }
  };

  const confirmUnavailable = async (requestId) => {
    try {
      await confirmRebookUnavailable(requestId);
      showResult(t('common.success'), 'Request updated.');
      loadData(true);
    } catch (err) {
      showResult(t('common.error'), err.message || t('customerBookings.loadFailed'), 'error');
    }
  };

  const beginEditBusiness = async (business) => {
    setEditingBusiness(business);
    setEditingOptions([]);
    setBusinessEditorOpen(true);
    setError('');
    if (business?._id || business?.id) {
      try {
        const [details, options] = await Promise.all([
          fetchSellerService(business._id || business.id).catch(() => business),
          fetchSellerServiceOptions(business._id || business.id).catch(() => []),
        ]);
        setEditingBusiness(details);
        setEditingOptions(options);
      } catch {
        setEditingOptions([]);
      }
    }
  };

  const openServiceView = async (business) => {
    setViewService(normalizeServiceDetail(business));
    setViewServiceLoading(true);
    try {
      const details = await fetchSellerService(business._id || business.id);
      setViewService(normalizeServiceDetail(details));
    } catch {
      showResult(t('common.error'), t('serviceDetails.loadFailed'), 'error');
    } finally {
      setViewServiceLoading(false);
    }
  };

  const deleteBusiness = (business) => {
    askConfirm({
      title: 'Delete this service?',
      message: 'This listing will be removed from your catalog.',
      confirmLabel: t('actions.delete'),
      destructive: true,
      onConfirm: async () => {
        closeDialog();
        setLoading(true);
        setError('');
        try {
          await deleteSellerService(business._id || business.id);
          showResult(t('common.success'), t('backend.businessDeleted'));
          await loadData(true);
        } catch (err) {
          showResult(t('common.error'), getSaveErrorMessage(err, t('backend.deleteBusinessFailed')), 'error');
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const setBusinessAvailability = async (business, status) => {
    setLoading(true);
    setError('');
    try {
      const location = business.location || business.serviceLocation || {};
      const hasLocation = (location.country && (location.city || location.state || location.district))
        && (location.latitude || location.latitudeRaw)
        && (location.longitude || location.longitudeRaw);
      const hasPayout = payoutDetails.accountNumber || business.payoutDetails?.accountNumber || business.payoutDetails?.msisdn;
      const hasOptions = Array.isArray(business.options) && business.options.length > 0;
      const hasPriceRows = business.availabilityTable?.rows?.some((row) => row.cells?.service && row.cells?.price)
        || Number(business.basePrice) > 0
        || hasOptions;
      if (!hasLocation || !hasPayout || !hasPriceRows) {
        beginEditBusiness(business);
        showResult(t('common.error'), t('seller.completeBeforeAvailability'), 'error');
        return;
      }
      await updateSellerService(business._id || business.id, { status });
      showResult(t('common.success'), t('backend.businessUpdated'));
      await loadData(true);
    } catch (err) {
      showResult(t('common.error'), getSaveErrorMessage(err, t('backend.availabilityFailed')), 'error');
      beginEditBusiness(business);
    } finally {
      setLoading(false);
    }
  };

  const savePayoutAccount = async () => {
    if (!payoutDetails.accountName.trim() || !payoutDetails.accountNumber.trim()) {
      showResult(t('common.error'), t('seller.validation.payoutRequired'), 'error');
      return;
    }
    setSavingPayout(true);
    try {
      const method = payoutDetails.method === 'bank' ? 'bank' : 'momo';
      const saved = await saveSellerPayoutDetails({
        method,
        providerId: payoutDetails.providerId || (method === 'bank' ? 'equity' : 'mtn'),
        accountName: payoutDetails.accountName.trim(),
        accountNumber: payoutDetails.accountNumber.trim(),
        ...(method === 'momo' ? { msisdn: payoutDetails.accountNumber.trim() } : {}),
      });
      setPayoutDetails({
        method: String(saved?.method || method).includes('bank') ? 'bank' : 'momo',
        providerId: saved?.providerId || payoutDetails.providerId,
        accountName: saved?.accountName || payoutDetails.accountName,
        accountNumber: saved?.accountNumber || saved?.msisdn || payoutDetails.accountNumber,
      });
      showResult(t('common.success'), 'Payout account saved.');
    } catch (err) {
      showResult(t('common.error'), err.message || 'Could not save payout details.', 'error');
    } finally {
      setSavingPayout(false);
    }
  };

  const labelStatus = (value) => String(value || '-').replace(/_/g, ' ');

  const renderBookings = () => {
    const list = bookings.length ? bookings : data;
    return (
    <ScrollView
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      contentContainerStyle={styles.scrollContent}
    >
      {hideChrome ? null : (
        <>
          <Text style={styles.eyebrow}>{t('seller.workspace')}</Text>
          <Text style={styles.title}>{t('seller.bookingRequests')}</Text>
        </>
      )}

      <View style={styles.statsRow}>
        <View style={styles.statsCard}>
          <Text style={styles.statsLabel}>{t('seller.totalOrders')}</Text>
          <Text style={styles.statsNumber}>{stats.totalBookings}</Text>
        </View>
        <View style={styles.statsCard}>
          <Text style={styles.statsLabel}>{t('seller.revenueRwf')}</Text>
          <Text style={styles.statsNumber}>{Number(stats.totalRevenue || 0).toLocaleString()}</Text>
        </View>
      </View>

      <View style={styles.verifyBox}>
        <Text style={styles.verifyLabel}>Complete booking with customer code</Text>
        <View style={styles.inputSearchRow}>
          <TextInput
            placeholder="BK-XXXXX"
            placeholderTextColor={colors.muted}
            value={verificationCode}
            onChangeText={setVerificationCode}
            autoCapitalize="characters"
            style={styles.verifyInput}
          />
          <TouchableOpacity style={styles.verifyBtn} onPress={handleVerifyCode} disabled={verifyLoading} activeOpacity={0.8}>
            {verifyLoading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.verifyBtnText}>{t('actions.verify')}</Text>}
          </TouchableOpacity>
        </View>
        {verifiedBooking ? (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.tableSummary}>{verifiedBooking.customerName || verifiedBooking.touristId?.name || 'Customer'} · {verifiedBooking.serviceName || verifiedBooking.serviceId?.title || 'Service'}</Text>
            <Text style={styles.tableSummary}>Paid: RWF {Number(verifiedBooking.amountPaid || verifiedBooking.depositAmount || 0).toLocaleString()}</Text>
            <TouchableOpacity style={[styles.smallPrimaryButton, { marginTop: 10 }]} onPress={handleCompleteStay} disabled={verifyLoading} activeOpacity={0.84}>
              <Text style={styles.smallPrimaryText}>Mark completed</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      {loading && !refreshing && <ActivityIndicator color={colors.primary} size="large" style={{ marginVertical: 20 }} />}

      {list.length === 0 && !loading && (
        <View style={styles.emptyContainer}>
          <Feather name="inbox" size={44} color={colors.muted} />
          <Text style={styles.emptyText}>{t('seller.noRequests')}</Text>
        </View>
      )}

      {list.map((booking) => {
        const status = String(booking.status || '').toLowerCase();
        const isReviewable = ['pending', 'reviewing', 'requested'].includes(status);
        const isConfirmed = status === 'confirmed';
        const customerName = booking.touristId?.name || booking.userId?.name || booking.touristId?.email || t('seller.customer');
        const serviceName = booking.serviceId?.title || booking.bookingDetails?.requestedService || booking.bookingDetails?.serviceName || booking.destinationPlace || t('seller.bookingDetail');
        return (
          <View key={booking._id || booking.id} style={styles.bookingCard}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.bookingId}>{t('seller.code')}: {booking.bookingCode || 'TBD'}</Text>
                <Text style={styles.cardTitle}>{serviceName}</Text>
                <Text style={styles.dateLabel}>
                  Qty {booking.quantity || 1} · {labelStatus(booking.paymentStatus || 'unpaid')}
                </Text>
              </View>
              <View style={[styles.badge, { backgroundColor: isReviewable ? '#FEF3C7' : '#D1FAE5' }]}>
                <Text style={{ color: isReviewable ? '#B45309' : '#047857', fontWeight: '800', fontSize: 11 }}>
                  {labelStatus(status || booking.paymentStatus)}
                </Text>
              </View>
            </View>

            <View style={styles.cardDivider} />
            <Text style={styles.clientDetails}>{t('seller.clientName')}: {customerName}</Text>
            <Text style={styles.priceRow}>{t('seller.totalRate')}: <Text style={styles.priceBold}>RWF {Number(booking.totalPrice || booking.amountPaid || 0).toLocaleString()}</Text></Text>

            <View style={styles.actionRow}>
              <TouchableOpacity style={[styles.actionButton, styles.outlineAction]} onPress={() => setSelectedBooking(booking)} activeOpacity={0.84}>
                <Text style={styles.outlineActionText}>{t('actions.view')}</Text>
              </TouchableOpacity>
              {isReviewable ? (
                <TouchableOpacity style={[styles.actionButton, styles.approveButton]} onPress={() => openBookingReview(booking)} activeOpacity={0.84}>
                  <Text style={styles.approveButtonText}>Review</Text>
                </TouchableOpacity>
              ) : null}
              {isConfirmed ? (
                <TouchableOpacity style={[styles.actionButton, styles.rejectButton]} onPress={() => cancelConfirmedBooking(booking)} activeOpacity={0.84}>
                  <Text style={styles.rejectButtonText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        );
      })}
    </ScrollView>
    );
  };

  const renderVerify = () => (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Text style={styles.eyebrow}>{t('seller.workspace')}</Text>
      <Text style={styles.title}>{t('seller.guestVerification')}</Text>
      <Text style={styles.text}>Enter a booking code or paste a QR /verify/... URL.</Text>

      <View style={styles.verifyBox}>
        <Text style={styles.verifyLabel}>{t('seller.bookingCode')}</Text>
        <View style={styles.inputSearchRow}>
          <TextInput
            placeholder="BK-XXXXX or /verify/..."
            placeholderTextColor={colors.muted}
            value={verificationCode}
            onChangeText={setVerificationCode}
            autoCapitalize="none"
            style={styles.verifyInput}
          />
          <TouchableOpacity
            style={styles.verifyBtn}
            onPress={handleVerifyCode}
            disabled={verifyLoading}
            activeOpacity={0.8}
          >
            {verifyLoading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.verifyBtnText}>{t('actions.verify')}</Text>}
          </TouchableOpacity>
        </View>
      </View>

      {verifiedBooking && (
        <View style={styles.verifiedCard}>
          <Text style={styles.verifiedCardTitle}>{t('seller.reservationDetails')}</Text>
          <View style={styles.verifiedRow}>
            <Text style={styles.infoLabel}>{t('seller.client')}:</Text>
            <Text style={styles.infoValue}>{verifiedBooking.customerName || verifiedBooking.touristId?.name || t('seller.traveler')}</Text>
          </View>
          <View style={styles.verifiedRow}>
            <Text style={styles.infoLabel}>{t('serviceDetails.service')}:</Text>
            <Text style={styles.infoValue}>{verifiedBooking.serviceName || verifiedBooking.serviceId?.title || verifiedBooking.bookingDetails?.requestedService || t('seller.standardRoom')}</Text>
          </View>
          <View style={styles.verifiedRow}>
            <Text style={styles.infoLabel}>{t('seller.dates')}:</Text>
            <Text style={styles.infoValue}>
              {verifiedBooking.bookingDate ? new Date(verifiedBooking.bookingDate).toLocaleString() : verifiedBooking.checkIn ? new Date(verifiedBooking.checkIn).toLocaleDateString() : '-'}
            </Text>
          </View>
          <View style={styles.verifiedRow}>
            <Text style={styles.infoLabel}>Paid:</Text>
            <Text style={[styles.infoValue, { color: colors.success }]}>RWF {Number(verifiedBooking.amountPaid || verifiedBooking.depositAmount || 0).toLocaleString()}</Text>
          </View>

          <TouchableOpacity
            style={styles.completeCheckInBtn}
            onPress={handleCompleteStay}
            disabled={verifyLoading}
            activeOpacity={0.85}
          >
            <Feather name="check-circle" size={20} color={colors.white} />
            <Text style={styles.completeCheckInText}>{t('seller.completeCheckIn')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );

  const renderRebookRequests = () => (
    <ScrollView
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      contentContainerStyle={styles.scrollContent}
    >
      <Text style={styles.eyebrow}>{t('seller.workspace')}</Text>
      <Text style={styles.title}>Re-book Requests</Text>
      <Text style={styles.text}>Confirm unavailable services, review deadlines, and follow customer change requests.</Text>
      {loading && !refreshing ? <ActivityIndicator color={colors.primary} size="large" style={{ marginVertical: 20 }} /> : null}
      {!!error && <Text style={styles.errorText}>{error}</Text>}
      {!loading && !rebookRequests.length ? (
        <View style={styles.emptyContainer}>
          <Feather name="repeat" size={44} color={colors.muted} />
          <Text style={styles.emptyText}>No re-book requests yet.</Text>
        </View>
      ) : null}
      {rebookRequests.map((request) => (
        <View key={request._id || request.id} style={styles.businessCard}>
          <View style={styles.businessTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{request.serviceId?.name || request.serviceId?.businessName || 'Service'}</Text>
              <Text style={styles.itemTypeLabel}>{request.requestType === 'rebook' ? 'Re-book' : 'Cancel'} - {String(request.status || 'pending').replace(/_/g, ' ')}</Text>
            </View>
            <View style={styles.remainingPill}>
              <Text style={styles.remainingText}>{request.rebookId || 'No ID'}</Text>
            </View>
          </View>
          <Text style={styles.itemDescription}>{request.reason || 'No reason provided.'}</Text>
          <Text style={styles.tableSummary}>Booking: {request.originalBookingId?.bookingCode || request.originalBookingId?._id || '-'}</Text>
          <Text style={styles.tableSummary}>Deadline: {request.deadlineAt ? new Date(request.deadlineAt).toLocaleString() : '-'}</Text>
          <Text style={styles.tableSummary}>Seller confirmation: {request.sellerConfirmedUnavailable ? 'Unavailable confirmed' : 'Awaiting confirmation'}</Text>
          {Array.isArray(request.auditLogs) && request.auditLogs.length ? (
            <View style={styles.timelineBox}>
              {request.auditLogs.slice(-4).map((log, index) => (
                <Text key={`${log.event}-${index}`} style={styles.tableSummary}>{String(log.event).replace(/_/g, ' ')} - {log.at ? new Date(log.at).toLocaleString() : '-'}</Text>
              ))}
            </View>
          ) : null}
          {!request.sellerConfirmedUnavailable ? (
            <TouchableOpacity style={[styles.actionButton, styles.approveButton]} onPress={() => confirmUnavailable(request._id || request.id)} activeOpacity={0.84}>
              <Text style={styles.approveButtonText}>Confirm unavailable</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );

  const renderCatalog = () => (
    <View style={styles.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.dashboardHeader}>
          {hideChrome ? null : (
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t('seller.businessDashboard')}</Text>
            <Text style={styles.text}>{t('seller.businessHelp')}</Text>
          </View>
          )}
          <TouchableOpacity style={styles.smallPrimaryButton} onPress={() => beginEditBusiness(null)} activeOpacity={0.84}>
            <Text style={styles.smallPrimaryText}>{t('actions.addBusiness')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsGrid}>
          <MetricCard label={t('seller.businesses')} value={stats.businesses} />
          <MetricCard label={t('seller.active')} value={stats.activeBusinesses} />
          <MetricCard label={t('seller.bookings')} value={stats.totalBookings} />
          <MetricCard label={t('seller.revenue')} value={`RWF ${Number(stats.totalRevenue || 0).toLocaleString()}`} />
          <MetricCard label={t('seller.listings')} value={stats.listings} />
        </View>

        {loading && !refreshing ? <ActivityIndicator color={colors.primary} size="large" style={{ marginVertical: 20 }} /> : null}

        <View style={styles.businessPanel}>
          {serviceCategories.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
              <TouchableOpacity
                style={[styles.remainingPill, !catalogCategoryId && { backgroundColor: colors.primary }]}
                onPress={() => setCatalogCategoryId('')}
                activeOpacity={0.84}
              >
                <Text style={[styles.remainingText, !catalogCategoryId && { color: colors.white }]}>All categories</Text>
              </TouchableOpacity>
              {serviceCategories.map((category) => {
                const id = String(category._id || category.id);
                const active = catalogCategoryId === id;
                return (
                  <TouchableOpacity
                    key={id}
                    style={[styles.remainingPill, active && { backgroundColor: colors.primary }]}
                    onPress={() => setCatalogCategoryId(id)}
                    activeOpacity={0.84}
                  >
                    <Text style={[styles.remainingText, active && { color: colors.white }]}>{category.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : null}

          {(services.length ? services : data).length === 0 && !loading ? (
            <View style={styles.emptyContainer}>
              <Feather name="briefcase" size={44} color={colors.muted} />
              <Text style={styles.emptyText}>{t('seller.noBusinesses')}</Text>
            </View>
          ) : null}

          {(services.length ? services : data)
            .filter((item) => matchesServiceFilter(item, section || 'all'))
            .filter((item) => !catalogCategoryId || serviceCategoryId(item) === catalogCategoryId)
            .map((item) => (
            <View key={item._id || item.id} style={styles.businessCard}>
              <View style={styles.businessTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{item.name || item.title}</Text>
                  <Text style={styles.itemTypeLabel}>
                    {serviceCategoryLabel(item, serviceCategories)}
                  </Text>
                </View>
                <View style={styles.remainingPill}>
                  <Text style={styles.remainingText}>{t('seller.remaining', { count: item.availableQuantity ?? item.quantityRemaining ?? 0 })}</Text>
                </View>
                <MenuTrigger onPress={() => setOverflow({
                  visible: true,
                  title: item.name || item.title || t('seller.service'),
                  items: [
                    { key: 'view', icon: 'eye', label: t('actions.view'), onPress: () => openServiceView(item) },
                    { key: 'edit', icon: 'edit-2', label: t('actions.edit'), onPress: () => beginEditBusiness(item) },
                    {
                      key: 'availability',
                      icon: item.status === 'unavailable' ? 'check-circle' : 'slash',
                      label: item.status === 'unavailable' ? t('actions.setAvailable') : t('actions.setUnavailable'),
                      onPress: () => setBusinessAvailability(item, item.status === 'unavailable' ? 'available' : 'unavailable'),
                    },
                    { key: 'delete', icon: 'trash-2', label: t('actions.delete'), destructive: true, onPress: () => deleteBusiness(item) },
                  ],
                })} />
              </View>
              <Text style={styles.itemDescription}>{item.description || t('seller.noDescription')}</Text>
              <Text style={styles.managedText}>{t('seller.priceManaged')}</Text>
              {item.imageReviewStatus === 'pending_image_review' ? <Text style={styles.statusNote}>New images are waiting for admin review. Approved images remain public.</Text> : null}
              {item.imageReviewStatus === 'rejected' ? <Text style={styles.statusNoteDanger}>New images were rejected. Approved images remain public.</Text> : null}
              {Array.isArray(item.images) && item.images.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.businessImages}>
                  {(item.primaryImage ? [item.primaryImage, ...item.images] : item.images)
                    .filter((image, index, arr) => arr.indexOf(image) === index)
                    .slice(0, 5)
                    .map((image, index) => (
                      <Image key={`${image}-${index}`} source={{ uri: typeof image === 'string' ? image : image?.url }} style={styles.businessImage} />
                    ))}
                </ScrollView>
              ) : null}
              <Text style={styles.tableSummary}>
                {item.supportsOptions === false
                  ? `Base price: RWF ${Number(item.basePrice || 0).toLocaleString()}`
                  : `Options: ${item.options?.length || item.availabilityTable?.rows?.length || 0}`}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <ServiceEditorModal
        visible={businessEditorOpen}
        service={editingBusiness}
        categories={serviceCategories}
        existingOptions={editingOptions}
        onClose={() => {
          setBusinessEditorOpen(false);
          setEditingBusiness(null);
          setEditingOptions([]);
        }}
        onSaved={async () => {
          showResult(t('common.success'), t('backend.businessSaved'));
          setBusinessEditorOpen(false);
          setEditingBusiness(null);
          setEditingOptions([]);
          await loadData(true);
        }}
      />
    </View>
  );

  const renderAnalytics = () => (
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />} contentContainerStyle={styles.scrollContent}>
      <View style={styles.statsGrid}>
        <MetricCard label="Services" value={stats.listings || stats.businesses || 0} />
        <MetricCard label="Revenue" value={`RWF ${Number(stats.totalRevenue || 0).toLocaleString()}`} />
        <MetricCard label="Held money" value={`RWF ${Number(stats.heldPayout || 0).toLocaleString()}`} />
        <MetricCard label="Bookings" value={stats.totalBookings || 0} />
        <MetricCard label="Active bookings" value={stats.activeBookings || 0} />
        <MetricCard label="Completed" value={stats.completedBookings || 0} />
        <MetricCard label="Cancellation rate" value={`${stats.cancellationRate || 0}%`} />
        <MetricCard label="Low availability" value={stats.lowAvailability || 0} />
        <MetricCard label="Pending services" value={stats.pendingServices || 0} />
        <MetricCard label="Approved services" value={stats.approvedServices || 0} />
      </View>
      <TouchableOpacity style={styles.smallPrimaryButton} onPress={onRefresh} activeOpacity={0.84}>
        <Text style={styles.smallPrimaryText}>Refresh</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderFinance = () => {
    const providerOptions = (payoutDetails.method === 'bank' ? payoutProviders.bankProviders : payoutProviders.mobileMoneyProviders)
      .map((item) => [item.id, item.name]);
    return (
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />} contentContainerStyle={styles.scrollContent}>
        {(!section || section === 'finance') ? (
          <>
            <View style={styles.statsGrid}>
              <MetricCard label="Gross collected" value={`RWF ${Number(finance.summary?.grossCollected || stats.totalRevenue || 0).toLocaleString()}`} />
              <MetricCard label="Pending payout" value={`RWF ${Number(finance.summary?.pendingPayout || stats.pendingPayout || 0).toLocaleString()}`} />
              <MetricCard label="Held payout" value={`RWF ${Number(finance.summary?.heldPayout || stats.heldPayout || 0).toLocaleString()}`} />
              <MetricCard label="Failed payout" value={`RWF ${Number(finance.summary?.failedPayout || stats.failedPayout || 0).toLocaleString()}`} />
            </View>
            {(finance.transactions || []).map((tx) => (
              <View key={tx._id || tx.payoutReference} style={styles.businessCard}>
                <Text style={styles.itemTitle}>{tx.bookingId?.bookingCode || tx.payoutReference || 'Payout'}</Text>
                <Text style={styles.tableSummary}>Amount: RWF {Number(tx.amount || 0).toLocaleString()}</Text>
                <Text style={styles.tableSummary}>Status: {labelStatus(tx.payoutStatus)}</Text>
                <Text style={styles.tableSummary}>Account: {tx.payoutAccount || '-'}</Text>
                <Text style={styles.itemDescription}>{tx.payoutMessage || ''}</Text>
              </View>
            ))}
            {!finance.transactions?.length ? <Text style={styles.managedText}>No payout transactions yet.</Text> : null}
          </>
        ) : (
          <View style={styles.businessCard}>
            <Text style={styles.itemTitle}>Payout account</Text>
            <Text style={styles.itemDescription}>Customers cannot pay until valid MoMo or bank details are saved.</Text>
            {!payoutDetails.accountNumber ? <Text style={styles.statusNoteDanger}>Warning: payout details are missing.</Text> : null}
            <ModalSelectField
              label={t('seller.payoutMethod')}
              value={payoutDetails.method}
              options={[['momo', t('bookingForm.mobileMoney')], ['bank', t('seller.bankAccount')]]}
              onChange={(value) => setPayoutDetails((current) => ({
                ...current,
                method: value,
                providerId: value === 'bank' ? (payoutProviders.bankProviders[0]?.id || 'equity') : (payoutProviders.mobileMoneyProviders[0]?.id || 'mtn'),
              }))}
              searchable={false}
            />
            {providerOptions.length ? (
              <ModalSelectField
                label="Provider"
                value={payoutDetails.providerId}
                options={providerOptions}
                onChange={(value) => setPayoutDetails((current) => ({ ...current, providerId: value }))}
                searchable={false}
              />
            ) : null}
            <TextField label={t('seller.payoutAccountName')} value={payoutDetails.accountName} onChangeText={(text) => setPayoutDetails((current) => ({ ...current, accountName: text }))} />
            <TextField label={t('seller.payoutAccountNumber')} value={payoutDetails.accountNumber} onChangeText={(text) => setPayoutDetails((current) => ({ ...current, accountNumber: text }))} keyboardType="phone-pad" />
            <TouchableOpacity style={[styles.saveButton, savingPayout && { opacity: 0.72 }]} onPress={savePayoutAccount} disabled={savingPayout} activeOpacity={0.86}>
              {savingPayout ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveButtonText}>Save payout account</Text>}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      {tab === 'analytics' && renderAnalytics()}
      {tab === 'bookings' && (!section || section === 'bookings') && renderBookings()}
      {tab === 'bookings' && section === 'rebook' && renderRebookRequests()}
      {tab === 'bookings' && section === 'verify' && renderVerify()}
      {tab === 'catalog' && renderCatalog()}
      {tab === 'finance' && renderFinance()}
      <OverflowMenu
        visible={overflow.visible}
        title={overflow.title}
        items={overflow.items}
        onClose={() => setOverflow({ visible: false, title: 'Actions', items: [] })}
      />
      <ServiceDetailsView
        visible={Boolean(viewService)}
        service={viewService}
        loading={viewServiceLoading}
        showProvider={false}
        title={t('actions.view')}
        onClose={() => setViewService(null)}
      />
      <BookingDetailModal booking={selectedBooking} onClose={() => setSelectedBooking(null)} />
      <BookingReviewModal
        booking={reviewBooking}
        form={reviewForm}
        setForm={setReviewForm}
        loading={loading}
        onClose={() => setReviewBooking(null)}
        onApprove={approveReviewedBooking}
        onReject={rejectReviewedBooking}
      />
      {dialogNode}
    </View>
  );
}

function MetricCard({ label, value }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function BookingDetailModal({ booking, onClose }) {
  if (!booking) return null;
  const responses = Array.isArray(booking.bookingDetails?.customResponses) ? booking.bookingDetails.customResponses : [];
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalScreen}>
        <ScrollView contentContainerStyle={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Booking details</Text>
            <TouchableOpacity style={styles.modalClose} onPress={onClose} activeOpacity={0.84}>
              <Feather name="x" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>
          <Text style={styles.itemTitle}>{booking.bookingCode || booking._id}</Text>
          <Text style={styles.tableSummary}>Customer: {booking.touristId?.name || booking.userId?.name || booking.touristId?.email || '-'}</Text>
          <Text style={styles.tableSummary}>Service: {booking.serviceId?.title || booking.bookingDetails?.requestedService || booking.destinationPlace || '-'}</Text>
          <Text style={styles.tableSummary}>Status: {String(booking.status || '-').replace(/_/g, ' ')}</Text>
          <Text style={styles.tableSummary}>Payment: {String(booking.paymentStatus || 'unpaid').replace(/_/g, ' ')}</Text>
          <Text style={styles.tableSummary}>Amount paid: RWF {Number(booking.amountPaid || 0).toLocaleString()}</Text>
          <Text style={styles.tableSummary}>Total: RWF {Number(booking.totalPrice || 0).toLocaleString()}</Text>
          {booking.promotionSnapshot?.title ? (
            <Text style={styles.tableSummary}>Promotion: {booking.promotionSnapshot.title} ({booking.promotionSnapshot.percent}%)</Text>
          ) : null}
          {responses.map((item, index) => (
            <Text key={`${item.fieldId || item.label}-${index}`} style={styles.tableSummary}>{item.label}: {String(item.value ?? '')}</Text>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

function BookingReviewModal({ booking, form, setForm, loading, onClose, onApprove, onReject }) {
  if (!booking) return null;
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalScreen}>
        <ScrollView contentContainerStyle={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Review booking</Text>
              <Text style={styles.modalSubtitle}>{booking.bookingCode || booking._id}</Text>
            </View>
            <TouchableOpacity style={styles.modalClose} onPress={onClose} activeOpacity={0.84}>
              <Feather name="x" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>
          <Text style={styles.itemDescription}>
            {(booking.touristId?.name || booking.userId?.name || 'Customer')} · {(booking.serviceId?.title || booking.bookingDetails?.requestedService || 'Service')}
          </Text>
          <NumberField label="Final price (RWF)" value={String(form.totalPrice)} onChangeText={(text) => setForm((current) => ({ ...current, totalPrice: text }))} />
          <NumberField label="Payment deadline (hours)" value={String(form.paymentDeadlineHours)} onChangeText={(text) => setForm((current) => ({ ...current, paymentDeadlineHours: text }))} />
          <TextField label="Payment reason" value={form.paymentReason} onChangeText={(text) => setForm((current) => ({ ...current, paymentReason: text }))} />
          <MultilineField label="Note to customer" value={form.note} onChangeText={(text) => setForm((current) => ({ ...current, note: text }))} />
          <MultilineField label="Reject reason" value={form.reason} onChangeText={(text) => setForm((current) => ({ ...current, reason: text }))} />
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.actionButton, styles.approveButton, loading && { opacity: 0.7 }]} onPress={onApprove} disabled={loading} activeOpacity={0.84}>
              <Text style={styles.approveButtonText}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, styles.rejectButton, loading && { opacity: 0.7 }]} onPress={onReject} disabled={loading} activeOpacity={0.84}>
              <Text style={styles.rejectButtonText}>Reject</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function Panel({ title, children }) {
  return (
    <View style={styles.editorPanel}>
      <Text style={styles.editorPanelTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Field({ label, multiline, style, quickDates, onQuickDate, ...props }) {
  const { t } = useTranslation();
  return (
    <View style={[styles.fieldWrap, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...props}
        multiline={multiline}
        placeholderTextColor={colors.muted}
        placeholder={quickDates ? t('seller.placeholders.date') : props.placeholder}
        style={[styles.fieldInput, multiline && styles.fieldTextArea]}
      />
      {quickDates ? (
        <View style={styles.quickDateRow}>
          {[
            [t('seller.quickDates.today'), addDays(0)],
            [t('seller.quickDates.sevenDays'), addDays(7)],
            [t('seller.quickDates.thirtyDays'), addDays(30)],
          ].map(([labelText, value]) => (
            <TouchableOpacity key={labelText} style={styles.quickDateButton} onPress={() => onQuickDate?.(value)} activeOpacity={0.84}>
              <Text style={styles.quickDateText}>{labelText}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function SelectField({ label, value, options, onChange }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.selectGrid}>
        {options.map(([optionValue, optionLabel]) => (
          <TouchableOpacity
            key={optionValue}
            style={[styles.selectOption, value === optionValue && styles.selectOptionActive]}
            onPress={() => onChange(optionValue)}
            activeOpacity={0.84}
          >
            <Text style={[styles.selectOptionText, value === optionValue && styles.selectOptionTextActive]}>{optionLabel}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 18,
    paddingTop: 62,
    paddingBottom: 24,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 8,
  },
  text: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 18,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statsCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statsLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  statsNumber: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 6,
  },
  dashboardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  smallPrimaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  smallPrimaryText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '900',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    marginBottom: 12,
  },
  metricCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: '31%',
    padding: 12,
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
  },
  metricValue: {
    color: colors.primary,
    fontSize: 17,
    fontWeight: '900',
    marginTop: 6,
  },
  infoText: {
    backgroundColor: colors.successSurface,
    borderRadius: 8,
    color: colors.success,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 10,
    padding: 10,
  },
  businessPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  businessCard: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 12,
  },
  businessTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  remainingPill: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  remainingText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '900',
  },
  managedText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 10,
  },
  statusNote: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
  },
  statusNoteDanger: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
  },
  businessImages: {
    gap: 8,
    marginTop: 11,
  },
  businessImage: {
    borderRadius: 8,
    height: 58,
    width: 78,
  },
  tableSummary: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 10,
  },
  businessActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  outlineButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  outlineButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  deleteButton: {
    alignItems: 'center',
    backgroundColor: colors.dangerSurface,
    borderRadius: 8,
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 38,
  },
  deleteButtonText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '900',
  },
  modalScreen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  modalContent: {
    padding: 14,
    paddingTop: 42,
    paddingBottom: 24,
  },
  modalHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '900',
  },
  modalSubtitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  modalClose: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  editorPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 12,
  },
  editorPanelTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 8,
  },
  twoColumns: {
    flexDirection: 'row',
    gap: 8,
  },
  fieldWrap: {
    flex: 1,
    marginTop: 8,
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 5,
  },
  fieldInput: {
    ...baseInputStyle(colors),
    borderRadius: 8,
    fontSize: 12,
    fontWeight: '700',
    minHeight: 42,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  fieldTextArea: {
    minHeight: 86,
    textAlignVertical: 'top',
  },
  uploadButton: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  uploadButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  uploadHint: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 7,
  },
  uploadPreviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  uploadPreviewCard: {
    borderRadius: 8,
    height: 86,
    overflow: 'hidden',
    position: 'relative',
    width: 104,
  },
  uploadPreviewImage: {
    height: '100%',
    width: '100%',
  },
  removeImageButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(16, 24, 40, 0.78)',
    borderRadius: 12,
    height: 24,
    justifyContent: 'center',
    position: 'absolute',
    right: 6,
    top: 6,
    width: 24,
  },
  emptyUploadBox: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 8,
    borderStyle: 'dashed',
    borderWidth: 1,
    gap: 6,
    marginTop: 12,
    padding: 16,
  },
  emptyUploadText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  optionEditor: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 8,
    marginBottom: 10,
    padding: 10,
  },
  optionEditorHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  optionEditorTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  segmentButton: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  segmentActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  segmentText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'capitalize',
  },
  segmentTextActive: {
    color: colors.white,
  },
  checkboxLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 9,
    marginTop: 10,
  },
  checkboxBox: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 5,
    borderWidth: 1,
    height: 21,
    justifyContent: 'center',
    width: 21,
  },
  checkboxBoxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  bookingFieldEditor: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 8,
    marginTop: 9,
    padding: 10,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
  },
  saveButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '900',
  },
  bookingCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 14,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  bookingId: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  dateLabel: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 4,
  },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  timelineBox: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 12,
  },
  clientDetails: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  priceRow: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 6,
  },
  priceBold: {
    color: colors.text,
    fontWeight: '800',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveButton: {
    backgroundColor: colors.primary,
  },
  approveButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '800',
  },
  outlineAction: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  outlineActionText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  rejectButton: {
    backgroundColor: colors.dangerSurface,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  rejectButtonText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '800',
  },
  verifyBox: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 20,
  },
  verifyLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  inputSearchRow: {
    flexDirection: 'row',
    gap: 10,
  },
  verifyInput: {
    ...baseInputStyle(colors),
    borderRadius: 10,
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    height: 48,
    paddingHorizontal: 16,
  },
  verifyBtn: {
    width: 90,
    height: 48,
    backgroundColor: colors.primary,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '800',
  },
  verifyError: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
    textAlign: 'center',
  },
  verifySuccess: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
    textAlign: 'center',
  },
  verifiedCard: {
    backgroundColor: colors.successSurface,
    borderWidth: 1,
    borderColor: '#84E1BC',
    borderRadius: 16,
    padding: 16,
  },
  verifiedCardTitle: {
    color: colors.success,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },
  verifiedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {
    color: colors.success,
    fontSize: 14,
  },
  infoValue: {
    color: colors.success,
    fontSize: 14,
    fontWeight: '700',
  },
  completeCheckInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    backgroundColor: colors.success,
    borderRadius: 10,
    marginTop: 18,
  },
  completeCheckInText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '800',
  },
  itemCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 14,
  },
  itemTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  itemTypeLabel: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  itemPrice: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '800',
  },
  itemDescription: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 10,
    opacity: 0.8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: '600',
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 14,
  },
  editorErrorText: {
    backgroundColor: colors.dangerSurface,
    borderRadius: 8,
    color: colors.danger,
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 17,
    marginBottom: 12,
    padding: 10,
  },
  quickDateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 7,
  },
  quickDateButton: {
    backgroundColor: colors.primaryLight,
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  quickDateText: {
    color: colors.primaryDark,
    fontSize: 10,
    fontWeight: '900',
  },
  selectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  selectOption: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  selectOptionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  selectOptionText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
  },
  selectOptionTextActive: {
    color: colors.white,
  },
});
