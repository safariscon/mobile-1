import MapView, { Marker } from 'react-native-maps';

export default function BookingMap({ coordinates, title, description, style }) {
  if (!coordinates) return null;

  return (
    <MapView
      style={style}
      initialRegion={{
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
      }}
    >
      <Marker coordinate={coordinates} title={title} description={description} />
    </MapView>
  );
}
