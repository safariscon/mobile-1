import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { fetchServiceDetails, submitBookingRequest } from '../api/services';
import { useAuth } from '../context/AuthContext';
import { ANALYTICS_EVENTS, trackAnalytics } from '../lib/analytics';
import { getVisiblePromotion } from '../lib/promotion';
import { DateField, MultilineField, NumberField, SelectField, TextField, TimeField } from './FormFields';
import { lightColors } from '../theme/colors';
import useThemedStyles from '../theme/useThemedStyles';

let colors = lightColors;
let styles;
import { RWANDA_DISTRICTS, RWANDA_PROVINCES } from '../data/formOptions';

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
  const images = useMemo(() => {
    const gallery = asList(displayService?.images);
    return gallery.length ? gallery : [displayService?.image || fallbackImage];
  }, [displayService]);
  const activeImage = images[selectedImageIndex] || images[0] || fallbackImage;
  const options = asList(displayService?.options);
  const amenities = asList(displayService?.amenities);
  const locationText = displayService?.generalLocation || displayService?.location?.generalLocation || service?.generalLocation || t('common.rwanda');
  const promotion = getVisiblePromotion(displayService?.promotion || service?.promotion);

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
              <InfoTile label={t('serviceDetails.category')} value={displayService?.category || t('serviceDetails.service')} icon="grid" />
              <InfoTile
                label={t('serviceDetails.seller')}
                value={formatBoolLabel(displayService?.seller?.verified, t('serviceDetails.verifiedSeller'), t('serviceDetails.pendingVerification'))}
                icon="shield"
              />
              <InfoTile label={t('serviceDetails.availability')} value={displayService?.availabilityStatus || displayService?.availability || t('serviceDetails.available')} icon="check-circle" />
              <InfoTile label={t('serviceDetails.pricing')} value={displayService?.pricingType || t('serviceDetails.standard')} icon="tag" />
              <InfoTile label={t('serviceDetails.unit')} value={displayService?.durationUnit || t('serviceDetails.use')} icon="clock" />
              <InfoTile label={t('serviceDetails.capacity')} value={`${displayService?.maximumCapacity || 1}`} icon="users" />
            </View>

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
              style={styles.requestButton}
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
              <Text style={styles.requestButtonText}>{t('serviceDetails.requestBooking')}</Text>
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
  customerProvince: '',
  customerDistrict: '',
  customerSector: '',
  customerCell: '',
  customerVillage: '',
  paymentMethod: 'mobile-money',
  specialRequests: '',
  agreeToTerms: false,
});

