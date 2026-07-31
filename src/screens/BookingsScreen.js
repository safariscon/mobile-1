import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import BookingMap from '../components/BookingMap';
import { API_BASE_URL, apiFetch } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { toCoordinatePair } from '../lib/directions';
import { ANALYTICS_EVENTS, trackAnalytics } from '../lib/analytics';
import { realtimeUserRooms, useRealtimeRefresh } from '../lib/realtime';
import { lightColors } from '../theme/colors';
import useThemedStyles from '../theme/useThemedStyles';

let colors = lightColors;
let styles;

const PAID_STATUSES = ['deposit_paid', 'deposit-paid', 'paid', 'completed'];

function parseJson(response) {
  return response.json().catch(() => ({}));
}

function formatMoney(value, t) {
  const amount = Number(value || 0);
  return amount > 0 ? `RWF ${amount.toLocaleString()}` : t('customerBookings.pendingQuote');
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
}

function formatStatus(value) {
  return String(value || 'pending')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function hasDepositPaid(booking) {
  return Boolean(booking?.detailsUnlocked || booking?.providerDetailsUnlocked || booking?.depositPaid || PAID_STATUSES.includes(booking?.paymentStatus));
}

function canPayDeposit(booking) {
  return ['confirmed', 'waiting-for-payment'].includes(booking?.status) || booking?.paymentStatus === 'pending';
}

function getBusiness(booking) {
  return booking?.hotelId || booking?.preferredHotelId || booking?.businessId || booking?.preferredBusinessId || null;
}

function getBookingTitle(booking, t) {
  const business = getBusiness(booking);
  return booking?.bookingDetails?.serviceName
    || booking?.bookingDetails?.requestedService
    || booking?.destinationPlace
    || business?.name
    || business?.businessName
    || t('customerBookings.booking');
}

function getLocation(booking, t) {
  const business = getBusiness(booking);
  const location = business?.serviceLocation || business?.publicLocation || business?.locationDetails || {};
  return booking?.destinationLocation
    || [location.province, location.district, location.sector].filter(Boolean).join(', ')
    || business?.location
    || t('common.rwanda');
}

function getSchedule(booking) {
  const details = booking?.bookingDetails || {};
  const date = details.bookingDate || booking?.checkIn;
  const endDate = details.endDate || booking?.checkOut;
  const startTime = details.startTime || '';
  const endTime = details.endTime || '';
  const dateText = [formatDate(date), endDate && endDate !== date ? formatDate(endDate) : ''].filter(Boolean).join(' - ');
  const timeText = [startTime, endTime].filter(Boolean).join(' - ');
  return [dateText, timeText].filter((item) => item && item !== '-').join(' at ') || '-';
}

function getDepositAmount(booking) {
  return Number(booking?.depositAmount || Math.round(Number(booking?.totalPrice || 0) * 0.3));
}

function getDetailRows(details = {}) {
  const hiddenKeys = new Set(['agreeToTerms', 'customResponses']);
  const fixedRows = Object.entries(details)
    .filter(([key, value]) => !hiddenKeys.has(key) && value !== undefined && value !== null && String(value).trim() !== '')
    .map(([key, value]) => [formatStatus(key), Array.isArray(value) ? value.join(', ') : String(value)]);
  const customRows = Array.isArray(details.customResponses)
    ? details.customResponses
        .filter((item) => item?.label && item.value !== undefined && item.value !== null && String(item.value).trim() !== '')
        .map((item) => [item.label, Array.isArray(item.value) ? item.value.join(', ') : String(item.value)])
    : [];
  return [...fixedRows, ...customRows];
}

function statusTone(status) {
  if (PAID_STATUSES.includes(status)) return { bg: '#DCFCE7', text: '#047857' };
  if (['confirmed', 'waiting-for-payment', 'pending'].includes(status)) return { bg: '#DBEAFE', text: '#1D4ED8' };
  if (['cancelled', 'rejected', 'refunded'].includes(status)) return { bg: '#FEE2E2', text: '#B91C1C' };
  return { bg: '#F3F4F6', text: '#475569' };
}

export default function BookingsScreen({ onOpenRoute }) {
  const themed = useThemedStyles(createStyles);
  colors = themed.colors;
  styles = themed.styles;
  const { t } = useTranslation();
  const { token, isAuthenticated, user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, hasNextPage: false, totalPages: 0 });
  const [changeRequests, setChangeRequests] = useState([]);
  const [changeLoading, setChangeLoading] = useState(false);
  const [changeError, setChangeError] = useState('');
  const abortRef = useRef(null);
  const loadedPagesRef = useRef(new Set());
  const pageSize = 20;

  const loadBookings = useCallback(async ({ page = 1, replace = false, silent = false } = {}) => {
    if (!isAuthenticated) return;
    if (loadedPagesRef.current.has(page) && !replace) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    if (!silent && page === 1) setLoading(true);
    if (page > 1) setLoadingMore(true);
    setError('');

    try {
      const response = await apiFetch(`/bookings/my?page=${page}&limit=${pageSize}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });
      const data = await parseJson(response);
      if (!response.ok) throw new Error(t('customerBookings.fetchFailed'));
      const items = Array.isArray(data) ? data : data.bookings || data.items || [];
      loadedPagesRef.current.add(page);
      setBookings((current) => {
        if (replace || page === 1) return items;
        const seen = new Set(current.map((item) => item._id || item.id));
        return current.concat(items.filter((item) => !seen.has(item._id || item.id)));
      });
      setPagination(data.pagination || { page, hasNextPage: false, totalPages: page });
    } catch (requestError) {
      if (requestError.name !== 'AbortError') setError(t('customerBookings.loadFailed'));
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [isAuthenticated, t, token]);

  const loadChangeRequests = useCallback(async () => {
    if (!isAuthenticated) return;
    setChangeLoading(true);
    setChangeError('');
    try {
      const response = await apiFetch('/rebook/customer?page=1', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        timeoutMs: 6000,
      });
      const data = await parseJson(response);
      if (!response.ok) throw new Error(data.message || 'Could not load booking change requests.');
      setChangeRequests(data.requests || []);
    } catch (requestError) {
      setChangeError(requestError.message || 'Could not load booking change requests.');
    } finally {
      setChangeLoading(false);
    }
  }, [isAuthenticated, token]);

  const refreshLiveData = useCallback(() => {
    loadedPagesRef.current.clear();
    loadBookings({ page: 1, replace: true, silent: true });
    loadChangeRequests();
  }, [loadBookings, loadChangeRequests]);

  useEffect(() => {
    loadBookings({ page: 1, replace: true });
    loadChangeRequests();
    return () => abortRef.current?.abort();
  }, [loadBookings, loadChangeRequests]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshLiveData();
    });
    return () => {
      subscription.remove();
    };
  }, [refreshLiveData]);

  const realtimeRooms = useMemo(() => realtimeUserRooms(user), [user]);

  useRealtimeRefresh({
    enabled: isAuthenticated,
    rooms: realtimeRooms,
    events: ['booking:changed', 'notification:new'],
    onRefresh: refreshLiveData,
  });

  const summary = useMemo(() => ({
    total: bookings.length,
    pending: bookings.filter((booking) => ['pending', 'reviewing', 'waiting-for-payment', 'confirmed'].includes(booking.status)).length,
    completed: bookings.filter((booking) => ['completed', 'provider-details-unlocked'].includes(booking.status) || hasDepositPaid(booking)).length,
  }), [bookings]);

  const handleRefresh = () => {
    loadedPagesRef.current.clear();
    setRefreshing(true);
    loadBookings({ page: 1, replace: true, silent: true });
    loadChangeRequests();
  };

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !pagination?.hasNextPage) return;
    loadBookings({ page: Number(pagination.page || 1) + 1, silent: true });
  }, [loadBookings, loading, loadingMore, pagination]);

  const handlePayDeposit = async (bookingId) => {
    trackAnalytics(ANALYTICS_EVENTS.PAY_DEPOSIT_CLICKED, { bookingId });
    setLoading(true);
    try {
      const response = await apiFetch(`/bookings/${bookingId}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          paymentMethod: 'mobile-money',
          senderAccount: user?.phone || bookingId,
        }),
      });
      const data = await parseJson(response);
      if (!response.ok) throw new Error(t('customerBookings.paymentProcessingFailed'));
      trackAnalytics(ANALYTICS_EVENTS.PAYMENT_SUCCESS, { bookingId, paymentId: data.payment?._id });
      loadedPagesRef.current.clear();
      await loadBookings({ page: 1, replace: true, silent: true });
      setSelectedBooking(data.booking || null);
    } catch (requestError) {
      trackAnalytics(ANALYTICS_EVENTS.PAYMENT_FAILED, { bookingId });
      setError(t('customerBookings.paymentFailed'));
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <View style={styles.center}>
        <Feather name="lock" size={32} color={colors.muted} />
        <Text style={styles.errorText}>{t('customerBookings.loginRequired')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={bookings}
        keyExtractor={(item, index) => String(item._id || item.id || index)}
        renderItem={({ item }) => <BookingRow booking={item} onView={() => setSelectedBooking(item)} />}
        ListHeaderComponent={(
          <>
            <View style={styles.hero}>
              <Text style={styles.eyebrow}>{t('customerBookings.eyebrow')}</Text>
              <Text style={styles.title}>{t('customerBookings.welcome', { name: user?.name ? `, ${user.name.split(' ')[0]}` : '' })}</Text>
              <Text style={styles.text}>{t('customerBookings.text')}</Text>
              <TouchableOpacity style={styles.refreshButton} onPress={() => loadBookings({ page: 1, replace: true })} activeOpacity={0.84}>
                <Feather name="refresh-cw" size={15} color={colors.primary} />
                <Text style={styles.refreshText}>{t('actions.refresh')}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.summaryGrid}>
              <SummaryCard label={t('customerBookings.total')} value={summary.total} icon="calendar" />
              <SummaryCard label={t('customerBookings.pending')} value={summary.pending} icon="clock" />
              <SummaryCard label={t('customerBookings.completed')} value={summary.completed} icon="check-circle" />
            </View>

            <ChangeRequestsPanel
              requests={changeRequests}
              loading={changeLoading}
              error={changeError}
              onRefresh={loadChangeRequests}
            />

            {error ? (
              <TouchableOpacity style={styles.errorBox} onPress={() => loadBookings({ page: 1, replace: true })} activeOpacity={0.84}>
                <Text style={styles.errorBoxText}>{t('customerBookings.retry', { message: error })}</Text>
              </TouchableOpacity>
            ) : null}

            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>{t('customerBookings.myBookings')}</Text>
            </View>
          </>
        )}
        ListEmptyComponent={!loading ? (
          <View style={styles.emptyState}>
            <Feather name="calendar" size={42} color={colors.muted} />
            <Text style={styles.emptyText}>{t('customerBookings.empty')}</Text>
          </View>
        ) : null}
        ListFooterComponent={loading || loadingMore ? <ActivityIndicator color={colors.primary} size="large" style={styles.loader} /> : !pagination?.hasNextPage && bookings.length ? <Text style={styles.endText}>End of results</Text> : null}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        onEndReached={loadMore}
        onEndReachedThreshold={0.35}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
      />

      <BookingDetailsModal
        booking={selectedBooking}
        visible={Boolean(selectedBooking)}
        onClose={() => setSelectedBooking(null)}
        onPay={handlePayDeposit}
        onOpenRoute={onOpenRoute}
        onChangeSubmitted={() => {
          loadChangeRequests();
          loadedPagesRef.current.clear();
          loadBookings({ page: 1, replace: true, silent: true });
        }}
        t={t}
      />
    </View>
  );
}

