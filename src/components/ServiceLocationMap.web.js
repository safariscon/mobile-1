import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import useThemedStyles from '../theme/useThemedStyles';

export default function ServiceLocationMap({ latitude, longitude, formattedAddress = '', googleMapsUrl = '', osmUrl = '' }) {
  const { colors, styles } = useThemedStyles(createStyles);
  const lat = Number(latitude);
  const lng = Number(longitude);
  const hasPoint = Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);

  const openLink = (url) => {
    if (url) Linking.openURL(url).catch(() => {});
  };

  if (!hasPoint) {
    return (
      <View style={styles.emptyWrap}>
        <Feather name="map-pin" size={18} color={colors.muted} />
        <Text style={styles.emptyText}>{formattedAddress || 'Location coordinates are not available yet.'}</Text>
      </View>
    );
  }

  const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01}%2C${lat - 0.01}%2C${lng + 0.01}%2C${lat + 0.01}&layer=mapnik&marker=${lat}%2C${lng}`;

  return (
    <View style={styles.wrap}>
      <View style={styles.mapFrame}>
        <iframe title="Service location map" src={embedUrl} style={{ border: 0, width: '100%', height: '100%' }} loading="lazy" />
      </View>
      {formattedAddress ? <Text style={styles.address}>{formattedAddress}</Text> : null}
      <View style={styles.linkRow}>
        <TouchableOpacity style={styles.linkButton} onPress={() => openLink(googleMapsUrl || `https://www.google.com/maps?q=${lat},${lng}`)} activeOpacity={0.84}>
          <Feather name="external-link" size={14} color={colors.primary} />
          <Text style={styles.linkText}>Open in Google Maps</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkButton} onPress={() => openLink(osmUrl || `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`)} activeOpacity={0.84}>
          <Feather name="map" size={14} color={colors.primary} />
          <Text style={styles.linkText}>Open in OpenStreetMap</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  wrap: { marginTop: 8 },
  mapFrame: { borderRadius: 10, height: 180, overflow: 'hidden', width: '100%' },
  address: { color: colors.muted, fontSize: 12, fontWeight: '700', lineHeight: 17, marginTop: 10 },
  linkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  linkButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  linkText: { color: colors.primary, fontSize: 11, fontWeight: '900' },
  emptyWrap: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    padding: 12,
  },
  emptyText: { color: colors.muted, flex: 1, fontSize: 12, fontWeight: '700', lineHeight: 17 },
});
