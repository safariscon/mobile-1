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
  buildServicePayload,
  completeVerifiedSellerBooking,
  confirmRebookUnavailable,
  createSellerService,
  deleteSellerService,
  fetchSellerBookings,
  fetchSellerFinance,
  fetchSellerOverview,
  fetchSellerPaymentProviders,
  fetchSellerPayoutDetails,
  fetchSellerRebookRequests,
  fetchSellerService,
  fetchSellerServices,
  lookupSellerBookingVerification,
  saveSellerPayoutDetails,
  updateSellerBookingStatus,
  updateSellerService,
  uploadSellerImages,
  verifySellerBookingCode,
} from '../api/seller';
import { fetchMarketplaceSettings } from '../api/services';
import { normalizeServiceDetail } from '../lib/serviceMapper';
import { useAuth } from '../context/AuthContext';
import { realtimeUserRooms, useRealtimeRefresh } from '../lib/realtime';
import { SERVICE_CATEGORY_OPTIONS } from '../data/formOptions';
import { lightColors } from '../theme/colors';
import { baseInputStyle } from '../theme/inputStyles';
import useThemedStyles from '../theme/useThemedStyles';
import { isDraftListing, matchesServiceFilter } from '../lib/listings';

let colors = lightColors;
let styles;

const DEFAULT_COLUMNS = [
  { id: 'service', label: 'Option name' },
  { id: 'price', label: 'Price (RWF)' },
  { id: 'priceType', label: 'Price type' },
  { id: 'calculationField', label: 'Calculation field' },
  { id: 'durationUnit', label: 'Duration unit' },
  { id: 'maximumDuration', label: 'Maximum duration' },
  { id: 'availability', label: 'Availability / capacity' },
  { id: 'availableFrom', label: 'Available from' },
  { id: 'availableTo', label: 'Available until' },
  { id: 'availableDays', label: 'Available days' },
  { id: 'availableStartTime', label: 'Open time' },
  { id: 'availableEndTime', label: 'Close time' },
  { id: 'requiresTime', label: 'Times required' },
  { id: 'details', label: 'Details / amenities' },
];

const PRICE_TABLE_OPTIONS = {
  priceType: [['fixed', 'Fixed price'], ['per-person', 'Per person'], ['per-room', 'Per room'], ['per-night', 'Per night'], ['per-day', 'Per day'], ['per-hour', 'Per hour'], ['per-item', 'Per item'], ['per-ticket', 'Per ticket'], ['per-package', 'Per package'], ['per-session', 'Per session']],
  calculationField: [['people', 'Number of people'], ['quantity', 'Quantity / units'], ['duration', 'Booking duration'], ['package', 'Selected package'], ['fixed', 'Fixed price']],
  durationUnit: [['minutes', 'Minutes'], ['hours', 'Hours'], ['days', 'Days'], ['nights', 'Nights'], ['same-day', 'Same day only'], ['none', 'No duration needed']],
};

const FIELD_TYPES = [
  ['text', 'Short answer'],
  ['textarea', 'Long answer'],
  ['number', 'Number'],
  ['email', 'Email address'],
  ['tel', 'Phone number'],
  ['date', 'Date'],
  ['time', 'Time'],
  ['datetime-local', 'Date and time'],
  ['select', 'Dropdown menu'],
  ['radio', 'Choose one option'],
  ['checkbox', 'Choose multiple options'],
  ['file', 'Upload a file'],
  ['url', 'Website link'],
];

const DEFAULT_BOOKING_FIELDS = [
  { id: 'field_name', type: 'text', label: 'Full Name', placeholder: 'Your full name', required: true, enabled: true, options: [] },
  { id: 'field_phone', type: 'tel', label: 'Phone Number', placeholder: '078xxxxxxx', required: true, enabled: true, options: [] },
  { id: 'field_date', type: 'date', label: 'Booking Date', placeholder: 'YYYY-MM-DD', required: true, enabled: true, options: [] },
];

function bookingFieldsForLanguage(t) {
  return [
    { id: 'field_name', type: 'text', label: t('seller.defaults.fullName'), placeholder: t('seller.defaults.fullNamePlaceholder'), required: true, enabled: true, options: [] },
    { id: 'field_phone', type: 'tel', label: t('seller.defaults.phoneNumber'), placeholder: '078xxxxxxx', required: true, enabled: true, options: [] },
    { id: 'field_date', type: 'date', label: t('seller.defaults.bookingDate'), placeholder: t('seller.placeholders.date'), required: true, enabled: true, options: [] },
  ];
}

