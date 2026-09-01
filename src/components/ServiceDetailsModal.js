import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { fetchServiceDetails, fetchMarketplaceSettings, fetchServiceAvailability, resolveBookingMode, submitBookingRequest, verifyRebookId } from '../api/services';
import AvailabilityTable from './AvailabilityTable';
import { collectImages, inventoryStatusLabel } from '../lib/serviceMapper';
import { useAuth } from '../context/AuthContext';
import { ANALYTICS_EVENTS, trackAnalytics } from '../lib/analytics';
import { getVisiblePromotion } from '../lib/promotion';
import { locationToText } from '../lib/geo';
import { MultilineField, NumberField, SelectField, TextField } from './FormFields';
import { BookingFields } from '../features/domain/DomainFields';
import {
  emptyBookingValues,
  firstError,
  mapBookingToSchedule,
  resolveDomain,
  validateBookingClient,
} from '../features/domain/registry';
import PaymentSheet from './PaymentSheet';
import ServiceLocationPicker from './ServiceLocationPicker';
import BookingPassCard from './BookingPassCard';
import { lightColors } from '../theme/colors';
import { pinIsSet } from '../lib/bookingVerification';
import useThemedStyles from '../theme/useThemedStyles';

let colors = lightColors;
let styles;

const fallbackImage = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=900&q=80';

function asList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function formatBoolLabel(value, yes, no) {
  return value ? yes : no;
}

function getOptionValue(option) {
  return option?.id || option?.name || option?.label || '';
}

function formatPromotionDateTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function ServiceDetailsModal({ visible, onClose, service, onRequireAuth, asScreen = false }) {
  const themed = useThemedStyles(createStyles);
  colors = themed.colors;
  styles = themed.styles;
  const { t } = useTranslation();
  const { isAuthenticated, user } = useAuth();
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showBookingForm, setShowBookingForm] = useState(false);

  useEffect(() => {
    let active = true;

    const loadDetails = async () => {
      if (!service?.id) return;
      setLoading(true);
      setError('');
      setDetails(null);

      try {
        const serviceDetails = await fetchServiceDetails(service.id);
        if (active) setDetails(serviceDetails);
      } catch (loadError) {
        if (active) setError(t('serviceDetails.loadFailed'));
      } finally {
        if (active) setLoading(false);
      }
    };

    if (visible || asScreen) {
      setShowBookingForm(false);
      loadDetails();
      trackAnalytics(ANALYTICS_EVENTS.SERVICE_VIEW, { serviceId: service.id, pageUrl: `safariscon://service/${service.id}` });
    }

    return () => {
      active = false;
    };
  }, [service?.id, visible]);

  const displayService = details || service;
  const imageItems = useMemo(() => {
    const gallery = collectImages(displayService);
    if (gallery.length) return gallery.slice(0, 3);
    const fallback = displayService?.image || fallbackImage;
    return [{ url: fallback, alt: displayService?.name || displayService?.title || 'Service' }];
  }, [displayService]);
  const images = useMemo(() => imageItems.map((item) => item.url), [imageItems]);
  const activeImage = images[selectedImageIndex] || images[0] || fallbackImage;
  const options = asList(displayService?.options);
  const amenities = asList(displayService?.amenities);
  const locationText = displayService?.generalLocation || displayService?.location?.generalLocation || displayService?.location?.district || service?.generalLocation || t('common.rwanda');
  const promotion = getVisiblePromotion(displayService?.promotion || service?.promotion);
  const inventoryLabel = inventoryStatusLabel(displayService?.inventoryStatus || displayService?.status || displayService?.availabilityStatus);
  const unavailable = ['unavailable', 'inactive', 'sold-out', 'out-of-stock', 'fully-booked', 'temporarily-unavailable'].includes(String(displayService?.inventoryStatus || displayService?.status || displayService?.availabilityStatus || '').toLowerCase());

  useEffect(() => {
    setSelectedImageIndex(0);
  }, [service?.id, images.length]);

  if (!service) return null;

  if (showBookingForm && asScreen) {
    return (
      <BookingRequestForm
        service={displayService}
        user={user}
        onBack={() => setShowBookingForm(false)}
        onClose={onClose}
      />
    );
  }

  if (showBookingForm) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowBookingForm(false)}>
        <BookingRequestForm
          service={displayService}
          user={user}
          onBack={() => setShowBookingForm(false)}
          onClose={onClose}
        />
      </Modal>
    );
  }

  const content = (
      <View style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.hero}>
            <Image source={{ uri: activeImage }} style={styles.coverImage} />
            <View style={styles.heroOverlay} />
            <TouchableOpacity onPress={onClose} style={styles.backButton} activeOpacity={0.82}>
              <Feather name="arrow-left" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            {images.length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery}>
                {images.map((image, index) => (
                  <TouchableOpacity
                    key={`${image}-${index}`}
                    style={[styles.thumbButton, selectedImageIndex === index && styles.thumbButtonActive]}
                    onPress={() => setSelectedImageIndex(index)}
                    activeOpacity={0.82}
                  >
                    <Image source={{ uri: image }} style={styles.thumb} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : null}

            <Text style={styles.title}>{displayService?.name || displayService?.title}</Text>
            <View style={styles.locationRow}>
              <Feather name="map-pin" size={14} color={colors.muted} />
              <Text style={styles.locationText}>{locationText}</Text>
            </View>

            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.loadingText}>{t('serviceDetails.loading')}</Text>
              </View>
            ) : null}

            {!!error && (
              <TouchableOpacity style={styles.errorBox} onPress={() => setError('')} activeOpacity={0.85}>
                <Text style={styles.errorText}>{t('serviceDetails.fallbackError')}</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.sectionTitle}>{t('serviceDetails.about')}</Text>
            <Text style={styles.description}>
              {displayService?.description || t('serviceDetails.privacyDescription')}
            </Text>

            {promotion ? <PromotionDetailsCard promotion={promotion} /> : null}

            <View style={styles.infoGrid}>
              <InfoTile label={t('serviceDetails.category')} value={displayService?.category || displayService?.serviceType || t('serviceDetails.service')} icon="grid" />
              <InfoTile
                label={t('serviceDetails.seller')}
                value={formatBoolLabel(displayService?.seller?.verified, t('serviceDetails.verifiedSeller'), t('serviceDetails.pendingVerification'))}
                icon="shield"
              />
              <InfoTile label={t('serviceDetails.availability')} value={inventoryLabel} icon="check-circle" />
              <InfoTile label={t('serviceDetails.pricing')} value={displayService?.pricingType || displayService?.priceText || t('serviceDetails.standard')} icon="tag" />
              <InfoTile label={t('serviceDetails.unit')} value={displayService?.durationUnit || t('serviceDetails.use')} icon="clock" />
              <InfoTile label={t('serviceDetails.capacity')} value={`${displayService?.maximumCapacity || displayService?.availableQuantity || 1}`} icon="users" />
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Availability table</Text>
            </View>
            <AvailabilityTable table={displayService?.availabilityTable} emptyText={t('serviceDetails.emptyOptions')} />

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('serviceDetails.optionsTitle')}</Text>
            </View>

            {options.length ? (
              <View style={styles.optionList}>
                {options.map((option) => (
                  <View key={option.id || option.name} style={styles.optionCard}>
                    <View style={styles.optionTop}>
                      <View style={styles.optionCopy}>
                        <Text style={styles.optionName}>{option.name || t('serviceDetails.serviceOption')}</Text>
                        <Text style={styles.optionMeta}>
                          {option.pricingType || displayService?.pricingType || t('serviceDetails.standard')} - {option.durationUnit || displayService?.durationUnit || t('serviceDetails.use')}
                        </Text>
                      </View>
                      <Text style={styles.optionPrice}>{option.priceText || t('serviceDetails.contactForPrice')}</Text>
                    </View>
                    <View style={styles.optionFacts}>
                      <Text style={styles.factText}>{t('serviceDetails.duration')}: {option.duration || option.durationUnit || t('serviceDetails.flexible')}</Text>
                      <Text style={styles.factText}>{t('serviceDetails.max')}: {option.maximumCapacity || displayService?.maximumCapacity || 1}</Text>
                      <Text style={styles.factText}>{option.availabilityStatus || displayService?.availabilityStatus || t('serviceDetails.available')}</Text>
                    </View>
                    {!!option.details && <Text style={styles.optionDetails}>{option.details}</Text>}
                    {asList(option.pricingRules).map((rule) => (
                      <Text key={`${option.id}-${rule.key}`} style={styles.optionRule}>{rule.label}: {rule.value}</Text>
                    ))}
                    {asList(option.availabilityRules).map((rule) => (
                      <Text key={`${option.id}-${rule.key}-availability`} style={styles.optionRule}>{rule.label}: {rule.value}</Text>
                    ))}
                    {asList(option.extraCells).map((cell) => (
                      <Text key={`${option.id}-${cell.key}-extra`} style={styles.optionRule}>{cell.label}: {cell.value}</Text>
                    ))}
                    {asList(option.amenities).length ? (
                      <ChipRow items={asList(option.amenities)} />
                    ) : null}
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>{t('serviceDetails.emptyOptions')}</Text>
              </View>
            )}

            <Text style={styles.sectionTitle}>{t('serviceDetails.amenities')}</Text>
            {amenities.length ? <ChipRow items={amenities} /> : <Text style={styles.mutedText}>{t('serviceDetails.emptyAmenities')}</Text>}

            <View style={styles.privacyBox}>
              <Feather name="lock" size={16} color={colors.primary} />
              <Text style={styles.privacyText}>
                {t('serviceDetails.privacy')}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.requestButton, unavailable && styles.disabledButton]}
              disabled={unavailable}
              activeOpacity={0.86}
              onPress={() => {
                if (!isAuthenticated) {
                  onRequireAuth?.();
                  return;
                }
                setShowBookingForm(true);
                trackAnalytics(ANALYTICS_EVENTS.BOOKING_FORM_OPENED, { serviceId: service.id, pageUrl: `safariscon://booking/${service.id}` });
              }}
            >
              <Text style={styles.requestButtonText}>{unavailable ? inventoryLabel : t('serviceDetails.requestBooking')}</Text>
              <Feather name="arrow-right" size={18} color={colors.white} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
  );

  if (asScreen) return content;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {content}
    </Modal>
  );
}

