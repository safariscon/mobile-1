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
import SchemaFields, { validateSchemaValues } from './SchemaFields';
import ServiceLocationPicker from './ServiceLocationPicker';
import WorldLocationFields from './WorldLocationFields';
import { categorySelectOptions, findCategory } from '../api/categories';
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
import useThemedStyles from '../theme/useThemedStyles';

const PRICE_TYPES = [
  ['fixed', 'Fixed price'],
  ['per-person', 'Per person'],
  ['per-day', 'Per day'],
  ['per-night', 'Per night'],
  ['per-hour', 'Per hour'],
  ['per-item', 'Per item'],
  ['per-package', 'Per package'],
];

const CALC_FIELDS = [
  ['people', 'Number of people'],
  ['quantity', 'Quantity / units'],
  ['duration', 'Booking duration'],
  ['fixed', 'Fixed price'],
];

const DURATION_UNITS = [
  ['minutes', 'Minutes'],
  ['hours', 'Hours'],
  ['days', 'Days'],
  ['nights', 'Nights'],
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
  const location = service?.location || service?.serviceLocation || {};
  const contact = service?.contactDetails || {};
  const categoryId = service?.categoryId?._id || service?.categoryId || service?.category?.id || service?.category?._id || '';
  const category = findCategory(categories, categoryId) || service?.category || null;
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
    categoryId: categoryId || category?._id || category?.id || '',
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
    listingAttributes: { ...(service?.listingAttributes || {}) },
    rebookSettings: {
      requestDeadlineHours: String(service?.rebookSettings?.requestDeadlineHours ?? 24),
      rebookIdValidityHours: String(service?.rebookSettings?.rebookIdValidityHours ?? 72),
    },
    basePrice: String(service?.basePrice ?? service?.pricing?.amount ?? ''),
    supportsOptions: category?.supportsOptions !== false,
    draftOptions: [],
  };
}