const emptyBusinessForm = {
  title: '',
  category: 'hotel-rooms',
  description: '',
  serviceLocation: { country: '', countryCode: '', state: '', city: '', province: '', district: '', sector: '', cell: '', village: '', street: '', fullAddress: '', formattedAddress: '', latitude: '', longitude: '', locationSource: 'map_click', isExactLocationVerified: false },
  locationDetails: { country: '', state: '', city: '', province: '', district: '', sector: '', cell: '', village: '', street: '' },
  payoutDetails: { method: 'momo', providerId: 'mtn', accountName: '', accountNumber: '', instructions: '' },
  contactDetails: { phone: '', whatsapp: '' },
  status: 'available',
  customAvailability: '',
  remainingQuantity: '',
  images: ['', '', ''],
  imageFiles: [],
  promotion: { enabled: false, title: '', percent: '', note: '', startAt: '', endAt: '' },
  promotionHistory: [],
  rebookSettings: { requestDeadlineHours: '24', rebookIdValidityHours: '72' },
  cancelWindowHours: '6',
  cancelPenaltyPercent: '20',
  availabilityTable: {
    columns: DEFAULT_COLUMNS,
    rows: [{ id: 'row_1', sortOrder: 1, cells: { service: '', price: '' } }],
  },
  bookingMode: 'manual',
  bookingForm: {
    title: '',
    description: '',
    isPublished: true,
    fields: DEFAULT_BOOKING_FIELDS,
  },
};

function normalizeTable(table) {
  return {
    columns: DEFAULT_COLUMNS,
    rows: Array.isArray(table?.rows) && table.rows.length
      ? table.rows.map((row, index) => ({
          id: row.id || `row_${index + 1}`,
          sortOrder: row.sortOrder ?? index + 1,
          cells: { ...(row.cells || {}) },
        }))
      : emptyBusinessForm.availabilityTable.rows,
  };
}

function padDatePart(value) {
  return String(value).padStart(2, '0');
}

function toDateInputValue(date) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
}

function getSaveErrorMessage(error, fallback) {
  const message = String(error?.message || '').trim();
  return message || fallback;
}

function normalizePromotionDate(value, endOfDay = false) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return `${text}T${endOfDay ? '23:59' : '00:00'}`;
  }
  return text;
}

function validateBusinessForm(form, t) {
  if (!form.title.trim()) return t('seller.validation.businessNameRequired');
  if (!form.category.trim()) return t('seller.validation.categoryRequired');
  if (!form.serviceLocation.country.trim() || !(form.serviceLocation.city || form.serviceLocation.district || '').trim()) {
    return 'Country and city are required.';
  }
  if (form.status === 'available' && (!form.serviceLocation.latitude || !form.serviceLocation.longitude)) {
    return 'Exact map coordinates are required before a service can be available.';
  }
  if (!form.contactDetails?.phone?.trim()) {
    return t('seller.validation.phoneRequired', { defaultValue: 'Contact phone is required.' });
  }
  const hasPriceRow = form.availabilityTable.rows.some((row) => String(row.cells?.service || '').trim() && String(row.cells?.price || '').trim());
  if (!hasPriceRow) return t('seller.validation.priceRequired');
  if (form.promotion.enabled) {
    if (!form.promotion.title.trim()) return t('seller.validation.promotionTitleRequired');
    if (!form.promotion.startAt || !form.promotion.endAt) return t('seller.validation.promotionDatesRequired');
    const percent = Number(form.promotion.percent);
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) return t('seller.validation.promotionPercentRequired');
    if (new Date(form.promotion.endAt) <= new Date(form.promotion.startAt)) return t('seller.validation.promotionEndAfterStart');
  }
  return '';
}

