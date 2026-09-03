import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import {
  MultilineField,
  NumberField,
  SelectField,
  TextField,
} from './FormFields';
import PhoneNumberField from './PhoneNumberField';
import { ListingFields, InventoryFields } from '../features/domain/DomainFields';
import {
  emptyInventoryValues,
  emptyListingValues,
  firstError,
  domainCopy,
  remainingPaymentOptions,
  resolveDomain,
  resolveSubtype,
  validateInventoryClient,
  validateListingClient,
} from '../features/domain/registry';
import ServiceLocationPicker from './ServiceLocationPicker';
import { categorySelectOptions, findCategory, serviceCategoryId } from '../api/categories';
import {
  buildOptionPayload,
  buildServicePayload,
  createSellerService,
  createSellerServiceOption,
  deleteSellerServiceOption,
  updateSellerService,
  updateSellerServiceOption,
  uploadSellerImages,
} from '../api/seller';
import { displayPhoneFromE164, toE164 } from '../lib/phone';
import { findFirstInvalidStep, getServiceSteps, validateStepAt } from '../lib/serviceSteps';
import useThemedStyles from '../theme/useThemedStyles';
import ServiceStepTabs from './ServiceStepTabs';
import { useToast } from './Toast';

const PRICE_TYPES = [
  ['fixed', 'Fixed price'],
  ['per-person', 'Per person'],
  ['per-day', 'Per day'],
  ['per-night', 'Per night'],
  ['per-hour', 'Per hour'],
  ['per-item', 'Per item'],
  ['per-package', 'Per package'],
];

const emptyLocation = {
  country: '',
  countryCode: '',
  state: '',
  city: '',
  area: '',
  street: '',
  fullAddress: '',
  formattedAddress: '',
  latitude: '',
  longitude: '',
  latitudeRaw: '',
  longitudeRaw: '',
  placeId: '',
  placeName: '',
  locationSource: 'map_click',
};

const emptyOption = () => ({
  localId: `opt_${Date.now()}`,
  name: '',
  price: '',
  priceType: 'per-day',
  calculationField: 'duration',
  durationUnit: 'days',
  capacity: '1',
  attributes: {},
});

