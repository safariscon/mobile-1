import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { POLICY_PAGES } from '../lib/policies';
import { usePolicy } from '../context/PolicyContext';
import useThemedStyles from '../theme/useThemedStyles';

const POLICY_ICONS = {
  'how-it-works': 'compass',
  terms: 'file-text',
  privacy: 'shield',
  payments: 'credit-card',
};

export default function PolicyLinks({ compact = false, onOpen }) {
  const themed = useThemedStyles(createStyles);
  const styles = themed.styles;
  const colors = themed.colors;
  const { openPolicy } = usePolicy();

  return (
    <View style={[styles.wrap, compact && styles.compact]}>
      {POLICY_PAGES.map((page) => (
        <TouchableOpacity key={page.key} style={styles.row} onPress={() => (onOpen || openPolicy)(page.key)} activeOpacity={0.86}>
          <View style={styles.iconWrap}>
            <Feather name={POLICY_ICONS[page.key] || 'file-text'} size={16} color={colors.primary} />
          </View>
          <Text style={styles.label}>{page.label}</Text>
          <Feather name="chevron-right" size={16} color={colors.muted} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const createStyles = (themeColors) => StyleSheet.create({
  wrap: { gap: 8, marginTop: 8 },
  compact: { marginTop: 4 },
  row: {
    alignItems: 'center',
    backgroundColor: themeColors.surfaceMuted,
    borderColor: themeColors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  iconWrap: {
    alignItems: 'center',
    backgroundColor: themeColors.primaryLight,
    borderRadius: 10,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  label: { color: themeColors.text, flex: 1, fontSize: 13, fontWeight: '800' },
});
