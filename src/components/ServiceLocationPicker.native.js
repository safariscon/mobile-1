import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import Feather from '@expo/vector-icons/Feather';
import { lightColors } from '../theme/colors';
import useThemedStyles from '../theme/useThemedStyles';

let colors = lightColors;
let styles;
import { apiFetch } from '../config/api';

const DEFAULT_CENTER = { latitude: -1.9441, longitude: 30.0619 };
const RWANDA_BOUNDS = { minLatitude: -2.9, maxLatitude: -1.0, minLongitude: 28.8, maxLongitude: 31.0 };

const isInsideRwanda = (latitude, longitude) =>
  Number.isFinite(latitude) &&
  Number.isFinite(longitude) &&
  latitude >= RWANDA_BOUNDS.minLatitude &&
  latitude <= RWANDA_BOUNDS.maxLatitude &&
  longitude >= RWANDA_BOUNDS.minLongitude &&
  longitude <= RWANDA_BOUNDS.maxLongitude;

export default function ServiceLocationPicker({ value, onChange }) {
  const themed = useThemedStyles(createStyles);
  colors = themed.colors;
  styles = themed.styles;
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState('');
  const [results, setResults] = useState([]);
  const latitude = Number(value?.latitude);
  const longitude = Number(value?.longitude);
  const hasPoint = isInsideRwanda(latitude, longitude);
  const coordinate = hasPoint ? { latitude, longitude } : DEFAULT_CENTER;

  const region = useMemo(() => ({
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    latitudeDelta: hasPoint ? 0.012 : 1.8,
    longitudeDelta: hasPoint ? 0.012 : 1.8,
  }), [coordinate.latitude, coordinate.longitude, hasPoint]);

  const updatePoint = (nextLatitude, nextLongitude, source, fullAddress = '') => {
    if (!isInsideRwanda(nextLatitude, nextLongitude)) {
      setMessage('Please choose a location inside Rwanda.');
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
      isExactLocationVerified: false,
    };
    onChange?.(nextValue);
    if (!fullAddress) {
      apiFetch(`/hotel/locations/reverse?latitude=${encodeURIComponent(nextLatitude)}&longitude=${encodeURIComponent(nextLongitude)}`, { timeoutMs: 8000 })
        .then((response) => response.json().then((data) => ({ response, data })))
        .then(({ response, data }) => {
          if (response.ok && data.address) onChange?.({ ...nextValue, fullAddress: data.address });
        })
        .catch(() => setMessage('Point selected. Please confirm or type the full address.'));
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
      const response = await apiFetch(`/hotel/locations/search?q=${encodeURIComponent(address)}`, { timeoutMs: 9000 });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Address search failed.');
      setResults((data.results || [])
        .map((item) => ({ label: item.address, latitude: Number(item.latitude), longitude: Number(item.longitude) }))
        .filter((item) => isInsideRwanda(item.latitude, item.longitude)));
    } catch {
      setMessage('Address search failed. You can still tap the map.');
    } finally {
      setSearching(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Exact map location</Text>
      <Text style={styles.help}>Tap the map, search the place name, or use GPS. Coordinates are saved silently.</Text>
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
      </View>
      {hasPoint ? <Text style={styles.success}>Exact location selected by {String(value?.locationSource || 'map_click').replace('_', ' ')}</Text> : <Text style={styles.warning}>Exact map point required before publishing.</Text>}
      {!!message && <Text style={styles.warning}>{message}</Text>}
      {results.map((result) => (
        <TouchableOpacity key={`${result.latitude}-${result.longitude}`} style={styles.result} onPress={() => updatePoint(result.latitude, result.longitude, 'search', result.label)} activeOpacity={0.84}>
          <Text style={styles.resultText}>{result.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  wrap: { backgroundColor: colors.infoSurface, borderColor: colors.border, borderRadius: 10, borderWidth: 1, marginTop: 12, padding: 12 },
  title: { color: colors.text, fontSize: 14, fontWeight: '900' },
  help: { color: colors.primaryDark, fontSize: 12, fontWeight: '700', lineHeight: 17, marginTop: 4 },
  mapShell: { borderColor: colors.border, borderRadius: 10, borderWidth: 1, height: 220, marginTop: 12, overflow: 'hidden' },
  map: { flex: 1 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  primaryButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 8, flexDirection: 'row', gap: 6, paddingHorizontal: 10, paddingVertical: 10 },
  primaryText: { color: colors.white, fontSize: 12, fontWeight: '900' },
  secondaryButton: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 6, paddingHorizontal: 10, paddingVertical: 10 },
  secondaryText: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  success: { color: colors.success, fontSize: 12, fontWeight: '900', marginTop: 9 },
  warning: { color: colors.warning, fontSize: 12, fontWeight: '800', marginTop: 9 },
  result: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, marginTop: 8, padding: 10 },
  resultText: { color: colors.text, fontSize: 12, fontWeight: '700', lineHeight: 17 },
});
