import { forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import useThemedStyles from '../theme/useThemedStyles';

const ServiceRouteMap = forwardRef(function ServiceRouteMap({ origin, destination }, ref) {
  const { colors, styles } = useThemedStyles(createStyles);
  useImperativeHandle(ref, () => ({ fitRoute() {}, centerOnOrigin() {} }), []);
  return (
    <View style={styles.fallback}>
      <Feather name="map" size={34} color={colors.primary} />
      <Text style={styles.title}>Interactive route map</Text>
      <Text style={styles.text}>Open this booking on Android or iOS to use the in-app interactive map.</Text>
      {origin && destination ? <Text style={styles.ready}>The secure route is ready.</Text> : null}
    </View>
  );
});

const createStyles = (colors) => StyleSheet.create({
  fallback: { ...StyleSheet.absoluteFillObject, alignItems: 'center', backgroundColor: colors.infoSurface, justifyContent: 'center', padding: 28 },
  title: { color: colors.text, fontSize: 18, fontWeight: '900', marginTop: 12 },
  text: { color: colors.muted, fontSize: 13, fontWeight: '700', lineHeight: 19, marginTop: 6, textAlign: 'center' },
  ready: { color: colors.success, fontSize: 12, fontWeight: '900', marginTop: 10 },
});

export default ServiceRouteMap;
