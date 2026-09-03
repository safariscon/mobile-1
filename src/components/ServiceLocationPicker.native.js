import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import Feather from '@expo/vector-icons/Feather';
import { lightColors } from '../theme/colors';
import { baseInputStyle } from '../theme/inputStyles';
import useThemedStyles from '../theme/useThemedStyles';
import { reverseGeocode, searchPlaces } from '../lib/geo';

let colors = lightColors;
let styles;

const DEFAULT_CENTER = { latitude: -1.9441, longitude: 30.0619 };

function composeAddress(parts = {}) {
  return [
    parts.placeName,
    parts.referenceName,
    parts.area,
    parts.city,
    parts.state,
    parts.country,
  ].map((part) => String(part || '').trim()).filter(Boolean).join(', ');
}

function toCoordinate(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/**
 * Unified location picker (matches frontend-1 ServiceLocationPicker):
 * type → search results → select → autofill country/city/region/address/lat/lng + map pin.
 */
export default function ServiceLocationPicker({
  value,
  onChange,
  mode = 'service',
  title = 'Exact map location',
  help = 'Search a place, tap the map, or use GPS. Selecting a result fills country, city, region, address, and coordinates.',
}) {
  const themed = useThemedStyles(createStyles);
  colors = themed.colors;
  styles = themed.styles;
  const mapRef = useRef(null);

  const location = useMemo(() => ({
    country: value?.country || '',
    countryCode: value?.countryCode || '',
    state: value?.state || value?.province || '',
    city: value?.city || value?.district || '',
    area: value?.area || value?.sector || '',
    placeName: value?.placeName || '',
    referenceName: value?.referenceName || value?.landmark || '',
    fullAddress: value?.fullAddress || value?.formattedAddress || '',
    formattedAddress: value?.formattedAddress || value?.fullAddress || '',
    latitude: toCoordinate(value?.latitude ?? value?.latitudeRaw),
    longitude: toCoordinate(value?.longitude ?? value?.longitudeRaw),
    latitudeRaw: value?.latitudeRaw || '',
    longitudeRaw: value?.longitudeRaw || '',
    placeId: value?.placeId || value?.googlePlaceId || '',
    locationSource: value?.locationSource || 'map_click',
    isExactLocationVerified: Boolean(value?.isExactLocationVerified),
  }), [value]);

  const hasPoint = location.latitude !== null && location.longitude !== null;
  const isCustomer = mode === 'customer';
  const [query, setQuery] = useState(location.formattedAddress || location.placeName || '');
  const syncedAddressRef = useRef(location.formattedAddress || location.placeName || '');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState('');
  const reverseTokenRef = useRef(0);

  const initialRegion = useMemo(() => ({
    latitude: hasPoint ? location.latitude : DEFAULT_CENTER.latitude,
    longitude: hasPoint ? location.longitude : DEFAULT_CENTER.longitude,
    latitudeDelta: hasPoint ? 0.012 : 0.35,
    longitudeDelta: hasPoint ? 0.012 : 0.35,
  }), []);

  const animateTo = (latitude, longitude) => {
    if (!mapRef.current || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    mapRef.current.animateToRegion({
      latitude,
      longitude,
      latitudeDelta: 0.012,
      longitudeDelta: 0.012,
    }, 350);
  };

  const update = (patch) => {
    onChange?.({
      ...location,
      ...value,
      ...patch,
      formattedAddress: patch.formattedAddress ?? patch.fullAddress ?? location.formattedAddress,
      fullAddress: patch.fullAddress ?? patch.formattedAddress ?? location.fullAddress,
      province: patch.state ?? patch.province ?? location.state,
      district: patch.city ?? patch.district ?? location.city,
      sector: patch.area ?? patch.sector ?? location.area,
    });
  };

  const applyPlace = (place, source, extras = {}) => {
    const latitude = Number(place.latitude ?? extras.latitude);
    const longitude = Number(place.longitude ?? extras.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    const next = {
      latitude: String(latitude),
      longitude: String(longitude),
      latitudeRaw: place.latitudeRaw || extras.latitudeRaw || String(latitude),
      longitudeRaw: place.longitudeRaw || extras.longitudeRaw || String(longitude),
      locationSource: source,
      isExactLocationVerified: source === 'search' || source === 'gps' || source === 'confirm',
      placeName: extras.placeName || place.placeName || location.placeName,
      referenceName: extras.referenceName || location.referenceName,
      formattedAddress: extras.formattedAddress || place.formattedAddress || place.label || location.formattedAddress,
      fullAddress: extras.formattedAddress || place.formattedAddress || place.label || location.fullAddress,
      placeId: extras.placeId || place.placeId || location.placeId,
      country: place.country || extras.country || location.country,
      countryCode: place.countryCode || extras.countryCode || location.countryCode,
      state: place.state || place.province || extras.state || location.state,
      city: place.city || place.district || extras.city || location.city,
      area: place.area || place.sector || extras.area || location.area,
    };
    if (!next.formattedAddress) next.formattedAddress = composeAddress(next);
    if (!next.fullAddress) next.fullAddress = next.formattedAddress;

    update(next);
    animateTo(latitude, longitude);
    const nextQuery = next.formattedAddress || place.label || query;
    syncedAddressRef.current = nextQuery;
    setQuery(nextQuery);
    setSearchResults([]);
    setMessage('');
    Keyboard.dismiss();
  };

  const applyCoordinates = async (latitude, longitude, source, extras = {}) => {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    const token = ++reverseTokenRef.current;
    setMessage('');
    setSearchResults([]);
    animateTo(latitude, longitude);

    update({
      latitude: String(latitude),
      longitude: String(longitude),
      latitudeRaw: extras.latitudeRaw || String(latitude),
      longitudeRaw: extras.longitudeRaw || String(longitude),
      locationSource: source,
      isExactLocationVerified: source === 'gps',
      ...extras,
    });

    try {
      const place = await reverseGeocode(latitude, longitude);
      if (token !== reverseTokenRef.current) return;
      if (place && (place.country || place.city || place.formattedAddress || place.placeName || place.label)) {
        applyPlace(place, source === 'gps' ? 'gps' : source, {
          ...extras,
          latitude,
          longitude,
          latitudeRaw: place.latitudeRaw || String(latitude),
          longitudeRaw: place.longitudeRaw || String(longitude),
        });
        return;
      }
      setMessage('No place name found for this pin. Fill place details below or search again.');
    } catch (_error) {
      if (token !== reverseTokenRef.current) return;
      setMessage('Could not look up this pin. Search a place or type the address details.');
    }
  };

  useEffect(() => {
    const next = location.formattedAddress || location.placeName || '';
    if (next && next !== syncedAddressRef.current && !searchResults.length) {
      syncedAddressRef.current = next;
      setQuery(next);
    }
  }, [location.formattedAddress, location.placeName]);

  useEffect(() => {
    const text = query.trim();
    if (text && text === String(syncedAddressRef.current || '').trim()) {
      setSearchResults([]);
      setSearching(false);
      return undefined;
    }
    if (text.length < 3) {
      setSearchResults([]);
      setSearching(false);
      return undefined;
    }

    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const countryBias = location.countryCode || 'rw';
        const results = await searchPlaces(text, countryBias);
        if (!cancelled) {
          setSearchResults(results);
          if (!results.length) setMessage('No places found. Try another name or tap the map.');
          else setMessage('');
        }
      } catch (_error) {
        if (!cancelled) {
          setSearchResults([]);
          setMessage('Address search failed. You can still tap the map.');
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, location.countryCode]);

  const useCurrentLocation = async () => {
    setMessage('Requesting GPS permission...');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setMessage('GPS permission was denied.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await applyCoordinates(Number(position.coords.latitude), Number(position.coords.longitude), 'gps');
      setMessage('Current location applied.');
    } catch (_error) {
      setMessage('Could not read GPS. Search a place instead.');
    }
  };

  const confirmPin = () => {
    if (!hasPoint) {
      setMessage('Drop a pin or select a search result before confirming.');
      return;
    }
    update({
      isExactLocationVerified: true,
      locationSource: location.locationSource || 'map_click',
    });
    setMessage('Exact pin confirmed.');
  };

  const updateManualField = (key, nextValue) => {
    const patch = { [key]: nextValue };
    const next = { ...location, ...patch };
    const composed = composeAddress(next);
    if (!location.formattedAddress || location.locationSource === 'manual' || !location.placeId) {
      patch.formattedAddress = composed || location.formattedAddress;
      patch.fullAddress = composed || location.fullAddress;
      patch.locationSource = location.placeId ? location.locationSource : 'manual';
    }
    update(patch);
    if (key === 'formattedAddress' || key === 'fullAddress') {
      syncedAddressRef.current = nextValue;
      setQuery(nextValue);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.help}>{help}</Text>

      <View style={styles.searchBox}>
        <Feather name="search" size={16} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search hotel, street, landmark…"
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {searching ? <ActivityIndicator size="small" color={colors.primary} /> : null}
        {query ? (
          <TouchableOpacity
            onPress={() => {
              setQuery('');
              setSearchResults([]);
              syncedAddressRef.current = '';
            }}
            hitSlop={8}
          >
            <Feather name="x" size={16} color={colors.muted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {searchResults.length ? (
        <View style={styles.resultsCard}>
          <ScrollView keyboardShouldPersistTaps="handled" style={styles.resultsScroll} nestedScrollEnabled>
            {searchResults.map((result, index) => (
              <TouchableOpacity
                key={`${result.placeId || result.label}-${index}`}
                style={styles.result}
                onPress={() => applyPlace(result, 'search')}
                activeOpacity={0.84}
              >
                <Feather name="map-pin" size={14} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultTitle} numberOfLines={1}>{result.placeName || result.label}</Text>
                  <Text style={styles.resultText} numberOfLines={2}>{result.label}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.mapShell}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={initialRegion}
          onPress={(event) => {
            const { latitude, longitude } = event.nativeEvent.coordinate;
            applyCoordinates(latitude, longitude, 'map_click');
          }}
        >
          {hasPoint ? (
            <Marker
              coordinate={{ latitude: location.latitude, longitude: location.longitude }}
              draggable
              onDragEnd={(event) => {
                const { latitude, longitude } = event.nativeEvent.coordinate;
                applyCoordinates(latitude, longitude, 'map_drag');
              }}
            />
          ) : null}
        </MapView>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.primaryButton} onPress={useCurrentLocation} activeOpacity={0.84}>
          <Feather name="crosshair" size={15} color={colors.white} />
          <Text style={styles.primaryText}>Use my location</Text>
        </TouchableOpacity>
        {!isCustomer ? (
          <TouchableOpacity style={styles.secondaryButton} onPress={confirmPin} activeOpacity={0.84}>
            <Feather name="check" size={15} color={colors.primary} />
            <Text style={styles.secondaryText}>Confirm pin</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {hasPoint ? (
        <Text style={styles.success}>
          Exact location set by {String(location.locationSource || 'map_click').replace(/_/g, ' ')}
          {location.isExactLocationVerified ? ' · confirmed' : ''}
          {location.latitude != null ? ` · ${Number(location.latitude).toFixed(5)}, ${Number(location.longitude).toFixed(5)}` : ''}
        </Text>
      ) : (
        <Text style={styles.warning}>{isCustomer ? 'Drop a pin or search so the provider can find you.' : 'Exact map point required before publishing.'}</Text>
      )}
      {!!message && <Text style={styles.warning}>{message}</Text>}

      {!isCustomer ? (
        <View style={styles.details}>
          <Text style={styles.detailsTitle}>Place details</Text>
          <Text style={styles.detailsHelp}>Filled automatically when you select a search result. You can edit if needed.</Text>
          <Field label="Place name" value={location.placeName} onChangeText={(text) => updateManualField('placeName', text)} placeholder="Hotel / venue name" />
          <Field label="Reference / landmark" value={location.referenceName} onChangeText={(text) => updateManualField('referenceName', text)} placeholder="Near… / opposite…" />
          <Field label="Full address" value={location.formattedAddress} onChangeText={(text) => updateManualField('formattedAddress', text)} placeholder="Street, area, city" />
          <Field label="Country" value={location.country} onChangeText={(text) => updateManualField('country', text)} placeholder="Rwanda" />
          <Field label="Region / province" value={location.state} onChangeText={(text) => updateManualField('state', text)} placeholder="Kigali" />
          <Field label="City / district" value={location.city} onChangeText={(text) => updateManualField('city', text)} placeholder="Gasabo" />
          <Field label="Area / sector" value={location.area} onChangeText={(text) => updateManualField('area', text)} placeholder="Remera" />
        </View>
      ) : null}
    </View>
  );
}

function Field({ label, value, onChangeText, placeholder }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value || ''}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={styles.fieldInput}
      />
    </View>
  );
}

const createStyles = (themeColors) => StyleSheet.create({
  wrap: {
    backgroundColor: themeColors.infoSurface,
    borderColor: themeColors.border,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
    padding: 12,
  },
  title: { color: themeColors.text, fontSize: 14, fontWeight: '900' },
  help: { color: themeColors.primaryDark, fontSize: 12, fontWeight: '700', lineHeight: 17, marginTop: 4 },
  searchBox: {
    alignItems: 'center',
    backgroundColor: themeColors.surface,
    borderColor: themeColors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    ...baseInputStyle(themeColors),
    backgroundColor: 'transparent',
    borderWidth: 0,
    color: themeColors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    padding: 0,
  },
  resultsCard: {
    backgroundColor: themeColors.surface,
    borderColor: themeColors.border,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
    maxHeight: 200,
    overflow: 'hidden',
  },
  resultsScroll: { maxHeight: 200 },
  result: {
    alignItems: 'flex-start',
    borderBottomColor: themeColors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  resultTitle: { color: themeColors.text, fontSize: 13, fontWeight: '900' },
  resultText: { color: themeColors.muted, fontSize: 12, fontWeight: '600', lineHeight: 16, marginTop: 2 },
  mapShell: {
    borderColor: themeColors.border,
    borderRadius: 12,
    borderWidth: 1,
    height: 230,
    marginTop: 12,
    overflow: 'hidden',
  },
  map: { flex: 1 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: themeColors.primary,
    borderRadius: 10,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  primaryText: { color: themeColors.white, fontSize: 12, fontWeight: '900' },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: themeColors.surface,
    borderColor: themeColors.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  secondaryText: { color: themeColors.primary, fontSize: 12, fontWeight: '900' },
  success: { color: themeColors.success, fontSize: 12, fontWeight: '800', lineHeight: 17, marginTop: 10 },
  warning: { color: themeColors.warning, fontSize: 12, fontWeight: '800', lineHeight: 17, marginTop: 8 },
  details: {
    backgroundColor: themeColors.surface,
    borderColor: themeColors.border,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
    padding: 12,
  },
  detailsTitle: { color: themeColors.text, fontSize: 13, fontWeight: '900' },
  detailsHelp: { color: themeColors.muted, fontSize: 11, fontWeight: '700', lineHeight: 16, marginBottom: 8, marginTop: 4 },
  field: { marginBottom: 10 },
  fieldLabel: { color: themeColors.text, fontSize: 11, fontWeight: '800', marginBottom: 5, textTransform: 'uppercase' },
  fieldInput: {
    ...baseInputStyle(themeColors),
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 14,
    fontWeight: '700',
    height: 44,
    paddingHorizontal: 12,
  },
});