function Panel({ title, children }) {
  const { styles } = useThemedStyles(createStyles);
  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>{title}</Text>
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
}) {
  const { t } = useTranslation();
  const { colors, styles } = useThemedStyles(createStyles);
  const [form, setForm] = useState(() => formFromService(null, categories));
  const [options, setOptions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const selectedCategory = useMemo(
    () => findCategory(categories, form.categoryId),
    [categories, form.categoryId]
  );
  const supportsOptions = selectedCategory ? selectedCategory.supportsOptions !== false : form.supportsOptions !== false;
  const listingSchema = selectedCategory?.listingFieldSchema || service?.schemaSnapshot?.listingFieldSchema || [];
  const optionSchema = selectedCategory?.optionFieldSchema || service?.schemaSnapshot?.optionFieldSchema || [];

  useEffect(() => {
    if (!visible) return;
    const next = formFromService(service, categories);
    if (!service && categories[0]) {
      next.categoryId = categories[0]._id || categories[0].id;
      next.supportsOptions = categories[0].supportsOptions !== false;
    }
    setForm(next);
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
  }, [visible, service, categories, existingOptions]);

  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const setLocation = (next) => setForm((current) => ({ ...current, location: { ...current.location, ...next } }));
  const setListingAttr = (id, value) => setForm((current) => ({
    ...current,
    listingAttributes: { ...current.listingAttributes, [id]: value },
  }));

  const onCategoryChange = (categoryId) => {
    const category = findCategory(categories, categoryId);
    setForm((current) => ({
      ...current,
      categoryId,
      supportsOptions: category?.supportsOptions !== false,
      listingAttributes: {},
      basePrice: category?.supportsOptions === false ? current.basePrice : '',
    }));
    if (category?.supportsOptions === false) setOptions([]);
  };

  const pickImages = async () => {
    const current = form.images.filter(Boolean);
    const remaining = Math.max(0, 5 - current.length);
    if (!remaining) {
      setError('Maximum 5 images allowed.');
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
      setError(err.message || 'Image upload failed.');
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

  const validate = () => {
    if (!form.categoryId) return 'Select a service category.';
    if (!form.title.trim()) return 'Title is required.';
    if (!form.location.country || !(form.location.city || form.location.state)) return 'Country and city are required.';
    if (form.status === 'available' && (!form.location.latitudeRaw && !form.location.latitude)) {
      return 'Exact map coordinates are required before a service can be available.';
    }
    if (!form.contactDetails.phoneE164) return 'Contact phone is required.';
    const schemaError = validateSchemaValues(listingSchema, form.listingAttributes);
    if (schemaError) return schemaError;
    if (!supportsOptions) {
      const price = Number(form.basePrice);
      if (!Number.isFinite(price) || price < 0) return 'Base price (RWF) is required for this category.';
    }
    return '';
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

  const save = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = buildServicePayload({
        ...form,
        contactDetails: {
          phoneE164: form.contactDetails.phoneE164,
          phoneIso: form.contactDetails.phoneIso,
          whatsappE164: form.contactDetails.whatsappE164,
          whatsappIso: form.contactDetails.whatsappIso,
        },
        supportsOptions,
      }, { category: selectedCategory });

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

      onSaved?.(savedService);
      onClose?.();
    } catch (err) {
      setError(err.message || 'Could not save service.');
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
          setError(err.message || 'Could not delete option.');
          return;
        }
      }
    }
    setOptions((current) => current.filter((item) => item.localId !== option.localId));
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{service ? 'Edit service' : 'Add service'}</Text>
              <Text style={styles.subtitle}>Schema-driven listing from your selected category</Text>
            </View>
            <TouchableOpacity style={styles.close} onPress={onClose} activeOpacity={0.84}>
              <Feather name="x" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <Panel title="Category & basics">
            <SelectField
              label="Category"
              value={form.categoryId}
              options={categorySelectOptions(categories)}
              onChange={onCategoryChange}
              placeholder="Select category"
            />
            {selectedCategory?.group ? <Text style={styles.hint}>Group: {selectedCategory.group}</Text> : null}
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

          <Panel title="Location">
            <WorldLocationFields
              value={form.location}
              onChange={(location) => setLocation({
                ...location,
                province: location.state || location.province,
                district: location.city || location.district,
              })}
            />
            <TextField
              label="Full address"
              value={form.location.fullAddress || form.location.formattedAddress}
              onChangeText={(text) => setLocation({ fullAddress: text, formattedAddress: text })}
            />
            <ServiceLocationPicker
              value={form.location}
              onChange={(next) => setLocation({
                ...next,
                latitudeRaw: next.latitudeRaw ?? (next.latitude != null ? String(next.latitude) : form.location.latitudeRaw),
                longitudeRaw: next.longitudeRaw ?? (next.longitude != null ? String(next.longitude) : form.location.longitudeRaw),
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

          <Panel title="Listing attributes">
            <SchemaFields fields={listingSchema} values={form.listingAttributes} onChange={setListingAttr} />
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

          <Panel title="Rebook rules">
            <View style={styles.row}>
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
            </View>
            <Text style={styles.hint}>Cancel penalty % and platform commission are set by admin on approval.</Text>
          </Panel>

          {!supportsOptions ? (
            <Panel title="Pricing">
              <NumberField label="Base price (RWF)" value={String(form.basePrice)} onChangeText={(text) => setField('basePrice', text)} />
            </Panel>
          ) : (
            <Panel title="Options">
              {options.map((option, index) => (
                <View key={option.localId} style={styles.optionCard}>
                  <View style={styles.optionHeader}>
                    <Text style={styles.optionTitle}>Option {index + 1}</Text>
                    <TouchableOpacity onPress={() => removeOption(option)} activeOpacity={0.84}>
                      <Text style={styles.removeText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                  <TextField label="Name" value={option.name} onChangeText={(text) => updateOption(option.localId, 'name', text)} />
                  <View style={styles.row}>
                    <NumberField label="Price (RWF)" value={String(option.price)} onChangeText={(text) => updateOption(option.localId, 'price', text)} />
                    <SelectField label="Price type" value={option.priceType} options={PRICE_TYPES} onChange={(value) => updateOption(option.localId, 'priceType', value)} searchable={false} />
                  </View>
                  <View style={styles.row}>
                    <SelectField label="Calculation" value={option.calculationField} options={CALC_FIELDS} onChange={(value) => updateOption(option.localId, 'calculationField', value)} searchable={false} />
                    <SelectField label="Duration unit" value={option.durationUnit} options={DURATION_UNITS} onChange={(value) => updateOption(option.localId, 'durationUnit', value)} searchable={false} />
                  </View>
                  <NumberField label="Capacity" value={String(option.capacity)} onChangeText={(text) => updateOption(option.localId, 'capacity', text)} />
                  {optionSchema.length ? (
                    <SchemaFields
                      fields={optionSchema}
                      values={option.attributes || {}}
                      onChange={(id, value) => updateOption(option.localId, 'attributes', { ...(option.attributes || {}), [id]: value })}
                    />
                  ) : null}
                </View>
              ))}
              <TouchableOpacity style={styles.outline} onPress={() => setOptions((current) => [...current, emptyOption()])} activeOpacity={0.84}>
                <Text style={styles.outlineText}>Add option</Text>
              </TouchableOpacity>
              {!service ? <Text style={styles.hint}>Options are saved after the service is created.</Text> : null}
            </Panel>
          )}

          <TouchableOpacity style={[styles.save, saving && { opacity: 0.7 }]} onPress={save} disabled={saving} activeOpacity={0.86}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{t('common.save')}</Text>}
          </TouchableOpacity>
        </ScrollView>
      </View>
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
