import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import Feather from '@expo/vector-icons/Feather';
import { lightColors } from '../theme/colors';
import useThemedStyles from '../theme/useThemedStyles';
import { reverseGeocode, searchPlaces } from '../lib/geo';

let colors = lightColors;
let styles;

const DEFAULT_CENTER = { latitude: 0, longitude: 20 };

export default function ServiceLocationPicker({ value, onChange }) {
  const themed = useThemedStyles(createStyles);
  colors = themed.colors;
  styles = themed.styles;
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState('');
  const [results, setResults] = useState([]);
  const latitude = Number(value?.latitude);
  const longitude = Number(value?.longitude);
  const hasPoint = Number.isFinite(latitude) && Number.isFinite(longitude);
  const coordinate = hasPoint ? { latitude, longitude } : DEFAULT_CENTER;

  const region = useMemo(() => ({
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    latitudeDelta: hasPoint ? 0.012 : 40,
    longitudeDelta: hasPoint ? 0.012 : 40,
  }), [coordinate.latitude, coordinate.longitude, hasPoint]);

  const updatePoint = (nextLatitude, nextLongitude, source, fullAddress = '') => {
    if (!Number.isFinite(nextLatitude) || !Number.isFinite(nextLongitude)) {
      setMessage('Choose a valid map point.');
      return;
    }
    setMessage('');
    setResults([]);
    const nextValue = {
      ...value,
      latitude: String(nextLatitude),
      longitude: String(nextLongitude),
      fullAddress: fullAddress || value?.fullAddress || '',
      locationSource: source,
      isExactLocationVerified: source === 'confirm' || value?.isExactLocationVerified === true,
    };
    onChange?.(nextValue);
    if (!fullAddress) {
      reverseGeocode(nextLatitude, nextLongitude)
        .then((result) => {
          if (result?.label) {
            onChange?.({
              ...nextValue,
              fullAddress: result.label,
              country: result.country || nextValue.country,
              state: result.state || nextValue.state,
              city: result.city || nextValue.city,
              province: result.state || nextValue.province,
              district: result.city || nextValue.district,
            });
          }
        })
        .catch(() => setMessage('Point selected. Confirm the pin or type the full address.'));
    }
  };

  const useCurrentLocation = async () => {
    setMessage('Requesting GPS permission...');
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      setMessage('GPS permission was denied.');
      return;
    }
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    updatePoint(Number(position.coords.latitude), Number(position.coords.longitude), 'gps');
  };

  const searchAddress = async () => {
    const address = String(value?.fullAddress || '').trim();
    if (address.length < 3) {
      setMessage('Type at least 3 characters in the full address field.');
      return;
    }
    setSearching(true);
    setMessage('');
    try {
      const items = await searchPlaces(address, value?.countryCode || value?.country || '');
      setResults(items);
      if (!items.length) setMessage('No places found. You can still tap the map.');
    } catch {
      setMessage('Address search failed. You can still tap the map.');
    } finally {
      setSearching(false);
    }
  };

  const confirmPin = () => {
    if (!hasPoint) {
      setMessage('Drop a pin before confirming.');
      return;
    }
    onChange?.({ ...value, isExactLocationVerified: true, locationSource: value?.locationSource || 'map_click' });
    setMessage('Exact pin confirmed.');
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Exact map location</Text>
      <Text style={styles.help}>Tap the map, search worldwide, or use GPS. Exact lat/lng is required before publishing.</Text>
      <View style={styles.mapShell}>
        <MapView
          style={styles.map}
          region={region}
          onPress={(event) => updatePoint(event.nativeEvent.coordinate.latitude, event.nativeEvent.coordinate.longitude, 'map_click')}
        >
          {hasPoint ? (
            <Marker
              coordinate={{ latitude, longitude }}
              draggable
              onDragEnd={(event) => updatePoint(event.nativeEvent.coordinate.latitude, event.nativeEvent.coordinate.longitude, 'map_click')}
            />
          ) : null}
        </MapView>
      </View>
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.primaryButton} onPress={useCurrentLocation} activeOpacity={0.84}>
          <Feather name="crosshair" size={15} color={colors.white} />
          <Text style={styles.primaryText}>Use my current location</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={searchAddress} disabled={searching} activeOpacity={0.84}>
          {searching ? <ActivityIndicator color={colors.primary} /> : <Feather name="search" size={15} color={colors.primary} />}
          <Text style={styles.secondaryText}>Search address</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={confirmPin} activeOpacity={0.84}>
          <Feather name="check" size={15} color={colors.primary} />
          <Text style={styles.secondaryText}>Confirm pin</Text>
        </TouchableOpacity>
      </View>
      {hasPoint ? <Text style={styles.success}>Exact location selected by {String(value?.locationSource || 'map_click').replace('_', ' ')}{value?.isExactLocationVerified ? ' and confirmed' : ''}</Text> : <Text style={styles.warning}>Exact map point required before publishing.</Text>}
      {!!message && <Text style={styles.warning}>{message}</Text>}
      {results.map((result) => (
        <TouchableOpacity key={`${result.latitude}-${result.longitude}`} style={styles.result} onPress={() => updatePoint(result.latitude, result.longitude, 'search', result.label)} activeOpacity={0.84}>
          <Text style={styles.resultText}>{result.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const createStyles = (themeColors) => StyleSheet.create({
  wrap: { backgroundColor: themeColors.infoSurface, borderColor: themeColors.border, borderRadius: 10, borderWidth: 1, marginTop: 12, padding: 12 },
  title: { color: themeColors.text, fontSize: 14, fontWeight: '900' },
  help: { color: themeColors.primaryDark, fontSize: 12, fontWeight: '700', lineHeight: 17, marginTop: 4 },
  mapShell: { borderColor: themeColors.border, borderRadius: 10, borderWidth: 1, height: 220, marginTop: 12, overflow: 'hidden' },
  map: { flex: 1 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  primaryButton: { alignItems: 'center', backgroundColor: themeColors.primary, borderRadius: 8, flexDirection: 'row', gap: 6, paddingHorizontal: 10, paddingVertical: 10 },
  primaryText: { color: themeColors.white, fontSize: 12, fontWeight: '900' },
  secondaryButton: { alignItems: 'center', backgroundColor: themeColors.surface, borderColor: themeColors.border, borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 6, paddingHorizontal: 10, paddingVertical: 10 },
  secondaryText: { color: themeColors.primary, fontSize: 12, fontWeight: '900' },
  success: { color: themeColors.success, fontSize: 12, fontWeight: '900', marginTop: 9 },
  warning: { color: themeColors.warning, fontSize: 12, fontWeight: '800', marginTop: 9 },
  result: { backgroundColor: themeColors.surface, borderColor: themeColors.border, borderRadius: 8, borderWidth: 1, marginTop: 8, padding: 10 },
  resultText: { color: themeColors.text, fontSize: 12, fontWeight: '700', lineHeight: 17 },
});