function formFromService(service, categories = []) {
  const contact = service?.contactDetails || {};
  // `service.location` is a legacy display string on the API, so it must never be spread.
  const catalog = service?.catalogLocation && typeof service.catalogLocation === 'object' ? service.catalogLocation : {};
  const legacy = service?.serviceLocation && typeof service.serviceLocation === 'object' ? service.serviceLocation : {};
  const inline = service?.location && typeof service.location === 'object' ? service.location : {};
  const addressLine = typeof service?.location === 'string' ? service.location : '';
  const location = {
    ...legacy,
    ...catalog,
    ...inline,
    state: inline.state || inline.province || catalog.state || legacy.province || '',
    city: inline.city || inline.district || catalog.city || legacy.district || '',
    area: inline.area || inline.sector || catalog.area || legacy.sector || '',
    placeName: inline.placeName || catalog.placeName || legacy.name || '',
    referenceName: inline.referenceName || catalog.referenceName || '',
    latitude: inline.latitude ?? catalog.latitude ?? legacy.latitude ?? contact.latitude ?? null,
    longitude: inline.longitude ?? catalog.longitude ?? legacy.longitude ?? contact.longitude ?? null,
    formattedAddress: inline.formattedAddress || catalog.formattedAddress || legacy.formattedAddress || contact.exactAddress || addressLine || '',
    fullAddress: inline.fullAddress || catalog.formattedAddress || legacy.fullAddress || contact.exactAddress || addressLine || '',
  };
  const categoryId = serviceCategoryId(service)
    || String(service?.categoryId || '')
    || '';
  const category = findCategory(categories, categoryId)
    || findCategory(categories, service?.categorySlug)
    || (typeof service?.category === 'object' ? service.category : null);
  const phone = contact.phoneE164
    ? { phoneE164: contact.phoneE164, phoneIso: contact.phoneIso || 'RW', display: displayPhoneFromE164(contact.phoneE164) }
    : { ...toE164(contact.phone || ''), display: contact.phone || '' };
  const whatsapp = contact.whatsappE164
    ? { phoneE164: contact.whatsappE164, phoneIso: contact.whatsappIso || 'RW', display: displayPhoneFromE164(contact.whatsappE164) }
    : contact.whatsapp
      ? { ...toE164(contact.whatsapp), display: contact.whatsapp }
      : { phoneE164: '', phoneIso: 'RW', display: '' };

  const images = (service?.images || []).map((img) => (typeof img === 'string' ? img : img?.url)).filter(Boolean);
  return {
    categoryId: String(categoryId || category?._id || category?.id || ''),
    categoryName: service?.categoryName || category?.name || '',
    categorySlug: service?.categorySlug || category?.slug || '',
    title: service?.title || service?.name || '',
    description: service?.description || '',
    status: service?.status === 'unavailable' ? 'unavailable' : 'available',
    primaryImage: service?.primaryImage || images[0] || '',
    images: images.slice(0, 5),
    location: {
      ...emptyLocation,
      ...location,
      latitude: location.latitude ?? '',
      longitude: location.longitude ?? '',
      latitudeRaw: location.latitudeRaw ?? (location.latitude != null ? String(location.latitude) : ''),
      longitudeRaw: location.longitudeRaw ?? (location.longitude != null ? String(location.longitude) : ''),
      state: location.state || location.province || '',
      city: location.city || location.district || '',
      area: location.area || location.sector || '',
    },
    contactDetails: {
      phoneE164: phone.phoneE164,
      phoneIso: phone.phoneIso || 'RW',
      phoneDisplay: phone.display,
      whatsappE164: whatsapp.phoneE164,
      whatsappIso: whatsapp.phoneIso || 'RW',
      whatsappDisplay: whatsapp.display,
    },
    listingAttributes: service?.listingAttributes && Object.keys(service.listingAttributes).length
      ? { ...service.listingAttributes }
      : emptyListingValues(resolveDomain(category || service), resolveSubtype(category || service)),
    paymentPolicy: {
      depositPercentage: String(service?.paymentPolicy?.depositPercentage ?? 50),
      remainingPaymentMethod: service?.paymentPolicy?.remainingPaymentMethod || 'PAY_AT_ARRIVAL',
    },
    cancellationPolicy: {
      type: service?.cancellationPolicy?.type || 'moderate',
      freeCancellationUntilHours: String(service?.cancellationPolicy?.freeCancellationUntilHours ?? 24),
      depositRefundable: Boolean(service?.cancellationPolicy?.depositRefundable),
    },
    rebookSettings: {
      requestDeadlineHours: String(service?.rebookSettings?.requestDeadlineHours ?? 24),
      rebookIdValidityHours: String(service?.rebookSettings?.rebookIdValidityHours ?? 72),
    },
    basePrice: String(service?.basePrice ?? service?.pricing?.amount ?? ''),
    supportsOptions: category?.supportsOptions !== false,
    draftOptions: [],
  };
}

function Panel({ title, hint, children }) {
  const { styles } = useThemedStyles(createStyles);
  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {children}
    </View>
  );
}

