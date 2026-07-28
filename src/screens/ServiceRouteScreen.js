import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Keyboard, PanResponder, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import * as Location from 'expo-location';
import ServiceRouteMap from '../components/ServiceRouteMap';
import { apiFetch } from '../config/api';
import { lightColors } from '../theme/colors';
import useThemedStyles from '../theme/useThemedStyles';

let colors = lightColors;
let styles;

const parseJson = (response) => response.json().catch(() => ({}));
const pointFrom = (value) => ({ latitude: Number(value?.latitude), longitude: Number(value?.longitude) });
const validPoint = (value) => Number.isFinite(value?.latitude) && Number.isFinite(value?.longitude);

function distanceMetres(left, right) {
  if (!validPoint(left) || !validPoint(right)) return Infinity;
  const rad = (value) => value * Math.PI / 180;
  const lat = rad(right.latitude - left.latitude);
  const lng = rad(right.longitude - left.longitude);
  const a = Math.sin(lat / 2) ** 2 + Math.cos(rad(left.latitude)) * Math.cos(rad(right.latitude)) * Math.sin(lng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function maneuverIcon(maneuver = {}) {
  if (maneuver.type === 'arrive') return 'map-pin';
  if (maneuver.type === 'depart') return 'play';
  if (['roundabout', 'rotary'].includes(maneuver.type)) return 'rotate-cw';
  if (String(maneuver.modifier).includes('left')) return 'corner-up-left';
  if (String(maneuver.modifier).includes('right')) return 'corner-up-right';
  return 'arrow-up';
}

export default function ServiceRouteScreen({ booking, onBack }) {
  const themed = useThemedStyles(createStyles);
  colors = themed.colors;
  styles = themed.styles;
  const bookingId = booking?._id || booking?.id;
  const { height } = useWindowDimensions();
  const sheetHeight = Math.min(510, Math.max(380, height * 0.58));
  const collapsed = sheetHeight - 205;
  const mapRef = useRef(null);
  const watchRef = useRef(null);
  const lastRouteRef = useRef({ point: null, time: 0 });
  const sheetY = useRef(new Animated.Value(collapsed)).current;
  const gestureStart = useRef(collapsed);

  const [access, setAccess] = useState({ loading: true, error: '' });
  const [serviceName, setServiceName] = useState('Booked service');
  const [destination, setDestination] = useState(null);
  const [savedOrigin, setSavedOrigin] = useState(null);
  const [origin, setOrigin] = useState(null);
  const [originAddress, setOriginAddress] = useState('');
  const [locationState, setLocationState] = useState({ permission: 'checking', message: '' });
  const [route, setRoute] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState('');
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [searchError, setSearchError] = useState('');
  const [navigating, setNavigating] = useState(false);

  const snapSheet = useCallback((expanded) => Animated.spring(sheetY, {
    toValue: expanded ? 0 : collapsed,
    damping: 22,
    stiffness: 220,
    useNativeDriver: true,
  }).start(), [collapsed, sheetY]);

  useEffect(() => sheetY.setValue(collapsed), [collapsed, sheetY]);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dy) > 7,
    onPanResponderGrant: () => sheetY.stopAnimation((value) => { gestureStart.current = value; }),
    onPanResponderMove: (_event, gesture) => sheetY.setValue(Math.max(0, Math.min(collapsed, gestureStart.current + gesture.dy))),
    onPanResponderRelease: (_event, gesture) => snapSheet(gestureStart.current + gesture.dy + gesture.vy * 55 < collapsed / 2),
  }), [collapsed, sheetY, snapSheet]);

  const requestRoute = useCallback(async (nextOrigin, address = originAddress, silent = false) => {
    if (!bookingId || !destination || !validPoint(nextOrigin)) return;
    if (!silent) setRouteLoading(true);
    setRouteError('');
    try {
      const response = await apiFetch(`/bookings/${encodeURIComponent(bookingId)}/route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin: { ...nextOrigin, address: address || 'Selected starting point' } }),
        timeoutMs: 12000,
      });
      const data = await parseJson(response);
      if (!response.ok) throw new Error(data.message || 'The route could not be calculated.');
      setRoute(data.route || null);
      lastRouteRef.current = { point: nextOrigin, time: Date.now() };
      setTimeout(() => mapRef.current?.fitRoute(), 80);
    } catch (error) {
      setRouteError(error.message || 'The route provider is unavailable.');
    } finally {
      setRouteLoading(false);
    }
  }, [bookingId, destination, originAddress]);

  const chooseOrigin = useCallback((value, address = 'Selected point on the map') => {
    const nextOrigin = pointFrom(value);
    if (!validPoint(nextOrigin)) return;
    setOrigin(nextOrigin);
    setOriginAddress(address);
    setLocationState((current) => ({ ...current, message: '' }));
    setResults([]);
    Keyboard.dismiss();
    requestRoute(nextOrigin, address);
  }, [requestRoute]);

  const searchLocations = useCallback(async (queryOverride, selectFirst = false) => {
    const query = String(queryOverride ?? search).trim();
    if (query.length < 3) return setSearchError('Enter at least 3 characters.');
    setSearching(true);
    setSearchError('');
    try {
      const response = await apiFetch(`/bookings/${encodeURIComponent(bookingId)}/location-search?q=${encodeURIComponent(query)}`, { timeoutMs: 9000 });
      const data = await parseJson(response);
      if (!response.ok) throw new Error(data.message || 'Location search failed.');
      const nextResults = data.results || [];
      setResults(selectFirst ? [] : nextResults);
      if (selectFirst && nextResults[0]) chooseOrigin(nextResults[0], nextResults[0].address);
    } catch (error) {
      setSearchError(error.message || 'Location search failed.');
    } finally {
      setSearching(false);
    }
  }, [bookingId, chooseOrigin, search]);

  const useCurrentLocation = useCallback(async () => {
    setLocationState((current) => ({ ...current, message: 'Finding your current location...' }));
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setLocationState({ permission: permission.status, message: 'Permission denied. Search or tap the map to choose a starting point.' });
        if (savedOrigin?.address && !origin) searchLocations(savedOrigin.address, true);
        return null;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const current = pointFrom(position.coords);
      setLocationState({ permission: 'granted', message: '' });
      chooseOrigin(current, 'My current location');
      setTimeout(() => mapRef.current?.centerOnOrigin(), 80);
      return current;
    } catch (_error) {
      setLocationState({ permission: 'unavailable', message: 'GPS is unavailable. Search or tap the map to choose a starting point.' });
      if (savedOrigin?.address && !origin) searchLocations(savedOrigin.address, true);
      return null;
    }
  }, [chooseOrigin, origin, savedOrigin, searchLocations]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await apiFetch(`/bookings/${encodeURIComponent(bookingId)}/service-location`, { timeoutMs: 9000 });
        const data = await parseJson(response);
        if (!response.ok) throw new Error(data.message || 'The protected location is unavailable.');
        if (!active) return;
        setServiceName(data.serviceName || 'Booked service');
        setDestination({ ...pointFrom(data.destination), address: data.destination?.address || '' });
        setSavedOrigin(data.savedOrigin || null);
        if (data.savedOrigin?.address) setSearch(data.savedOrigin.address);
        setAccess({ loading: false, error: '' });
      } catch (error) {
        if (active) setAccess({ loading: false, error: error.message || 'The protected location is unavailable.' });
      }
    })();
    return () => { active = false; };
  }, [bookingId]);

  useEffect(() => {
    if (destination && !origin && locationState.permission === 'checking') useCurrentLocation();
  }, [destination, locationState.permission, origin, useCurrentLocation]);

  useEffect(() => () => watchRef.current?.remove?.(), []);

  const toggleNavigation = async () => {
    if (navigating) {
      watchRef.current?.remove?.();
      watchRef.current = null;
      return setNavigating(false);
    }
    const start = origin || await useCurrentLocation();
    if (!start) return;
    setNavigating(true);
    snapSheet(false);
    try {
      watchRef.current = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, distanceInterval: 20, timeInterval: 5000 }, (position) => {
        const current = pointFrom(position.coords);
        setOrigin(current);
        setOriginAddress('My current location');
        if (distanceMetres(lastRouteRef.current.point, current) >= 75 && Date.now() - lastRouteRef.current.time >= 15000) {
          requestRoute(current, 'My current location', true);
        }
      });
    } catch (_error) {
      setNavigating(false);
      setLocationState((current) => ({ ...current, message: 'Live GPS is unavailable. You can still refresh this route.' }));
    }
  };

  const stateMessage = access.loading ? 'Checking secure location access...' : access.error || routeError || locationState.message;
  const stateIsError = Boolean(access.error || routeError);

  return (
    <View style={styles.screen}>
      <ServiceRouteMap ref={mapRef} origin={origin} destination={destination} routeCoordinates={route?.coordinates || []} onSelectOrigin={chooseOrigin} />
      <TouchableOpacity style={[styles.mapButton, styles.back]} onPress={onBack}><Feather name="arrow-left" size={21} color={colors.text} /></TouchableOpacity>
      <View style={styles.searchPanel}>
        <View style={styles.searchRow}>
          <Feather name="search" size={17} color={colors.muted} />
          <TextInput value={search} onChangeText={(value) => { setSearch(value); setResults([]); setSearchError(''); }} onSubmitEditing={() => searchLocations()} placeholder="Search starting location" placeholderTextColor={colors.muted} style={styles.searchInput} returnKeyType="search" />
          <TouchableOpacity style={styles.searchButton} onPress={() => searchLocations()} disabled={searching}>{searching ? <ActivityIndicator size="small" color={colors.white} /> : <Feather name="arrow-right" size={17} color={colors.white} />}</TouchableOpacity>
        </View>
        {!!searchError && <Text style={styles.searchError}>{searchError}</Text>}
        {!!results.length && <View style={styles.results}>{results.slice(0, 5).map((result) => <TouchableOpacity key={result.id} style={styles.result} onPress={() => chooseOrigin(result, result.address)}><Feather name="map-pin" size={15} color={colors.primary} /><Text style={styles.resultText} numberOfLines={2}>{result.address}</Text></TouchableOpacity>)}</View>}
      </View>
      <View style={styles.controls}>
        <TouchableOpacity style={styles.mapButton} onPress={() => mapRef.current?.fitRoute()}><Feather name="maximize" size={19} color={colors.text} /></TouchableOpacity>
        <TouchableOpacity style={styles.mapButton} onPress={useCurrentLocation}><Feather name="crosshair" size={19} color={colors.primary} /></TouchableOpacity>
      </View>
      {!!stateMessage && <View style={[styles.banner, stateIsError && styles.errorBanner]}>{access.loading || routeLoading ? <ActivityIndicator size="small" color={colors.primary} /> : <Feather name={stateIsError ? 'alert-circle' : 'info'} size={16} color={stateIsError ? '#B91C1C' : colors.primary} />}<Text style={[styles.bannerText, stateIsError && styles.errorText]}>{stateMessage}</Text></View>}

      <Animated.View style={[styles.sheet, { height: sheetHeight, transform: [{ translateY: sheetY }] }]}>
        <View style={styles.handleArea} {...panResponder.panHandlers}>
          <View style={styles.handle} />
          <View style={styles.heading}>
            <View style={styles.destinationIcon}><Feather name="map-pin" size={18} color={colors.white} /></View>
            <View style={styles.headingCopy}><Text style={styles.serviceName} numberOfLines={1}>{serviceName}</Text><Text style={styles.address} numberOfLines={2}>{destination?.address || booking?.destinationLocation || 'Protected destination'}</Text></View>
            <TouchableOpacity style={styles.expand} onPress={() => snapSheet(true)}><Feather name="chevron-up" size={19} color={colors.primary} /></TouchableOpacity>
          </View>
        </View>
        <View style={styles.summary}>
          <Summary value={route ? `${route.distanceKm} km` : '--'} label="Distance" />
          <Summary value={route ? `${route.durationMinutes} min` : '--'} label="Travel time" />
          <Summary value={locationState.permission === 'granted' ? 'GPS' : origin ? 'Selected' : '--'} label="Origin" />
        </View>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.refresh} onPress={() => requestRoute(origin)} disabled={!origin || routeLoading}>{routeLoading ? <ActivityIndicator size="small" color={colors.primary} /> : <Feather name="refresh-cw" size={16} color={colors.primary} />}<Text style={styles.refreshText}>Refresh route</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.start, (!destination || access.error) && styles.disabled]} onPress={toggleNavigation} disabled={!destination || Boolean(access.error)}><Feather name={navigating ? 'square' : 'navigation'} size={16} color={colors.white} /><Text style={styles.startText}>{navigating ? 'Stop' : 'Start navigation'}</Text></TouchableOpacity>
        </View>
        <View style={styles.directionsHeader}><Text style={styles.directionsTitle}>Turn-by-turn directions</Text><Text style={styles.stepsCount}>{route?.steps?.length || 0} steps</Text></View>
        <ScrollView style={styles.steps} contentContainerStyle={styles.stepsContent} nestedScrollEnabled showsVerticalScrollIndicator={false}>
          {!origin ? <EmptySteps text="Use GPS, search, or tap the map to select your starting point." /> : !route?.steps?.length ? <EmptySteps text="Refresh the route to load directions." /> : route.steps.map((step, index) => <View key={step.id || index} style={styles.step}><View style={styles.stepIcon}><Feather name={maneuverIcon(step.maneuver)} size={16} color={colors.primary} /></View><View style={styles.stepCopy}><Text style={styles.stepText}>{step.instruction}</Text><Text style={styles.stepMeta}>{step.distanceKm} km · {step.durationMinutes} min</Text></View></View>)}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

function Summary({ value, label }) { return <View style={styles.summaryItem}><Text style={styles.summaryValue}>{value}</Text><Text style={styles.summaryLabel}>{label}</Text></View>; }
function EmptySteps({ text }) { return <View style={styles.empty}><Feather name="map" size={24} color={colors.muted} /><Text style={styles.emptyText}>{text}</Text></View>; }

const createStyles = (colors) => StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1, overflow: 'hidden' },
  mapButton: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 22, borderWidth: 1, elevation: 5, height: 44, justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 5, width: 44 },
  back: { left: 14, position: 'absolute', top: 14, zIndex: 5 },
  searchPanel: { left: 66, position: 'absolute', right: 14, top: 14, zIndex: 6 },
  searchRow: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: 13, elevation: 5, flexDirection: 'row', gap: 8, minHeight: 46, paddingLeft: 12 },
  searchInput: { color: colors.text, flex: 1, fontSize: 13, fontWeight: '700', minHeight: 44 },
  searchButton: { alignItems: 'center', alignSelf: 'stretch', backgroundColor: colors.primary, borderBottomRightRadius: 13, borderTopRightRadius: 13, justifyContent: 'center', width: 44 },
  searchError: { backgroundColor: colors.dangerSurface, color: colors.danger, fontSize: 11, fontWeight: '800', padding: 7 },
  results: { backgroundColor: colors.surface, borderRadius: 12, elevation: 6, marginTop: 5, overflow: 'hidden' },
  result: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', gap: 8, minHeight: 48, padding: 10 },
  resultText: { color: colors.text, flex: 1, fontSize: 11, fontWeight: '700', lineHeight: 16 },
  controls: { gap: 9, position: 'absolute', right: 14, top: 76, zIndex: 4 },
  banner: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.96)', borderColor: colors.border, borderRadius: 11, borderWidth: 1, bottom: 218, flexDirection: 'row', gap: 8, left: 14, padding: 10, position: 'absolute', right: 14, zIndex: 4 },
  errorBanner: { borderColor: '#FECACA' }, bannerText: { color: colors.primaryDark, flex: 1, fontSize: 11, fontWeight: '800' }, errorText: { color: colors.danger },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, bottom: 0, elevation: 18, left: 0, paddingBottom: 8, position: 'absolute', right: 0, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.2, shadowRadius: 10, zIndex: 10 },
  handleArea: { paddingHorizontal: 16, paddingTop: 9 }, handle: { alignSelf: 'center', backgroundColor: colors.border, borderRadius: 3, height: 5, marginBottom: 11, width: 48 },
  heading: { alignItems: 'center', flexDirection: 'row', gap: 10 }, destinationIcon: { alignItems: 'center', backgroundColor: '#C2410C', borderRadius: 12, height: 42, justifyContent: 'center', width: 42 }, headingCopy: { flex: 1 }, serviceName: { color: colors.text, fontSize: 16, fontWeight: '900' }, address: { color: colors.muted, fontSize: 11, fontWeight: '700', lineHeight: 15, marginTop: 3 }, expand: { alignItems: 'center', backgroundColor: colors.primaryLight, borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
  summary: { backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderRadius: 12, borderWidth: 1, flexDirection: 'row', marginHorizontal: 16, marginTop: 12, paddingVertical: 10 }, summaryItem: { alignItems: 'center', borderRightColor: colors.border, borderRightWidth: 1, flex: 1 }, summaryValue: { color: colors.text, fontSize: 13, fontWeight: '900' }, summaryLabel: { color: colors.muted, fontSize: 9, fontWeight: '800', marginTop: 3, textTransform: 'uppercase' },
  actions: { flexDirection: 'row', gap: 9, marginHorizontal: 16, marginTop: 11 }, refresh: { alignItems: 'center', borderColor: colors.primary, borderRadius: 11, borderWidth: 1, flex: 1, flexDirection: 'row', gap: 7, justifyContent: 'center', minHeight: 44 }, refreshText: { color: colors.primary, fontSize: 12, fontWeight: '900' }, start: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 11, flex: 1.2, flexDirection: 'row', gap: 7, justifyContent: 'center' }, startText: { color: colors.white, fontSize: 12, fontWeight: '900' }, disabled: { opacity: 0.5 },
  directionsHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 16, marginTop: 15 }, directionsTitle: { color: colors.text, fontSize: 14, fontWeight: '900' }, stepsCount: { color: colors.muted, fontSize: 10, fontWeight: '800' }, steps: { flex: 1, marginTop: 4 }, stepsContent: { paddingBottom: 22, paddingHorizontal: 16 }, empty: { alignItems: 'center', padding: 25 }, emptyText: { color: colors.muted, fontSize: 12, fontWeight: '700', lineHeight: 18, marginTop: 8, textAlign: 'center' }, step: { borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', gap: 11, paddingVertical: 12 }, stepIcon: { alignItems: 'center', backgroundColor: colors.primaryLight, borderRadius: 18, height: 36, justifyContent: 'center', width: 36 }, stepCopy: { flex: 1 }, stepText: { color: colors.text, fontSize: 12, fontWeight: '800', lineHeight: 17 }, stepMeta: { color: colors.muted, fontSize: 10, fontWeight: '700', marginTop: 3 },
});
