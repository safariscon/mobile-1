import { forwardRef, useImperativeHandle, useRef } from 'react';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import useThemedStyles from '../theme/useThemedStyles';

const RWANDA_REGION = {
  latitude: -1.9441,
  longitude: 30.0619,
  latitudeDelta: 1.8,
  longitudeDelta: 1.8,
};

const ServiceRouteMap = forwardRef(function ServiceRouteMap({ origin, destination, routeCoordinates = [], onSelectOrigin }, ref) {
  const { colors, styles } = useThemedStyles(createStyles);
  const mapRef = useRef(null);

  useImperativeHandle(ref, () => ({
    fitRoute() {
      const points = routeCoordinates.length ? routeCoordinates : [origin, destination].filter(Boolean);
      if (points.length > 1) {
        mapRef.current?.fitToCoordinates(points, {
          animated: true,
          edgePadding: { top: 90, right: 45, bottom: 250, left: 45 },
        });
      } else if (points[0]) {
        mapRef.current?.animateCamera({ center: points[0], zoom: 15 }, { duration: 450 });
      }
    },
    centerOnOrigin() {
      if (origin) mapRef.current?.animateCamera({ center: origin, zoom: 16 }, { duration: 450 });
    },
  }), [destination, origin, routeCoordinates]);

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      initialRegion={destination ? { ...destination, latitudeDelta: 0.08, longitudeDelta: 0.08 } : RWANDA_REGION}
      onPress={(event) => onSelectOrigin?.(event.nativeEvent.coordinate)}
      showsCompass={false}
      showsMyLocationButton={false}
      toolbarEnabled={false}
      loadingEnabled
    >
      {routeCoordinates.length > 1 ? (
        <Polyline coordinates={routeCoordinates} strokeColor={colors.primary} strokeWidth={6} lineCap="round" lineJoin="round" />
      ) : null}
      {origin ? (
        <Marker coordinate={origin} title="Starting point" draggable onDragEnd={(event) => onSelectOrigin?.(event.nativeEvent.coordinate)}>
          <View style={[styles.marker, styles.originMarker]}>
            <Feather name="user" size={15} color={colors.white} />
          </View>
        </Marker>
      ) : null}
      {destination ? (
        <Marker coordinate={destination} title="Service destination">
          <View style={[styles.marker, styles.destinationMarker]}>
            <Feather name="map-pin" size={16} color={colors.white} />
          </View>
        </Marker>
      ) : null}
    </MapView>
  );
});

const createStyles = (colors) => StyleSheet.create({
  marker: {
    alignItems: 'center',
    borderColor: colors.white,
    borderRadius: 22,
    borderWidth: 3,
    height: 42,
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.24,
    shadowRadius: 5,
    width: 42,
  },
  originMarker: { backgroundColor: '#0F766E' },
  destinationMarker: { backgroundColor: '#C2410C' },
});

export default ServiceRouteMap;