const initialBookingValues = (user) => ({
  fullName: user?.name || '',
  phone: user?.phone || '',
  email: user?.email || '',
  bookingDate: '',
  endDate: '',
  startTime: '',
  endTime: '',
  numberOfPeople: '1',
  quantity: '1',
  customerLocation: '',
  customerCountry: '',
  customerCountryCode: '',
  customerState: '',
  customerCity: '',
  customerSector: '',
  paymentMethod: 'mobile-money',
  rebookId: '',
  specialRequests: '',
  agreeToTerms: false,
});

function BookingRequestForm({ service, user, onBack, onClose }) {
  const { t } = useTranslation();
  const options = asList(service?.options);
  const domain = resolveDomain(service);
  const bookingSchema = asList(service?.schemaSnapshot?.bookingFieldSchema);
  const customFields = !bookingSchema.length && service?.bookingForm?.isPublished
    ? asList(service.bookingForm.fields).filter((field) => field.enabled !== false)
    : [];
  const [values, setValues] = useState(() => initialBookingValues(user));
  const [customValues, setCustomValues] = useState(() => {
    const defaults = {};
    customFields.forEach((field) => {
      defaults[field.id] = field.type === 'checkbox' ? [] : field.defaultValue || '';
    });
    return defaults;
  });
  const [bookingAttributes, setBookingAttributes] = useState(() => emptyBookingValues(domain));
  const [selectedOptionId, setSelectedOptionId] = useState(getOptionValue(options[0]));
  const [submitting, setSubmitting] = useState(false);
  const [verifyingRebook, setVerifyingRebook] = useState(false);
  const [verifiedRebookId, setVerifiedRebookId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [marketplaceSettings, setMarketplaceSettings] = useState({ bookingMode: 'manual', bookingRules: [] });
  const [payBooking, setPayBooking] = useState(null);
  const [paidBooking, setPaidBooking] = useState(null);
  const [step, setStep] = useState(1);
  const [pin, setPin] = useState({ latitude: '', longitude: '' });
  const [availability, setAvailability] = useState(null);
  const selectedOption = options.find((option) => getOptionValue(option) === selectedOptionId) || options[0];
  const locationText = service?.generalLocation || service?.location?.generalLocation || t('common.rwanda');
  const bookingMode = resolveBookingMode(marketplaceSettings, service);

  useEffect(() => {
    let active = true;
    fetchMarketplaceSettings()
      .then((settings) => { if (active) setMarketplaceSettings(settings); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const hotelId = service?.hotelId || service?.id;
    const optionId = getOptionValue(selectedOption);
    if (!hotelId) return undefined;
    let active = true;
    fetchServiceAvailability(hotelId, optionId, {
      checkIn: bookingAttributes.checkIn,
      checkOut: bookingAttributes.checkOut,
    }).then((data) => {
      if (active) setAvailability(data);
    }).catch(() => {
      if (active) setAvailability(null);
    });
    return () => { active = false; };
  }, [service?.hotelId, service?.id, selectedOptionId, bookingAttributes.checkIn, bookingAttributes.checkOut]);

  const updateValue = (key, value) => setValues((current) => ({ ...current, [key]: value }));
  const updateCustomValue = (key, value) => setCustomValues((current) => ({ ...current, [key]: value }));

  const validateStay = () => {
    if (!service?.hotelId && !service?.id) return t('bookingForm.unavailable');
    if (['unavailable', 'inactive', 'sold-out'].includes(String(service?.status || service?.availabilityStatus || '').toLowerCase())) return t('bookingForm.unavailable');
    if (!selectedOption) return t('bookingForm.chooseOptionError');
    const schemaError = firstError(validateBookingClient(domain, bookingAttributes, {
      listing: service,
      inventory: selectedOption || {},
    }));
    if (schemaError) return schemaError;
    if (availability?.remaining != null && Number(availability.remaining) <= 0) {
      return t('bookingForm.fullyBooked');
    }
    return '';
  };

  const validateDetails = () => {
    if (!values.fullName.trim()) return t('bookingForm.fullNameError');
    if (!/^\+?[0-9][0-9\s-]{7,18}$/.test(values.phone.trim())) return t('bookingForm.phoneError');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) return t('bookingForm.emailError');
    if (Math.max(1, Number(values.quantity) || 0) < 1) return 'Quantity must be at least 1.';
    if (!pinIsSet(pin)) return t('bookingForm.mapPinError');
    if (values.rebookId.trim() && verifiedRebookId !== values.rebookId.trim()) return 'Verify the Re-book ID before submitting.';
    const missingCustom = customFields.find((field) => {
      if (!field.required) return false;
      const value = customValues[field.id];
      if (value && typeof value === 'object') return !String(value.fileName || value.value || '').trim();
      return !String(value || '').trim();
    });
    if (missingCustom) return t('bookingForm.customRequired', { label: missingCustom.label });
    return '';
  };

  const validatePayment = () => {
    if (!values.agreeToTerms) return t('bookingForm.termsError');
    return '';
  };

  const goNext = () => {
    const message = step === 1 ? validateStay() : validateDetails();
    if (message) {
      setError(message);
      return;
    }
    setError('');
    setStep((current) => current + 1);
  };

  const handleVerifyRebook = async () => {
    const rebookId = values.rebookId.trim();
    if (!rebookId) {
      setError('Enter a Re-book ID first.');
      return;
    }
    setVerifyingRebook(true);
    setError('');
    setSuccess('');
    try {
      await verifyRebookId({ rebookId, serviceId: service?.id || service?.hotelId });
      setVerifiedRebookId(rebookId);
      setSuccess('Re-book ID verified.');
    } catch (verifyError) {
      setVerifiedRebookId('');
      setError(verifyError.message || 'Could not verify Re-book ID.');
    } finally {
      setVerifyingRebook(false);
    }
  };

  const handleSubmit = async () => {
    setError('');
    setSuccess('');
    const validationError = validateStay() || validateDetails() || validatePayment();
    if (validationError) {
      if (validateStay()) setStep(1);
      else if (validateDetails()) setStep(2);
      else setStep(3);
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const schedule = mapBookingToSchedule(domain, bookingAttributes);
      const quantity = Math.max(1, Number(values.quantity) || 1);
      const people = Math.max(1, Number(schedule.numberOfPeople || values.numberOfPeople) || 1);
      const customResponses = customFields.map((field) => ({
        fieldId: field.id,
        label: field.label,
        type: field.type,
        value: customValues[field.id],
      }));
      const checkIn = schedule.startDate || values.bookingDate || null;
      const checkOut = schedule.endDate || values.endDate || schedule.startDate || values.bookingDate || null;
      const customerLocationDetails = {
        country: values.customerCountry || pin.country || 'Rwanda',
        countryCode: values.customerCountryCode || pin.countryCode || 'RW',
        state: values.customerState || pin.state,
        province: values.customerState || pin.state,
        city: values.customerCity || pin.city,
        district: values.customerCity || pin.city,
        sector: values.customerSector.trim() || pin.area || '',
        latitude: Number(pin.latitude),
        longitude: Number(pin.longitude),
        latitudeRaw: String(pin.latitudeRaw || pin.latitude || ''),
        longitudeRaw: String(pin.longitudeRaw || pin.longitude || ''),
        fullAddress: pin.fullAddress || pin.formattedAddress || values.customerLocation.trim(),
        formattedAddress: pin.formattedAddress || pin.fullAddress || values.customerLocation.trim(),
      };
      const customerLocationText = values.customerLocation.trim() || locationToText(customerLocationDetails);

      const response = await submitBookingRequest({
        hotelId: service.hotelId || service.id,
        serviceId: service.hotelId || service.id,
        optionId: getOptionValue(selectedOption),
        rebookId: verifiedRebookId || undefined,
        quantity,
        numberOfPeople: people,
        guests: people,
        totalConsumptionUnits: quantity * people,
        checkIn,
        checkOut,
        bookingDate: checkIn,
        endBookingDate: checkOut,
        startTime: schedule.startTime || values.startTime,
        endTime: schedule.endTime || values.endTime,
        totalPrice: 0,
        destinationPlace: service.title || service.name || t('bookingForm.selectedService'),
        destinationLocation: locationText,
        customerLocation: customerLocationText,
        customerLocationDetails,
        bookingAttributes,
        bookingDetails: {
          ...values,
          serviceName: service.title || service.name || t('bookingForm.selectedService'),
          requestedService: selectedOption.name || t('serviceDetails.serviceOption'),
          selectedOptionId: getOptionValue(selectedOption),
          listedPriceRwf: selectedOption.price || '',
          fullName: values.fullName.trim(),
          email: values.email.trim().toLowerCase(),
          phone: values.phone.trim(),
          bookingDate: checkIn,
          endDate: checkOut,
          endBookingDate: checkOut,
          startTime: schedule.startTime || values.startTime,
          endTime: schedule.endTime || values.endTime,
          numberOfPeople: people,
          quantity,
          totalConsumptionUnits: quantity * people,
          customerLocation: values.customerLocation.trim() || customerLocationText,
          customerLocationDetails,
          paymentMethod: values.paymentMethod,
          serviceCategory: service.serviceType || service.category || '',
          bookingType: service.serviceType || service.category || 'service',
          providerRules: service.bookingRules ? [service.bookingRules] : [],
          customFormTitle: service.bookingForm?.title || '',
          customResponses,
          bookingAttributes,
        },
      });

      trackAnalytics(ANALYTICS_EVENTS.BOOKING_SUBMITTED, { serviceId: service.id || service.hotelId, bookingId: response?.booking?._id });
      if (bookingMode === 'automatic' && response?.booking) {
        setSuccess(response?.booking?.bookingCode ? t('bookingForm.successCode', { code: response.booking.bookingCode }) : t('bookingForm.success'));
        setPayBooking(response.booking);
      } else {
        setSuccess(response?.booking?.bookingCode
          ? `${t('bookingForm.successCode', { code: response.booking.bookingCode })} Wait for provider review before paying.`
          : 'Booking request sent. Wait for provider review before paying.');
      }
    } catch (requestError) {
      setError(requestError.message || t('bookingForm.submitFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formContent}>
        <View style={styles.formTopBar}>
          <TouchableOpacity onPress={step > 1 ? () => setStep((current) => current - 1) : onBack} style={styles.formIconButton} activeOpacity={0.82}>
            <Feather name="arrow-left" size={20} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={styles.formIconButton} activeOpacity={0.82}>
            <Feather name="x" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        <Text style={styles.formTitle}>{service?.title || service?.name || t('bookingForm.title')}</Text>
        <View style={styles.stepRow}>
          {['Stay', 'Details', 'Pay'].map((label, index) => (
            <View key={label} style={[styles.stepChip, step === index + 1 && styles.stepChipActive]}>
              <Text style={[styles.stepChipText, step === index + 1 && styles.stepChipTextActive]}>{index + 1}. {label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.bookingCard}>
          {step === 1 && !paidBooking ? (
            <>
          <SelectField
            label={t('bookingForm.chooseService')}
            value={selectedOptionId}
            options={options.map((option) => ({
              value: getOptionValue(option),
              label: option.name || t('serviceDetails.serviceOption'),
              description: option.priceText || t('serviceDetails.contactForPrice'),
            }))}
            onChange={setSelectedOptionId}
            placeholder="Select option"
          />
          {availability?.remaining != null ? (
            <Text style={styles.availabilityHint}>
              {Number(availability.remaining) <= 0 ? t('bookingForm.fullyBooked') : `${availability.remaining} left`}
            </Text>
          ) : null}
          <View style={{ marginBottom: 8 }}>
            <BookingFields category={service} listing={service} values={bookingAttributes} onChange={setBookingAttributes} />
          </View>
            </>
          ) : null}

          {step === 2 && !paidBooking ? (
            <>
          <TextField label={t('bookingForm.fullName')} value={values.fullName} onChangeText={(text) => updateValue('fullName', text)} />
          <TextField label={t('bookingForm.phone')} value={values.phone} onChangeText={(text) => updateValue('phone', text)} keyboardType="phone-pad" />
          <TextField label={t('bookingForm.email')} value={values.email} onChangeText={(text) => updateValue('email', text)} keyboardType="email-address" autoCapitalize="none" />
          <NumberField label={t('bookingForm.quantity')} value={values.quantity} onChangeText={(text) => updateValue('quantity', text)} />
          <ServiceLocationPicker value={pin} onChange={setPin} />
          <View style={styles.rebookRow}>
            <View style={{ flex: 1 }}>
              <TextField label="Re-book ID" value={values.rebookId} onChangeText={(text) => { updateValue('rebookId', text); setVerifiedRebookId(''); }} autoCapitalize="characters" />
            </View>
            {values.rebookId.trim() ? (
              <TouchableOpacity style={styles.rebookButton} onPress={handleVerifyRebook} disabled={verifyingRebook} activeOpacity={0.84}>
                {verifyingRebook ? <ActivityIndicator color={colors.white} /> : <Text style={styles.rebookButtonText}>{t('actions.verify')}</Text>}
              </TouchableOpacity>
            ) : null}
          </View>
          {customFields.map((field) => (
            <CustomField
              key={field.id}
              field={field}
              value={customValues[field.id]}
              onChange={(nextValue) => updateCustomValue(field.id, nextValue)}
            />
          ))}
            </>
          ) : null}

          {step === 3 && !paidBooking ? (
            <>
          <SelectField
            label={t('bookingForm.paymentMethod')}
            value={values.paymentMethod}
            options={[
              ['mobile-money', t('bookingForm.mobileMoney')],
              ['bank', t('bookingForm.bank')],
            ]}
            onChange={(method) => updateValue('paymentMethod', method)}
            searchable={false}
          />
          <TouchableOpacity style={styles.checkboxRow} onPress={() => updateValue('agreeToTerms', !values.agreeToTerms)} activeOpacity={0.84}>
            <View style={[styles.checkbox, values.agreeToTerms && styles.checkboxActive]}>
              {values.agreeToTerms ? <Feather name="check" size={14} color={colors.white} /> : null}
            </View>
            <Text style={styles.checkboxText}>{t('bookingForm.terms')}</Text>
          </TouchableOpacity>
            </>
          ) : null}

          {paidBooking ? <BookingPassCard booking={paidBooking} /> : null}

          {!!error && <Text style={styles.formError}>{error}</Text>}
          {!!success && <Text style={styles.formSuccess}>{success}</Text>}

          {paidBooking ? null : step < 3 ? (
            <TouchableOpacity style={styles.requestButton} onPress={goNext} activeOpacity={0.86}>
              <Text style={styles.requestButtonText}>Continue</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.requestButton, submitting && styles.disabledButton]} onPress={handleSubmit} disabled={submitting} activeOpacity={0.86}>
              {submitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.requestButtonText}>{bookingMode === 'automatic' ? 'Submit and pay' : t('actions.submitBooking')}</Text>}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
      <PaymentSheet
        visible={Boolean(payBooking)}
        booking={payBooking}
        onClose={() => setPayBooking(null)}
        onPaid={(nextBooking) => {
          setPayBooking(null);
          setPaidBooking(nextBooking);
          setSuccess(nextBooking?.bookingCode || t('customerBookings.unlocked'));
        }}
      />
    </View>
  );
}

function CustomField({ field, value, onChange }) {
  if (field.type === 'checkbox' && asList(field.options).length) {
    const selectedValues = Array.isArray(value) ? value : [];
    return (
      <View style={styles.inputWrap}>
        <Text style={styles.inputLabel}>{field.label}{field.required ? ' *' : ''}</Text>
        <View style={styles.segmentRow}>
          {field.options.map((option) => {
            const active = selectedValues.includes(option);
            return (
              <TouchableOpacity
                key={option}
                style={[styles.segmentButton, active && styles.segmentButtonActive]}
                onPress={() => onChange(active ? selectedValues.filter((item) => item !== option) : [...selectedValues, option])}
                activeOpacity={0.84}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{option}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }

  if (['select', 'radio'].includes(field.type) && asList(field.options).length) {
    return (
      <SelectField
        label={`${field.label}${field.required ? ' *' : ''}`}
        value={value}
        options={field.options.map((option) => [option, option])}
        onChange={onChange}
        placeholder={field.placeholder || 'Select option'}
      />
    );
  }

  if (field.type === 'file') {
    const meta = value && typeof value === 'object' ? value : {};
    return (
      <TextField
        label={`${field.label}${field.required ? ' *' : ''}`}
        value={meta.fileName || ''}
        onChangeText={(text) => onChange({ fileName: text, size: meta.size || 0, type: meta.type || 'application/octet-stream' })}
        placeholder={field.placeholder || 'file-name.pdf'}
      />
    );
  }

  if (field.type === 'date') {
    return <DateField label={`${field.label}${field.required ? ' *' : ''}`} value={String(value || '')} onChange={onChange} placeholder={field.placeholder || 'YYYY-MM-DD'} minimumDate={new Date()} />;
  }

  if (field.type === 'time') {
    return <TimeField label={`${field.label}${field.required ? ' *' : ''}`} value={String(value || '')} onChange={onChange} placeholder={field.placeholder || 'HH:mm'} />;
  }

  if (field.type === 'number') {
    return <NumberField label={`${field.label}${field.required ? ' *' : ''}`} value={String(value || '')} onChangeText={onChange} placeholder={field.placeholder || field.helpText || ''} />;
  }

  if (field.type === 'textarea') {
    return <MultilineField label={`${field.label}${field.required ? ' *' : ''}`} value={String(value || '')} onChangeText={onChange} placeholder={field.placeholder || field.helpText || ''} />;
  }

  return (
    <TextField
      label={`${field.label}${field.required ? ' *' : ''}`}
      value={String(value || '')}
      onChangeText={onChange}
      placeholder={field.placeholder || field.helpText || ''}
      keyboardType={field.type === 'email' ? 'email-address' : field.type === 'tel' ? 'phone-pad' : 'default'}
      autoCapitalize={field.type === 'email' || field.type === 'url' ? 'none' : 'sentences'}
    />
  );
}

function InfoTile({ label, value, icon }) {
  return (
    <View style={styles.infoTile}>
      <Feather name={icon} size={15} color={colors.primary} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function PromotionDetailsCard({ promotion }) {
  const startsAt = formatPromotionDateTime(promotion.startAt);
  const endsAt = formatPromotionDateTime(promotion.endAt);
  const validText = startsAt || endsAt
    ? `Valid ${startsAt || 'now'} - ${endsAt || 'scheduled'}`
    : '';

  return (
    <View style={styles.promotionDetailsCard}>
      <View style={styles.promotionDetailsHeader}>
        <Feather name="star" size={11} color="#111827" />
        <Text style={styles.promotionDetailsHeaderText}>Promotion</Text>
      </View>
      <View style={styles.promotionDetailsBody}>
        <Text style={styles.promotionDetailsTitle}>{promotion.title}</Text>
        <Text style={styles.promotionDetailsText}>{promotion.status === 'scheduled' ? `Starts soon: save ${promotion.percent}% on this service.` : `Save ${promotion.percent}% on this service.`}</Text>
        {!!promotion.note && <Text style={styles.promotionDetailsText}>{promotion.note}</Text>}
        {!!validText && <Text style={styles.promotionDetailsValid}>{validText}</Text>}
      </View>
    </View>
  );
}

function ChipRow({ items }) {
  return (
    <View style={styles.chipRow}>
      {items.map((item) => (
        <View key={item} style={styles.chip}>
          <Feather name="check" size={12} color={colors.primary} />
          <Text style={styles.chipText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: 28,
  },
  formContent: {
    padding: 16,
    paddingBottom: 30,
  },
  stepRow: { flexDirection: 'row', gap: 8, marginBottom: 12, marginTop: 8 },
  stepChip: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    flex: 1,
    paddingVertical: 8,
  },
  stepChipActive: { backgroundColor: colors.primaryLight },
  stepChipText: { color: colors.muted, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  stepChipTextActive: { color: colors.primaryDark },
  availabilityHint: { color: colors.primary, fontSize: 12, fontWeight: '800', marginBottom: 8 },
  rebookRow: { alignItems: 'flex-end', flexDirection: 'row', gap: 8 },
  rebookButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 10,
    height: 48,
    justifyContent: 'center',
    marginBottom: 12,
    minWidth: 88,
    paddingHorizontal: 12,
  },
  rebookButtonText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  formTopBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 28,
  },
  formIconButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  formTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    marginTop: 18,
    textAlign: 'center',
  },
  formSubtitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
    textAlign: 'center',
  },
  bookingCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 18,
    padding: 14,
  },
  bookingServiceName: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '900',
  },
  rulesBox: {
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
    marginTop: 14,
    padding: 12,
  },
  rulesTitle: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  rulesText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 3,
  },
  customerLocationBox: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 14,
    padding: 12,
  },
  rebookBox: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 14,
    padding: 12,
  },
  secondaryVerifyButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 42,
    justifyContent: 'center',
    marginTop: 10,
  },
  secondaryVerifyText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  customerLocationTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  customerLocationHelp: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
    marginTop: 3,
  },
  optionPicker: {
    gap: 9,
  },
  selectableOption: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    padding: 12,
  },
  selectableOptionActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  inputWrap: {
    flex: 1,
    marginTop: 13,
  },
  inputLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 7,
    marginTop: 12,
  },
  textInput: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  textArea: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  twoColumn: {
    flexDirection: 'row',
    gap: 10,
  },
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  segmentButton: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  segmentButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  segmentText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  segmentTextActive: {
    color: colors.white,
  },
  checkboxRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  checkbox: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxText: {
    color: colors.muted,
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  formError: {
    backgroundColor: colors.dangerSurface,
    borderRadius: 8,
    color: colors.danger,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 14,
    padding: 10,
  },
  formSuccess: {
    backgroundColor: colors.successSurface,
    borderRadius: 8,
    color: colors.success,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 14,
    padding: 10,
  },
  disabledButton: {
    opacity: 0.72,
  },
  hero: {
    height: 250,
  },
  coverImage: {
    height: '100%',
    width: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 23, 56, 0.16)',
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    left: 18,
    position: 'absolute',
    top: 46,
    width: 36,
  },
  body: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    marginTop: -18,
    padding: 18,
  },
  gallery: {
    gap: 8,
    paddingBottom: 14,
  },
  thumbButton: {
    borderColor: 'transparent',
    borderRadius: 10,
    borderWidth: 2,
    padding: 2,
  },
  thumbButtonActive: {
    borderColor: colors.primary,
  },
  thumb: {
    borderRadius: 8,
    height: 56,
    width: 86,
  },
  title: {
    color: colors.text,
    fontSize: 23,
    fontWeight: '900',
    lineHeight: 29,
  },
  locationRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 7,
  },
  locationText: {
    color: colors.muted,
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
  },
  loadingBox: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: colors.dangerSurface,
    borderRadius: 12,
    marginTop: 14,
    padding: 12,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '800',
  },
  sectionHeader: {
    marginTop: 4,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 10,
    marginTop: 20,
  },
  description: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
    opacity: 0.82,
  },
  promotionDetailsCard: {
    backgroundColor: colors.warningSurface,
    borderColor: '#FBBF24',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 16,
    overflow: 'hidden',
  },
  promotionDetailsHeader: {
    alignItems: 'center',
    backgroundColor: '#FBBF24',
    flexDirection: 'row',
    gap: 5,
    minHeight: 30,
    paddingHorizontal: 14,
  },
  promotionDetailsHeaderText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  promotionDetailsBody: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  promotionDetailsTitle: {
    color: colors.warning,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 7,
  },
  promotionDetailsText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
  },
  promotionDetailsValid: {
    color: '#EA580C',
    fontSize: 11,
    fontWeight: '900',
    marginTop: 8,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    marginTop: 18,
  },
  infoTile: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 84,
    padding: 11,
    width: '48%',
  },
  infoLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
    marginTop: 7,
    textTransform: 'uppercase',
  },
  infoValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 16,
    marginTop: 3,
  },
  optionList: {
    gap: 11,
  },
  optionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 13,
  },
  optionTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  optionCopy: {
    flex: 1,
  },
  optionName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  optionMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },
  optionPrice: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
  },
  optionFacts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 11,
  },
  factText: {
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
    color: colors.primaryDark,
    fontSize: 10,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  optionDetails: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 10,
    opacity: 0.78,
  },
  optionRule: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
    marginTop: 4,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  chipText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
  },
  mutedText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  privacyBox: {
    alignItems: 'flex-start',
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 9,
    marginTop: 20,
    padding: 13,
  },
  privacyText: {
    color: colors.primaryDark,
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
  requestButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    height: 52,
    justifyContent: 'center',
    marginTop: 18,
  },
  requestButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '900',
  },
});