function SummaryCard({ label, value, icon }) {
  return (
    <View style={styles.summaryCard}>
      <Feather name={icon} size={17} color={colors.primary} />
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const BookingRow = memo(function BookingRow({ booking, onView }) {
  const { t } = useTranslation();
  const tone = statusTone(booking.paymentStatus || booking.status);
  return (
    <View style={styles.bookingRow}>
      <View style={styles.bookingCopy}>
        <Text style={styles.bookingMeta}>{formatDate(booking.createdAt)} - {booking.bookingCode || String(booking._id || '').slice(-8)}</Text>
        <Text style={styles.bookingTitle}>{getBookingTitle(booking, t)}</Text>
        <Text style={styles.bookingLocation}>{getLocation(booking, t)}</Text>
      </View>
      <View style={styles.bookingActions}>
        <View style={[styles.statusBadge, { backgroundColor: tone.bg }]}>
          <Text style={[styles.statusText, { color: tone.text }]}>{formatStatus(booking.paymentStatus || booking.status)}</Text>
        </View>
        <TouchableOpacity style={styles.viewButton} onPress={onView} activeOpacity={0.84}>
          <Text style={styles.viewButtonText}>{t('customerBookings.view')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

function BookingDetailsModal({ booking, visible, onClose, onPay, onOpenRoute, onChangeSubmitted, t }) {
  const [showChangeForm, setShowChangeForm] = useState(false);
  const [requestType, setRequestType] = useState('rebook');
  const [reason, setReason] = useState('');
  const [changeSaving, setChangeSaving] = useState(false);
  const [changeMessage, setChangeMessage] = useState('');
  const [changeError, setChangeError] = useState('');
  if (!booking) return null;
  const business = getBusiness(booking);
  const depositPaid = hasDepositPaid(booking);
  const providerUnlocked = Boolean(booking.providerDetailsUnlocked || booking.detailsUnlocked || depositPaid);
  const canPay = canPayDeposit(booking) && !depositPaid;
  const details = booking.bookingDetails || {};
  const contact = providerUnlocked ? business?.contactDetails || business?.contactInfo || {} : {};
  const serviceLocation = business?.serviceLocation || business?.publicLocation || business?.locationDetails || {};
  const locationUnlocked = depositPaid && providerUnlocked && booking.locationUnlocked === true;
  const destinationCoordinates = locationUnlocked
    ? toCoordinatePair(serviceLocation) || toCoordinatePair(contact) || toCoordinatePair(business)
    : null;
  const destinationAddress = locationUnlocked
    ? serviceLocation.fullAddress || business?.location || getLocation(booking, t)
    : '';
  const canOpenDirections = locationUnlocked && (destinationCoordinates || destinationAddress);
  const submittedRows = getDetailRows(details);
  const remainingBalance = Math.max(0, Number(booking.remainingBalance ?? Number(booking.totalPrice || 0) - Number(booking.amountPaid || 0)));
  const canRequestChange = depositPaid && !['completed', 'cancelled', 'rejected'].includes(booking.status);

  const submitChangeRequest = async () => {
    if (!reason.trim()) {
      setChangeError('Please explain why you cannot attend.');
      return;
    }
    setChangeSaving(true);
    setChangeError('');
    setChangeMessage('');
    try {
      const response = await apiFetch('/rebook/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalBookingId: booking._id || booking.id,
          requestType,
          reason: reason.trim(),
        }),
      });
      const data = await parseJson(response);
      if (!response.ok) throw new Error(data.message || 'Could not submit booking change request.');
      setReason('');
      setChangeMessage(data.message || 'Your booking change request was submitted.');
      onChangeSubmitted?.(data.request);
    } catch (requestError) {
      setChangeError(requestError.message || 'Could not submit booking change request.');
    } finally {
      setChangeSaving(false);
    }
  };

  const openReceipt = () => {
    const receiptId = booking.verificationToken || booking._id;
    Linking.openURL(`${API_BASE_URL}/receipt/${encodeURIComponent(receiptId)}`).catch(() => {});
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalScreen}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('customerBookings.details')}</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.84}>
              <Feather name="x" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>

          <DetailGrid rows={[
            [t('customerBookings.name'), getBookingTitle(booking, t)],
            [t('customerBookings.type'), formatStatus(details.bookingType || business?.type || 'service')],
            [t('customerBookings.location'), getLocation(booking, t)],
            [t('customerBookings.status'), formatStatus(booking.status)],
            [t('customerBookings.paymentStatus'), formatStatus(booking.paymentStatus || 'unpaid')],
            [t('customerBookings.bookingCode'), booking.bookingCode || booking._id],
            [t('customerBookings.totalPrice'), formatMoney(booking.totalPrice, t)],
            [t('customerBookings.deposit'), formatMoney(getDepositAmount(booking), t)],
            [t('customerBookings.amountPaid'), formatMoney(booking.amountPaid, t)],
            [t('customerBookings.remainingBalance'), formatMoney(remainingBalance, t)],
            [t('customerBookings.schedule'), getSchedule(booking)],
            [t('customerBookings.quantityGuests'), details.quantity || booking.guests || booking.quantity || 1],
          ]} />

          <View style={[styles.noticeBox, providerUnlocked ? styles.unlockedNotice : styles.lockedNoticeBox]}>
            <Text style={styles.noticeTitle}>{providerUnlocked ? t('customerBookings.unlocked') : t('customerBookings.locked')}</Text>
            <Text style={styles.noticeText}>
              {providerUnlocked
                ? t('customerBookings.unlockedText')
                : canPay
                  ? t('customerBookings.payToUnlock', { amount: formatMoney(getDepositAmount(booking), t) })
                  : t('customerBookings.lockedText')}
            </Text>
          </View>

          {!!booking.adminResponseMessage && <Text style={styles.adminMessage}>{booking.adminResponseMessage}</Text>}

          <Text style={styles.sectionTitle}>{t('customerBookings.providerInfo')}</Text>
          <DetailGrid rows={[
            [t('customerBookings.business'), providerUnlocked ? business?.businessName || business?.name || '-' : business?.name || booking.anonymousBusinessName || t('customerBookings.hiddenUntilDeposit')],
            [t('customerBookings.province'), serviceLocation.province || '-'],
            [t('customerBookings.district'), serviceLocation.district || '-'],
            [t('customerBookings.sector'), serviceLocation.sector || '-'],
            locationUnlocked ? [t('customerBookings.fullAddress'), serviceLocation.fullAddress || business?.location || '-'] : [t('customerBookings.message'), t('customerBookings.payToUnlockLocation')],
            [t('customerBookings.phoneWhatsapp'), providerUnlocked ? [contact.phone, contact.whatsapp].filter(Boolean).join(' / ') || '-' : t('customerBookings.lockedValue')],
            [t('bookingForm.email'), providerUnlocked ? contact.email || business?.sellerContactEmail || business?.ownerEmail || '-' : t('customerBookings.lockedValue')],
            [t('customerBookings.approval'), providerUnlocked ? business?.approvalStatus || business?.verificationStatus || business?.status || '-' : t('customerBookings.lockedValue')],
          ]} />

          {providerUnlocked && Array.isArray(business?.images) && business.images.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imageRow}>
              {business.images.slice(0, 3).map((image, index) => (
                <Image key={`${image}-${index}`} source={{ uri: image }} style={styles.providerImage} />
              ))}
            </ScrollView>
          ) : null}

          {locationUnlocked && destinationCoordinates ? (
            <View style={styles.mapCard}>
              <BookingMap
                style={styles.map}
                coordinates={destinationCoordinates}
                title={business?.businessName || business?.name || t('customerBookings.business')}
                description={destinationAddress}
              />
            </View>
          ) : null}

          {submittedRows.length ? (
            <>
              <Text style={styles.sectionTitle}>{t('customerBookings.submittedDetails')}</Text>
              <DetailGrid rows={submittedRows} />
            </>
          ) : null}

          <View style={styles.modalActions}>
            {canPay ? (
              <TouchableOpacity style={styles.primaryAction} onPress={() => onPay(booking._id)} activeOpacity={0.84}>
                <Text style={styles.primaryActionText}>{t('customerBookings.payDeposit')}</Text>
              </TouchableOpacity>
            ) : null}
            {depositPaid && booking.verificationToken ? (
              <TouchableOpacity style={styles.secondaryAction} onPress={openReceipt} activeOpacity={0.84}>
                <Feather name="file-text" size={16} color={colors.primary} />
                <Text style={styles.secondaryActionText}>{t('actions.downloadPdf')}</Text>
              </TouchableOpacity>
            ) : null}
            {canOpenDirections ? (
              <TouchableOpacity
                style={styles.secondaryAction}
                onPress={() => {
                  onClose?.();
                  onOpenRoute?.(booking);
                }}
                activeOpacity={0.84}
              >
                <Feather name="navigation" size={16} color={colors.primary} />
                <Text style={styles.secondaryActionText}>{t('actions.getDirections')}</Text>
              </TouchableOpacity>
            ) : null}
            {canRequestChange ? (
              <TouchableOpacity
                style={styles.secondaryAction}
                onPress={() => setShowChangeForm((value) => !value)}
                activeOpacity={0.84}
              >
                <Feather name="repeat" size={16} color={colors.primary} />
                <Text style={styles.secondaryActionText}>Request change</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {showChangeForm ? (
            <View style={styles.changeForm}>
              <Text style={styles.changeTitle}>Need to change this booking?</Text>
              <Text style={styles.changeText}>Tell us why you cannot attend and choose re-book or cancel.</Text>
              <View style={styles.segmentRow}>
                {['rebook', 'cancel'].map((type) => {
                  const active = requestType === type;
                  return (
                    <TouchableOpacity key={type} style={[styles.segmentButton, active && styles.segmentButtonActive]} onPress={() => setRequestType(type)} activeOpacity={0.84}>
                      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{type === 'rebook' ? 'Re-book' : 'Cancel'}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TextInput
                value={reason}
                onChangeText={setReason}
                placeholder="Please explain the reason and provide any details..."
                placeholderTextColor={colors.muted}
                multiline
                maxLength={1500}
                style={styles.reasonInput}
                textAlignVertical="top"
              />
              <Text style={styles.changeHint}>Submit before the allowed deadline. Re-book IDs are one-time use only.</Text>
              {!!changeError && <Text style={styles.formError}>{changeError}</Text>}
              {!!changeMessage && <Text style={styles.formSuccess}>{changeMessage}</Text>}
              <TouchableOpacity style={[styles.primaryAction, changeSaving && styles.disabledAction]} onPress={submitChangeRequest} disabled={changeSaving || Boolean(changeMessage)} activeOpacity={0.84}>
                {changeSaving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryActionText}>Submit request</Text>}
              </TouchableOpacity>
            </View>
          ) : null}

          {depositPaid && booking.verificationToken ? (
            <View style={styles.qrBox}>
              <Image source={{ uri: `${API_BASE_URL}/qr/${encodeURIComponent(booking.verificationToken)}` }} style={styles.qrImage} />
              <Text style={styles.qrText}>{t('customerBookings.qrText')}</Text>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

function ChangeRequestsPanel({ requests, loading, error, onRefresh }) {
  return (
    <View style={styles.changePanel}>
      <View style={styles.changePanelHeader}>
        <View>
          <Text style={styles.changePanelTitle}>My Booking Change Requests</Text>
          <Text style={styles.changePanelText}>Track Re-book IDs, cancellations, deadlines, and refunds.</Text>
        </View>
        <TouchableOpacity style={styles.miniRefreshButton} onPress={onRefresh} activeOpacity={0.84}>
          <Feather name="refresh-cw" size={14} color={colors.primary} />
        </TouchableOpacity>
      </View>
      {loading ? <ActivityIndicator color={colors.primary} style={styles.changeLoader} /> : null}
      {!!error && <Text style={styles.formError}>{error}</Text>}
      {!loading && !error && !requests.length ? <Text style={styles.changePanelText}>No booking change requests yet.</Text> : null}
      {requests.slice(0, 3).map((request) => (
        <View key={request._id || request.id} style={styles.changeCard}>
          <View style={styles.changeCardTop}>
            <Text style={styles.changeCardTitle}>{request.serviceId?.name || request.serviceId?.businessName || 'Service'}</Text>
            <View style={styles.changeStatusBadge}>
              <Text style={styles.changeStatusText}>{formatStatus(request.status)}</Text>
            </View>
          </View>
          <Text style={styles.changePanelText}>Booking ID: {request.originalBookingId?.bookingCode || request.originalBookingId?._id || '-'}</Text>
          <Text style={styles.changePanelText}>Action: {request.requestType === 'rebook' ? 'Re-book' : 'Cancel'}</Text>
          <Text style={styles.changePanelText}>Re-book ID: {request.rebookId || 'Not generated'}</Text>
          <Text style={styles.changePanelText}>Reason: {request.reason || '-'}</Text>
          {Array.isArray(request.auditLogs) && request.auditLogs.length ? (
            <View style={styles.timeline}>
              <Text style={styles.timelineTitle}>Request timeline</Text>
              {request.auditLogs.slice(-4).map((item, index) => (
                <Text key={`${item.event}-${index}`} style={styles.timelineText}>{formatStatus(item.event)} - {formatDate(item.at)}</Text>
              ))}
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function DetailGrid({ rows }) {
  return (
    <View style={styles.detailGrid}>
      {rows.filter((row) => row?.[1] !== undefined && row?.[1] !== null && String(row[1]).trim() !== '').map(([label, value]) => (
        <View key={`${label}-${value}`} style={styles.detailCell}>
          <Text style={styles.detailLabel}>{label}</Text>
          <Text style={styles.detailValue}>{String(value)}</Text>
        </View>
      ))}
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingTop: 58,
    paddingBottom: 28,
  },
  center: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    padding: 20,
  },
  hero: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    marginTop: 5,
  },
  text: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 5,
  },
  refreshButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  refreshText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 14,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    padding: 12,
  },
  summaryValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    marginTop: 9,
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
    marginTop: 3,
    textTransform: 'uppercase',
  },
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 14,
    overflow: 'hidden',
  },
  panelHeader: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 14,
  },
  panelTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
    padding: 14,
  },
  bookingRow: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  bookingCopy: {
    flex: 1,
  },
  bookingMeta: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  bookingTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
    marginTop: 4,
  },
  bookingLocation: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  bookingActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  viewButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  viewButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '900',
  },
  emptyState: {
    alignItems: 'center',
    gap: 9,
    paddingBottom: 28,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
  },
  loader: {
    marginVertical: 18,
  },
  endText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    paddingVertical: 18,
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: colors.dangerSurface,
    borderRadius: 8,
    marginTop: 14,
    padding: 12,
  },
  errorBoxText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '900',
  },
  errorText: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  modalScreen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  modalContent: {
    padding: 16,
    paddingTop: 42,
    paddingBottom: 28,
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  detailCell: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    minHeight: 64,
    padding: 11,
    width: '48%',
  },
  detailLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  detailValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 17,
    marginTop: 5,
  },
  noticeBox: {
    borderRadius: 8,
    marginTop: 14,
    padding: 13,
  },
  unlockedNotice: {
    backgroundColor: colors.successSurface,
  },
  lockedNoticeBox: {
    backgroundColor: colors.warningSurface,
  },
  noticeTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  noticeText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 5,
  },
  adminMessage: {
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 18,
    marginTop: 14,
    padding: 12,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 10,
    marginTop: 18,
  },
  imageRow: {
    gap: 9,
    marginTop: 14,
  },
  providerImage: {
    borderRadius: 8,
    height: 92,
    width: 132,
  },
  mapCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 190,
    marginTop: 14,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  modalActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    marginTop: 18,
  },
  primaryAction: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  primaryActionText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '900',
  },
  secondaryAction: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  secondaryActionText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  disabledAction: {
    opacity: 0.6,
  },
  changePanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    padding: 14,
  },
  changePanelHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  changePanelTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  changePanelText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 4,
  },
  miniRefreshButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  changeLoader: {
    marginVertical: 12,
  },
  changeCard: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 10,
    padding: 12,
  },
  changeCardTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  changeCardTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 13,
    fontWeight: '900',
  },
  changeStatusBadge: {
    backgroundColor: colors.primaryLight,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  changeStatusText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '900',
  },
  changeForm: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 14,
    padding: 12,
  },
  changeTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  changeText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 4,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  segmentButton: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  segmentButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  segmentText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  segmentTextActive: {
    color: colors.white,
  },
  reasonInput: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 12,
    minHeight: 92,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  changeHint: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
    marginTop: 8,
  },
  formError: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 10,
  },
  formSuccess: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 10,
  },
  timeline: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    marginTop: 10,
    paddingTop: 10,
  },
  timelineTitle: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  timelineText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 5,
  },
  qrBox: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 16,
    padding: 14,
  },
  qrImage: {
    height: 132,
    width: 132,
  },
  qrText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
    marginTop: 10,
    textAlign: 'center',
  },
});

