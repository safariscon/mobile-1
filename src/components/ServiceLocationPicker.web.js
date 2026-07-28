import { StyleSheet, Text, View } from 'react-native';
import useThemedStyles from '../theme/useThemedStyles';

export default function ServiceLocationPicker() {
  const { styles } = useThemedStyles(createStyles);
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Exact map location</Text>
      <Text style={styles.help}>Map picking is available in the native app. On web preview, use latitude and longitude fields below.</Text>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  wrap: { backgroundColor: colors.infoSurface, borderColor: colors.border, borderRadius: 10, borderWidth: 1, marginTop: 12, padding: 12 },
  title: { color: colors.text, fontSize: 14, fontWeight: '900' },
  help: { color: colors.primaryDark, fontSize: 12, fontWeight: '700', lineHeight: 17, marginTop: 4 },
});