function BookingRequestForm({ service, user, onBack, onClose }) {
  const { t } = useTranslation();
  const options = asList(service?.options);
  const customFields = service?.bookingForm?.isPublished
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
  const [selectedOptionId, setSelectedOptionId] = useState(getOptionValue(options[0]));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const selectedOption = options.find((option) => getOptionValue(option) === selectedOptionId) || options[0];
  const locationText = service?.generalLocation || service?.location?.generalLocation || t('common.rwanda');

  const updateValue = (key, value) => setValues((current) => ({ ...current, [key]: value }));
  const updateCustomValue = (key, value) => setCustomValues((current) => ({ ...current, [key]: value }));

  const validate = () => {
    if (!service?.hotelId && !service?.id) return t('bookingForm.unavailable');
    if (!selectedOption) return t('bookingForm.chooseOptionError');
    if (!values.fullName.trim()) return t('bookingForm.fullNameError');
    if (!/^\+?[0-9][0-9\s-]{7,18}$/.test(values.phone.trim())) return t('bookingForm.phoneError');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) return t('bookingForm.emailError');
    if (!values.bookingDate.trim()) return t('bookingForm.dateError');
    if (!values.customerProvince || !values.customerDistrict || !values.customerSector.trim()) return 'Customer province, district, and sector are required.';
    if (values.endDate && values.bookingDate && new Date(values.endDate) <= new Date(values.bookingDate)) {
      return 'End date must be after booking date.';
    }
    if (!values.agreeToTerms) return t('bookingForm.termsError');
    const missingCustom = customFields.find((field) => field.required && !String(customValues[field.id] || '').trim());
    if (missingCustom) return t('bookingForm.customRequired', { label: missingCustom.label });
    return '';
  };

  const handleSubmit = async () => {
    setError('');
    setSuccess('');
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const quantity = Math.max(1, Number(values.quantity) || 1);
      const people = Math.max(1, Number(values.numberOfPeople) || 1);
      const customResponses = customFields.map((field) => ({
        fieldId: field.id,
        label: field.label,
        type: field.type,
        value: customValues[field.id],
      }));
      const checkIn = values.bookingDate || null;
      const checkOut = values.endDate || values.bookingDate || null;
      const customerLocationDetails = {
        province: values.customerProvince,
        district: values.customerDistrict,
        sector: values.customerSector.trim(),
        cell: values.customerCell.trim(),
        village: values.customerVillage.trim(),
      };
      const customerLocationText = [
        customerLocationDetails.village,
        customerLocationDetails.cell,
        customerLocationDetails.sector,
        customerLocationDetails.district,
        customerLocationDetails.province,
      ].filter(Boolean).join(', ');

      const response = await submitBookingRequest({
        hotelId: service.hotelId || service.id,
        quantity,
        guests: people,
        checkIn,
        checkOut,
        totalPrice: 0,
        destinationPlace: service.title || service.name || t('bookingForm.selectedService'),
        destinationLocation: locationText,
        bookingDetails: {
          ...values,
          serviceName: service.title || service.name || t('bookingForm.selectedService'),
          requestedService: selectedOption.name || t('serviceDetails.serviceOption'),
          selectedOptionId: selectedOption.id,
          listedPriceRwf: selectedOption.price || '',
          fullName: values.fullName.trim(),
          email: values.email.trim().toLowerCase(),
          phone: values.phone.trim(),
          bookingDate: values.bookingDate,
          endDate: values.endDate || values.bookingDate,
          startTime: values.startTime,
          endTime: values.endTime,
          numberOfPeople: people,
          quantity,
          customerLocation: values.customerLocation.trim() || customerLocationText,
          customerLocationDetails,
          paymentMethod: values.paymentMethod,
          serviceCategory: service.category || '',
          bookingType: service.category || 'service',
          providerRules: service.bookingRules ? [service.bookingRules] : [],
          customFormTitle: service.bookingForm?.title || '',
          customResponses,
        },
      });

      trackAnalytics(ANALYTICS_EVENTS.BOOKING_SUBMITTED, { serviceId: service.id || service.hotelId, bookingId: response?.booking?._id });
      setSuccess(response?.booking?.bookingCode ? t('bookingForm.successCode', { code: response.booking.bookingCode }) : t('bookingForm.success'));
    } catch (requestError) {
      setError(t('bookingForm.submitFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formContent}>
        <View style={styles.formTopBar}>
          <TouchableOpacity onPress={onBack} style={styles.formIconButton} activeOpacity={0.82}>
            <Feather name="arrow-left" size={20} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={styles.formIconButton} activeOpacity={0.82}>
            <Feather name="x" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        <Text style={styles.formTitle}>{t('bookingForm.title')}</Text>
        <Text style={styles.formSubtitle}>{t('bookingForm.subtitle')}</Text>

        <View style={styles.bookingCard}>
          <Text style={styles.bookingServiceName}>{service?.title || service?.name || t('bookingForm.selectedService')}</Text>
          <View style={styles.locationRow}>
            <Feather name="map-pin" size={13} color={colors.muted} />
            <Text style={styles.locationText}>{locationText}</Text>
          </View>

          <View style={styles.rulesBox}>
            <Text style={styles.rulesTitle}>{t('bookingForm.rules')}</Text>
            <Text style={styles.rulesText}>{t('bookingForm.ruleDeposit')}</Text>
            <Text style={styles.rulesText}>{t('bookingForm.rulePrivacy')}</Text>
            {!!service?.bookingRules?.cancellationPolicy?.description && (
              <Text style={styles.rulesText}>{service.bookingRules.cancellationPolicy.description}</Text>
            )}
          </View>

          <SelectField
            label={t('bookingForm.chooseService')}
            value={selectedOptionId}
            options={options.map((option) => ({
              value: getOptionValue(option),
              label: option.name || t('serviceDetails.serviceOption'),
              description: option.priceText || t('serviceDetails.contactForPrice'),
            }))}
            onChange={setSelectedOptionId}
            placeholder="Select from the seller's table"
          />

          <TextField label={t('bookingForm.fullName')} value={values.fullName} onChangeText={(text) => updateValue('fullName', text)} placeholder={t('bookingForm.fullNamePlaceholder')} />
          <TextField label={t('bookingForm.phone')} value={values.phone} onChangeText={(text) => updateValue('phone', text)} placeholder={t('bookingForm.phonePlaceholder')} keyboardType="phone-pad" />
          <TextField label={t('bookingForm.email')} value={values.email} onChangeText={(text) => updateValue('email', text)} placeholder={t('bookingForm.emailPlaceholder')} keyboardType="email-address" autoCapitalize="none" />

          <View style={styles.twoColumn}>
            <DateField label={t('bookingForm.bookingDate')} value={values.bookingDate} onChange={(value) => updateValue('bookingDate', value)} placeholder={t('bookingForm.datePlaceholder')} minimumDate={new Date()} />
            <DateField label={t('bookingForm.endDate')} value={values.endDate} onChange={(value) => updateValue('endDate', value)} placeholder={t('bookingForm.datePlaceholder')} minimumDate={values.bookingDate ? new Date(values.bookingDate) : new Date()} />
          </View>

          <View style={styles.twoColumn}>
            <TimeField label={t('bookingForm.startTime')} value={values.startTime} onChange={(value) => updateValue('startTime', value)} placeholder={t('bookingForm.timePlaceholder')} />
            <TimeField label={t('bookingForm.endTime')} value={values.endTime} onChange={(value) => updateValue('endTime', value)} placeholder={t('bookingForm.timePlaceholder')} />
          </View>

          <View style={styles.twoColumn}>
            <NumberField label={t('bookingForm.people')} value={values.numberOfPeople} onChangeText={(text) => updateValue('numberOfPeople', text)} />
            <NumberField label={t('bookingForm.quantity')} value={values.quantity} onChangeText={(text) => updateValue('quantity', text)} />
          </View>

          <View style={styles.customerLocationBox}>
            <Text style={styles.customerLocationTitle}>Customer location</Text>
            <Text style={styles.customerLocationHelp}>Province, district, and sector are required for this booking.</Text>
            <TextField label={`${t('bookingForm.pickup')} (optional)`} value={values.customerLocation} onChangeText={(text) => updateValue('customerLocation', text)} placeholder={t('bookingForm.pickupPlaceholder')} />
            <View style={styles.twoColumn}>
              <SelectField label={`${t('customerBookings.province')} *`} value={values.customerProvince} options={RWANDA_PROVINCES.map((province) => [province, province || 'Select province'])} onChange={(value) => updateValue('customerProvince', value)} placeholder="Select province" />
              <SelectField label={`${t('customerBookings.district')} *`} value={values.customerDistrict} options={[['', 'Select district'], ...RWANDA_DISTRICTS.map((district) => [district, district])]} onChange={(value) => updateValue('customerDistrict', value)} placeholder="Select district" />
            </View>
            <View style={styles.twoColumn}>
              <TextField label={`${t('customerBookings.sector')} *`} value={values.customerSector} onChangeText={(text) => updateValue('customerSector', text)} />
              <TextField label={t('seller.cell')} value={values.customerCell} onChangeText={(text) => updateValue('customerCell', text)} />
            </View>
            <TextField label={t('seller.village')} value={values.customerVillage} onChangeText={(text) => updateValue('customerVillage', text)} />
          </View>

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

          {customFields.map((field) => (
            <CustomField
              key={field.id}
              field={field}
              value={customValues[field.id]}
              onChange={(nextValue) => updateCustomValue(field.id, nextValue)}
            />
          ))}

          <MultilineField
            label={t('bookingForm.specialRequest')}
            value={values.specialRequests}
            onChangeText={(text) => updateValue('specialRequests', text)}
            placeholder={t('bookingForm.specialPlaceholder')}
          />

          <TouchableOpacity style={styles.checkboxRow} onPress={() => updateValue('agreeToTerms', !values.agreeToTerms)} activeOpacity={0.84}>
            <View style={[styles.checkbox, values.agreeToTerms && styles.checkboxActive]}>
              {values.agreeToTerms ? <Feather name="check" size={14} color={colors.white} /> : null}
            </View>
            <Text style={styles.checkboxText}>{t('bookingForm.terms')}</Text>
          </TouchableOpacity>

          {!!error && <Text style={styles.formError}>{error}</Text>}
          {!!success && <Text style={styles.formSuccess}>{success}</Text>}

          <TouchableOpacity style={[styles.requestButton, submitting && styles.disabledButton]} onPress={handleSubmit} disabled={submitting} activeOpacity={0.86}>
            {submitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.requestButtonText}>{t('actions.submitBooking')}</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
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