export default function ServiceEditorModal({
  visible,
  service,
  categories = [],
  existingOptions = [],
  onClose,
  onSaved,
  presentation = 'modal',
  initialStep = 0,
  showToast: showToastProp,
}) {
  const { t } = useTranslation();
  const { colors, styles } = useThemedStyles(createStyles);
  const { showToast: showToastLocal, toastNode } = useToast();
  const showToast = showToastProp || showToastLocal;
  const isPage = presentation === 'page';
  const [form, setForm] = useState(() => formFromService(null, categories));
  const [options, setOptions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(0);

  const selectedCategory = useMemo(
    () => findCategory(categories, form.categoryId),
    [categories, form.categoryId]
  );
  const supportsOptions = selectedCategory ? selectedCategory.supportsOptions !== false : form.supportsOptions !== false;
  const domain = resolveDomain(selectedCategory || service);
  const subtype = resolveSubtype(selectedCategory || service);
  const isStay = domain === 'accommodation';
  const copy = domainCopy(selectedCategory || service);
  const steps = useMemo(() => getServiceSteps(copy), [copy.kind]);

  const validationCtx = useMemo(() => ({
    form,
    options,
    domain,
    subtype,
    supportsOptions,
    copy,
    firstError,
    validateListingClient,
    validateInventoryClient,
  }), [form, options, domain, subtype, supportsOptions, copy]);

  useEffect(() => {
    if (!visible) return;
    const next = formFromService(service, categories);
    if (!service && categories[0]) {
      next.categoryId = categories[0]._id || categories[0].id;
      next.supportsOptions = categories[0].supportsOptions !== false;
    }
    setForm(next);
    setStep(Math.max(0, Math.min(steps.length - 1, Number(initialStep) || 0)));
    setOptions(
      (existingOptions || []).map((opt) => ({
        ...opt,
        localId: opt._id || opt.id || `opt_${Math.random()}`,
        name: opt.name || '',
        price: String(opt.price ?? ''),
        priceType: opt.priceType || 'per-day',
        calculationField: opt.calculationField || 'duration',
        durationUnit: opt.durationUnit || 'days',
        capacity: String(opt.capacity ?? 1),
        attributes: opt.attributes || {},
      }))
    );
    setError('');
  }, [visible, service, categories, existingOptions, initialStep, steps.length]);

  const raiseStepError = (message, nextStep) => {
    setError(message);
    if (typeof nextStep === 'number') setStep(nextStep);
    showToast(message, 'error');
  };

  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const setLocation = (next) => setForm((current) => ({ ...current, location: { ...current.location, ...next } }));
  const onCategoryChange = (nextCategoryId) => {
    const category = findCategory(categories, nextCategoryId);
    setForm((current) => ({
      ...current,
      categoryId: String(nextCategoryId || ''),
      categoryName: category?.name || '',
      categorySlug: category?.slug || '',
      supportsOptions: category?.supportsOptions !== false,
      listingAttributes: emptyListingValues(resolveDomain(category), resolveSubtype(category)),
      paymentPolicy: current.paymentPolicy || { depositPercentage: '50', remainingPaymentMethod: 'PAY_AT_ARRIVAL' },
      cancellationPolicy: current.cancellationPolicy || {
        type: 'moderate',
        freeCancellationUntilHours: '24',
        depositRefundable: false,
      },
      basePrice: category?.supportsOptions === false ? current.basePrice : '',
    }));
    if (category?.supportsOptions === false) setOptions([]);
    else if (!options.length) setOptions([emptyOption()]);
  };

  const pickImages = async () => {
    const current = form.images.filter(Boolean);
    const remaining = Math.max(0, 5 - current.length);
    if (!remaining) {
      raiseStepError('Maximum 5 images allowed.', 0);
      return;
    }
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission required', 'Allow photo library access to upload images.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 0.85,
      });
      if (result.canceled || !result.assets?.length) return;
      setUploading(true);
      const formData = new FormData();
      result.assets.slice(0, remaining).forEach((asset, index) => {
        formData.append('images', {
          uri: asset.uri,
          name: asset.fileName || `service-${Date.now()}-${index}.jpg`,
          type: asset.mimeType || 'image/jpeg',
        });
      });
      const urls = await uploadSellerImages(formData);
      setForm((current) => {
        const images = [...current.images.filter(Boolean), ...urls].slice(0, 5);
        return {
          ...current,
          images,
          primaryImage: current.primaryImage || images[0] || '',
        };
      });
    } catch (err) {
      raiseStepError(err.message || 'Image upload failed.', 0);
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (url) => {
    setForm((current) => {
      const images = current.images.filter((item) => item !== url);
      return {
        ...current,
        images,
        primaryImage: current.primaryImage === url ? (images[0] || '') : current.primaryImage,
      };
    });
  };

  const syncOptions = async (serviceId, list) => {
    for (const option of list) {
      const body = buildOptionPayload({
        ...option,
        attributes: option.attributes || {},
      });
      if (option._id || option.id) {
        await updateSellerServiceOption(serviceId, option._id || option.id, body);
      } else if (String(option.name || '').trim()) {
        await createSellerServiceOption(serviceId, body);
      }
    }
  };

  const goNext = () => {
    const message = validateStepAt(step, validationCtx);
    if (message) {
      raiseStepError(message, step);
      return;
    }
    setError('');
    setStep((index) => Math.min(steps.length - 1, index + 1));
  };

  const goBack = () => {
    setError('');
    setStep((index) => Math.max(0, index - 1));
  };

  const onTabChange = (index) => {
    // Allow free navigation when editing existing, but validate current before leaving forward on create
    if (!service && index > step) {
      const message = validateStepAt(step, validationCtx);
      if (message) {
        raiseStepError(message, step);
        return;
      }
    }
    setError('');
    setStep(index);
  };

  const save = async () => {
    const invalid = findFirstInvalidStep(validationCtx);
    if (invalid.message) {
      raiseStepError(invalid.message, invalid.stepIndex);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const listingAttributes = { ...(form.listingAttributes || {}) };
      if (isStay) {
        listingAttributes.checkInTime = listingAttributes.checkInFrom || listingAttributes.checkInTime;
        listingAttributes.checkOutTime = listingAttributes.checkOutUntil || listingAttributes.checkOutTime;
        listingAttributes.maxStayNights = listingAttributes.allowLongStays ? 90 : 30;
        if (listingAttributes.hostIdentity?.legalName) listingAttributes.requireHostIdentity = true;
      }
      const payload = buildServicePayload({
        ...form,
        listingAttributes,
        paymentPolicy: {
          depositPercentage: Math.max(20, Math.min(100, Number(form.paymentPolicy?.depositPercentage) || 50)),
          remainingPaymentMethod: form.paymentPolicy?.remainingPaymentMethod || 'PAY_AT_ARRIVAL',
        },
        cancellationPolicy: {
          type: form.cancellationPolicy?.type || 'moderate',
          freeCancellationUntilHours: Number(form.cancellationPolicy?.freeCancellationUntilHours) || 24,
          depositRefundable: Boolean(form.cancellationPolicy?.depositRefundable),
        },
        categoryId: String(form.categoryId || selectedCategory?._id || selectedCategory?.id || ''),
        contactDetails: {
          phoneE164: form.contactDetails.phoneE164,
          phoneIso: form.contactDetails.phoneIso,
          whatsappE164: form.contactDetails.whatsappE164,
          whatsappIso: form.contactDetails.whatsappIso,
        },
        supportsOptions,
      }, { category: selectedCategory });
      if (!payload.categoryId) {
        raiseStepError('Select a service category.', 0);
        setSaving(false);
        return;
      }

      let saved;
      const serviceId = service?._id || service?.id;
      if (serviceId) {
        saved = await updateSellerService(serviceId, payload);
      } else {
        saved = await createSellerService(payload);
      }
      const savedService = saved.service || saved;
      const savedId = savedService._id || savedService.id || serviceId;

      if (supportsOptions && savedId && options.length) {
        await syncOptions(savedId, options);
      }

      showToast(service ? 'Service updated.' : 'Service created.', 'success');
      onSaved?.(savedService);
      onClose?.();
    } catch (err) {
      raiseStepError(err.message || 'Could not save service.', step);
    } finally {
      setSaving(false);
    }
  };

  const updateOption = (localId, key, value) => {
    setOptions((current) => current.map((item) => (item.localId === localId ? { ...item, [key]: value } : item)));
  };

  const removeOption = async (option) => {
    if (option._id || option.id) {
      const serviceId = service?._id || service?.id;
      if (serviceId) {
        try {
          await deleteSellerServiceOption(serviceId, option._id || option.id);
        } catch (err) {
          raiseStepError(err.message || 'Could not delete option.', 2);
          return;
        }
      }
    }
    setOptions((current) => current.filter((item) => item.localId !== option.localId));
  };

  if (!visible && !isPage) return null;

  const editorBody = (
    <View style={styles.screen}>
      {!showToastProp ? toastNode : null}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          {isPage ? (
            <TouchableOpacity style={styles.close} onPress={onClose} activeOpacity={0.84}>
              <Feather name="arrow-left" size={18} color={colors.text} />
            </TouchableOpacity>
          ) : null}
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{service ? (isStay ? 'Edit stay' : 'Edit service') : (isStay ? 'List a stay' : 'Add service')}</Text>
            <Text style={styles.subtitle}>
              Step {step + 1} of {steps.length}: {steps[step]?.label}
            </Text>
          </View>
          {!isPage ? (
            <TouchableOpacity style={styles.close} onPress={onClose} activeOpacity={0.84}>
              <Feather name="x" size={18} color={colors.text} />
            </TouchableOpacity>
          ) : null}
        </View>

        <ServiceStepTabs steps={steps} activeIndex={step} onChange={onTabChange} mode="edit" />

        {!!error && <Text style={styles.error}>{error}</Text>}

        {step === 0 ? (
          <>
            <Panel title="Category & basics">
              <SelectField
                label="Category"
                value={String(form.categoryId || '')}
                options={categorySelectOptions(categories)}
                onChange={onCategoryChange}
                placeholder="Select category"
              />
              {selectedCategory ? (
                <Text style={styles.hint}>
                  {selectedCategory.name}
                  {selectedCategory.group ? ` · ${selectedCategory.group}` : ''}
                  {selectedCategory.slug ? ` · ${selectedCategory.slug}` : ''}
                </Text>
              ) : form.categoryName ? (
                <Text style={styles.hint}>{form.categoryName}{form.categorySlug ? ` · ${form.categorySlug}` : ''}</Text>
              ) : null}
              <TextField label="Title" value={form.title} onChangeText={(text) => setField('title', text)} />
              <MultilineField label="Description" value={form.description} onChangeText={(text) => setField('description', text)} />
              <SelectField
                label="Availability"
                value={form.status}
                options={[['available', 'Available'], ['unavailable', 'Not available']]}
                onChange={(value) => setField('status', value)}
                searchable={false}
              />
            </Panel>

            <Panel
              title="Location"
              hint="Search a place by typing, then select a result. Country, city, region, address, and map pin fill in automatically."
            >
              <ServiceLocationPicker
                value={form.location}
                onChange={(next) => setLocation({
                  ...next,
                  latitude: next.latitude != null ? String(next.latitude) : '',
                  longitude: next.longitude != null ? String(next.longitude) : '',
                  latitudeRaw: next.latitudeRaw ?? (next.latitude != null ? String(next.latitude) : form.location.latitudeRaw),
                  longitudeRaw: next.longitudeRaw ?? (next.longitude != null ? String(next.longitude) : form.location.longitudeRaw),
                  province: next.state || next.province || '',
                  district: next.city || next.district || '',
                  sector: next.area || next.sector || '',
                })}
              />
            </Panel>

            <Panel title="Contact">
              <PhoneNumberField
                label="Phone (required)"
                value={{ phoneE164: form.contactDetails.phoneE164, phoneIso: form.contactDetails.phoneIso, display: form.contactDetails.phoneDisplay }}
                onChange={(phone) => setForm((current) => ({
                  ...current,
                  contactDetails: {
                    ...current.contactDetails,
                    phoneE164: phone.phoneE164,
                    phoneIso: phone.phoneIso,
                    phoneDisplay: phone.display,
                  },
                }))}
              />
              <PhoneNumberField
                label="WhatsApp (optional)"
                value={{ phoneE164: form.contactDetails.whatsappE164, phoneIso: form.contactDetails.whatsappIso, display: form.contactDetails.whatsappDisplay }}
                onChange={(phone) => setForm((current) => ({
                  ...current,
                  contactDetails: {
                    ...current.contactDetails,
                    whatsappE164: phone.phoneE164,
                    whatsappIso: phone.phoneIso,
                    whatsappDisplay: phone.display,
                  },
                }))}
              />
            </Panel>

            <Panel title="Photos (max 5)">
              <TouchableOpacity style={styles.upload} onPress={pickImages} disabled={uploading} activeOpacity={0.84}>
                {uploading ? <ActivityIndicator color={colors.primary} /> : (
                  <>
                    <Feather name="upload-cloud" size={18} color={colors.primary} />
                    <Text style={styles.uploadText}>Upload photos</Text>
                  </>
                )}
              </TouchableOpacity>
              <Text style={styles.hint}>Optional cover = first image. Tap a photo to set as cover.</Text>
              <View style={styles.imageGrid}>
                {form.images.filter(Boolean).map((url) => (
                  <TouchableOpacity key={url} style={styles.imageCard} onPress={() => setField('primaryImage', url)} activeOpacity={0.9}>
                    <Image source={{ uri: url }} style={styles.image} />
                    {form.primaryImage === url ? <Text style={styles.coverBadge}>Cover</Text> : null}
                    <TouchableOpacity style={styles.removeImage} onPress={() => removeImage(url)} activeOpacity={0.84}>
                      <Feather name="x" size={12} color="#fff" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </View>
            </Panel>
          </>
        ) : null}

        {step === 1 ? (
          <Panel
            title={isStay ? 'House rules, availability & invoicing' : copy.kind === 'rental' ? 'Rental rules & locations' : 'Category details'}
            hint={copy.kind === 'rental' ? 'These rules apply to the whole listing (class, ages, pickup/return, permits).' : undefined}
          >
            <ListingFields
              category={selectedCategory || service}
              values={form.listingAttributes}
              onChange={(next) => setForm((current) => ({ ...current, listingAttributes: next }))}
            />
          </Panel>
        ) : null}

        {step === 2 ? (
          !supportsOptions ? (
            <Panel title="Pricing">
              <NumberField label="Base price (RWF)" value={String(form.basePrice)} onChangeText={(text) => setField('basePrice', text)} />
            </Panel>
          ) : (
            <Panel
              title={isStay ? 'Rooms & units' : copy.kind === 'rental' ? 'Vehicles / bike types' : 'Options & prices'}
              hint={copy.kind === 'rental'
                ? 'Add each vehicle or bike type you offer, with its own price and details. This is separate from the rental rules above.'
                : 'Add priced options customers can choose from.'}
            >
              {options.length ? null : (
                <Text style={styles.hint}>Nothing here yet. Tap add below to create one.</Text>
              )}
              {options.map((option, index) => (
                <View key={option.localId} style={styles.optionCard}>
                  <View style={styles.optionHeader}>
                    <Text style={styles.optionTitle}>{isStay ? `Unit ${index + 1}` : copy.kind === 'rental' ? `Vehicle ${index + 1}` : `Option ${index + 1}`}</Text>
                    <TouchableOpacity onPress={() => removeOption(option)} activeOpacity={0.84}>
                      <Text style={styles.removeText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                  <TextField label="Name" value={option.name} onChangeText={(text) => updateOption(option.localId, 'name', text)} />
                  <NumberField label="Price (RWF)" value={String(option.price)} onChangeText={(text) => updateOption(option.localId, 'price', text)} />
                  <SelectField label="Price type" value={option.priceType} options={PRICE_TYPES} onChange={(value) => updateOption(option.localId, 'priceType', value)} searchable={false} />
                  <NumberField label={copy.capacityLabel || 'Capacity'} value={String(option.capacity)} onChangeText={(text) => updateOption(option.localId, 'capacity', text)} />
                  <InventoryFields
                    category={selectedCategory || service}
                    values={option.attributes || emptyInventoryValues(domain, subtype)}
                    onChange={(next) => updateOption(option.localId, 'attributes', next)}
                  />
                </View>
              ))}
              <TouchableOpacity style={styles.outline} onPress={() => setOptions((current) => [...current, emptyOption()])} activeOpacity={0.84}>
                <Text style={styles.outlineText}>{isStay ? 'Add unit' : copy.kind === 'rental' ? 'Add vehicle type' : 'Add option'}</Text>
              </TouchableOpacity>
            </Panel>
          )
        ) : null}

        {step === 3 ? (
          <>
            <Panel
              title="Customer payment"
              hint="Choose how much customers pay online when booking. Minimum 20%."
            >
              <NumberField
                label="Online deposit %"
                value={String(form.paymentPolicy?.depositPercentage ?? 50)}
                onChangeText={(text) => setField('paymentPolicy', {
                  ...(form.paymentPolicy || {}),
                  depositPercentage: text.replace(/[^0-9]/g, ''),
                })}
              />
              <Text style={styles.hint}>Minimum 20%, maximum 100%. Default is 50% of the full booking price.</Text>
              <SelectField
                label="Remaining balance"
                value={form.paymentPolicy?.remainingPaymentMethod || 'PAY_AT_ARRIVAL'}
                options={remainingPaymentOptions(selectedCategory || service)}
                onChange={(value) => setField('paymentPolicy', {
                  ...(form.paymentPolicy || {}),
                  remainingPaymentMethod: value,
                })}
                searchable={false}
              />
              <SelectField
                label="Cancellation policy"
                value={form.cancellationPolicy?.type || 'moderate'}
                options={[['flexible', 'Flexible'], ['moderate', 'Moderate'], ['strict', 'Strict']]}
                onChange={(value) => setField('cancellationPolicy', {
                  ...(form.cancellationPolicy || {}),
                  type: value,
                })}
                searchable={false}
              />
              <NumberField
                label="Free cancellation until (hours before start)"
                value={String(form.cancellationPolicy?.freeCancellationUntilHours ?? 24)}
                onChangeText={(text) => setField('cancellationPolicy', {
                  ...(form.cancellationPolicy || {}),
                  freeCancellationUntilHours: text,
                })}
              />
            </Panel>
            <Panel title="Rebook rules" hint="How long customers have to request a rebook and how long a rebook ID stays valid.">
              <NumberField
                label="Request deadline (hours)"
                value={String(form.rebookSettings.requestDeadlineHours)}
                onChangeText={(text) => setField('rebookSettings', { ...form.rebookSettings, requestDeadlineHours: text })}
              />
              <NumberField
                label="Rebook ID validity (hours)"
                value={String(form.rebookSettings.rebookIdValidityHours)}
                onChangeText={(text) => setField('rebookSettings', { ...form.rebookSettings, rebookIdValidityHours: text })}
              />
            </Panel>
          </>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
          <TouchableOpacity
            style={[styles.outline, { flex: 1, opacity: step === 0 ? 0.4 : 1 }]}
            disabled={step === 0}
            onPress={goBack}
            activeOpacity={0.84}
          >
            <Text style={styles.outlineText}>Back</Text>
          </TouchableOpacity>
          {step < steps.length - 1 ? (
            <TouchableOpacity style={[styles.save, { flex: 1 }]} onPress={goNext} activeOpacity={0.86}>
              <Text style={styles.saveText}>Continue</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.save, { flex: 1 }, saving && { opacity: 0.7 }]} onPress={save} disabled={saving} activeOpacity={0.86}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{t('actions.save')}</Text>}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );

  if (isPage) return editorBody;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {editorBody}
    </Modal>
  );
}

const createStyles = (colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 12 },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 4, fontWeight: '600' },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  error: { color: '#B91C1C', fontWeight: '700', marginBottom: 10 },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 14,
  },
  panelTitle: { color: colors.text, fontSize: 15, fontWeight: '800', marginBottom: 10 },
  hint: { color: colors.muted, fontSize: 12, fontWeight: '600', marginBottom: 8 },
  row: { flexDirection: 'row', gap: 10 },
  upload: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  uploadText: { color: colors.primary, fontWeight: '800' },
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  imageCard: { width: 96, height: 96, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.border },
  image: { width: '100%', height: '100%' },
  coverBadge: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    backgroundColor: colors.primary,
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  removeImage: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  optionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  optionTitle: { fontWeight: '800', color: colors.text },
  removeText: { color: '#B91C1C', fontWeight: '800' },
  outline: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineText: { fontWeight: '800', color: colors.text },
  save: {
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  saveText: { color: '#fff', fontWeight: '900', fontSize: 15 },
});