function formFromBusiness(business, t) {
  const defaultFields = t ? bookingFieldsForLanguage(t) : DEFAULT_BOOKING_FIELDS;
  const defaultFormTitle = t ? t('seller.defaults.bookingRequest') : '';
  const sourceLocation = business?.serviceLocation || {};
  const legacyLocation = business?.locationDetails || {};
  return {
    ...emptyBusinessForm,
    title: business?.title || business?.name || '',
    category: business?.category || business?.type || 'hotel-rooms',
    description: business?.description || '',
    serviceLocation: {
      ...emptyBusinessForm.serviceLocation,
      ...sourceLocation,
      country: sourceLocation.country || '',
      countryCode: sourceLocation.countryCode || '',
      state: sourceLocation.state || sourceLocation.province || legacyLocation.state || legacyLocation.province || '',
      city: sourceLocation.city || sourceLocation.district || legacyLocation.city || legacyLocation.district || '',
      province: sourceLocation.province || sourceLocation.state || legacyLocation.province || '',
      district: sourceLocation.district || sourceLocation.city || legacyLocation.district || '',
      sector: sourceLocation.sector || legacyLocation.sector || '',
      cell: sourceLocation.cell || legacyLocation.cell || '',
      village: sourceLocation.village || legacyLocation.village || '',
      street: sourceLocation.street || legacyLocation.street || '',
      fullAddress: sourceLocation.fullAddress || business?.contactDetails?.exactAddress || business?.location || '',
      formattedAddress: sourceLocation.formattedAddress || sourceLocation.fullAddress || '',
      latitude: sourceLocation.latitude ?? business?.contactDetails?.latitude ?? '',
      longitude: sourceLocation.longitude ?? business?.contactDetails?.longitude ?? '',
    },
    locationDetails: { ...emptyBusinessForm.locationDetails, ...legacyLocation },
    payoutDetails: {
      ...emptyBusinessForm.payoutDetails,
      ...(business?.payoutDetails || {}),
      method: String(business?.payoutDetails?.method || 'momo').toLowerCase().includes('bank') ? 'bank' : 'momo',
      providerId: business?.payoutDetails?.providerId || 'mtn',
      accountNumber: business?.payoutDetails?.accountNumber || business?.payoutDetails?.msisdn || '',
    },
    contactDetails: { ...emptyBusinessForm.contactDetails, ...(business?.contactDetails || {}) },
    status: business?.status === 'unavailable' ? 'unavailable' : business?.availabilityText ? 'custom' : 'available',
    customAvailability: business?.availabilityText || '',
    remainingQuantity: business?.availabilityText || String(business?.availableQuantity ?? business?.quantityRemaining ?? ''),
    images: [...(Array.isArray(business?.images) ? business.images : []), '', '', ''].slice(0, 3),
    imageFiles: [],
    promotion: {
      enabled: business?.promotion?.enabled === true,
      title: business?.promotion?.title || '',
      percent: String(business?.promotion?.percent || ''),
      note: business?.promotion?.note || business?.promotion?.description || '',
      startAt: business?.promotion?.startAt ? String(business.promotion.startAt).slice(0, 16) : '',
      endAt: business?.promotion?.endAt ? String(business.promotion.endAt).slice(0, 16) : '',
    },
    rebookSettings: {
      requestDeadlineHours: String(business?.rebookSettings?.requestDeadlineHours ?? 24),
      rebookIdValidityHours: String(business?.rebookSettings?.rebookIdValidityHours ?? 72),
    },
    cancelWindowHours: String(business?.cancelWindowHours ?? business?.cancellationPolicy?.windowHours ?? 6),
    cancelPenaltyPercent: String(business?.cancelPenaltyPercent ?? business?.cancellationPolicy?.penaltyPercent ?? 20),
    promotionHistory: Array.isArray(business?.promotionHistory) ? business.promotionHistory : [],
    availabilityTable: normalizeTable(business?.availabilityTable),
    bookingForm: {
      title: business?.bookingForm?.title || defaultFormTitle,
      description: business?.bookingForm?.description || '',
      isPublished: business?.bookingForm?.isPublished !== false,
      fields: Array.isArray(business?.bookingForm?.fields) && business.bookingForm.fields.length ? business.bookingForm.fields : defaultFields,
    },
    bookingMode: business?.bookingMode || 'manual',
  };
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
  const [businessEditorOpen, setBusinessEditorOpen] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState(null);
  const [businessForm, setBusinessForm] = useState(emptyBusinessForm);
  const [rebookRequests, setRebookRequests] = useState([]);
  const [savingBusiness, setSavingBusiness] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [editorError, setEditorError] = useState('');
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
      const [overviewData, servicesList, bookingsList, financeData, payout, providers, settings] = await Promise.all([
        fetchSellerOverview().catch(() => ({})),
        fetchSellerServices().catch(() => []),
        fetchSellerBookings().catch(() => []),
        fetchSellerFinance().catch(() => ({ summary: {}, transactions: [] })),
        fetchSellerPayoutDetails().catch(() => ({})),
        fetchSellerPaymentProviders().catch(() => ({ mobileMoneyProviders: [], bankProviders: [] })),
        fetchMarketplaceSettings().catch(() => ({ bookingMode: 'manual' })),
      ]);

      const cleanServices = (servicesList || []).filter((item) => !isDraftListing(item));
      const cleanBookings = bookingsList || [];
      setOverview(overviewData);
      setServices(cleanServices);
      setBookings(cleanBookings);
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

  const beginEditBusiness = (business) => {
    setEditingBusiness(business);
    const nextForm = formFromBusiness(business, t);
    const serviceLevel = marketplaceSettings?.bookingMode === 'service-level';
    nextForm.bookingModeEditable = serviceLevel;
    if (!business) {
      nextForm.bookingMode = serviceLevel ? 'manual' : (marketplaceSettings?.bookingMode || 'manual');
    } else if (!serviceLevel && marketplaceSettings?.bookingMode) {
      nextForm.bookingMode = marketplaceSettings.bookingMode;
    }
    setBusinessForm(nextForm);
    setBusinessEditorOpen(true);
    setError('');
    setEditorError('');
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

  const updateBusinessForm = (key, value) => {
    setBusinessForm((current) => ({ ...current, [key]: value }));
  };

  const uploadPickedImages = async (assets) => {
    const formData = new FormData();
    assets.forEach((asset, index) => {
      const uri = asset.uri;
      const name = asset.fileName || `service-photo-${Date.now()}-${index}.jpg`;
      const type = asset.mimeType || 'image/jpeg';
      formData.append('images', { uri, name, type });
    });
    return uploadSellerImages(formData);
  };

  const pickBusinessImages = async () => {
    setEditorError('');
    const currentImages = businessForm.images.map((image) => image.trim()).filter(Boolean);
    const remainingSlots = Math.max(0, 3 - currentImages.length);
    if (remainingSlots <= 0) {
      setEditorError(t('seller.photoLimitReached'));
      return;
    }

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t('backend.permissionRequired'), t('backend.photoPermission'));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: remainingSlots,
        quality: 0.85,
      });

      if (result.canceled || !result.assets?.length) return;
      const tooLarge = result.assets.some((asset) => Number(asset.fileSize || 0) > 5 * 1024 * 1024);
      if (tooLarge) {
        setEditorError(t('seller.imageLimit'));
        return;
      }
      setUploadingImages(true);
      const uploadedUrls = await uploadPickedImages(result.assets.slice(0, remainingSlots));
      setBusinessForm((current) => ({
        ...current,
        images: [...current.images.map((image) => image.trim()).filter(Boolean), ...uploadedUrls].slice(0, 3),
      }));
    } catch (err) {
      setEditorError(t('backend.imageUploadFailed'));
    } finally {
      setUploadingImages(false);
    }
  };

  const removeBusinessImage = (imageUrl) => {
    setBusinessForm((current) => ({
      ...current,
      images: current.images.filter((image) => image !== imageUrl),
    }));
  };

  const updateNestedForm = (section, key, value) => {
    setBusinessForm((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [key]: value,
      },
    }));
  };

  const updateOptionCell = (rowId, key, value) => {
    setBusinessForm((current) => ({
      ...current,
      availabilityTable: {
        ...current.availabilityTable,
        rows: current.availabilityTable.rows.map((row) => row.id === rowId ? { ...row, cells: { ...row.cells, [key]: value } } : row),
      },
    }));
  };

  const addOptionRow = () => {
    setBusinessForm((current) => ({
      ...current,
      availabilityTable: {
        ...current.availabilityTable,
        rows: [...current.availabilityTable.rows, { id: `row_${Date.now()}`, sortOrder: current.availabilityTable.rows.length + 1, cells: { service: '', price: '', priceType: 'fixed', calculationField: 'duration', durationUnit: 'days', availability: '1', requiresTime: 'yes', details: '' } }],
      },
    }));
  };

  const removeOptionRow = (rowId) => {
    setBusinessForm((current) => ({
      ...current,
      availabilityTable: {
        ...current.availabilityTable,
        rows: current.availabilityTable.rows.length > 1 ? current.availabilityTable.rows.filter((row) => row.id !== rowId) : current.availabilityTable.rows,
      },
    }));
  };

  const updateBookingField = (fieldId, key, value) => {
    setBusinessForm((current) => ({
      ...current,
      bookingForm: {
        ...current.bookingForm,
        fields: current.bookingForm.fields.map((field) => field.id === fieldId ? { ...field, [key]: value } : field),
      },
    }));
  };

  const addBookingField = () => {
    setBusinessForm((current) => ({
      ...current,
      bookingForm: {
        ...current.bookingForm,
        fields: [
          ...current.bookingForm.fields,
          { id: `field_${Date.now()}`, type: 'text', label: t('seller.defaults.newQuestion'), placeholder: '', required: false, enabled: true, options: [] },
        ],
      },
    }));
  };

  const removeBookingField = (fieldId) => {
    setBusinessForm((current) => ({
      ...current,
      bookingForm: {
        ...current.bookingForm,
        fields: current.bookingForm.fields.length > 1 ? current.bookingForm.fields.filter((field) => field.id !== fieldId) : current.bookingForm.fields,
      },
    }));
  };

  const saveBusinessPayload = async (formToSave, businessToSave = editingBusiness) => {
    const validationError = validateBusinessForm(formToSave, t);
    if (validationError) throw new Error(validationError);
    const formWithDates = {
      ...formToSave,
      promotion: {
        ...formToSave.promotion,
        startAt: normalizePromotionDate(formToSave.promotion.startAt),
        endAt: normalizePromotionDate(formToSave.promotion.endAt, true),
      },
    };
    const payload = buildServicePayload(formWithDates);
    if (businessToSave?._id || businessToSave?.id) {
      return updateSellerService(businessToSave._id || businessToSave.id, payload);
    }
    return createSellerService(payload);
  };

  const saveBusiness = async () => {
    setSavingBusiness(true);
    setError('');
    setEditorError('');
    try {
      await saveBusinessPayload(businessForm);
      showResult(t('common.success'), t('backend.businessSaved'));
      setEditingBusiness(null);
      setBusinessEditorOpen(false);
      await loadData(true);
    } catch (err) {
      setEditorError(getSaveErrorMessage(err, t('backend.saveBusinessFailed')));
    } finally {
      setSavingBusiness(false);
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
      const serviceLocation = formFromBusiness(business, t).serviceLocation;
      const hasLocation = (serviceLocation.country && (serviceLocation.city || serviceLocation.district)) && serviceLocation.latitude && serviceLocation.longitude;
      const hasPayout = (payoutDetails.accountNumber || business.payoutDetails?.accountNumber || business.payoutDetails?.msisdn)
        && (payoutDetails.accountName || business.payoutDetails?.accountName);
      const hasPriceRows = business.availabilityTable?.rows?.some((row) => row.cells?.service && row.cells?.price);
      if (!hasLocation || !hasPayout || !hasPriceRows) {
        beginEditBusiness(business);
        showResult(t('common.error'), t('seller.completeBeforeAvailability'), 'error');
        return;
      }
      const nextForm = {
        ...formFromBusiness(business, t),
        status,
        remainingQuantity: status === 'available' ? String(business.availableQuantity || 1) : '0',
      };
      await saveBusinessPayload(nextForm, business);
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
          {(services.length ? services : data).length === 0 && !loading ? (
            <View style={styles.emptyContainer}>
              <Feather name="briefcase" size={44} color={colors.muted} />
              <Text style={styles.emptyText}>{t('seller.noBusinesses')}</Text>
            </View>
          ) : null}

          {(services.length ? services : data).filter((item) => matchesServiceFilter(item, section || 'all')).map((item) => (
            <View key={item._id} style={styles.businessCard}>
              <View style={styles.businessTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{item.name || item.title}</Text>
                  <Text style={styles.itemTypeLabel}>{item.category || item.type || t('seller.service')}</Text>
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
                  {item.images.slice(0, 3).map((image, index) => (
                    <Image key={`${image}-${index}`} source={{ uri: image }} style={styles.businessImage} />
                  ))}
                </ScrollView>
              ) : null}
              <Text style={styles.tableSummary}>{t('seller.tableSummary', { rows: item.availabilityTable?.rows?.length || 0, columns: item.availabilityTable?.columns?.length || DEFAULT_COLUMNS.length })}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <BusinessEditModal
        visible={businessEditorOpen}
        editingBusiness={editingBusiness}
        form={businessForm}
        saving={savingBusiness}
        uploadingImages={uploadingImages}
        error={editorError}
        onClose={() => {
          setBusinessEditorOpen(false);
          setEditingBusiness(null);
        }}
        onSave={saveBusiness}
        onSet={updateBusinessForm}
        onSetNested={updateNestedForm}
        onOptionCell={updateOptionCell}
        onAddOption={addOptionRow}
        onRemoveOption={removeOptionRow}
        onBookingField={updateBookingField}
        onAddBookingField={addBookingField}
        onRemoveBookingField={removeBookingField}
        onPickImages={pickBusinessImages}
        onRemoveImage={removeBusinessImage}
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

function BusinessEditModal({ visible, editingBusiness, form, saving, uploadingImages, error, onClose, onSave, onSet, onSetNested, onOptionCell, onAddOption, onRemoveOption, onBookingField, onAddBookingField, onRemoveBookingField, onPickImages, onRemoveImage }) {
  const { t } = useTranslation();
  const categoryOptions = SERVICE_CATEGORY_OPTIONS.map(([value, labelText]) => [value, t(`seller.categories.${value}`, { defaultValue: labelText })]);
  const priceTypeOptions = PRICE_TABLE_OPTIONS.priceType.map(([value, labelText]) => [value, t(`seller.priceTypes.${value}`, { defaultValue: labelText })]);
  const calculationOptions = PRICE_TABLE_OPTIONS.calculationField.map(([value, labelText]) => [value, t(`seller.calculationFields.${value}`, { defaultValue: labelText })]);
  const durationOptions = PRICE_TABLE_OPTIONS.durationUnit.map(([value, labelText]) => [value, t(`seller.durationUnits.${value}`, { defaultValue: labelText })]);
  const fieldTypeOptions = FIELD_TYPES.map(([value, labelText]) => [value, t(`seller.fieldTypes.${value}`, { defaultValue: labelText })]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalScreen}>
        <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>{editingBusiness ? t('seller.editBusiness') : t('seller.addBusiness')}</Text>
              <Text style={styles.modalSubtitle}>{t('seller.modalHelp')}</Text>
            </View>
            <TouchableOpacity style={styles.modalClose} onPress={onClose} activeOpacity={0.84}>
              <Feather name="x" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>
          {!!error && <Text style={styles.editorErrorText}>{error}</Text>}

          <Panel title={t('seller.businessBasics')}>
            <TextField label={t('seller.businessName')} value={form.title} onChangeText={(text) => onSet('title', text)} />
            <ModalSelectField label={t('seller.category')} value={form.category} options={categoryOptions} onChange={(value) => onSet('category', value)} placeholder={t('seller.category')} />
            <MultilineField label={t('seller.description')} value={form.description} onChangeText={(text) => onSet('description', text)} />
          </Panel>

          <Panel title={t('seller.serviceLocation')}>
            <WorldLocationFields
              value={form.serviceLocation}
              onChange={(location) => onSet('serviceLocation', {
                ...form.serviceLocation,
                ...location,
                province: location.state || location.province,
                district: location.city || location.district,
              })}
            />
            <TextField label={t('seller.fullAddress')} value={form.serviceLocation.fullAddress} onChangeText={(text) => onSetNested('serviceLocation', 'fullAddress', text)} placeholder="Street, city, country" />
            <ServiceLocationPicker value={form.serviceLocation} onChange={(nextLocation) => onSet('serviceLocation', nextLocation)} />
            <View style={styles.twoColumns}>
              <NumberField allowDecimal allowNegative label={t('seller.latitude')} value={String(form.serviceLocation.latitude || '')} onChangeText={(text) => onSetNested('serviceLocation', 'latitude', text)} />
              <NumberField allowDecimal allowNegative label={t('seller.longitude')} value={String(form.serviceLocation.longitude || '')} onChangeText={(text) => onSetNested('serviceLocation', 'longitude', text)} />
            </View>
          </Panel>

          <Panel title={t('seller.contactPayout')}>
            <View style={styles.twoColumns}>
              <TextField label={t('seller.privatePhone')} value={form.contactDetails.phone} onChangeText={(text) => onSetNested('contactDetails', 'phone', text)} keyboardType="phone-pad" />
              <TextField label={t('seller.whatsapp')} value={form.contactDetails.whatsapp} onChangeText={(text) => onSetNested('contactDetails', 'whatsapp', text)} keyboardType="phone-pad" />
            </View>
            <Text style={styles.uploadHint}>Payout MoMo/bank is managed under Finance → Payout (and Profile).</Text>
          </Panel>

          <Panel title={t('seller.photos')}>
            <TouchableOpacity style={styles.uploadButton} onPress={onPickImages} disabled={uploadingImages} activeOpacity={0.84}>
              {uploadingImages ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <>
                  <Feather name="upload-cloud" size={18} color={colors.primary} />
                  <Text style={styles.uploadButtonText}>{t('seller.uploadPhotos')}</Text>
                </>
              )}
            </TouchableOpacity>
            <Text style={styles.uploadHint}>{t('seller.uploadHint')}</Text>
            {form.images.map((image) => image.trim()).filter(Boolean).length ? (
              <View style={styles.uploadPreviewGrid}>
                {form.images.map((image) => image.trim()).filter(Boolean).map((image) => (
                  <View key={image} style={styles.uploadPreviewCard}>
                    <Image source={{ uri: image }} style={styles.uploadPreviewImage} />
                    <TouchableOpacity style={styles.removeImageButton} onPress={() => onRemoveImage(image)} activeOpacity={0.84}>
                      <Feather name="x" size={14} color={colors.white} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyUploadBox}>
                <Feather name="image" size={22} color={colors.muted} />
                <Text style={styles.emptyUploadText}>{t('seller.noPhotos')}</Text>
              </View>
            )}
          </Panel>

          <Panel title={t('seller.priceTable')}>
            {form.availabilityTable.rows.map((row, index) => (
              <View key={row.id} style={styles.optionEditor}>
                <View style={styles.optionEditorHeader}>
                  <Text style={styles.optionEditorTitle}>{t('seller.option', { number: index + 1 })}</Text>
                  <TouchableOpacity onPress={() => onRemoveOption(row.id)} activeOpacity={0.84}>
                    <Text style={styles.deleteButtonText}>{t('actions.remove')}</Text>
                  </TouchableOpacity>
                </View>
                <TextField label={t('seller.optionName')} value={row.cells.service || ''} onChangeText={(text) => onOptionCell(row.id, 'service', text)} />
                <View style={styles.twoColumns}>
                  <NumberField label={t('seller.price')} value={String(row.cells.price || '')} onChangeText={(text) => onOptionCell(row.id, 'price', text)} />
                  <ModalSelectField label={t('seller.priceType')} value={row.cells.priceType || ''} options={priceTypeOptions} onChange={(value) => onOptionCell(row.id, 'priceType', value)} placeholder={t('seller.priceType')} />
                </View>
                <View style={styles.twoColumns}>
                  <ModalSelectField label={t('seller.calculationField')} value={row.cells.calculationField || ''} options={calculationOptions} onChange={(value) => onOptionCell(row.id, 'calculationField', value)} placeholder={t('seller.calculationField')} />
                  <ModalSelectField label={t('seller.durationUnit')} value={row.cells.durationUnit || ''} options={durationOptions} onChange={(value) => onOptionCell(row.id, 'durationUnit', value)} placeholder={t('seller.durationUnit')} />
                </View>
                <View style={styles.twoColumns}>
                  <NumberField label={t('seller.maxDuration')} value={String(row.cells.maximumDuration || '')} onChangeText={(text) => onOptionCell(row.id, 'maximumDuration', text)} />
                  <NumberField label={t('seller.capacity')} value={String(row.cells.availability || '')} onChangeText={(text) => onOptionCell(row.id, 'availability', text)} />
                </View>
                <View style={styles.twoColumns}>
                  <TextField label="Available from" value={String(row.cells.availableFrom || '')} onChangeText={(text) => onOptionCell(row.id, 'availableFrom', text)} placeholder="YYYY-MM-DD" />
                  <TextField label="Available until" value={String(row.cells.availableTo || '')} onChangeText={(text) => onOptionCell(row.id, 'availableTo', text)} placeholder="YYYY-MM-DD" />
                </View>
                <TextField label="Available days" value={String(row.cells.availableDays || '')} onChangeText={(text) => onOptionCell(row.id, 'availableDays', text)} placeholder="Mon,Tue,Wed,Thu,Fri" />
                <View style={styles.twoColumns}>
                  <TextField label="Open time" value={String(row.cells.availableStartTime || '')} onChangeText={(text) => onOptionCell(row.id, 'availableStartTime', text)} placeholder="07:00" />
                  <TextField label="Close time" value={String(row.cells.availableEndTime || '')} onChangeText={(text) => onOptionCell(row.id, 'availableEndTime', text)} placeholder="20:00" />
                </View>
                <ModalSelectField
                  label="Times required"
                  value={row.cells.requiresTime || 'yes'}
                  options={[['yes', 'Yes'], ['no', 'No']]}
                  onChange={(value) => onOptionCell(row.id, 'requiresTime', value)}
                  searchable={false}
                />
                <MultilineField label={t('seller.detailsAmenities')} value={row.cells.details || ''} onChangeText={(text) => onOptionCell(row.id, 'details', text)} placeholder="Wi-Fi, breakfast, private bathroom..." />
              </View>
            ))}
            <TouchableOpacity style={styles.outlineButton} onPress={onAddOption} activeOpacity={0.84}>
              <Text style={styles.outlineButtonText}>{t('actions.addOption')}</Text>
            </TouchableOpacity>
          </Panel>

          <Panel title={t('seller.availabilityRebook')}>
            <ModalSelectField label={t('seller.availability')} value={form.status} options={[['available', t('seller.available')], ['unavailable', t('seller.notAvailable')], ['custom', t('seller.custom')]]} onChange={(value) => onSet('status', value)} searchable={false} />
            {form.status === 'custom' ? (
              <TextField label={t('seller.customAvailability')} value={form.customAvailability} onChangeText={(text) => onSet('customAvailability', text)} placeholder={t('seller.weekendsExample')} />
            ) : (
              <NumberField label={t('seller.remainingQuantity')} value={String(form.remainingQuantity)} onChangeText={(text) => onSet('remainingQuantity', text)} placeholder={t('seller.quantityExample')} />
            )}
            <View style={styles.twoColumns}>
              <NumberField label={t('seller.deadlineHours')} value={String(form.rebookSettings.requestDeadlineHours)} onChangeText={(text) => onSetNested('rebookSettings', 'requestDeadlineHours', text)} />
              <NumberField label={t('seller.rebookHours')} value={String(form.rebookSettings.rebookIdValidityHours)} onChangeText={(text) => onSetNested('rebookSettings', 'rebookIdValidityHours', text)} />
            </View>
            <View style={styles.twoColumns}>
              <NumberField label="Cancel window (hours)" value={String(form.cancelWindowHours || '6')} onChangeText={(text) => onSet('cancelWindowHours', text)} />
              <NumberField label="Cancel penalty (%)" value={String(form.cancelPenaltyPercent || '20')} onChangeText={(text) => onSet('cancelPenaltyPercent', text)} />
            </View>
            {form.bookingModeEditable ? (
              <ModalSelectField
                label="Booking mode"
                value={form.bookingMode || 'manual'}
                options={[['manual', 'Manual approval'], ['auto', 'Auto confirm']]}
                onChange={(value) => onSet('bookingMode', value)}
                searchable={false}
              />
            ) : (
              <Text style={styles.uploadHint}>Booking mode: {form.bookingMode || 'manual'} (marketplace-controlled).</Text>
            )}
          </Panel>

          <Panel title={t('seller.promotion')}>
            <TouchableOpacity style={styles.checkboxLine} onPress={() => onSet('promotion', { ...form.promotion, enabled: !form.promotion.enabled })} activeOpacity={0.84}>
              <View style={[styles.checkboxBox, form.promotion.enabled && styles.checkboxBoxActive]}>
                {form.promotion.enabled ? <Feather name="check" size={13} color={colors.white} /> : null}
              </View>
              <Text style={styles.checkboxLabel}>{t('seller.usePromotionHistory')}</Text>
            </TouchableOpacity>
            <TextField label={t('seller.promotionTitle')} value={form.promotion.title} onChangeText={(text) => onSet('promotion', { ...form.promotion, title: text })} placeholder="Example: Happy Hours!" />
            <NumberField label={t('seller.promotionPercent')} value={String(form.promotion.percent)} onChangeText={(text) => onSet('promotion', { ...form.promotion, percent: text })} placeholder="Example: 25" />
            <MultilineField label={t('seller.promotionNote')} value={form.promotion.note} onChangeText={(text) => onSet('promotion', { ...form.promotion, note: text })} />
            {form.promotion.enabled ? (
              <View style={styles.twoColumns}>
                <DateTimeField label={t('seller.promotionStarts')} value={form.promotion.startAt || ''} onChange={(text) => onSet('promotion', { ...form.promotion, startAt: text })} placeholder={t('seller.placeholders.dateTime')} />
                <DateTimeField label={t('seller.promotionEnds')} value={form.promotion.endAt || ''} onChange={(text) => onSet('promotion', { ...form.promotion, endAt: text })} placeholder={t('seller.placeholders.dateTime')} />
              </View>
            ) : null}
            {form.promotionHistory?.length ? (
              <Text style={styles.uploadHint}>{t('seller.promotionHistory', { count: form.promotionHistory.length })}</Text>
            ) : null}
          </Panel>

          <Panel title={t('seller.customerForm')}>
            <TextField label={t('seller.formName')} value={form.bookingForm.title} onChangeText={(text) => onSet('bookingForm', { ...form.bookingForm, title: text })} />
            <MultilineField label={t('seller.formMessage')} value={form.bookingForm.description} onChangeText={(text) => onSet('bookingForm', { ...form.bookingForm, description: text })} />
            {form.bookingForm.fields.map((field) => (
              <View key={field.id} style={styles.bookingFieldEditor}>
                <View style={styles.optionEditorHeader}>
                  <Text style={styles.optionEditorTitle}>{t('seller.customerQuestion')}</Text>
                  <TouchableOpacity onPress={() => onRemoveBookingField(field.id)} activeOpacity={0.84}>
                    <Text style={styles.deleteButtonText}>{t('actions.remove')}</Text>
                  </TouchableOpacity>
                </View>
                <TextField label={t('seller.questionLabel')} value={field.label} onChangeText={(text) => onBookingField(field.id, 'label', text)} />
                <View style={styles.twoColumns}>
                  <ModalSelectField label={t('seller.answerType')} value={field.type} options={fieldTypeOptions} onChange={(value) => onBookingField(field.id, 'type', value)} placeholder={t('seller.answerType')} />
                  <TextField label={t('seller.placeholder')} value={field.placeholder || ''} onChangeText={(text) => onBookingField(field.id, 'placeholder', text)} />
                </View>
                <TextField label={t('seller.helpNote')} value={field.helpText || ''} onChangeText={(text) => onBookingField(field.id, 'helpText', text)} />
                <TextField label={t('seller.prefilled')} value={String(field.defaultValue || '')} onChangeText={(text) => onBookingField(field.id, 'defaultValue', text)} />
                {['select', 'radio', 'checkbox'].includes(field.type) ? (
                  <TextField label={t('seller.choices')} value={(field.options || []).join(', ')} onChangeText={(text) => onBookingField(field.id, 'options', text.split(',').map((item) => item.trim()).filter(Boolean))} placeholder={t('seller.choicesExample')} />
                ) : null}
                {field.type === 'file' ? (
                  <View style={styles.twoColumns}>
                    <TextField label={t('seller.fileTypes')} value={field.validation?.acceptedFileTypes || ''} onChangeText={(text) => onBookingField(field.id, 'validation', { ...(field.validation || {}), acceptedFileTypes: text })} placeholder={t('seller.placeholders.fileTypes')} />
                    <NumberField label={t('seller.maxFileSize')} value={String(field.validation?.maxFileSizeMb || 5)} onChangeText={(text) => onBookingField(field.id, 'validation', { ...(field.validation || {}), maxFileSizeMb: text })} />
                  </View>
                ) : null}
                {field.type === 'number' ? (
                  <View style={styles.twoColumns}>
                    <NumberField label={t('seller.minNumber')} value={String(field.validation?.min ?? '')} onChangeText={(text) => onBookingField(field.id, 'validation', { ...(field.validation || {}), min: text })} />
                    <NumberField label={t('seller.maxNumber')} value={String(field.validation?.max ?? '')} onChangeText={(text) => onBookingField(field.id, 'validation', { ...(field.validation || {}), max: text })} />
                  </View>
                ) : null}
                <TouchableOpacity style={styles.checkboxLine} onPress={() => onBookingField(field.id, 'required', !field.required)} activeOpacity={0.84}>
                  <View style={[styles.checkboxBox, field.required && styles.checkboxBoxActive]}>
                    {field.required ? <Feather name="check" size={13} color={colors.white} /> : null}
                  </View>
                  <Text style={styles.checkboxLabel}>{t('seller.required')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.checkboxLine} onPress={() => onBookingField(field.id, 'enabled', field.enabled === false)} activeOpacity={0.84}>
                  <View style={[styles.checkboxBox, field.enabled !== false && styles.checkboxBoxActive]}>
                    {field.enabled !== false ? <Feather name="check" size={13} color={colors.white} /> : null}
                  </View>
                  <Text style={styles.checkboxLabel}>{t('seller.showQuestion')}</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.outlineButton} onPress={onAddBookingField} activeOpacity={0.84}>
              <Text style={styles.outlineButtonText}>{t('actions.addQuestion')}</Text>
            </TouchableOpacity>
          </Panel>

          <TouchableOpacity style={[styles.saveButton, saving && { opacity: 0.72 }]} onPress={onSave} disabled={saving} activeOpacity={0.86}>
            {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveButtonText}>{editingBusiness ? t('actions.updateBusiness') : t('actions.createBusiness')}</Text>}
          </TouchableOpacity>
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
