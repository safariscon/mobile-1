import * as Location from 'expo-location';
import { Linking, Platform } from 'react-native';

export function toCoordinatePair(location = {}) {
  const latitude = Number(location.latitude ?? location.lat ?? location.coordinates?.latitude);
  const longitude = Number(location.longitude ?? location.lng ?? location.lon ?? location.coordinates?.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;

  return { latitude, longitude };
}

function encodePlace({ coordinates, address }) {
  if (coordinates) return `${coordinates.latitude},${coordinates.longitude}`;
  return encodeURIComponent(address || 'Rwanda');
}

async function getCustomerCoordinates() {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') return null;

  const lastKnown = await Location.getLastKnownPositionAsync({
    maxAge: 5 * 60 * 1000,
    requiredAccuracy: 250,
  }).catch(() => null);
  if (lastKnown?.coords) return lastKnown.coords;

  const current = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  }).catch(() => null);
  return current?.coords || null;
}

export async function openDirections({ destinationCoordinates, destinationAddress }) {
  const originCoordinates = await getCustomerCoordinates();
  const destination = encodePlace({ coordinates: destinationCoordinates, address: destinationAddress });
  const origin = originCoordinates
    ? encodePlace({ coordinates: originCoordinates })
    : '';

  const url = Platform.select({
    ios: origin
      ? `http://maps.apple.com/?saddr=${origin}&daddr=${destination}`
      : `http://maps.apple.com/?daddr=${destination}`,
    default: origin
      ? `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`
      : `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`,
  });

  await Linking.openURL(url);
}
